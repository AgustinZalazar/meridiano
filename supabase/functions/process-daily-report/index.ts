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

    // Convert storage URLs to signed URLs so OpenAI can download them
    // regardless of bucket visibility settings
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const resolvedItems = await Promise.all(
      media_items.map(async (item) => {
        try {
          // Extract bucket and path from URL patterns:
          // /storage/v1/object/public/{bucket}/{path}
          // /storage/v1/object/{bucket}/{path}
          const match = item.url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)/);
          if (!match) return item;
          const [, bucket, path] = match;
          const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 3600);
          if (error || !data?.signedUrl) return item;
          return { ...item, url: data.signedUrl };
        } catch {
          return item;
        }
      })
    );

    // Build content blocks.
    // Items WITH a note: send text only (no image) — prevents GPT-4o from overriding the
    // inspector's own words with its visual interpretation.
    // Items WITHOUT a note: send image so GPT-4o can describe what it sees.
    const imageContent: { type: string; text?: string; image_url?: { url: string; detail: string } }[] = [];

    resolvedItems.forEach((item, index) => {
      const kind = item.type === 'foto' ? 'Foto' : 'Video';
      if (item.note) {
        imageContent.push({
          type: 'text',
          text: `--- ELEMENTO ${index + 1} (${kind}) ---\nDESCRIPCIÓN EXACTA DEL INSPECTOR: "${item.note}"\n[sin imagen — usá solo este texto]`,
        });
      } else {
        imageContent.push({
          type: 'text',
          text: `--- ELEMENTO ${index + 1} (${kind}) ---\n[sin nota — describí el problema visible en la imagen]:`,
        });
        imageContent.push({ type: 'image_url', image_url: { url: item.url, detail: 'high' } });
      }
    });

    const typeLabel = dailyReport.type === 'oficina' ? 'oficina técnica' : 'contratistas';

    const systemPrompt = `Sos un sistema de registro de inspecciones de obras. Convertís los elementos documentados por un inspector en pendientes estructurados. Para elementos con "DESCRIPCIÓN EXACTA DEL INSPECTOR": copiá esa frase tal cual como description (solo corregí errores tipográficos obvios), y clasificá el trade según el texto. Para elementos sin nota: describí brevemente el problema visible en la imagen y clasificá el trade. Respondés exclusivamente con JSON válido, sin texto adicional.`;

    const userPrompt = `Procesá ${resolvedItems.length} elemento${resolvedItems.length !== 1 ? 's' : ''} del informe del día (${typeLabel}).

Reglas estrictas:
1. Elemento con DESCRIPCIÓN EXACTA DEL INSPECTOR → description = esa frase (copiada, mínimos cambios). Trade = clasificá por el texto.
2. Elemento sin nota → description = descripción breve del problema visual. Trade = clasificá por la imagen.
3. Un elemento = exactamente un ítem, en el mismo orden. No combines ni separes.

JSON de respuesta:
{
  "items": [
    { "description": "...", "trade": "especialidad o null" }
  ],
  "summary": "resumen de 1-2 oraciones de la jornada"
}

Trades válidos: albanilería, electricidad, plomería, carpintería, pintura, herrería, vidriería, HVAC, impermeabilización, estructura, general.`;

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

    // Copy report_media from daily report to the generated formal report
    const { data: dailyMedia } = await supabaseAdmin
      .from('report_media')
      .select('type, uri, note')
      .eq('report_id', daily_report_id);

    if (dailyMedia && dailyMedia.length > 0) {
      await supabaseAdmin.from('report_media').insert(
        dailyMedia.map((m) => ({ report_id: report.id, type: m.type, uri: m.uri, note: m.note }))
      );
    }

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
          created_by:  user.id,
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
