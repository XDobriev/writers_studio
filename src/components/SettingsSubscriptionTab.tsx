import { useState } from 'react';
import { useSubscription, type Plan } from '../lib/useSubscription';
import { UpgradeModal } from './UpgradeModal';
import { ConfirmDialog } from './ConfirmDialog';
import { plural } from '../lib/i18n';

const PLAN_META: Record<Plan, { name: string; desc: string }> = {
  free:     { name: 'Бесплатный план', desc: '1 книга · базовый редактор · без экспорта' },
  pro:      { name: 'Pro',             desc: 'Безлимит книг · все функции · экспорт' },
  lifetime: { name: 'Lifetime',        desc: 'Безлимит книг · все функции · навсегда' },
};

interface Props {
  userId: string | undefined;
  userEmail: string | undefined;
  isActive: boolean;
}

export function SettingsSubscriptionTab({ userId, userEmail, isActive }: Props) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const {
    plan, planExpiresAt, grandfathered, hasRecurring, planLoaded,
    lastProPayment, refundLoading, refundError, refundDone,
    refundConfirmOpen, setRefundConfirmOpen, handleRefund,
  } = useSubscription(userId, isActive);

  return (
    <>
      <div id="sm-panel-subscription" role="tabpanel" aria-labelledby="sm-tab-subscription" tabIndex={0} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px' }}>
          {!planLoaded
            ? <div style={{ height: 52, borderRadius: 6, background: 'var(--surface-2)' }} />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ font: '600 14px var(--font-ui)', color: 'var(--ink)', marginBottom: 3 }}>{PLAN_META[plan].name}</div>
                    <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>{PLAN_META[plan].desc}</div>
                    {plan === 'pro' && planExpiresAt && (
                      <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)', marginTop: 5 }}>
                        {hasRecurring ? 'Следующее списание' : 'Активна до'}{' '}
                        {new Date(planExpiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    )}
                    {plan === 'pro' && grandfathered && (
                      <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ok)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>✦</span>
                        <span>Ранняя цена · 290 ₽/мес навсегда</span>
                      </div>
                    )}
                  </div>
                  {plan !== 'free' && (
                    <span style={{
                      font: '500 10.5px var(--font-mono)', color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                      borderRadius: 6, padding: '3px 8px', letterSpacing: '0.06em', textTransform: 'uppercase',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {plan === 'lifetime' ? 'Lifetime' : 'Pro'}
                    </span>
                  )}
                </div>

                {plan === 'free' && (
                  <button
                    className="btn btn--primary"
                    onClick={() => setUpgradeOpen(true)}
                    style={{ fontSize: 13, height: 38 }}
                  >
                    Апгрейд до Pro
                  </button>
                )}

                {plan === 'pro' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      className="btn btn--ghost"
                      onClick={() => setUpgradeOpen(true)}
                      style={{ fontSize: 13, height: 38 }}
                    >
                      Перейти на Lifetime
                    </button>
                    <a
                      href={`mailto:support@avtorskaya-studiya.ru?subject=Отмена подписки&body=Прошу отменить мою подписку Pro. Email аккаунта: ${userEmail ?? ''}`}
                      className="btn btn--ghost"
                      style={{ fontSize: 13, padding: '6px 12px', textDecoration: 'none', color: 'var(--ink-3)' }}
                    >
                      Отменить подписку
                    </a>
                    {!refundDone && lastProPayment && (() => {
                      const daysLeft = Math.ceil(
                        (new Date(lastProPayment.paid_at).getTime() + 14 * 86400_000 - Date.now()) / 86400_000
                      );
                      if (daysLeft <= 0) return null;
                      return (
                        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 8, marginTop: 2 }}>
                          <button
                            className="btn btn--ghost"
                            style={{ fontSize: 12, color: 'var(--danger)', width: '100%', justifyContent: 'center' }}
                            onClick={() => setRefundConfirmOpen(true)}
                            disabled={refundLoading}
                          >
                            Запросить возврат · ещё {daysLeft} {plural(daysLeft, 'день', 'дня', 'дней')}
                          </button>
                          {refundError && (
                            <p style={{ font: '400 11px var(--font-ui)', color: 'var(--danger)', margin: '6px 0 0', textAlign: 'center' }}>
                              {refundError}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )
          }
        </div>
      </div>

      {upgradeOpen && (
        <UpgradeModal
          onClose={() => setUpgradeOpen(false)}
          skipPro={plan === 'pro'}
          grandfathered={grandfathered}
        />
      )}

      <ConfirmDialog
        open={refundConfirmOpen}
        message={`Доступ к Pro-функциям будет прекращён немедленно.\nДеньги вернутся на карту в течение нескольких дней.`}
        confirmLabel="Подтвердить возврат"
        onConfirm={handleRefund}
        onCancel={() => { setRefundConfirmOpen(false); }}
      />
    </>
  );
}
