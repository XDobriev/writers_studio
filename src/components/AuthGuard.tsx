import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

function SessionExpiredScreen({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      color: 'var(--ink)',
      textAlign: 'center',
      padding: '0 24px',
      background: 'var(--bg-deep)',
    }}>
      <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>
        Сессия завершена
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 280, lineHeight: 1.55 }}>
        Время авторизации истекло. Войдите снова — ваши данные в сохранности.
      </div>
      <button className="btn" onClick={onDismiss} style={{ marginTop: 8 }}>
        Войти снова
      </button>
    </div>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading, sessionExpired, clearSessionExpired } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
        Загрузка…
      </div>
    );
  }

  if (!session && sessionExpired) {
    return <SessionExpiredScreen onDismiss={clearSessionExpired} />;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
