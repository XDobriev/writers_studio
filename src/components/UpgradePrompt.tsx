import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { overlayVariants, modalPanelVariants } from '../lib/motion';
import { UpgradeModal } from './UpgradeModal';
import { isGrandfatheringActive } from '../lib/pricing';
import { useEscapeToClose } from '../lib/useEscapeToClose';
import { trapTab, useModalFocus } from '../lib/useModalFocus';
import { useAuth } from '../lib/auth';
import { useProfile, QUERY_KEYS } from '../lib/queries';
import { canStartTrial, startProTrial, type Profile } from '../lib/profiles';

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
  import: {
    title: 'Импорт FB2 и EPUB — в Pro',
    body: 'Импорт из DOCX, TXT и Markdown доступен бесплатно. Перенос книг из FB2 и EPUB (Author.Today, Литнет, читалки) — на плане Pro.',
  },
  books: {
    title: 'Лимит книг',
    body: 'Бесплатный план включает одну книгу. Перейдите на Pro, чтобы вести неограниченное количество проектов.',
  },
};

const TRIAL_OFFERS: Record<string, { title: string; body: string }> = {
  characters: {
    title: '4-й персонаж — попробуйте Pro бесплатно',
    body: 'Бесплатный план включает до 3 персонажей. Включите 7 дней Pro в один клик — без привязки карты. По окончании пробного периода все созданные персонажи останутся в книге.',
  },
  timeline: {
    title: '11-е событие — попробуйте Pro бесплатно',
    body: 'Бесплатный план включает до 10 событий хронологии. Включите 7 дней Pro в один клик — без привязки карты. По окончании пробного периода все события останутся в книге.',
  },
  books: {
    title: '2-я книга — попробуйте Pro бесплатно',
    body: 'Бесплатный план включает одну книгу. Включите 7 дней Pro в один клик — без привязки карты. По окончании пробного периода все созданные книги останутся в аккаунте.',
  },
};

export function UpgradePrompt({
  open,
  feature,
  onClose,
  onTrialActivated,
}: {
  open: boolean;
  feature: string;
  onClose: () => void;
  onTrialActivated?: () => void;
}) {
  const proRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);

  const showTrialOffer = (feature === 'characters' || feature === 'timeline' || feature === 'books') && canStartTrial(profile);

  const defaultMeta = FEATURE_TEXT[feature] ?? { title: 'Лимит Free-плана', body: 'Перейдите на Pro.' };
  const { title, body } = showTrialOffer
    ? (TRIAL_OFFERS[feature] ?? defaultMeta)
    : defaultMeta;

  useEscapeToClose(open, onClose);
  useModalFocus(open, panelRef, proRef);

  const handleStartTrial = async () => {
    setTrialLoading(true);
    setTrialError(null);
    try {
      const result = await startProTrial();
      if (user?.id) {
        queryClient.setQueryData<Profile | null>(QUERY_KEYS.profile(user.id), (prev) =>
          prev
            ? {
                ...prev,
                trial_started_at: result.trial_started_at,
                trial_ends_at: result.trial_ends_at,
                trial_used: result.trial_used,
              }
            : prev
        );
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(user.id) });
      }
      try {
        onTrialActivated?.();
      } finally {
        onClose();
      }
    } catch (e) {
      setTrialError(e instanceof Error ? e.message : 'Не удалось активировать пробный период.');
    } finally {
      setTrialLoading(false);
    }
  };

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-modal)' }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            variants={modalPanelVariants}
            style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '28px 32px', width: showTrialOffer ? 420 : 380, maxWidth: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 48px oklch(0 0 0 / 0.4)' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => trapTab(e)}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in oklch, var(--accent) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {showTrialOffer ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                )}
              </div>
              <div>
                <div style={{ font: '600 15px var(--font-ui)', color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
                <div style={{ font: '400 13px/1.6 var(--font-ui)', color: 'var(--ink-2)' }}>{body}</div>
              </div>
            </div>

            {trialError && (
              <div role="alert" style={{ font: '400 12px var(--font-ui)', color: 'var(--danger)', background: 'color-mix(in oklch, var(--danger) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--danger) 30%, transparent)', borderRadius: 8, padding: '8px 12px' }}>
                {trialError}
              </div>
            )}

            {showTrialOffer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  ref={proRef}
                  className="btn btn--primary"
                  onClick={() => { void handleStartTrial(); }}
                  disabled={trialLoading}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {trialLoading ? 'Включаем Pro…' : 'Включить 7 дней Pro бесплатно'}
                </button>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
                  <button onClick={onClose} className="btn btn--ghost" disabled={trialLoading}>
                    Отмена
                  </button>
                  <button
                    onClick={() => { onClose(); setShowUpgradeModal(true); }}
                    className="btn btn--ghost"
                    disabled={trialLoading}
                    style={{ color: 'var(--ink-2)' }}
                  >
                    Купить Pro
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={onClose} className="btn btn--ghost">Отмена</button>
                <button
                  ref={proRef}
                  className="btn btn--primary"
                  onClick={() => { onClose(); setShowUpgradeModal(true); }}
                >
                  Перейти на Pro →
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    {showUpgradeModal && (
      <UpgradeModal grandfathered={isGrandfatheringActive()} onClose={() => setShowUpgradeModal(false)} />
    )}
    </>
  );
}
