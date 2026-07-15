import { useState, useRef, useEffect } from 'react';

interface SeriesNameEditProps {
  name: string;
  onRename: (next: string) => void;
}

/**
 * Инлайн-переименование серии в подписи группы на Home. Не держит серверное
 * имя в состоянии: draft живёт только на время правки и сбрасывается от `name`
 * при каждом входе в режим редактирования.
 */
export function SeriesNameEdit({ name, onRename }: SeriesNameEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== name) onRename(next);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="series-name-edit"
        onClick={() => { setDraft(name); setEditing(true); }}
        title={`Переименовать серию: ${name}`}
        aria-label={`Переименовать серию: ${name}`}
      >
        {name}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      className="series-name-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
      }}
      aria-label="Название серии"
    />
  );
}
