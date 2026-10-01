import { useCallback, useState } from 'react';
import { supabase } from '../supabase';
import * as store from '../offline/store';
import { useNetworkState } from '../offline/network';

export type DbProjectCard = {
  id: string;
  name: string;
  logo_url: string | null;
  property_type: string | null;
  rubros: { id: string; status: string }[];
  _offline?: boolean;
};

const CACHE_KEY = 'projects';
const SELECT = 'id, name, logo_url, property_type, rubros(id, status)';

export function useProjects() {
  const isOnline = useNetworkState();
  const [projects, setProjects] = useState<DbProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);

    // Serve cache first for instant display (stale-while-revalidate)
    const cached = await store.getCache<DbProjectCard[]>(CACHE_KEY);
    if (cached?.length) {
      setProjects(cached);
      setFromCache(true);
      setLoading(false);
    }

    if (isOnline) {
      const { data } = await supabase.from('projects').select(SELECT);
      if (data) {
        const fresh = data as DbProjectCard[];
        setProjects(fresh);
        await store.setCache(CACHE_KEY, fresh);
        setFromCache(false);
      }
      setLoading(false);
    } else if (!cached?.length) {
      setLoading(false);
    }
  }, [isOnline]);

  return { projects, loading, fromCache, refetch };
}
