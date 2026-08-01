import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';

interface Profile {
  full_name: string;
  plan: 'starter' | 'pro' | 'enterprise';
}

export function useProfile() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('profiles')
      .select('full_name, plan')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data));
  }, [session?.user.id]);

  return {
    profile,
    email: session?.user.email ?? '',
  };
}
