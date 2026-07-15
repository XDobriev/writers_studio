import type { BillingInterval } from '../lib/pricing';
import { annualSavingsPercent } from '../lib/pricing';

interface Props {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  grandfathered: boolean;
}

const OPTIONS: { key: BillingInterval; label: string }[] = [
  { key: 'monthly', label: 'Месяц' },
  { key: 'annual',  label: 'Год' },
];

export function BillingIntervalToggle({ value, onChange, grandfathered }: Props) {
  const savings = annualSavingsPercent(grandfathered);

  return (
    <div className="bill-toggle" role="radiogroup" aria-label="Период оплаты">
      {OPTIONS.map(({ key, label }) => {
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(key)}
            className={`bill-toggle__opt${on ? ' bill-toggle__opt--on' : ''}`}
          >
            {label}
            {key === 'annual' && <span className="bill-toggle__save">−{savings}%</span>}
          </button>
        );
      })}
    </div>
  );
}
