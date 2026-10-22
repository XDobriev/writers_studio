import { useState } from 'react';
import { RecurringConsent } from './RecurringConsent';
import { ErrorBanner } from './ErrorBanner';
import { isRecurringPlan, type CheckoutPlan } from '../lib/checkout';
import { LIFETIME_PRICE, formatRub, isGrandfatheringActive, proPrice } from '../lib/pricing';

interface PendingCheckoutPanelProps {
  plan: CheckoutPlan;
  error: string | null;
  onConfirm: (consent: boolean) => void;
  onCancel: () => void;
}

// Шаг оплаты после входа (/login?plan=…): согласие на автоматические списания, если его
// не дали на лендинге, и повтор после ошибки create-payment-url (вместо молчаливого /books).
export function PendingCheckoutPanel({ plan, error, onConfirm, onCancel }: PendingCheckoutPanelProps) {
  const recurring = isRecurringPlan(plan);
  const [consent, setConsent] = useState(false);
  const interval = plan === 'pro_annual' ? 'annual' : 'monthly';
  const price = recurring
    ? `${formatRub(proPrice(interval, isGrandfatheringActive()))} ${interval === 'annual' ? '/ год' : '/ месяц'}`
    : `${formatRub(LIFETIME_PRICE)} · один раз`;

  return (
    <div style={{ width: 360, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ font: '600 18px var(--font-ui)', color: 'var(--ink)', marginBottom: 4 }}>
          {recurring ? 'Оформление подписки Pro' : 'Покупка Lifetime'}
        </div>
        <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)' }}>{price}</div>
      </div>
      {recurring && <RecurringConsent interval={interval} checked={consent} onChange={setConsent} />}
      {error && <ErrorBanner message={error} />}
      <button
        className="btn btn--primary"
        style={{ justifyContent: 'center', height: 40 }}
        disabled={recurring && !consent}
        onClick={() => onConfirm(recurring && consent)}
      >
        Перейти к оплате
      </button>
      <button className="btn" style={{ justifyContent: 'center', height: 40 }} onClick={onCancel}>
        Позже
      </button>
    </div>
  );
}
