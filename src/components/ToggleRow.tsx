/** Строка-переключатель (label + switch) с необязательной серой подсказкой. Экран экспорта. */
export function ToggleRow({ label, hint, isOn, onChange, isDisabled, isLast }: {
  label: string;
  hint?: string;
  isOn: boolean;
  onChange: (v: boolean) => void;
  isDisabled?: boolean;
  isLast?: boolean;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--border-soft)',
      fontSize: 13, color: isDisabled ? 'var(--ink-4)' : 'var(--ink-2)', cursor: isDisabled ? 'default' : 'pointer',
    }}>
      <input type="checkbox" checked={isOn} onChange={(e) => !isDisabled && onChange(e.target.checked)} disabled={isDisabled} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
      <span style={{ width: 32, height: 18, borderRadius: 999, background: isOn && !isDisabled ? 'var(--accent)' : 'var(--surface-2)', position: 'relative', transition: 'background 150ms', flexShrink: 0, opacity: isDisabled ? 0.4 : 1 }}>
        <span style={{ position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: 999, background: 'oklch(0.98 0 0)', transform: isOn && !isDisabled ? 'translateX(14px)' : 'translateX(0)', transition: 'transform 150ms' }} />
      </span>
      <span>{label}{hint && <span style={{ color: 'var(--ink-4)', marginLeft: 4 }}>{hint}</span>}</span>
    </label>
  );
}
