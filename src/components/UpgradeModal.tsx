import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getLifetimeSlotsRemaining } from '../lib/profiles';

const PRO_FEATURES = [
  'Безлимитное количество книг',
  'Экспорт DOCX, ePub и FB2',
  'Хронология и карта мира',
  'История версий без лимита',
  'Приоритетная поддержка и закрытый чат',
];

interface Props {
  onClose: () => void;
  skipPro?: boolean;
  grandfathered?: boolean;
}

export function UpgradeModal({ onClose, skipPro = false, grandfathered = false }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [lifetimeSlots, setLifetimeSlots] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [recurringConsent, setRecurringConsent] = useState(false);

  async function handlePurchase(plan: 'pro' | 'lifetime') {
    setIsLoading(true);
    setPurchaseError(null);
    try {
      if (plan === 'pro') {
        await supabase.from('recurring_consents').insert({
          plan,
          user_agent: navigator.userAgent,
        });
      }
      const { data, error } = await supabase.functions.invoke('create-payment-url', {
        body: { plan },
      });
      if (error || !data?.url) throw error ?? new Error('Не удалось получить ссылку на оплату');
      window.location.href = data.url;
    } catch (e) {
      setPurchaseError(e instanceof Error ? e.message : 'Ошибка оплаты');
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    getLifetimeSlotsRemaining().then((slots) => {
      if (slots !== null) setLifetimeSlots(slots);
    });
  }, []);

  const showLifetime = lifetimeSlots !== null && lifetimeSlots > 0;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'oklch(0 0 0 / 0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Перейти на Pro"
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 14, width: 360, maxWidth: '100%',
          boxShadow: '0 32px 80px oklch(0.05 0.01 50 / 0.55)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ font: '600 16px var(--font-ui)', color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 3 }}>
                {skipPro ? 'Перейти на Lifetime' : 'Перейти на Pro'}
              </div>
              <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>
                {skipPro ? 'Один раз — навсегда, без ежемесячной оплаты' : 'Полный доступ ко всем функциям редактора'}
              </div>
            </div>
            <button
              className="tb-btn"
              onClick={onClose}
              aria-label="Закрыть"
              style={{ fontSize: 20, lineHeight: 1, padding: '0 6px', color: 'var(--ink-4)', flexShrink: 0 }}
            >
              ×
            </button>
          </div>

          {!skipPro && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {PRO_FEATURES.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: 'var(--ok)', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>✓</span>
                    <span style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-2)' }}>{f}</span>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'var(--surface)', borderRadius: 10,
                padding: '12px 14px', marginBottom: 16,
                display: 'flex', alignItems: 'baseline', gap: 6,
              }}>
                <span style={{ font: '700 26px var(--font-ui)', color: 'var(--ink)', letterSpacing: '-0.03em' }}>{grandfathered ? '290 ₽' : '399 ₽'}</span>
                <span style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-4)' }}>/ месяц</span>
                {grandfathered && (
                  <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ok)', marginLeft: 2 }}>· ранняя цена навсегда</span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className="as-checkbox"
                    checked={recurringConsent}
                    onChange={(e) => setRecurringConsent(e.target.checked)}
                  />
                  <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.5 }}>
                    Согласен на автоматические ежемесячные списания согласно{' '}
                    <a href="/offer" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                      условиям оферты
                    </a>
                  </span>
                </label>
                <button
                  className="btn btn--primary"
                  style={{ justifyContent: 'center', fontSize: 13, height: 38 }}
                  onClick={() => handlePurchase('pro')}
                  disabled={isLoading || !recurringConsent}
                >
                  {isLoading ? 'Переход к оплате…' : 'Оформить подписку'}
                </button>
                <button className="btn btn--ghost" onClick={onClose} style={{ fontSize: 13, height: 38, width: 'fit-content', alignSelf: 'center', paddingInline: 24 }}>
                  Позже
                </button>
                {purchaseError && (
                  <p style={{ font: '400 12px var(--font-ui)', color: 'var(--danger)', margin: '4px 0 0', textAlign: 'center' }}>
                    {purchaseError}
                  </p>
                )}
              </div>
            </>
          )}

          {skipPro && purchaseError && (
            <p style={{ font: '400 12px var(--font-ui)', color: 'var(--danger)', margin: '0 0 8px', textAlign: 'center' }}>
              {purchaseError}
            </p>
          )}

          {showLifetime && (
            <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 16, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <span style={{ font: '600 14px var(--font-ui)', color: 'var(--ink)' }}>Lifetime</span>
                  <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)', marginLeft: 8 }}>один раз · навсегда</span>
                </div>
                <span style={{
                  font: '500 10px var(--font-mono)', letterSpacing: '0.08em',
                  color: 'var(--accent)', background: 'var(--accent-soft)',
                  border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                  borderRadius: 5, padding: '2px 7px',
                }}>
                  {lifetimeSlots} мест
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ font: '700 22px var(--font-ui)', color: 'var(--ink)', letterSpacing: '-0.03em' }}>4 990 ₽</span>
                <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>разовый платёж</span>
              </div>
              <button
                className="btn"
                style={{ justifyContent: 'center', fontSize: 13, height: 36, width: '100%' }}
                onClick={() => handlePurchase('lifetime')}
                disabled={isLoading}
              >
                {isLoading ? 'Переход к оплате…' : 'Купить Lifetime'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
