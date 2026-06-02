import { useState, useEffect, useRef } from 'react';
import { useUserDisplay } from '../../lib/useUserDisplay';
import { useAuth } from '../../lib/auth';
import { Icon } from '../Icon';
import { SettingsModal } from '../SettingsModal';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  lifetime: 'Lifetime',
};

export function SidebarFoot() {
  const { displayName, initials, plan, planLoaded } = useUserDisplay();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { signOut } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const rafId = requestAnimationFrame(() => {
      containerRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDropdownOpen(false); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = containerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
        if (!items?.length) return;
        const idx = Array.from(items).indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown'
          ? (idx + 1) % items.length
          : (idx - 1 + items.length) % items.length;
        items[next].focus();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [dropdownOpen]);

  async function handleSignOut() {
    setDropdownOpen(false);
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <>
      <div ref={containerRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className="sb-foot"
          aria-label="Аккаунт"
          aria-haspopup="menu"
          aria-expanded={dropdownOpen}
          onClick={() => setDropdownOpen(v => !v)}
        >
          <div className="sb-avatar" style={isSigningOut ? { opacity: 0.5 } : undefined}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sb-foot-name">{displayName || '—'}</div>
            <div className="sb-foot-meta">{planLoaded ? (PLAN_LABEL[plan] ?? plan) : '…'}</div>
          </div>
          <span style={{ color: 'var(--ink-4)', flexShrink: 0, transition: 'transform 0.12s', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'flex' }}>
            <Icon name="chevd" size={12} />
          </span>
        </button>
        {dropdownOpen && (
          <div role="menu" style={{
            position: 'absolute',
            bottom: '100%',
            left: 8,
            right: 8,
            marginBottom: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: 8,
            padding: 4,
            boxShadow: '0 4px 20px oklch(0.05 0.01 50 / 0.18)',
            zIndex: 100,
            animation: 'dropdown-in 0.12s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}>
            <button
              type="button"
              role="menuitem"
              className="sb-dropdown-item"
              onClick={() => { setDropdownOpen(false); setSettingsOpen(true); }}
            >
              <Icon name="settings" size={14} />
              Настройки
            </button>
            <div style={{ height: 1, background: 'var(--border-soft)', margin: '2px 0' }} />
            <button
              type="button"
              role="menuitem"
              className="sb-dropdown-item sb-dropdown-item--danger"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              style={isSigningOut ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
            >
              <Icon name="log-out" size={14} />
              {isSigningOut ? 'Выход…' : 'Выйти'}
            </button>
          </div>
        )}
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
