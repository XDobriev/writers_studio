import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { Icon } from './Icon';
import { SettingsModal } from './SettingsModal';

interface AccountMenuProps {
  placement?: 'above' | 'below';
  children: (props: { onClick: () => void; open: boolean; signingOut: boolean }) => ReactNode;
}

export function AccountMenu({ placement = 'above', children }: AccountMenuProps) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const rafId = requestAnimationFrame(() => {
      containerRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
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
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  const dropdownStyle: React.CSSProperties = placement === 'above'
    ? { position: 'absolute', bottom: '100%', left: 8, right: 8, marginBottom: 4 }
    : { position: 'absolute', top: '100%', right: 0, minWidth: 160, marginTop: 4 };

  return (
    <>
      <div ref={containerRef} style={{ position: 'relative' }}>
        {children({ onClick: () => setOpen(v => !v), open, signingOut })}
        {open && (
          <div
            role="menu"
            style={{
              ...dropdownStyle,
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
              padding: 4,
              boxShadow: '0 4px 20px oklch(0.05 0.01 50 / 0.18)',
              zIndex: 100,
              animation: 'dropdown-in 0.12s cubic-bezier(0.22, 1, 0.36, 1) both',
            }}
          >
            <button
              type="button"
              role="menuitem"
              className="sb-dropdown-item"
              onClick={() => { setOpen(false); setSettingsOpen(true); }}
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
              disabled={signingOut}
              style={signingOut ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
            >
              <Icon name="log-out" size={14} />
              {signingOut ? 'Выход…' : 'Выйти'}
            </button>
          </div>
        )}
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
