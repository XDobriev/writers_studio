import { useState } from 'react';

const KEY = 'cookie_consent_v1';

export function CookieBanner() {
  const [accepted, setAccepted] = useState(() => !!localStorage.getItem(KEY));

  if (accepted) return null;

  function accept() {
    localStorage.setItem(KEY, '1');
    setAccepted(true);
  }

  return (
    <div
      role="dialog"
      aria-label="Уведомление об использовании куки"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9990,
        background: 'oklch(0.18 0.014 50 / 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-3)',
        padding: '10px 12px 10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 520,
        width: 'calc(100vw - 32px)',
        boxShadow: '0 4px 24px oklch(0 0 0 / 0.5)',
        font: '13px var(--font-ui)',
        color: 'var(--ink-2)',
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.5 }}>
        Мы используем куки для авторизации и аналитики.{' '}
        <a href="/privacy" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          Политика&nbsp;конфиденциальности
        </a>
      </span>
      <button
        onClick={accept}
        className="btn btn--primary"
        style={{ flexShrink: 0, fontSize: 12.5, height: 32, padding: '0 14px' }}
      >
        Принять
      </button>
    </div>
  );
}
