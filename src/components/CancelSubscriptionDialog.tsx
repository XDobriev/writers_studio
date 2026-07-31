import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { overlayVariants, modalPanelVariants } from '../lib/motion';
import { CANCEL_REASONS, type CancelReason } from '../lib/cancellations';
import { useEscapeToClose } from '../lib/useEscapeToClose';

interface Props {
  open: boolean;
  expiresFormatted: string | null;
  loading: boolean;
  onConfirm: (reason: CancelReason, comment: string) => void | Promise<void>;
  onClose: () => void;
}

export function CancelSubscriptionDialog({ open, expiresFormatted, loading, onConfirm, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [comment, setComment] = useState('');

  useEscapeToClose(open, onClose);

  useEffect(() => {
    if (!open) { setReason(null); setComment(''); return; }
    closeRef.current?.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Отмена подписки"
            tabIndex={-1}
            variants={modalPanelVariants}
            style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '24px 28px', width: 400, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 24px 48px oklch(0 0 0 / 0.4)' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                const focusable = e.currentTarget.querySelectorAll<HTMLElement>('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])');
                const first = focusable[0]; const last = focusable[focusable.length - 1];
                if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
                  e.preventDefault(); (e.shiftKey ? last : first).focus();
                }
              }
            }}
          >
            <div>
              <div style={{ font: '600 15px var(--font-ui)', color: 'var(--ink)', marginBottom: 4 }}>
                Жаль, что вы уходите
              </div>
              <div style={{ font: '400 12px/1.5 var(--font-ui)', color: 'var(--ink-4)' }}>
                {expiresFormatted
                  ? `Доступ к Pro сохранится до ${expiresFormatted} — рукописи никуда не денутся.`
                  : 'Рукописи останутся с вами и на бесплатном плане.'}
              </div>
            </div>

            <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <legend className="label" style={{ marginBottom: 6 }}>Что не сложилось?</legend>
              {CANCEL_REASONS.map(({ key, label }) => (
                <label key={key} className="cancel-reason">
                  <input
                    type="radio"
                    name="cancel-reason"
                    className="as-radio"
                    checked={reason === key}
                    onChange={() => setReason(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <div>
              <label className="label" htmlFor="cancel-comment" style={{ display: 'block', marginBottom: 6 }}>
                Что стоило бы поправить? <span style={{ color: 'var(--ink-4)', textTransform: 'none', letterSpacing: 0 }}>— по желанию</span>
              </label>
              <textarea
                id="cancel-comment"
                className="input"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                style={{ width: '100%', resize: 'vertical', minHeight: 52, padding: '8px 10px', fontFamily: 'var(--font-ui)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button ref={closeRef} onClick={onClose} disabled={loading} className="btn btn--ghost">
                Остаться
              </button>
              <button
                onClick={() => { if (reason) void onConfirm(reason, comment); }}
                disabled={loading || !reason}
                className="btn btn--danger-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {loading && <span className="btn-spinner" style={{ width: 11, height: 11, borderColor: 'color-mix(in oklch, var(--danger) 30%, transparent)', borderTopColor: 'var(--danger)' }} />}
                {loading ? 'Отменяем…' : 'Отменить подписку'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
