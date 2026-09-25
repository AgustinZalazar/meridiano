import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';

export interface Profile {
  full_name: string;
  plan: 'starter' | 'pro' | 'enterprise';
  avatar_url: string | null;
}

export function useProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, plan, avatar_url')
      .eq('id', session.user.id)
      .single();
    setProfile(data as Profile | null);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    email: session?.user.email ?? '',
    refetch: fetchProfile,
  };
}
