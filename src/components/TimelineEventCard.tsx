import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  TYPE_COLORS,
  TYPE_LABELS,
  type TimelineEvent,
  type TimelineEventPatch,
  type TimelineEventType,
} from '../lib/timeline';
import type { ChapterMeta } from '../lib/chapters';

export function TimelineEventCard({
  event,
  chapters,
  onUpdate,
  onDelete,
}: {
  event: TimelineEvent;
  chapters: ChapterMeta[];
  onUpdate: (patch: TimelineEventPatch) => void;
  onDelete: () => void;
}) {
  const [era, setEra] = useState(event.era);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<TimelineEventPatch>({});

  useEffect(() => { setEra(event.era); }, [event.id, event.era]);
  useEffect(() => { setTitle(event.title); }, [event.id, event.title]);
  useEffect(() => { setDescription(event.description); }, [event.id, event.description]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const schedule = (patch: TimelineEventPatch) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const p = pending.current;
      pending.current = {};
      onUpdate(p);
    }, 700);
  };

  const onEraChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEra(e.target.value);
    schedule({ era: e.target.value });
  };
  const onTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTitle(v);
    schedule({ title: v });
  };
  const onDescChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    schedule({ description: e.target.value });
  };
  const onTypeChange = (type: TimelineEventType) => onUpdate({ type });
  const onChapterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ chapter_id: e.target.value === '' ? null : e.target.value });
  };

  const color = TYPE_COLORS[event.type];

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          left: -23,
          top: 16,
          width: 14,
          height: 14,
          borderRadius: 999,
          background: color,
          border: '3px solid var(--bg)',
        }}
      />
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-soft)',
          borderTop: `2px solid ${color}`,
          borderRadius: 10,
          padding: '14px 18px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          {(['plot', 'character', 'world', 'other'] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTypeChange(t)}
              aria-pressed={event.type === t}
              className={'chip' + (event.type === t ? ' chip--accent' : '')}
              style={{ cursor: 'pointer', border: 'none' }}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            onClick={onDelete}
            title="Удалить событие"
            aria-label="Удалить событие"
            className="btn-danger-hover"
            style={{ padding: '4px 6px', font: '400 16px var(--font-ui)', lineHeight: 1, borderRadius: 4 }}
          >
            ×
          </button>
        </div>

        <input
          value={title}
          onChange={onTitleChange}
          placeholder="Название события"
          aria-label="Название события"
          style={{
            width: '100%',
            font: '500 17px var(--font-serif)',
            color: 'var(--ink)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '2px 0',
            marginBottom: 6,
          }}
        />

        <textarea
          value={description}
          onChange={onDescChange}
          placeholder="Что произошло"
          aria-label="Описание события"
          rows={2}
          style={{
            width: '100%',
            font: '400 13px/1.55 var(--font-serif)',
            color: 'var(--ink-2)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            padding: 0,
            marginBottom: 12,
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            paddingTop: 10,
            borderTop: '1px solid var(--border-soft)',
          }}
        >
          <input
            value={era}
            onChange={onEraChange}
            aria-label="Когда"
            placeholder="когда (Зима 824)"
            style={{
              flex: '1 1 120px',
              height: 28,
              padding: '0 10px',
              border: '1px solid var(--border-soft)',
              borderRadius: 6,
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              font: '400 12px var(--font-ui)',
              outline: 'none',
            }}
          />
          <select
            value={event.chapter_id ?? ''}
            onChange={onChapterChange}
            aria-label="Глава"
            style={{
              flex: '1 1 120px',
              height: 28,
              padding: '0 8px',
              border: '1px solid var(--border-soft)',
              borderRadius: 6,
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              fontSize: 12,
              outline: 'none',
            }}
          >
            <option value="">без главы</option>
            {chapters.map((ch, i) => (
              <option key={ch.id} value={ch.id}>
                {String(i + 1).padStart(2, '0')} · {ch.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
