import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('[analyze-foto] incoming:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('[analyze-foto] has auth header:', !!authHeader);
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    console.log('[analyze-foto] user:', user?.id ?? null, 'authError:', authError?.message ?? null);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { project_id, rubro_id, type, foto_url, markers, comment } = body;
    console.log('[analyze-foto] body fields:', { project_id, foto_url: foto_url?.slice?.(0, 60), markers_len: markers?.length });

    if (!foto_url || !project_id) {
      return new Response(JSON.stringify({ error: 'foto_url y project_id son requeridos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify access: studio membership or project creator
    const { data: project, error: projectErr } = await supabaseAdmin
      .from('projects')
      .select('studio_id, created_by')
      .eq('id', project_id)
      .single<{ studio_id: string | null; created_by: string }>();

    console.log('[analyze-foto] project studio_id:', project?.studio_id ?? null, 'created_by:', project?.created_by ?? null, 'err:', projectErr?.message ?? null);

    if (!project) {
      return new Response(JSON.stringify({ error: 'Proyecto no encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let hasAccess = project.created_by === user.id;

    if (!hasAccess && project.studio_id) {
      const { data: membership } = await supabaseAdmin
        .from('studio_members')
        .select('role')
        .eq('studio_id', project.studio_id)
        .eq('user_id', user.id)
        .single();
      hasAccess = !!membership;
    }

    console.log('[analyze-foto] hasAccess:', hasAccess);

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Sin acceso al proyecto' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[analyze-foto] auth ok, calling OpenAI with url:', foto_url.slice(0, 80));

    // Build context from markers
    const markerList: { description: string; rx: number; ry: number }[] = Array.isArray(markers) ? markers : [];
    const markerContext = markerList.length > 0
      ? `\n\nMARCADORES NUMERADOS EN LA IMAGEN (posición relativa 0-1):\n${markerList.map((m, i) => `${i + 1}. "${m.description}" (x:${m.rx.toFixed(2)}, y:${m.ry.toFixed(2)})`).join('\n')}`
      : '';

    const commentContext = comment?.trim()
      ? `\n\nCOMENTARIO GENERAL DEL INSPECTOR: ${String(comment).trim().slice(0, 500)}`
      : '';

    const systemPrompt = `Sos un inspector experto en obras de construcción. Analizás fotos de obra anotadas para identificar problemas, defectos y tareas pendientes. Respondés exclusivamente con JSON válido sin texto adicional.`;

    const userPrompt = `Analizá esta foto de obra de construcción. Puede tener marcadores numerados, dibujos o anotaciones visuales.${markerContext}${commentContext}

Identificá todos los problemas, defectos o tareas pendientes visibles. Cada marcador numerado debe generar su propio ítem, más cualquier problema adicional que observes.

Respondé SOLO con este JSON:
{
  "items": [
    { "description": "descripción clara y específica del problema", "trade": "especialidad o null" }
  ],
  "summary": "resumen breve de 1-2 oraciones de la inspección"
}

Especialidades válidas: albanilería, electricidad, plomería, carpintería, pintura, herrería, vidriería, HVAC, impermeabilización, estructura, general.`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: foto_url, detail: 'low' },
              },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
        temperature: 0.2,
      }),
    });

    console.log('[analyze-foto] OpenAI response status:', openaiRes.status);

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      throw new Error(`OpenAI error ${openaiRes.status}: ${err}`);
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices[0]?.message?.content;
    if (!content) throw new Error('La IA no devolvió contenido');

    const parsed = JSON.parse(content);
    const items: { description: string; trade: string | null }[] = parsed.items ?? [];
    if (!Array.isArray(items)) throw new Error('La IA devolvió un formato inválido');

    // Create report
    const { data: report, error: reportErr } = await supabaseAdmin
      .from('reports')
      .insert({
        project_id,
        rubro_id: rubro_id || null,
        created_by: user.id,
        type: type ?? 'contratistas',
        mode: 'foto',
        note: comment?.trim() || null,
        status: 'completed',
        foto_url,
        ai_summary: parsed.summary ?? null,
      })
      .select('id')
      .single();

    if (reportErr || !report) throw new Error(`Error al crear el informe: ${reportErr?.message}`);

    // Insert pending items
    if (items.length > 0) {
      const { error: itemsErr } = await supabaseAdmin.from('pending_items').insert(
        items.map((item) => ({
          report_id: report.id,
          project_id,
          rubro_id: rubro_id || null,
          description: String(item.description).slice(0, 1000),
          trade: item.trade ? String(item.trade).slice(0, 100) : null,
          status: 'pendiente',
          source: 'ai',
        }))
      );
      if (itemsErr) throw new Error(`Error al insertar pendientes: ${itemsErr.message}`);
    }

    return new Response(
      JSON.stringify({ report_id: report.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[analyze-foto]', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
