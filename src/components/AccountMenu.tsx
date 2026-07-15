import { useState, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { dropdownVariants } from '../lib/motion';
import { useMenuDismiss } from '../lib/useMenuDismiss';
import { useAuth } from '../lib/auth';
import { Icon } from './Icon';
import { SettingsModal } from './SettingsModal';

interface AccountMenuProps {
  placement?: 'above' | 'below';
  children: (props: { onClick: () => void; open: boolean; signingOut: boolean }) => ReactNode;
}

export function AccountMenu({ placement = 'above', children }: AccountMenuProps) {
  const { signOut, user } = useAuth();
  // Гейт согласован с серверным is_admin(): claim app_metadata.role пишет только
  // service_role, подделать через updateUser нельзя. UI-ссылка появляется после
  // релогина админа (свежий JWT с claim); реальную защиту держит серверный RPC.
  const isAdmin = user?.app_metadata?.role === 'admin';
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useMenuDismiss(open, () => setOpen(false), containerRef);

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
        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              variants={dropdownVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{
                ...dropdownStyle,
                background: 'var(--surface)',
                border: '1px solid var(--border-soft)',
                borderRadius: 8,
                padding: 4,
                boxShadow: '0 4px 20px oklch(0.05 0.01 50 / 0.18)',
                zIndex: 100,
              }}
            >
              {isAdmin && (
                <Link
                  to="/admin"
                  role="menuitem"
                  className="sb-dropdown-item"
                  onClick={() => setOpen(false)}
                >
                  <Icon name="shield" size={14} />
                  Администрирование
                </Link>
              )}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {settingsOpen && <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
