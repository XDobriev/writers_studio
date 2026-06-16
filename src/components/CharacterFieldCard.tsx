import { useEffect, useRef, useState } from 'react';

interface CharacterFieldCardProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  warn?: boolean;
  hint?: string;
}

export function CharacterFieldCard({ label, value, onChange, warn, hint }: CharacterFieldCardProps) {
  const [local, setLocal] = useState(value);
  const initialRef = useRef(value);

  useEffect(() => {
    if (value !== initialRef.current) {
      setLocal(value);
      initialRef.current = value;
    }
  }, [value]);

  return (
    <div className={`char-field-card${warn ? ' char-field-card--warn' : ''}`}>
      <div className="char-field-card__head">
        {warn && <span className="char-field-card__dot" />}
        <span className="char-field-card__label">{label}</span>
      </div>
      {hint && !local && (
        <div className="char-field-card__hint">{hint}</div>
      )}
      <textarea
        className="char-field-card__text"
        value={local}
        onChange={(e) => { setLocal(e.target.value); onChange(e.target.value); }}
        rows={5}
        placeholder="—"
        aria-label={label}
      />
    </div>
  );
}
