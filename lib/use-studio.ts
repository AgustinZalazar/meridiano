import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';
import * as store from './offline/store';

export type StudioRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Studio {
  id: string;
  name: string;
  plan: string;
  videos_used: number;
  logo_url: string | null;
}

export function useStudio() {
  const { session } = useAuth();
  const [studio, setStudio] = useState<Studio | null>(null);
  const [role, setRole] = useState<StudioRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStudio = useCallback(async () => {
    if (!session?.user?.id) {
      setStudio(null);
      setRole(null);
      setLoading(false);
      return;
    }

    const cacheKey = `studio:${session.user.id}`;

    const cached = await store.getCache<{ studio: Studio; role: StudioRole }>(cacheKey);
    if (cached) {
      setStudio(cached.studio);
      setRole(cached.role);
      setLoading(false);
    }

    try {
      const { data: memberData } = await supabase
        .from('studio_members')
        .select('role, studio_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!memberData?.studio_id) {
        if (!cached) { setStudio(null); setRole(null); }
        setLoading(false);
        return;
      }

      const { data: studioData } = await supabase
        .from('studios')
        .select('id, name, plan, videos_used_this_period, logo_url')
        .eq('id', memberData.studio_id)
        .maybeSingle();

      if (studioData) {
        const { videos_used_this_period, ...rest } = studioData as any;
        const fresh = { ...rest, videos_used: videos_used_this_period ?? 0 } as Studio;
        const freshRole = memberData.role as StudioRole;
        setStudio(fresh);
        setRole(freshRole);
        await store.setCache(cacheKey, { studio: fresh, role: freshRole });
      }
    } catch {
      // offline — cached data already applied
    }

    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchStudio();
  }, [fetchStudio]);

  const isOwner = role === 'owner';
  const isAdmin = role === 'owner' || role === 'admin';
  const canWrite = role === 'owner' || role === 'admin' || role === 'member';

  return { studio, role, loading, isOwner, isAdmin, canWrite, refetch: fetchStudio };
}
