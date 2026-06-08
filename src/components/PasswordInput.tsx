import { useState } from 'react';
import { Icon } from './Icon';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  hasError?: boolean;
  autoFocus?: boolean;
  name?: string;
  required?: boolean;
  minLength?: number;
}

export function PasswordInput({ id, value, onChange, autoComplete, hasError, autoFocus, name, required, minLength }: Props) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        name={name}
        className={`input${hasError ? ' input--err' : ''}`}
        type={show ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ paddingRight: 36, width: '100%' }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: 0 }}
        tabIndex={-1}
        aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
      >
        <Icon name={show ? 'eye-off' : 'eye'} size={15} />
      </button>
    </div>
  );
}
