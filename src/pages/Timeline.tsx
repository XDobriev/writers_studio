import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Sidebar, WithMode } from '../components/Chrome';
import { useAuth } from '../lib/auth';
import { supabase, type Book } from '../lib/supabase';
import { listChapters, type Chapter } from '../lib/chapters';
import {
  createTimelineEvent,
  deleteTimelineEvent,
  listTimelineEvents,
  TYPE_COLORS,
  TYPE_LABELS,
  updateTimelineEvent,
  type TimelineEvent,
  type TimelineEventPatch,
  type TimelineEventType,
} from '../lib/timeline';

type TypeFilter = 'all' | TimelineEventType;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'все' },
  { value: 'plot', label: 'сюжет' },
  { value: 'character', label: 'персонаж' },
  { value: 'world', label: 'мир' },
  { value: 'other', label: 'другое' },
];

export default function Timeline() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [book, setBook] = useState<Book | null>(null);
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TypeFilter>('all');

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      try {
        const [bookRes, evList, chList] = await Promise.all([
          supabase.from('books').select('*').eq('id', bookId).single(),
          listTimelineEvents(bookId),
          listChapters(bookId),
        ]);
        if (cancelled) return;
        if (bookRes.error) throw bookRes.error;
        setBook(bookRes.data as Book);
        setEvents(evList);
        setChapters(chList);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  const onCreate = useCallback(async () => {
    if (!bookId || !user) return;
    const position = events?.length ?? 0;
    try {
      const created = await createTimelineEvent(bookId, user.id, { position });
      setEvents((prev) => [...(prev ?? []), created]);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, user, events]);

  const onUpdate = useCallback(async (id: string, patch: TimelineEventPatch) => {
    setEvents((prev) => prev ? prev.map((e) => (e.id === id ? { ...e, ...patch } as TimelineEvent : e)) : prev);
    try {
      const updated = await updateTimelineEvent(id, patch);
      setEvents((prev) => prev ? prev.map((e) => (e.id === id ? updated : e)) : prev);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const onDelete = useCallback(async (id: string) => {
    if (!window.confirm('Удалить это событие? Действие нельзя отменить.')) return;
    try {
      await deleteTimelineEvent(id);
      setEvents((prev) => prev ? prev.filter((e) => e.id !== id) : prev);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const filtered = useMemo(() => {
    if (!events) return [];
    if (filter === 'all') return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)' }}>Ошибка: {error}</div>
      </div>
    );
  }

  if (!book || !events || !chapters) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink-3)', padding: 32 }}>
        Загрузка…
      </div>
    );
  }

  return (
    <WithMode active="timeline">
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <Sidebar book={book} subtitle={`хронология · ${events.length}`}>
          <div className="sb-section"><span className="sb-section-title">Слои</span></div>
          <div style={{ padding: '4px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                className={'sb-item' + (filter === f.value ? ' sb-item--on' : '')}
                onClick={() => setFilter(f.value)}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <span style={{ width: 14, height: 14, borderRadius: 3, background: f.value === 'all' ? 'transparent' : TYPE_COLORS[f.value], border: f.value === 'all' ? '1px solid var(--border)' : 'none' }} />
                <span className="sb-item-title">{f.label}</span>
                <span />
              </button>
            ))}
          </div>
        </Sidebar>

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <span style={{ font: '500 13px var(--font-ui)' }}>Хронология «{book.title}»</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={onCreate} className="btn"><Icon name="plus" size={14} /> Событие</button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '32px 48px' }}>
            {filtered.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--ink-3)', padding: '48px 0' }}>
                <div style={{ font: '500 14px var(--font-ui)' }}>
                  {events.length === 0 ? 'Хронология пуста' : 'Нет событий в этом слое'}
                </div>
                {events.length === 0 && (
                  <button onClick={onCreate} className="btn"><Icon name="plus" size={13} /> Создать первое событие</button>
                )}
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                <div style={{ position: 'absolute', left: 7, top: 6, bottom: 6, width: 2, background: 'var(--border-soft)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {filtered.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      chapters={chapters}
                      onUpdate={(patch) => onUpdate(ev.id, patch)}
                      onDelete={() => onDelete(ev.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </WithMode>
  );
}

function EventCard({ event, chapters, onUpdate, onDelete }: {
  event: TimelineEvent;
  chapters: Chapter[];
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

  const onEraChange = (e: ChangeEvent<HTMLInputElement>) => { setEra(e.target.value); schedule({ era: e.target.value }); };
  const onTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTitle(v);
    schedule({ title: v.trim() === '' ? 'Событие' : v });
  };
  const onDescChange = (e: ChangeEvent<HTMLTextAreaElement>) => { setDescription(e.target.value); schedule({ description: e.target.value }); };
  const onTypeChange = (type: TimelineEventType) => onUpdate({ type });
  const onChapterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ chapter_id: e.target.value === '' ? null : e.target.value });
  };

  const color = TYPE_COLORS[event.type];

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: -23, top: 16, width: 14, height: 14, borderRadius: 999, background: color, border: '3px solid var(--bg)' }} />
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          {(['plot', 'character', 'world', 'other'] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTypeChange(t)}
              className={'chip' + (event.type === t ? ' chip--accent' : '')}
              style={{ cursor: 'pointer', border: 'none' }}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
          <input
            value={era}
            onChange={onEraChange}
            placeholder="когда (например, Зима 824)"
            style={{ flex: 1, minWidth: 160, height: 28, padding: '0 10px', border: '1px solid var(--border-soft)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink)', font: '400 12px var(--font-ui)', outline: 'none' }}
          />
          <select
            value={event.chapter_id ?? ''}
            onChange={onChapterChange}
            style={{ height: 28, padding: '0 8px', border: '1px solid var(--border-soft)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 12, outline: 'none' }}
          >
            <option value="">без главы</option>
            {chapters.map((ch, i) => (
              <option key={ch.id} value={ch.id}>{String(i + 1).padStart(2, '0')} · {ch.title}</option>
            ))}
          </select>
          <button
            onClick={onDelete}
            title="Удалить событие"
            style={{ background: 'transparent', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', padding: '4px 8px', font: '400 16px var(--font-ui)', lineHeight: 1, borderRadius: 4 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-4)'; }}
          >
            ×
          </button>
        </div>

        <input
          value={title}
          onChange={onTitleChange}
          placeholder="Название события"
          style={{ width: '100%', font: '500 17px var(--font-serif)', color: 'var(--ink)', background: 'transparent', border: 'none', outline: 'none', padding: '2px 0', marginBottom: 6 }}
        />

        <textarea
          value={description}
          onChange={onDescChange}
          placeholder="Что произошло"
          rows={2}
          style={{ width: '100%', font: '400 13px/1.55 var(--font-serif)', color: 'var(--ink-2)', background: 'transparent', border: 'none', outline: 'none', resize: 'vertical', padding: 0 }}
        />
      </div>
    </div>
  );
}
