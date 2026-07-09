import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { overlayVariants, modalPanelVariants } from '../lib/motion';
import { Icon } from './Icon';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/queries';
import { EDITOR_SHORTCUTS, shortcutLabel } from '../lib/shortcuts';
import { SettingsProfileTab } from './SettingsProfileTab';
import { SettingsInterfaceTab } from './SettingsInterfaceTab';
import { SettingsSubscriptionTab } from './SettingsSubscriptionTab';

type Tab = 'profile' | 'interface' | 'subscription';

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Профиль' },
  { key: 'interface', label: 'Интерфейс' },
  { key: 'subscription', label: 'Подписка' },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const isFreePlan = profile?.plan === 'free';
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [helpOpen, setHelpOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Настройки"
            tabIndex={-1}
            variants={modalPanelVariants}
            style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 14, width: 440, maxWidth: '100%', minWidth: 0, maxHeight: '90vh',
              display: 'flex', flexDirection: 'column', outline: 'none',
              boxShadow: '0 32px 80px oklch(0.05 0.01 50 / 0.55)',
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return;
              const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? [];
              const arr = Array.from(focusable);
              if (!arr.length) return;
              const first = arr[0];
              const last = arr[arr.length - 1];
              if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
              }
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px 0', flexShrink: 0 }}>
              <span style={{ font: '600 14px var(--font-ui)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Настройки</span>
              <span style={{ flex: 1 }} />
              <button className="tb-btn" onClick={onClose} aria-label="Закрыть" title="Закрыть" style={{ fontSize: 20, lineHeight: 1, padding: '0 6px', color: 'var(--ink-4)' }}>×</button>
            </div>

            {/* Tab bar */}
            <div
              role="tablist"
              aria-label="Разделы настроек"
              style={{
                display: 'flex', padding: '12px 24px 0',
                borderBottom: '1px solid var(--border-soft)', flexShrink: 0,
              }}
            >
              {TABS.map(t => (
                <button
                  key={t.key}
                  id={`sm-tab-${t.key}`}
                  role="tab"
                  aria-selected={activeTab === t.key}
                  aria-controls={`sm-panel-${t.key}`}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    font: activeTab === t.key ? '500 13px var(--font-ui)' : '400 13px var(--font-ui)',
                    color: activeTab === t.key ? 'var(--ink)' : 'var(--ink-4)',
                    background: 'none', border: 'none',
                    borderBottom: activeTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                    padding: '0 2px 10px', marginRight: 12, cursor: 'pointer',
                    transition: 'color 0.15s, border-color 0.15s',
                    letterSpacing: '-0.01em', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {t.label}
                  {t.key === 'subscription' && isFreePlan && (
                    <span aria-hidden="true" style={{
                      width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0,
                    }} />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {activeTab === 'profile' && <SettingsProfileTab />}
              {activeTab === 'interface' && <SettingsInterfaceTab />}
              {activeTab === 'subscription' && (
                <SettingsSubscriptionTab
                  userId={user?.id}
                  isActive={activeTab === 'subscription'}
                />
              )}
            </div>

            {/* Help collapsible */}
            <div style={{ borderTop: '1px solid var(--border-soft)', padding: '0 24px', flexShrink: 0 }}>
              <button
                onClick={() => setHelpOpen(v => !v)}
                aria-expanded={helpOpen}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '13px 0',
                  font: '500 10.5px var(--font-mono)',
                  color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase',
                }}
              >
                Помощь
                <span style={{ transition: 'transform 0.15s', transform: helpOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'flex' }}>
                  <Icon name="chevd" size={12} />
                </span>
              </button>
              {helpOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 14 }}>
                  {EDITOR_SHORTCUTS.map((s) => (
                    <div
                      key={s.label}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}
                    >
                      <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)' }}>{s.label}</span>
                      <kbd style={{
                        font: '500 11px var(--font-mono)', color: 'var(--ink-2)',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap', letterSpacing: '0.02em',
                      }}>
                        {shortcutLabel(s)}
                      </kbd>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
