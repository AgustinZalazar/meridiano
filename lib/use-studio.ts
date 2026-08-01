import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';

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

    setLoading(true);

    const { data: memberData } = await supabase
      .from('studio_members')
      .select('role, studio_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!memberData?.studio_id) {
      setStudio(null);
      setRole(null);
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
      setStudio({ ...rest, videos_used: videos_used_this_period ?? 0 } as Studio);
    } else {
      setStudio(null);
    }
    setRole(memberData.role as StudioRole);
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
