import { useState, useEffect } from 'react';
import { useAuth } from './auth';
import { getProfile } from './profiles';

export function useUserDisplay() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<string>('free');
  const [planLoaded, setPlanLoaded] = useState(false);

  const meta = user?.user_metadata;
  const tgName = meta?.provider === 'telegram'
    ? ([meta?.first_name, meta?.last_name].filter(Boolean).join(' ') || (meta?.telegram_username ? `@${meta.telegram_username}` : null))
    : null;
  const displayName = meta?.full_name ?? meta?.name ?? tgName ?? user?.email ?? '';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join('') || '?';

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then((profile) => {
      if (profile?.plan) setPlan(profile.plan);
      setPlanLoaded(true);
    });
  }, [user]);

  return { displayName, initials, plan, planLoaded };
}
