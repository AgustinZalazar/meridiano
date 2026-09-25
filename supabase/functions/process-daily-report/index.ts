import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MediaItem {
  type: 'foto' | 'video';
  url: string;   // foto: annotated image URL — video: extracted thumbnail URL
  note: string | null;
}

interface RequestBody {
  daily_report_id: string;
  media_items: MediaItem[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const { daily_report_id, media_items } = body;

    if (!daily_report_id || !Array.isArray(media_items) || media_items.length === 0) {
      return new Response(JSON.stringify({ error: 'daily_report_id y media_items son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch the daily report container to get project/rubro/type context
    const { data: dailyReport, error: drErr } = await supabaseAdmin
      .from('reports')
      .select('id, project_id, rubro_id, type, status, projects(studio_id)')
      .eq('id', daily_report_id)
      .single<{
        id: string;
        project_id: string;
        rubro_id: string | null;
        type: string;
        status: string;
        projects: { studio_id: string | null } | null;
      }>();

    if (drErr || !dailyReport) {
      return new Response(JSON.stringify({ error: 'Informe del día no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify studio membership
    const studioId = dailyReport.projects?.studio_id;
    if (studioId) {
      const { data: membership } = await supabaseAdmin
        .from('studio_members')
        .select('role')
        .eq('studio_id', studioId)
        .eq('user_id', user.id)
        .single();
      if (!membership) {
        return new Response(JSON.stringify({ error: 'Sin acceso al proyecto' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Build the GPT-4o vision message — all images in a single call for combined context
    // Each image is preceded by a text label with its note, matching the analyze-foto pattern
    const imageContent: { type: string; text?: string; image_url?: { url: string; detail: string } }[] = [];

    media_items.forEach((item, index) => {
      const label = item.type === 'foto'
        ? `[FOTO ${index + 1}${item.note ? ` — "${item.note}"` : ''}]`
        : `[CAPTURA DE VIDEO ${index + 1}${item.note ? ` — "${item.note}"` : ''}]`;

      imageContent.push({ type: 'text', text: label });
      imageContent.push({ type: 'image_url', image_url: { url: item.url, detail: 'low' } });
    });

    const typeLabel = dailyReport.type === 'oficina' ? 'oficina técnica' : 'contratistas';

    const systemPrompt = `Sos un inspector experto en obras de construcción. Analizás el informe del día de un inspector, que contiene fotos y capturas de video del avance y los problemas registrados durante la jornada. Analizás todo el material en conjunto para detectar problemas, defectos y tareas pendientes. Respondés exclusivamente con JSON válido sin texto adicional.`;

    const userPrompt = `Analizá este informe del día de obra (${typeLabel}). Contiene ${media_items.length} elemento${media_items.length !== 1 ? 's' : ''}: ${media_items.filter(m => m.type === 'foto').length} foto${media_items.filter(m => m.type === 'foto').length !== 1 ? 's' : ''} y ${media_items.filter(m => m.type === 'video').length} captura${media_items.filter(m => m.type === 'video').length !== 1 ? 's' : ''} de video. Cada imagen está etiquetada con su número y nota del inspector.

Identificá todos los problemas, defectos o tareas pendientes visibles en el material. Consolidá problemas similares que aparezcan en múltiples imágenes en un solo ítem.

Respondé SOLO con este JSON:
{
  "items": [
    { "description": "descripción clara y específica del problema", "trade": "especialidad o null" }
  ],
  "summary": "resumen breve de 1-2 oraciones del informe del día"
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
              ...imageContent,
              { type: 'text', text: userPrompt },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        temperature: 0.2,
      }),
    });

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

    // Create the unified report for this daily report
    const { data: report, error: reportErr } = await supabaseAdmin
      .from('reports')
      .insert({
        project_id:  dailyReport.project_id,
        rubro_id:    dailyReport.rubro_id ?? null,
        created_by:  user.id,
        type:        dailyReport.type,
        mode:        'foto',
        status:      'completed',
        ai_summary:  parsed.summary ?? null,
        date:        new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single();

    if (reportErr || !report) throw new Error(`Error al crear el informe: ${reportErr?.message}`);

    // Insert all pending items
    if (items.length > 0) {
      const { error: itemsErr } = await supabaseAdmin.from('pending_items').insert(
        items.map((item) => ({
          report_id:   report.id,
          project_id:  dailyReport.project_id,
          rubro_id:    dailyReport.rubro_id ?? null,
          description: String(item.description).slice(0, 1000),
          trade:       item.trade ? String(item.trade).slice(0, 100) : null,
          status:      'pendiente',
          source:      'ai',
        }))
      );
      if (itemsErr) throw new Error(`Error al insertar pendientes: ${itemsErr.message}`);
    }

    // Mark the daily report container as closed
    await supabaseAdmin
      .from('reports')
      .update({ status: 'cerrado' })
      .eq('id', daily_report_id);

    return new Response(
      JSON.stringify({ report_id: report.id, items_count: items.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[process-daily-report]', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
