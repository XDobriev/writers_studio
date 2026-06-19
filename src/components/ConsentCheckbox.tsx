import type { ReactNode } from 'react';

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

// Чекбокс согласия со стартовым выравниванием и подписью-ссылкой (форма регистрации).
export function ConsentCheckbox({ checked, onChange, children }: ConsentCheckboxProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 14, height: 14 }}
      />
      <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.55 }}>
        {children}
      </span>
    </label>
  );
}
