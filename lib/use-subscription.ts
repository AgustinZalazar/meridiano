import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'inactive';

export interface Subscription {
  status: SubscriptionStatus;
  priceId: string | null;
  currentPeriodEnd: Date | null;
}

export function useSubscription() {
  const { session } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!session?.user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data } = await supabase
      .from('subscriptions')
      .select('status, price_id, current_period_end')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (data) {
      setSubscription({
        status: data.status as SubscriptionStatus,
        priceId: data.price_id ?? null,
        currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
      });
    } else {
      setSubscription(null);
    }

    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';

  return { subscription, isActive, loading, refetch: fetchSubscription };
}
