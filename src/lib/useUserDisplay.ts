import { useState, useEffect } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';

export function useUserDisplay() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<string>('free');

  const displayName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? '';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join('') || '?';

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('plan').eq('user_id', user.id).single()
      .then(({ data }) => { if (data?.plan) setPlan(data.plan); });
  }, [user]);

  return { displayName, initials, plan };
}
