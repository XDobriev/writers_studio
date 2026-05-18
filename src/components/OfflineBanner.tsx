import { useOnlineStatus } from '../lib/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 9999,
        background: 'var(--warn)',
        color: 'var(--bg-deep)',
        font: '500 12px var(--font-ui)',
        textAlign: 'center',
        padding: '7px 16px',
        letterSpacing: '-0.01em',
        animation: 'slide-down 0.2s ease',
      }}
    >
      Нет подключения к сети — изменения не сохраняются
    </div>
  );
}
