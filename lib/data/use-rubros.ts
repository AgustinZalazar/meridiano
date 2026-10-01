import { useCallback, useState } from 'react';
import { supabase } from '../supabase';
import * as store from '../offline/store';
import { useNetworkState } from '../offline/network';

export type DbRubro = {
  id: string;
  code: string;
  name: string;
  contractor: string | null;
  status: 'sin_iniciar' | 'en_curso' | 'completada';
  start_date: string | null;
  end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  _offline?: boolean;
};

const SELECT =
  'id, code, name, contractor, status, start_date, end_date, actual_start_date, actual_end_date';

export function useRubros(projectId: string) {
  const isOnline = useNetworkState();
  const [rubros, setRubros] = useState<DbRubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  const refetch = useCallback(async () => {
    if (!projectId) return;
    const cacheKey = `rubros:${projectId}`;
    setLoading(true);

    const cached = await store.getCache<DbRubro[]>(cacheKey);
    if (cached?.length) {
      setRubros(cached);
      setFromCache(true);
      setLoading(false);
    }

    if (isOnline) {
      const { data } = await supabase
        .from('rubros')
        .select(SELECT)
        .eq('project_id', projectId)
        .order('created_at');
      if (data) {
        const fresh = data as DbRubro[];
        setRubros(fresh);
        await store.setCache(cacheKey, fresh);
        setFromCache(false);
      }
      setLoading(false);
    } else if (!cached?.length) {
      setLoading(false);
    }
  }, [projectId, isOnline]);

  return { rubros, loading, fromCache, refetch };
}
