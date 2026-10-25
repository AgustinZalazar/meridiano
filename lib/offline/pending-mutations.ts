import { supabase } from '../supabase';
import { enqueue } from './store';

type PendienteStatus = 'pendiente' | 'en_revision' | 'resuelto';

/**
 * Updates a pending item's status.
 * Online: direct write. Offline: enqueues for later sync.
 * Returns true if the write succeeded or was enqueued.
 */
export async function updatePendienteStatus(
  id: string,
  status: PendienteStatus,
  isOnline: boolean,
): Promise<boolean> {
  if (isOnline) {
    const { error } = await supabase.from('pending_items').update({ status }).eq('id', id);
    return !error;
  }

  await enqueue({ type: 'update_pendiente_status', payload: { id, status }, localId: id });
  return true;
}
