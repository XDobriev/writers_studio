import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { supabase, type Book } from '../lib/supabase';
import {
  countWords,
  listChapters,
  updateChapter,
  type Chapter,
  type ChapterPatch,
} from '../lib/chapters';

type Side = 'left' | 'right';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function Split() {
  const { id: bookId } = useParams<{ id: string }>();
  const [search, setSearch] = useSearchParams();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<Record<Side, SaveState>>({ left: 'idle', right: 'idle' });

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      try {
        const [bookRes, list] = await Promise.all([
          supabase.from('books').select('*').eq('id', bookId).single(),
          listChapters(bookId),
        ]);
        if (cancelled) return;
        if (bookRes.error) throw bookRes.error;
        setBook(bookRes.data as Book);
        setChapters(list);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  const leftId = search.get('left');
  const rightId = search.get('right');

  useEffect(() => {
    if (!chapters || chapters.length === 0) return;
    const next = new URLSearchParams(search);
    let changed = false;
    if (!leftId || !chapters.some((c) => c.id === leftId)) {
      next.set('left', chapters[0].id);
      changed = true;
    }
    if (!rightId || !chapters.some((c) => c.id === rightId)) {
      const fallback = chapters[1] ?? chapters[0];
      next.set('right', fallback.id);
      changed = true;
    }
    if (changed) setSearch(next, { replace: true });
  }, [chapters, leftId, rightId, search, setSearch]);

  const select = useCallback((side: Side, id: string) => {
    const next = new URLSearchParams(search);
    next.set(side, id);
    setSearch(next, { replace: false });
  }, [search, setSearch]);

  const leftChapter = useMemo(
    () => (chapters && leftId ? chapters.find((c) => c.id === leftId) ?? null : null),
    [chapters, leftId],
  );
  const rightChapter = useMemo(
    () => (chapters && rightId ? chapters.find((c) => c.id === rightId) ?? null : null),
    [chapters, rightId],
  );

  const onPersist = useCallback(async (id: string, patch: ChapterPatch, side: Side) => {
    setSaveState((s) => ({ ...s, [side]: 'saving' }));
    try {
      const updated = await updateChapter(id, patch);
      setChapters((prev) => prev ? prev.map((c) => (c.id === id ? updated : c)) : prev);
      setSaveState((s) => ({ ...s, [side]: 'saved' }));
    } catch (e) {
      setSaveState((s) => ({ ...s, [side]: 'error' }));
      setError((e as Error).message);
    }
  }, []);

  if (!bookId) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)' }}>Ошибка: {error}</div>
        <Link to={`/books/${bookId}/editor`} className="btn" style={{ marginTop: 16, textDecoration: 'none' }}>← Назад к редактору</Link>
      </div>
    );
  }

  if (!book || !chapters) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink-3)', padding: 32 }}>
        Загрузка…
      </div>
    );
  }

  if (chapters.length < 2) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink-2)', padding: 32, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ font: '500 16px var(--font-serif)' }}>Для сравнения нужно минимум две главы.</div>
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Сейчас в книге {chapters.length === 0 ? 'нет глав' : 'одна глава'}.</div>
        <Link to={`/books/${bookId}/editor`} className="btn btn--primary" style={{ textDecoration: 'none' }}>← Открыть редактор</Link>
      </div>
    );
  }

  return (
    <div className="as as-app" style={{ height: '100vh' }}>
      <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
        <div className="tb" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to={`/books/${bookId}`} className="btn btn--ghost" style={{ textDecoration: 'none', fontSize: 12 }}>← {book.title}</Link>
            <span className="chip" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' }}>Сравнение глав</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Link to={`/books/${bookId}/editor${leftId ? `?chapter=${leftId}` : ''}`} className="tb-btn" style={{ textDecoration: 'none' }}><Icon name="book" size={15} /></Link>
            <Link to={`/books/${bookId}/focus${leftId ? `?chapter=${leftId}` : ''}`} className="tb-btn" style={{ textDecoration: 'none' }}><Icon name="focus" size={15} /></Link>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border-soft)', overflow: 'hidden' }}>
          {(['left', 'right'] as const).map((side) => {
            const ch = side === 'left' ? leftChapter : rightChapter;
            return (
              <Pane
                key={side}
                side={side}
                chapter={ch}
                chapters={chapters}
                saveState={saveState[side]}
                onSelect={(id) => select(side, id)}
                onPersist={(id, patch) => onPersist(id, patch, side)}
              />
            );
          })}
        </div>

        <div className="status">
          <span>{saveState.left === 'saved' && saveState.right === 'saved' ? '● обе панели сохранены' : 'автосохранение…'}</span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>
            слева: {leftChapter?.title ?? '—'} · справа: {rightChapter?.title ?? '—'}
          </span>
        </div>
      </main>
    </div>
  );
}

