import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { useProfile, QUERY_KEYS } from '../lib/queries';
import { useUserDisplay } from '../lib/useUserDisplay';
import { updateProfile, uploadAvatar, deleteAvatar, isTrialActive, type Profile } from '../lib/profiles';
import { useErrorState } from '../lib/useErrorState';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { UpgradeModal } from '../components/UpgradeModal';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  lifetime: 'Lifetime',
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const { displayName, initials, avatarUrl, plan, planLoaded } = useUserDisplay();
  const queryClient = useQueryClient();
  const { error, setError, clearError } = useErrorState();

  const [nameInput, setNameInput] = useState<string>('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileLoaded = profile !== undefined;
  const savedDisplayName = profile?.display_name;

  useEffect(() => {
    if (profileLoaded) {
      setNameInput(savedDisplayName ?? '');
    }
  }, [profileLoaded, savedDisplayName]);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const isDirty = nameInput.trim() !== (profile?.display_name ?? '').trim();

  const nameMutation = useMutation({
    mutationFn: (displayNameValue: string | null) =>
      updateProfile(user!.id, { display_name: displayNameValue }),
    onSuccess: (_data, displayNameValue) => {
      if (!user) return;
      queryClient.setQueryData<Profile | null>(QUERY_KEYS.profile(user.id), (prev) =>
        prev ? { ...prev, display_name: displayNameValue } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(user.id) });
      setSavedFlash(true);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить имя');
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(user!.id, file, profile?.avatar_url),
    onSuccess: (publicUrl) => {
      if (!user) return;
      queryClient.setQueryData<Profile | null>(QUERY_KEYS.profile(user.id), (prev) =>
        prev ? { ...prev, avatar_url: publicUrl } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(user.id) });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить аватар');
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: () => deleteAvatar(user!.id, profile!.avatar_url!),
    onSuccess: () => {
      if (!user) return;
      queryClient.setQueryData<Profile | null>(QUERY_KEYS.profile(user.id), (prev) =>
        prev ? { ...prev, avatar_url: null } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(user.id) });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Не удалось удалить аватар');
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Только изображения');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Файл слишком большой (макс. 2 МБ)');
      return;
    }
    clearError();
    avatarMutation.mutate(file);
  }

  function handleSaveName(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isDirty || nameMutation.isPending || !user) return;
    clearError();
    const trimmed = nameInput.trim() || null;
    nameMutation.mutate(trimmed);
  }

  const validInitials = initials && initials !== '?' ? initials : null;
  const fallback = validInitials || (displayName?.trim() ? displayName.trim()[0]?.toUpperCase() : null);
  const avatarBusy = avatarMutation.isPending || deleteAvatarMutation.isPending;
  const isTrial = isTrialActive(profile);

  const isTelegram = user?.user_metadata?.provider === 'telegram';
  const isVk = user?.user_metadata?.provider === 'vk';
  const accountLabel = isTelegram ? 'Telegram' : isVk ? 'ВКонтакте' : 'Email';
  const accountDisplay = isTelegram
    ? (user?.user_metadata?.telegram_username
      ? `@${user.user_metadata.telegram_username}`
      : `Telegram ID: ${user?.user_metadata?.telegram_id ?? ''}`)
    : isVk
      ? `VK ID: ${user?.user_metadata?.vk_id ?? ''}`
      : (user?.email ?? '—');

  return (
    <div className="as profile-page">
      <div className="profile-wrap">
        <div className="profile-top">
          <button
            type="button"
            className="profile-back"
            onClick={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/books'))}
          >
            <Icon name="arrows" size={14} />
            Назад
          </button>
          <h1 className="profile-title">Профиль</h1>
        </div>

        {error && (
          <ErrorBanner message={error} onDismiss={clearError} style={{ marginBottom: 20 }} />
        )}

        <div className="profile-header">
          <button
            type="button"
            className="avatar-upload-zone"
            onClick={() => fileInputRef.current?.click()}
            title="Нажмите, чтобы загрузить аватар"
            aria-label="Загрузить аватар"
            disabled={avatarBusy}
          >
            <div className="sb-avatar">
              {avatarUrl && !imgError ? (
                <img
                  src={avatarUrl}
                  alt={displayName || 'Аватар'}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                />
              ) : fallback ? (
                fallback
              ) : (
                <Icon name="user" size={20} />
              )}
            </div>
            <div className={'avatar-upload-overlay' + (avatarBusy ? ' avatar-upload-overlay--visible' : '')}>
              {avatarBusy ? (
                <span style={{ font: '500 11px var(--font-mono)' }}>…</span>
              ) : (
                <Icon name="camera" size={16} />
              )}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            disabled={avatarBusy}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div className="profile-header-info">
            <div className="profile-header-name">
              {displayName || '—'}
            </div>
            <div className="profile-header-meta">
              {planLoaded ? (isTrial ? 'Pro · триал' : (PLAN_LABEL[plan] ?? plan)) : '…'}
            </div>
            <div className="profile-avatar-actions">
              <button
                type="button"
                className="profile-avatar-link"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
              >
                {avatarMutation.isPending ? 'Загрузка…' : 'Сменить фото'}
              </button>
              {profile?.avatar_url && (
                <button
                  type="button"
                  className="profile-avatar-link profile-avatar-link--danger"
                  onClick={() => {
                    clearError();
                    deleteAvatarMutation.mutate();
                  }}
                  disabled={avatarBusy}
                >
                  {deleteAvatarMutation.isPending ? 'Удаление…' : 'Удалить аватар'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="profile-field">
          <label className="label" htmlFor="profile-name">Отображаемое имя</label>
          <form className="profile-field-row" onSubmit={handleSaveName}>
            <input
              id="profile-name"
              className="input"
              value={nameInput}
              disabled={nameMutation.isPending}
              onChange={(e) => {
                setNameInput(e.target.value);
                setSavedFlash(false);
              }}
              placeholder="Ваше имя"
              maxLength={80}
            />
            <button
              type="submit"
              className="btn btn--primary profile-save-btn"
              disabled={!isDirty || nameMutation.isPending}
            >
              {nameMutation.isPending ? 'Сохраняем…' : savedFlash && !isDirty ? '✓ Сохранено' : 'Сохранить'}
            </button>
          </form>
          <div className="input-hint">
            Отображается в шапке студии, сайдбаре и на карточках ваших книг.
          </div>
        </div>

        <div className="profile-field">
          <div className="label">{accountLabel}</div>
          <div className="profile-readonly">
            <span className="profile-readonly-value">{accountDisplay}</span>
          </div>
        </div>

        <div className="profile-field" style={{ marginBottom: 0 }}>
          <div className="label">Тариф</div>
          <div className="profile-readonly">
            <span>{planLoaded ? (isTrial ? 'Пробный период Pro' : (PLAN_LABEL[plan] ?? plan)) : '…'}</span>
            {planLoaded && (plan === 'free' || isTrial) && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => setShowUpgradeModal(true)}
              >
                Перейти на Pro
              </button>
            )}
          </div>
        </div>
      </div>

      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}
