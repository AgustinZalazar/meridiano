import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueuedOp } from './types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Cache ────────────────────────────────────────────────────────────────────

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [`cache:${key}`, JSON.stringify(data)],
      [`cache:meta:${key}`, JSON.stringify({ savedAt: Date.now() })],
    ]);
  } catch {}
}

// ── Queue ────────────────────────────────────────────────────────────────────

export async function getQueue(): Promise<QueuedOp[]> {
  try {
    const raw = await AsyncStorage.getItem('queue');
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.filter((op) => op.status === 'pending').length;
}

async function saveQueue(queue: QueuedOp[]): Promise<void> {
  await AsyncStorage.setItem('queue', JSON.stringify(queue));
}

export async function enqueue(
  op: Pick<QueuedOp, 'type' | 'payload' | 'localId'> & { dependsOn?: string }
): Promise<void> {
  try {
    const queue = await getQueue();
    queue.push({
      opId: uuid(),
      type: op.type,
      payload: op.payload,
      localId: op.localId,
      dependsOn: op.dependsOn,
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    });
    await saveQueue(queue);
  } catch {}
}

export async function dequeue(opId: string): Promise<void> {
  try {
    const queue = await getQueue();
    await saveQueue(queue.filter((op) => op.opId !== opId));
  } catch {}
}

export async function markFailed(opId: string): Promise<void> {
  try {
    const queue = await getQueue();
    const op = queue.find((o) => o.opId === opId);
    if (op) {
      op.status = 'failed';
      op.retryCount += 1;
      await saveQueue(queue);
    }
  } catch {}
}

export async function optimisticAdd<T extends { id: string }>(
  cacheKey: string,
  item: T & { _offline?: boolean }
): Promise<void> {
  try {
    const current = (await getCache<T[]>(cacheKey)) ?? [];
    await setCache(cacheKey, [...current, { ...item, _offline: true }]);
  } catch {}
}

// ── ID map ───────────────────────────────────────────────────────────────────

export async function getIdMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem('id-map');
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function setIdMapping(localId: string, serverId: string): Promise<void> {
  try {
    const map = await getIdMap();
    map[localId] = serverId;
    await AsyncStorage.setItem('id-map', JSON.stringify(map));
  } catch {}
}

export function resolveId(id: string, idMap: Record<string, string>): string {
  return idMap[id] ?? id;
}

export function resolveIds(
  payload: Record<string, any>,
  idMap: Record<string, string>
): Record<string, any> {
  const resolved: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    resolved[k] = typeof v === 'string' ? (idMap[v] ?? v) : v;
  }
  return resolved;
}