function Pane({ side, chapter, chapters, saveState, onSelect, onPersist }: {
  side: Side;
  chapter: Chapter | null;
  chapters: Chapter[];
  saveState: SaveState;
  onSelect: (id: string) => void;
  onPersist: (id: string, patch: ChapterPatch) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<ChapterPatch | null>(null);
  const targetIdRef = useRef<string | null>(null);

  const flush = useCallback(() => {
    const patch = pendingPatch.current;
    const id = targetIdRef.current;
    pendingPatch.current = null;
    if (!patch || !id) return;
    onPersist(id, patch);
  }, [onPersist]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flush();
  }, [flush]);

  // На смену активной главы — сначала flush предыдущей, потом подменить content.
  const lastChIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastChIdRef.current && lastChIdRef.current !== chapter?.id) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flush();
    }
    lastChIdRef.current = chapter?.id ?? null;
  }, [chapter?.id, flush]);

  useEffect(() => {
    if (!chapter || !editorRef.current) return;
    if (editorRef.current.innerHTML !== chapter.content) {
      editorRef.current.innerHTML = chapter.content || '';
    }
  }, [chapter?.id]);

  const onInput = useCallback(() => {
    if (!chapter || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    targetIdRef.current = chapter.id;
    pendingPatch.current = { ...(pendingPatch.current ?? {}), content: html, words: countWords(html) };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { flush(); }, 700);
  }, [chapter, flush]);

  const labels: Record<SaveState, { text: string; color: string }> = {
    idle: { text: '', color: 'var(--ink-4)' },
    saving: { text: '● сохранение', color: 'var(--accent-2)' },
    saved: { text: '● сохранено', color: 'var(--ok)' },
    error: { text: '● ошибка', color: 'var(--danger)' },
  };

  return (
    <div style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ height: 36, flexShrink: 0, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-deep)' }}>
        <span style={{ font: '500 9.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>{side === 'left' ? 'слева' : 'справа'}</span>
        <select
          value={chapter?.id ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          style={{ flex: 1, minWidth: 0, height: 26, padding: '0 6px', border: '1px solid var(--border-soft)', borderRadius: 5, background: 'var(--surface)', color: 'var(--ink)', fontSize: 12, outline: 'none' }}
        >
          {chapters.map((c, i) => (
            <option key={c.id} value={c.id}>{String(i + 1).padStart(2, '0')} · {c.title}</option>
          ))}
        </select>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', flexShrink: 0 }}>{chapter ? `${chapter.words.toLocaleString('ru-RU')} сл` : ''}</span>
        {labels[saveState].text && (
          <span style={{ font: '400 10.5px var(--font-mono)', color: labels[saveState].color, flexShrink: 0 }}>{labels[saveState].text}</span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '28px 24px 60px', background: 'var(--bg)' }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          spellCheck
          className="sheet"
          style={{ width: 520, padding: '40px 48px 60px', fontSize: 15.5, outline: 'none' }}
        />
      </div>
    </div>
  );
}
