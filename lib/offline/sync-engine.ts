import { supabase } from '../supabase';
import * as store from './store';
import type { QueuedOp } from './types';

async function executeOp(op: QueuedOp, idMap: Record<string, string>): Promise<string | null> {
  const payload = store.resolveIds(op.payload, idMap);

  switch (op.type) {
    case 'create_project': {
      const { data, error } = await supabase.from('projects').insert(payload).select('id').single();
      if (error) throw error;
      return data.id as string;
    }
    case 'create_informe': {
      const { data, error } = await supabase.from('informes').insert(payload).select('id').single();
      if (error) throw error;
      return data.id as string;
    }
    case 'create_rubro': {
      const { data, error } = await supabase.from('rubros').insert(payload).select('id').single();
      if (error) throw error;
      return data.id as string;
    }
    case 'edit_pendiente': {
      const { id, ...rest } = payload;
      const resolvedId = store.resolveId(id as string, idMap);
      await supabase.from('pending_items').update(rest).eq('id', resolvedId);
      return resolvedId;
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
