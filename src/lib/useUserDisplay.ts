import { useAuth } from './auth';
import { useProfile } from './queries';

export function useUserDisplay() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);

  const meta = user?.user_metadata;
  const tgName = meta?.provider === 'telegram'
    ? ([meta?.first_name, meta?.last_name].filter(Boolean).join(' ') || (meta?.telegram_username ? `@${meta.telegram_username}` : null))
    : null;
  const vkName = meta?.provider === 'vk'
    ? ([meta?.first_name, meta?.last_name].filter(Boolean).join(' ') || null)
    : null;
  const displayName: string = profile?.display_name ?? meta?.full_name ?? meta?.name ?? tgName ?? vkName ?? user?.email ?? '';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join('') || '?';

  const avatarUrl: string | null = meta?.avatar_url ?? meta?.photo_url ?? null;

  return {
    displayName,
    initials,
    plan: profile?.plan ?? 'free',
    planLoaded: !isLoading,
    avatarUrl,
  };
}
