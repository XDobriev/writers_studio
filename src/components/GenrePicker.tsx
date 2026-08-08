import { useState, useRef, useEffect } from 'react';

const GENRE_LIST = [
  'Фэнтези', 'Фэнтези (городское)', 'Фэнтези (тёмное)', 'Фэнтези (эпическое)',
  'Фантастика', 'Детектив', 'Триллер', 'Хоррор', 'Романтика',
  'Историческая проза', 'Приключения', 'Young Adult', 'Мистика',
  'Постапокалипсис', 'Антиутопия', 'Лирическая проза', 'Нон-фикшн',
];

const OTHER = 'Другое';

function isCustom(g: string) {
  return g !== OTHER && !GENRE_LIST.some((preset) => preset.toLowerCase() === g.toLowerCase());
}

export function GenrePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const customVal = value.find(isCustom) ?? '';
  const [customInput, setCustomInput] = useState(customVal);
  const [showCustom, setShowCustom] = useState(customVal !== '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCustom) inputRef.current?.focus();
  }, [showCustom]);

  const toggle = (genre: string) => {
    if (genre === OTHER) {
      const next = !showCustom;
      setShowCustom(next);
      if (!next) {
        setCustomInput('');
        onChange(value.filter((g) => !isCustom(g)));
      }
      return;
    }
    if (value.some((g) => g.toLowerCase() === genre.toLowerCase())) {
      onChange(value.filter((g) => g.toLowerCase() !== genre.toLowerCase()));
    } else {
      onChange([...value, genre]);
    }
  };

  const handleCustomBlur = () => {
    const trimmed = customInput.trim();
    const without = value.filter((g) => !isCustom(g));
    if (trimmed) {
      onChange([...without, trimmed]);
    } else {
      onChange(without);
      setShowCustom(false);
    }
  };

  const otherActive = showCustom;
  const allTags = [...GENRE_LIST, OTHER];

  return (
    <div>
      <label className="label">Жанры</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {allTags.map((g) => {
          const active = g === OTHER ? otherActive : value.some((v) => v.toLowerCase() === g.toLowerCase());
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggle(g)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: active ? 'var(--accent)' : 'var(--surface-2)',
                color: active ? 'oklch(0.98 0 0)' : 'var(--ink-2)',
                transition: 'background 0.12s, border-color 0.12s, color 0.12s',
              }}
            >
              {g}
            </button>
          );
        })}
      </div>
      {showCustom && (
        <input
          ref={inputRef}
          className="input"
          style={{ marginTop: 8 }}
          value={customInput}
          placeholder="Введите свой жанр…"
          onChange={(e) => setCustomInput(e.target.value)}
          onBlur={handleCustomBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleCustomBlur(); }
          }}
        />
      )}
    </div>
  );
}
