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
        console.log(`[${reportId}] Transcription: ${transcription.slice(0, 80)}...`);
      } catch (e) {
        console.warn(`[${reportId}] Transcription failed:`, e);
      }
    }

    // 5. Upload frames to report-frames bucket & build DB records
    const frameFiles = fs.readdirSync(framesDir).sort();
    const frameBase64: string[] = [];
    const frameDbRecords: { report_id: string; storage_path: string; timestamp_sec: number; order_index: number }[] = [];

    for (let i = 0; i < frameFiles.length; i++) {
      const file = frameFiles[i];
      const buf = fs.readFileSync(path.join(framesDir, file));
      const storagePath = `${reportId}/${file}`;

      await supabase.storage
        .from('report-frames')
        .upload(storagePath, buf, { contentType: 'image/jpeg', upsert: true });

      frameBase64.push(buf.toString('base64'));
      frameDbRecords.push({ report_id: reportId, storage_path: storagePath, timestamp_sec: i * 5, order_index: i });
    }

    if (frameDbRecords.length > 0) {
      await supabase.from('report_frames').insert(frameDbRecords);
    }
    console.log(`[${reportId}] ${frameDbRecords.length} frames uploaded`);

    // 6. Analyze with GPT-4o
    const typeCtx = report.type === 'contratistas'
      ? 'Informe de contratistas: enfocate en ejecución, calidad, seguridad y trabajos faltantes.'
      : 'Observación de oficina técnica: enfocate en desvíos de proyecto, documentación y aspectos técnicos.';

    const imageMessages = frameBase64.map((b64) => ({
      type: 'image_url' as const,
      image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'low' as const },
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Sos un inspector de obras especializado. ${typeCtx}
Analizá las imágenes y la transcripción del recorrido. Generá una lista de hallazgos o pendientes.
Respondé ÚNICAMENTE con un JSON array (sin markdown):
[{"description":"descripción clara y específica (máx 200 chars)","trade":"Especialidad o null"}]
Si no hay pendientes, respondé: []`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                report.note ? `Nota del inspector: "${report.note}"` : '',
                `Transcripción: ${transcription || '(sin audio)'}`,
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
