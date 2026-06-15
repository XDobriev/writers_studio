import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { overlayVariants, modalPanelVariants } from '../lib/motion';

export function ConfirmDialog({ message, onConfirm, onCancel, open, confirmLabel = 'Удалить' }: {
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  open: boolean;
  confirmLabel?: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [clicked, setClicked] = useState(false);

  const handleConfirm = async () => {
    if (clicked) return;
    setClicked(true);
    try { await onConfirm(); } catch { setClicked(false); }
  };

  useEffect(() => {
    if (!open) { setClicked(false); return; }
    cancelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

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
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Подтверждение действия"
            variants={modalPanelVariants}
            style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '24px 28px', width: 360, maxWidth: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 48px oklch(0 0 0 / 0.4)' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                const focusable = e.currentTarget.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
                const first = focusable[0]; const last = focusable[focusable.length - 1];
                if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
                  e.preventDefault(); (e.shiftKey ? last : first).focus();
                }
              }
            }}
          >
            <p style={{ font: '400 14px/1.6 var(--font-ui)', color: 'var(--ink)', margin: 0, whiteSpace: 'pre-wrap' }}>{message}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button ref={cancelRef} onClick={onCancel} disabled={clicked} className="btn btn--ghost">Отмена</button>
              <button
                onClick={() => { void handleConfirm(); }}
                disabled={clicked}
                className="btn btn--danger-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {clicked && <span className="btn-spinner" style={{ width: 11, height: 11, borderColor: 'color-mix(in oklch, var(--danger) 30%, transparent)', borderTopColor: 'var(--danger)' }} />}
                {clicked ? `${confirmLabel}…` : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
