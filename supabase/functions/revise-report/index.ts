import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate JWT and extract user
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { report_id, instructions } = body;

    if (!report_id || !instructions?.trim()) {
      return new Response(JSON.stringify({ error: 'report_id e instructions son requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limit instructions length to reduce prompt injection surface
    const sanitizedInstructions = String(instructions).trim().slice(0, 1000);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify user has access to this report via studio membership
    const { data: report, error: reportError } = await supabaseAdmin
      .from('reports')
      .select('id, project_id, projects(studio_id)')
      .eq('id', report_id)
      .single<{ id: string; project_id: string; projects: { studio_id: string } | null }>();

    if (reportError || !report) {
      return new Response(JSON.stringify({ error: 'Informe no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const studioId = report.projects?.studio_id;
    if (!studioId) {
      return new Response(JSON.stringify({ error: 'El informe no tiene proyecto asociado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: membership } = await supabaseAdmin
      .from('studio_members')
      .select('role')
      .eq('studio_id', studioId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Sin acceso a este informe' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch current pending items
    const { data: currentItems, error: itemsError } = await supabaseAdmin
      .from('pending_items')
      .select('id, description, trade, status')
      .eq('report_id', report_id);

    if (itemsError) throw new Error(`Error al leer pendientes: ${itemsError.message}`);

    // Build prompt with clear delimiters to reduce injection risk
    const prompt = `Sos un asistente experto en gestión de obras de construcción.

## PENDIENTES ACTUALES (JSON)
${JSON.stringify(currentItems, null, 2)}

## INSTRUCCIONES DEL USUARIO
"""
${sanitizedInstructions}
"""

## TAREA
Devolvé el listado actualizado aplicando las instrucciones. Reglas:
- Conservá el "id" de los ítems que NO cambian o se modifican
- Omití los ítems eliminados
- Los ítems nuevos llevan id: null
- Cada ítem: id (string | null), description (string), trade (string | null), status ("pendiente" | "en_revision" | "resuelto")
- Respondé SOLO con un objeto JSON: { "items": [...] }`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Sos un asistente de gestión de obras. Seguí las instrucciones y respondé exclusivamente con JSON válido.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices[0]?.message?.content;
    if (!content) throw new Error('La IA no devolvió contenido');

    const parsed = JSON.parse(content);
    const updatedItems: { id: string | null; description: string; trade: string | null; status: string }[] =
      parsed.items ?? [];

    if (!Array.isArray(updatedItems)) throw new Error('La IA devolvió un formato inválido');

    const currentIds = new Set((currentItems ?? []).map((i) => i.id));
    const updatedIds = new Set(updatedItems.filter((i) => i.id).map((i) => i.id));

    const toDelete = [...currentIds].filter((id) => !updatedIds.has(id));
    const toUpdate = updatedItems.filter((i) => i.id && currentIds.has(i.id));
    const toInsert = updatedItems.filter((i) => !i.id);

    if (toDelete.length > 0) {
      const { error } = await supabaseAdmin.from('pending_items').delete().in('id', toDelete);
      if (error) throw new Error(`Error al eliminar ítems: ${error.message}`);
    }

    for (const item of toUpdate) {
      const { error } = await supabaseAdmin
        .from('pending_items')
        .update({ description: item.description, trade: item.trade, status: item.status })
        .eq('id', item.id!);
      if (error) throw new Error(`Error al actualizar ítem ${item.id}: ${error.message}`);
    }

    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from('pending_items').insert(
        toInsert.map((item) => ({
          report_id,
          description: item.description,
          trade: item.trade,
          status: item.status ?? 'pendiente',
          source: 'ai',
        }))
      );
      if (error) throw new Error(`Error al insertar ítems: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ ok: true, deleted: toDelete.length, updated: toUpdate.length, inserted: toInsert.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[revise-report]', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
