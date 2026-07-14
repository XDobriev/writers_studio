import { useBookContentCounts } from '../lib/queries';
import type { Book } from '../lib/supabase';
import type { SeriesTransferOptions } from '../lib/books';

export interface SeriesTransferState {
  enabled: boolean;
  sourceBookId: string;
  characters: boolean;
  locationsMap: boolean;
  notes: boolean;
  timeline: boolean;
}

export const INITIAL_SERIES_TRANSFER: SeriesTransferState = {
  enabled: false,
  sourceBookId: '',
  characters: true,
  locationsMap: true,
  notes: true,
  timeline: false,
};

export function toTransferOptions(s: SeriesTransferState): SeriesTransferOptions {
  return {
    characters: s.characters,
    locationsMap: s.locationsMap,
    notes: s.notes,
    timeline: s.timeline,
  };
}

type OptionKey = 'characters' | 'locationsMap' | 'notes' | 'timeline';

interface SeriesTransferPickerProps {
  books: Book[];
  value: SeriesTransferState;
  onChange: (v: SeriesTransferState) => void;
  disabled?: boolean;
}

// Секция «продолжение серии» в модале новой книги: выбор книги-источника
// и что перенести. Переносится всё-или-ничего внутри каждой группы.
export function SeriesTransferPicker({ books, value, onChange, disabled }: SeriesTransferPickerProps) {
  const sourceId = value.enabled && value.sourceBookId ? value.sourceBookId : undefined;
  const { data: counts, isPending } = useBookContentCounts(sourceId);

  if (books.length === 0) return null;

  const toggleEnabled = (enabled: boolean) => {
    onChange({
      ...value,
      enabled,
      sourceBookId: enabled && !value.sourceBookId ? books[0].id : value.sourceBookId,
    });
  };

  const options: { key: OptionKey; label: string; hint?: string; count?: number }[] = [
    { key: 'characters', label: 'Персонажи', hint: 'вместе со связями', count: counts?.characters },
    { key: 'locationsMap', label: 'Локации и карта мира', hint: 'штампы, фон, шаблон', count: counts?.locations },
    { key: 'notes', label: 'Заметки', count: counts?.notes },
    { key: 'timeline', label: 'Хронология', hint: 'события книги 1 — часто предыстория', count: counts?.timeline },
  ];

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'default' : 'pointer' }}>
        <input
          type="checkbox"
          checked={value.enabled}
          disabled={disabled}
          onChange={(e) => toggleEnabled(e.target.checked)}
          style={{ flexShrink: 0, accentColor: 'var(--accent)', width: 14, height: 14 }}
        />
        <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink-1)' }}>
          Это продолжение серии
        </span>
      </label>

      {value.enabled && (
        <div
          style={{
            marginTop: 10,
            padding: 14,
            borderRadius: 8,
            border: '1px solid var(--border-soft)',
            background: 'color-mix(in oklch, var(--accent) 4%, var(--surface))',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div>
            <label htmlFor="series-source" className="label">Книга-источник</label>
            <select
              id="series-source"
              className="input"
              value={value.sourceBookId}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, sourceBookId: e.target.value })}
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">Перенести</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {options.map((o) => {
                const empty = o.count === 0;
                return (
                  <label
                    key={o.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: disabled || empty ? 'default' : 'pointer',
                      opacity: empty ? 0.45 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={value[o.key] && !empty}
                      disabled={disabled || empty}
                      onChange={(e) => onChange({ ...value, [o.key]: e.target.checked })}
                      style={{ flexShrink: 0, accentColor: 'var(--accent)', width: 14, height: 14 }}
                    />
                    <span style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-2)' }}>
                      {o.label}
                    </span>
                    <span style={{ font: '400 12px var(--font-mono)', color: 'var(--ink-4)' }}>
                      {isPending ? '…' : o.count}
                    </span>
                    {o.hint && (
                      <span className="hide-sm" style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)' }}>
                        · {o.hint}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            <div className="input-hint">
              Главы не переносятся. Копии не связаны с оригиналом: правки в новой книге не затронут книгу-источник.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
