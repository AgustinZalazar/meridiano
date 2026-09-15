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

    const { report_id } = await req.json();
    if (!report_id) {
      return new Response(JSON.stringify({ error: 'report_id requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch report with transcription
    const { data: report, error: reportErr } = await supabaseAdmin
      .from('reports')
      .select('id, transcription, project_id, projects(studio_id)')
      .eq('id', report_id)
      .single<{ id: string; transcription: string | null; project_id: string; projects: { studio_id: string } | null }>();

    if (reportErr || !report) {
      return new Response(JSON.stringify({ error: 'Informe no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify membership
    const studioId = report.projects?.studio_id;
    if (studioId) {
      const { data: membership } = await supabaseAdmin
        .from('studio_members')
        .select('role')
        .eq('studio_id', studioId)
        .eq('user_id', user.id)
        .single();
      if (!membership) {
        return new Response(JSON.stringify({ error: 'Sin acceso' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!report.transcription) {
      return new Response(JSON.stringify({ error: 'El informe no tiene transcripción' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch frames and items
    const [framesRes, itemsRes] = await Promise.all([
      supabaseAdmin
        .from('report_frames')
        .select('id, storage_path, timestamp_sec, order_index')
        .eq('report_id', report_id)
        .order('order_index'),
      supabaseAdmin
        .from('pending_items')
        .select('id, description, trade')
        .eq('report_id', report_id),
    ]);

    const frames = framesRes.data ?? [];
    const items  = itemsRes.data ?? [];

    if (frames.length === 0 || items.length === 0) {
      return new Response(JSON.stringify({ ok: true, matched: 0, reason: 'Sin frames o items' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate signed URLs for all frames so GPT-4o can see the actual images
    const frameSignedUrls: Record<string, string> = {};
    await Promise.all(
      frames.slice(0, 24).map(async (frame) => {
        const { data } = await supabaseAdmin.storage
          .from('report-frames')
          .createSignedUrl(frame.storage_path, 600);
        if (data?.signedUrl) frameSignedUrls[frame.id] = data.signedUrl;
      })
    );

    const framesWithUrls = frames.filter((f) => frameSignedUrls[f.id]);

    const itemsDesc = items.map((it) =>
      `  { "item_id": "${it.id}", "pendiente": ${JSON.stringify(it.description)}, "rubro": ${JSON.stringify(it.trade ?? 'General')} }`
    ).join(',\n');

    const transcriptionTrimmed = report.transcription.slice(0, 4000);

    // Build interleaved content: label + image for each frame
    const frameContent: { type: string; text?: string; image_url?: { url: string; detail: string } }[] =
      framesWithUrls.flatMap((frame) => [
        { type: 'text', text: `[Frame ID="${frame.id}" t=${frame.timestamp_sec}s]` },
        { type: 'image_url', image_url: { url: frameSignedUrls[frame.id], detail: 'low' } },
      ]);

    const userContent = [
      {
        type: 'text',
        text: `TRANSCRIPCIÓN:\n"""${transcriptionTrimmed}"""\n\nPENDIENTES:\n[${itemsDesc}]\n\nA continuación verás los frames del video, cada uno precedido por su ID y timestamp. Para cada pendiente, elegí el frame cuya imagen muestra mejor la situación descripta (mismo sector, mismo defecto, misma zona).`,
      },
      ...frameContent,
    ];

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Sos un inspector de obras experto. Analizás frames de video de recorridos de obra y los asociás a los pendientes detectados. Para cada pendiente elegís el frame que mejor muestra VISUALMENTE esa situación — no el más cercano en tiempo, sino el que realmente se ve en la imagen. Respondés exclusivamente con JSON válido: { "matches": [ { "item_id": "...", "frame_id": "..." } ] }',
          },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1024,
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
    const matches: { item_id: string; frame_id: string }[] = parsed.matches ?? [];

    if (!Array.isArray(matches)) throw new Error('Formato de respuesta inválido');

    // Validate all IDs exist
    const validFrameIds = new Set(frames.map((f) => f.id));
    const validItemIds  = new Set(items.map((i) => i.id));

    const validMatches = matches.filter(
      (m) => validItemIds.has(m.item_id) && validFrameIds.has(m.frame_id)
    );

    // Apply matches: update pending_items.frame_id
    let updated = 0;
    for (const match of validMatches) {
      const { error } = await supabaseAdmin
        .from('pending_items')
        .update({ frame_id: match.frame_id })
        .eq('id', match.item_id);
      if (!error) updated++;
    }

    return new Response(
      JSON.stringify({ ok: true, matched: updated, total_items: items.length, total_frames: frames.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[match-frames-to-items]', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
