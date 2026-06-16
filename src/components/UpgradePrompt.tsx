import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { overlayVariants, modalPanelVariants } from '../lib/motion';

const FEATURE_TEXT: Record<string, { title: string; body: string }> = {
  characters: {
    title: 'Лимит персонажей',
    body: 'Бесплатный план позволяет добавить до 3 персонажей. Перейдите на Pro, чтобы добавлять без ограничений.',
  },
  timeline: {
    title: 'Лимит событий',
    body: 'Бесплатный план позволяет добавить до 10 событий хронологии. Перейдите на Pro, чтобы работать без ограничений.',
  },
  export: {
    title: 'Экспорт недоступен',
    body: 'Экспорт в EPUB, FB2 и DOCX доступен на плане Pro.',
  },
  books: {
    title: 'Лимит книг',
    body: 'Бесплатный план включает одну книгу. Перейдите на Pro, чтобы вести неограниченное количество проектов.',
  },
};

export function UpgradePrompt({ open, feature, onClose }: { open: boolean; feature: string; onClose: () => void }) {
  const closeRef = useRef<HTMLAnchorElement>(null);
  const { title, body } = FEATURE_TEXT[feature] ?? { title: 'Лимит Free-плана', body: 'Перейдите на Pro.' };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={modalPanelVariants}
            style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '28px 32px', width: 380, maxWidth: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 48px oklch(0 0 0 / 0.4)' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return;
              const focusable = e.currentTarget.querySelectorAll<HTMLElement>('a[href], button, [tabindex]:not([tabindex="-1"])');
              const arr = Array.from(focusable);
              if (!arr.length) return;
              const first = arr[0], last = arr[arr.length - 1];
              if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
                e.preventDefault(); (e.shiftKey ? last : first).focus();
              }
            }}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in oklch, var(--accent) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div>
                <div style={{ font: '600 15px var(--font-ui)', color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
                <div style={{ font: '400 13px/1.6 var(--font-ui)', color: 'var(--ink-2)' }}>{body}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} className="btn btn--ghost">Отмена</button>
              <Link
                ref={closeRef}
                to="/offer"
                className="btn btn--primary"
                style={{ textDecoration: 'none' }}
                onClick={onClose}
              >
                Перейти на Pro →
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
