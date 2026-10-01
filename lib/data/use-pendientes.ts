import { useCallback, useState } from 'react';
import { supabase } from '../supabase';
import * as store from '../offline/store';
import { useNetworkState } from '../offline/network';

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportType = 'contratistas' | 'oficina';
type PendingStatus = 'pendiente' | 'en_revision' | 'resuelto';

// Shape returned by the global tab (all projects)
export type DbPendingGlobal = {
  id: string;
  description: string;
  trade: string | null;
  status: PendingStatus;
  source: 'ai' | 'manual';
  created_at: string;
  projects: { name: string } | null;
  rubros: { name: string } | null;
  reports: { type: ReportType } | null;
  profiles: { full_name: string } | null;
};

// Shape returned when scoped to a project
export type DbPendingItem = {
  id: string;
  description: string;
  rubro_id: string;
  trade: string | null;
  status: PendingStatus;
  source: 'ai' | 'manual';
  reports: { type: ReportType } | null;
  created_at: string;
  profiles: { full_name: string } | null;
  _offline?: boolean;
};

// ── Tab — all projects ────────────────────────────────────────────────────────

const TAB_SELECT =
  'id, description, trade, status, source, created_at, projects(name), rubros(name), reports(type), profiles!created_by(full_name)';

export function usePendientesTab() {
  const isOnline = useNetworkState();
  const [items, setItems] = useState<DbPendingGlobal[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);

    const cached = await store.getCache<DbPendingGlobal[]>('pendientes:tab');
    if (cached?.length) {
      setItems(cached);
      setFromCache(true);
      setLoading(false);
    }

    if (isOnline) {
      const { data } = await supabase
        .from('pending_items')
        .select(TAB_SELECT)
        .order('created_at', { ascending: false });
      if (data) {
        const fresh = data as unknown as DbPendingGlobal[];
        setItems(fresh);
        await store.setCache('pendientes:tab', fresh);
        setFromCache(false);
      }
      setLoading(false);
    } else if (!cached?.length) {
      setLoading(false);
    }
  }, [isOnline]);

  return { items, loading, fromCache, refetch };
}

// ── Per-project ───────────────────────────────────────────────────────────────

const PROJECT_SELECT =
  'id, description, rubro_id, trade, status, source, reports(type), created_at, profiles!created_by(full_name)';

export function useProjectPendientes(projectId: string) {
  const isOnline = useNetworkState();
  const [items, setItems] = useState<DbPendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  const refetch = useCallback(async () => {
    if (!projectId) return;
    const cacheKey = `pendientes:${projectId}`;
    setLoading(true);

    const cached = await store.getCache<DbPendingItem[]>(cacheKey);
    if (cached?.length) {
      setItems(cached);
      setFromCache(true);
      setLoading(false);
    }

    if (isOnline) {
      const { data } = await supabase
        .from('pending_items')
        .select(PROJECT_SELECT)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (data) {
        const fresh = data as unknown as DbPendingItem[];
        setItems(fresh);
        await store.setCache(cacheKey, fresh);
        setFromCache(false);
      }
      setLoading(false);
    } else if (!cached?.length) {
      setLoading(false);
    }
  }, [projectId, isOnline]);

  return { items, loading, fromCache, refetch };
}
