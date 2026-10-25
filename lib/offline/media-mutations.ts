import * as FileSystem from 'expo-file-system/legacy';
import { enqueue } from './store';
import { OFFLINE_MEDIA_DIR } from './types';

async function ensureDir(): Promise<string> {
  const dir = `${FileSystem.documentDirectory ?? ''}${OFFLINE_MEDIA_DIR}`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

export async function enqueueReportFoto(opts: {
  report_id: string;
  source_uri: string;
  storage_path: string;
  note: string | null;
}): Promise<string> {
  const dir = await ensureDir();
  const ts = Date.now();
  const local_path = `${dir}foto_${ts}.png`;
  await FileSystem.copyAsync({ from: opts.source_uri, to: local_path });
  const localId = `offline-foto-${ts}`;
  await enqueue({
    type: 'add_report_media_foto',
    payload: {
      report_id: opts.report_id,
      local_path,
      storage_path: opts.storage_path,
      note: opts.note,
    },
    localId,
  });
  return localId;
}

export async function enqueueReportVideo(opts: {
  report_id: string;
  source_video_uri: string;
  source_thumb_uri: string;
  video_ext: string;
  storage_video_path: string;
  storage_thumb_path: string;
  note: string | null;
}): Promise<{ localId: string; local_video_path: string; local_thumb_path: string }> {
  const dir = await ensureDir();
  const ts = Date.now();
  const local_video_path = `${dir}video_${ts}.${opts.video_ext}`;
  const local_thumb_path = `${dir}thumb_${ts}.jpg`;
  await Promise.all([
    FileSystem.copyAsync({ from: opts.source_video_uri, to: local_video_path }),
    FileSystem.copyAsync({ from: opts.source_thumb_uri, to: local_thumb_path }),
  ]);
  const localId = `offline-video-${ts}`;
  await enqueue({
    type: 'add_report_media_video',
    payload: {
      report_id: opts.report_id,
      local_video_path,
      local_thumb_path,
      video_ext: opts.video_ext,
      storage_video_path: opts.storage_video_path,
      storage_thumb_path: opts.storage_thumb_path,
      note: opts.note,
    },
    localId,
  });
  return { localId, local_video_path, local_thumb_path };
}
