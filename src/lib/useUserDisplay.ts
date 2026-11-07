import { useAuth } from './auth';
import { useProfile } from './queries';
import { effectivePlan } from './profiles';

export function useUserDisplay() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);

  const meta = user?.user_metadata;
  const tgName = meta?.provider === 'telegram'
    ? ([meta?.first_name, meta?.last_name].filter(Boolean).join(' ') || (meta?.telegram_username ? `@${meta.telegram_username}` : null))
    : null;
  const vkName = meta?.provider === 'vk'
    ? ([meta?.first_name, meta?.last_name].filter(Boolean).join(' ') || (meta?.vk_id ? `id${meta.vk_id}` : null))
    : null;
  const emailFallback = user?.email && !user.email.endsWith('.local') ? user.email : null;
  const displayName: string = (profile?.display_name?.trim() || null) ?? meta?.full_name ?? meta?.name ?? tgName ?? vkName ?? emailFallback ?? '';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join('') || '?';

  const avatarUrl: string | null = (profile?.avatar_url?.trim() || null) ?? meta?.avatar_url ?? meta?.photo_url ?? null;

  return {
    displayName,
    initials,
    // С учётом срока: истёкший pro — 'free' (isPaidPlan). До загрузки профиля тоже 'free',
    // поэтому деструктивное по плану смотрит planLoaded (ретеншн версий теперь серверный).
    plan: effectivePlan(profile),
    planLoaded: !isLoading,
    avatarUrl,
  };
}
