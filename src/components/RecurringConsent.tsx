import { ConsentCheckbox } from './ConsentCheckbox';
import type { BillingInterval } from '../lib/pricing';

interface RecurringConsentProps {
  interval: BillingInterval;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

// Согласие на автоматические списания Pro. Обязательно везде, где стартует оплата Pro
// (лендинг, UpgradeModal, оплата после регистрации): без него create-payment-url
// отвечает 400 consent_required. Текст зеркалит recurringConsentText в _shared/pricing.ts.
export function RecurringConsent({ interval, checked, onChange }: RecurringConsentProps) {
  return (
    <ConsentCheckbox checked={checked} onChange={onChange}>
      Согласен на автоматические {interval === 'annual' ? 'ежегодные' : 'ежемесячные'} списания согласно{' '}
      <a href="/offer" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
        условиям оферты
      </a>
    </ConsentCheckbox>
  );
}
