import { supabase } from '../supabase';
import * as store from './store';
import * as FileSystem from 'expo-file-system/legacy';
import type { QueuedOp } from './types';
import { getVideoMime } from '../../utils/video';

export { getPendingCount } from './store';

async function executeOp(op: QueuedOp, idMap: Record<string, string>): Promise<string | null> {
  const payload = store.resolveIds(op.payload, idMap);

  switch (op.type) {
    case 'create_project': {
      const { data, error } = await supabase.from('projects').insert(payload).select('id').single();
      if (error) throw error;
      return data.id as string;
    }
    case 'create_report': {
      const { data, error } = await supabase.from('reports').insert(payload).select('id').single();
      if (error) throw error;
      return data.id as string;
    }
    case 'create_rubro': {
      const { data, error } = await supabase.from('rubros').insert(payload).select('id').single();
      if (error) throw error;
      return data.id as string;
    }
    case 'update_pendiente_status': {
      const { id, status } = payload;
      const resolvedId = store.resolveId(id as string, idMap);
      const { error } = await supabase.from('pending_items').update({ status }).eq('id', resolvedId);
      if (error) throw error;
      return resolvedId;
    }
    case 'add_report_media_foto': {
      const { report_id, local_path, storage_path, note } = payload;
      const base64 = await FileSystem.readAsStringAsync(local_path, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const chars = atob(base64);
      const bytes = new Uint8Array(chars.length);
      for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
      const { error: uploadError } = await supabase.storage
        .from('project-images')
        .upload(storage_path, bytes.buffer, { contentType: 'image/png', upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('project-images').getPublicUrl(storage_path);
      const { error } = await supabase.from('report_media').insert({
        report_id, type: 'foto', uri: urlData.publicUrl, note: note ?? null,
      });
      if (error) throw error;
      FileSystem.deleteAsync(local_path, { idempotent: true }).catch(() => {});
      return report_id;
    }
    case 'add_report_media_video': {
      const { report_id, local_video_path, local_thumb_path, video_ext,
              storage_video_path, storage_thumb_path, note } = payload;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const thumbRes = await FileSystem.uploadAsync(
        `${supabaseUrl}/storage/v1/object/processing/${storage_thumb_path}`,
        local_thumb_path,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'image/jpeg',
            'x-upsert': 'true',
          },
        },
      );
      if (!thumbRes || thumbRes.status >= 300) throw new Error(`Thumb upload failed: ${thumbRes?.status}`);
      const videoRes = await FileSystem.uploadAsync(
        `${supabaseUrl}/storage/v1/object/processing/${storage_video_path}`,
        local_video_path,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': getVideoMime(video_ext),
            'x-upsert': 'true',
          },
        },
      );
      if (!videoRes || videoRes.status >= 300) throw new Error(`Video upload failed: ${videoRes?.status}`);
      const thumbUrl = `${supabaseUrl}/storage/v1/object/public/processing/${storage_thumb_path}`;
      const { error } = await supabase.from('report_media').insert({
        report_id, type: 'video', uri: thumbUrl, video_path: storage_video_path, note: note ?? null,
      });
      if (error) throw error;
      FileSystem.deleteAsync(local_video_path, { idempotent: true }).catch(() => {});
      FileSystem.deleteAsync(local_thumb_path, { idempotent: true }).catch(() => {});
      return report_id;
    }
    default:
      throw new Error(`Unknown op type`);
  }
}

export async function runSync(
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const queue = await store.getQueue();
  const pending = queue.filter((op) => op.status === 'pending');
  let done = 0;

  for (const op of pending) {
    try {
      const idMap = await store.getIdMap();
      const serverId = await executeOp(op, idMap);
      if (serverId && serverId !== op.localId) {
        await store.setIdMapping(op.localId, serverId);
      }
      await store.dequeue(op.opId);
      done++;
      onProgress?.(done, pending.length);
    } catch (e) {
      await store.markFailed(op.opId);
      console.warn('[SyncEngine] op failed:', op.opId, e);
    }
  }
}
