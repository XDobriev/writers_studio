import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

function SessionExpiredOverlay({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      background: 'rgba(0, 0, 0, 0.45)',
    }}>
      <div style={{
        background: 'var(--bg-deep)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
        maxWidth: 280,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
          Сессия завершена
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55 }}>
          Время авторизации истекло. Войдите снова — ваши данные в сохранности.
        </div>
        <button className="btn" onClick={onDismiss} style={{ marginTop: 6 }}>
          Войти снова
        </button>
      </div>
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

  if (!session && !sessionExpired) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return (
    <>
      {children}
      {sessionExpired && <SessionExpiredOverlay onDismiss={clearSessionExpired} />}
    </>
  );
}
