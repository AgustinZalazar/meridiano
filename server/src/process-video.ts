import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';
import { supabase } from './supabase';

const exec = promisify(execFile);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface Report {
  id: string;
  project_id: string;
  rubro_id: string | null;
  type: 'contratistas' | 'oficina';
  mode: string;
  note: string | null;
  video_path: string | null;
}

export async function processVideoReport(reportId: string): Promise<void> {
  const { data: report, error } = await supabase
    .from('reports')
    .select('id, project_id, rubro_id, type, mode, note, video_path')
    .eq('id', reportId)
    .single<Report>();

  if (error || !report) {
    console.error(`[${reportId}] Report not found:`, error?.message);
    return;
  }

  if (report.mode !== 'video' || !report.video_path) {
    console.log(`[${reportId}] Skipped (not a video report or no video_path)`);
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `meridiano-${reportId.slice(0, 8)}-`));
  console.log(`[${reportId}] Processing started, tmpDir: ${tmpDir}`);

  try {
    // 1. Download video from Supabase Storage
    const { data: blob, error: dlErr } = await supabase.storage
      .from('processing')
      .download(report.video_path);

    if (dlErr || !blob) throw new Error(`Download failed: ${dlErr?.message}`);

    const ext = report.video_path.split('.').pop() ?? 'mp4';
    const videoPath = path.join(tmpDir, `video.${ext}`);
    fs.writeFileSync(videoPath, Buffer.from(await blob.arrayBuffer()));
    console.log(`[${reportId}] Video downloaded`);

    // 2. Extract frames (1 every 5s, max 720p width)
    const framesDir = path.join(tmpDir, 'frames');
    fs.mkdirSync(framesDir);
    await exec('ffmpeg', [
      '-i', videoPath,
      '-vf', 'fps=1/5,scale=min(1280\\,iw):-2',
      '-q:v', '3',
      path.join(framesDir, 'frame_%03d.jpg'),
    ]);

    // 3. Extract audio
    const audioPath = path.join(tmpDir, 'audio.mp3');
    try {
      await exec('ffmpeg', ['-i', videoPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '4', audioPath]);
    } catch {
      // Silent videos are fine — no audio to transcribe
    }

    // 4. Transcribe audio with Whisper
    let transcription = '';
    if (fs.existsSync(audioPath)) {
      try {
        const result = await openai.audio.transcriptions.create({
          file: fs.createReadStream(audioPath) as any,
          model: 'whisper-1',
          language: 'es',
        });
        transcription = result.text;
        console.log(`[${reportId}] Transcription done (${transcription.length} chars)`);
      } catch (e) {
        console.warn(`[${reportId}] Transcription failed:`, e);
      }
    }

    // 5. Upload frames to report-frames bucket, describe each with GPT-4o Vision & build DB records
    const frameFiles = fs.readdirSync(framesDir).sort();
    const frameBase64: string[] = [];
    const frameDbRecords: {
      report_id: string;
      storage_path: string;
      timestamp_sec: number;
      order_index: number;
      visual_description: string | null;
    }[] = [];

    for (let i = 0; i < frameFiles.length; i++) {
      const file = frameFiles[i];
      const buf = fs.readFileSync(path.join(framesDir, file));
      const storagePath = `${reportId}/${file}`;

      const { error: uploadErr } = await supabase.storage
        .from('report-frames')
        .upload(storagePath, buf, { contentType: 'image/jpeg', upsert: true });

      if (uploadErr) {
        console.error(`[${reportId}] Frame upload failed (${file}):`, uploadErr.message);
        continue;
      }

      // Describe frame with GPT-4o Vision for better AI matching
      let visual_description: string | null = null;
      try {
        const b64 = buf.toString('base64');
        const visionRes = await openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 150,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describí en una oración corta (máx 120 caracteres) qué se ve en esta imagen de una obra de construcción. Enfocate en los elementos constructivos visibles, materiales, trabajos en ejecución o defectos.',
              },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'low' } },
            ],
          }],
        });
        visual_description = visionRes.choices[0]?.message?.content?.trim() ?? null;
      } catch (e) {
        console.warn(`[${reportId}] Vision description failed for frame ${i}:`, e);
      }

      frameBase64.push(buf.toString('base64'));
      frameDbRecords.push({
        report_id: reportId,
        storage_path: storagePath,
        timestamp_sec: i * 5,
        order_index: i,
        visual_description,
      });
    }

    if (frameDbRecords.length === 0) {
      console.error(`[${reportId}] WARNING: 0 frames uploaded — check that the 'report-frames' bucket exists in Supabase Storage`);
    } else {
      await supabase.from('report_frames').insert(frameDbRecords);
    }
    console.log(`[${reportId}] ${frameDbRecords.length} frames uploaded`);

    // 6. Analyze with GPT-4o
    const typeCtx = report.type === 'contratistas'
      ? 'Informe de contratistas: registrá trabajos faltantes, errores de ejecución, incumplimientos de proyecto y aspectos de calidad/seguridad.'
      : 'Observación de oficina técnica: registrá desvíos respecto al proyecto, errores de replanteo, discrepancias de medidas y aspectos técnicos.';

    const imageMessages = frameBase64.map((b64) => ({
      type: 'image_url' as const,
      image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'low' as const },
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 3000,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Sos un inspector de obras especializado. ${typeCtx}

Analizá las imágenes y la transcripción del recorrido y generá una lista COMPLETA de hallazgos y pendientes.

REGLAS:
1. NO repitas el mismo problema: si aparece en múltiples imágenes, listalo una sola vez incluyendo todas las ubicaciones afectadas.
2. Incluí siempre la ubicación exacta en la descripción: piso (P00, P01...), unidad (U01, U104...), sector (living, baño, dormitorio, etc.).
3. Incluí medidas específicas cuando se mencionen (ej: "viga invertida 7cm", "abertura 3.83m en obra vs 4.83m en proyecto").
4. Sé técnico y específico — evitá frases genéricas como "verificar terminaciones" sin detalle.
5. Si algo aplica a múltiples unidades o a todo el edificio, hacelo explícito en la descripción (ej: "P00 a P03 unidades 02/102/202/302").
6. El campo "trade" debe ser una especialidad constructiva: Mampostería, Hormigón, Estructura, Instalaciones sanitarias, Instalaciones eléctricas, Revestimientos, Carpintería, Impermeabilización, Tareas generales, u otra pertinente.

Respondé ÚNICAMENTE con un JSON array (sin markdown):
[{"description":"descripción con ubicación y detalle (máx 250 chars)","trade":"Especialidad"}]
Si no hay pendientes, respondé: []`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                report.note ? `Nota del inspector: "${report.note}"` : '',
                `Transcripción del recorrido:\n${transcription || '(sin audio)'}`,
              ].filter(Boolean).join('\n\n'),
            },
            ...imageMessages,
          ],
        },
      ],
    });

    const raw = (completion.choices[0].message.content ?? '[]').trim();
    let pendingItems: { description: string; trade: string | null }[] = [];
    try {
      pendingItems = JSON.parse(raw.replace(/^```json\n?|\n?```$/g, ''));
      if (!Array.isArray(pendingItems)) pendingItems = [];
    } catch {
      console.error(`[${reportId}] Failed to parse GPT response:`, raw.slice(0, 200));
    }

    // 7. Insert pending_items
    if (pendingItems.length > 0) {
      await supabase.from('pending_items').insert(
        pendingItems.map((item) => ({
          report_id:   reportId,
          project_id:  report.project_id,
          rubro_id:    report.rubro_id,
          description: item.description.slice(0, 500),
          trade:       item.trade ?? null,
          source:      'ai',
          status:      'pendiente',
        }))
      );
    }

    // 8. Mark report completed
    await supabase.from('reports').update({
      status:        'completed',
      transcription: transcription || null,
      ai_summary:    `${pendingItems.length} pendiente${pendingItems.length !== 1 ? 's' : ''} detectado${pendingItems.length !== 1 ? 's' : ''}`,
    }).eq('id', reportId);

    // 9. Delete video from processing bucket
    await supabase.storage.from('processing').remove([report.video_path]);

    console.log(`[${reportId}] Done — ${pendingItems.length} pending items`);

  } catch (err) {
    console.error(`[${reportId}] Error:`, err);
    await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
