import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { overlayVariants, modalPanelVariants } from '../lib/motion';
import { supabase } from '../lib/supabase';

const SESSION_KEY = 'as_exit_intent_shown';

export function ExitIntentPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const armedAt = Date.now() + 4000;
    const onMouseOut = (e: MouseEvent) => {
      if (shownRef.current || Date.now() < armedAt) return;
      if (e.clientY > 0 || e.relatedTarget) return;
      shownRef.current = true;
      sessionStorage.setItem(SESSION_KEY, '1');
      setOpen(true);
      document.removeEventListener('mouseout', onMouseOut);
    };
    document.addEventListener('mouseout', onMouseOut);
    return () => document.removeEventListener('mouseout', onMouseOut);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = email.trim().toLowerCase();
    if (!val) return;
    setStatus('loading');
    const { error } = await supabase.from('waitlist').insert({ email: val });
    if (error && error.code !== '23505') {
      setStatus('error');
    } else {
      setStatus('done');
    }
  };

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
          onClick={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Подписка на письма для авторов"
            tabIndex={-1}
            variants={modalPanelVariants}
            style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 14, padding: '28px 28px 24px', width: 420, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 24px 48px oklch(0 0 0 / 0.4)' }}
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <h2 style={{ font: '600 22px/1.2 var(--font-serif)', letterSpacing: '-0.015em', color: 'var(--ink)', margin: 0 }}>
                Прежде чем уйти — письма для авторов?
              </h2>
              <button onClick={() => setOpen(false)} aria-label="Закрыть" title="Закрыть" className="icon-close-btn" style={{ fontSize: 20, flexShrink: 0 }}>×</button>
            </div>
            <p style={{ font: '400 14px/1.6 var(--font-serif)', color: 'var(--ink-2)', marginBottom: 20 }}>
              Обновления и новые фичи — не чаще раза в месяц. Без рекламы.
            </p>
            {status === 'done' ? (
              <p style={{ font: '500 14px var(--font-serif)', color: 'var(--ok)', margin: 0 }}>Готово — будем писать.</p>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  ref={inputRef}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ваш@email.ru"
                  className="input"
                  aria-label="Адрес электронной почты"
                  style={{ flex: 1, minWidth: 200, height: 44 }}
                  disabled={status === 'loading'}
                />
                <button type="submit" className="btn btn--primary" style={{ height: 44, padding: '0 20px', fontSize: 14 }} disabled={status === 'loading'}>
                  {status === 'loading' ? '…' : 'Подписаться'}
                </button>
              </form>
            )}
            {status === 'error' && (
              <p style={{ font: '400 13px var(--font-ui)', color: 'var(--danger)', marginTop: 10 }}>Что-то пошло не так. Попробуйте ещё раз.</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
