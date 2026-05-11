import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase, type Book } from '../lib/supabase';
import {
  countWords,
  listChapters,
  updateChapter,
  type Chapter,
  type ChapterPatch,
} from '../lib/chapters';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function Focus() {
  const { id: bookId } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const requestedChapter = search.get('chapter');

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

  const activeChapter = useMemo(() => {
    if (!chapters || chapters.length === 0) return null;
    if (requestedChapter) {
      const found = chapters.find((c) => c.id === requestedChapter);
      if (found) return found;
    }
    return chapters[0];
  }, [chapters, requestedChapter]);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<ChapterPatch | null>(null);
  const targetIdRef = useRef<string | null>(null);

  const flush = useCallback(async () => {
    const patch = pendingPatch.current;
    const id = targetIdRef.current;
    pendingPatch.current = null;
    if (!patch || !id) return;
    setSaveState('saving');
    try {
      const updated = await updateChapter(id, patch);
      setChapters((prev) => prev ? prev.map((c) => (c.id === id ? updated : c)) : prev);
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      setError((e as Error).message);
    }
  }, []);

  const scheduleSave = useCallback((id: string, patch: ChapterPatch) => {
    targetIdRef.current = id;
    pendingPatch.current = { ...(pendingPatch.current ?? {}), ...patch };
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flush(); }, 700);
  }, [flush]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void flush();
  }, [flush]);

  useEffect(() => {
    if (!activeChapter || !editorRef.current) return;
    if (editorRef.current.innerHTML !== activeChapter.content) {
      editorRef.current.innerHTML = activeChapter.content || '';
    }
  }, [activeChapter?.id]);

  const exit = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      void flush();
    }
    const target = activeChapter ? `/books/${bookId}/editor?chapter=${activeChapter.id}` : `/books/${bookId}/editor`;
    navigate(target);
  }, [activeChapter, bookId, flush, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exit]);

  const onInput = useCallback(() => {
    if (!activeChapter || !editorRef.current) return;
    const html = editorRef.current.innerHTML;
    scheduleSave(activeChapter.id, { content: html, words: countWords(html) });
  }, [activeChapter, scheduleSave]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'oklch(0.10 0.012 50)', color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)' }}>Ошибка: {error}</div>
        <button className="btn" style={{ marginTop: 16 }} onClick={exit}>← Назад к редактору</button>
      </div>
    );
  }

  if (!book || !chapters) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'oklch(0.10 0.012 50)', color: 'var(--ink-3)', padding: 32 }}>
        Загрузка…
      </div>
    );
  }

  if (!activeChapter) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'oklch(0.10 0.012 50)', color: 'var(--ink-3)', padding: 32, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
        <div>В книге ещё нет глав.</div>
        <button className="btn" onClick={exit}>← Открыть редактор</button>
      </div>
    );
  }

  const idx = chapters.findIndex((c) => c.id === activeChapter.id);
  const saveLabel: Record<SaveState, { text: string; color: string }> = {
    idle: { text: '', color: 'var(--ink-4)' },
    saving: { text: '● сохранение', color: 'var(--accent-2)' },
    saved: { text: '● сохранено', color: 'var(--ok)' },
    error: { text: '● ошибка', color: 'var(--danger)' },
  };

  return (
    <div className="as" style={{ height: '100vh', background: 'oklch(0.10 0.012 50)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: 'oklch(0.20 0.014 50 / 0.7)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-soft)', borderRadius: 999, padding: '6px 12px' }}>
        <span style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{book.title} · {String(idx + 1).padStart(2, '0')} · {activeChapter.title}</span>
        <span style={{ width: 1, height: 14, background: 'var(--border-soft)' }} />
        <span style={{ font: '400 10.5px var(--font-mono)', color: 'var(--ink-3)' }}>{activeChapter.words.toLocaleString('ru-RU')} сл</span>
        {saveLabel[saveState].text && (
          <>
            <span style={{ width: 1, height: 14, background: 'var(--border-soft)' }} />
            <span style={{ font: '400 10.5px var(--font-mono)', color: saveLabel[saveState].color }}>{saveLabel[saveState].text}</span>
          </>
        )}
      </div>

      <button
        onClick={exit}
        title="Выйти из фокус-режима (Esc)"
        className="tb-btn"
        style={{ position: 'absolute', top: 18, right: 18, padding: '0 12px', height: 30, font: '400 10.5px var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-3)', border: '1px solid var(--border-soft)', background: 'oklch(0.20 0.014 50 / 0.7)', backdropFilter: 'blur(8px)', borderRadius: 8 }}
      >
        ESC ↩
      </button>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '80px 40px 60px', overflow: 'auto' }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          spellCheck
          style={{
            width: 720,
            maxWidth: '100%',
            fontFamily: 'var(--font-serif)',
            color: 'oklch(0.92 0.014 85)',
            fontSize: 18,
            lineHeight: 1.85,
            letterSpacing: '0.005em',
            outline: 'none',
            minHeight: 'calc(100vh - 200px)',
          }}
        />
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14, font: '400 11px var(--font-mono)', color: 'var(--ink-4)' }}>
        <span>фокус-режим</span>
        <span style={{ flex: 1 }} />
        <span>{activeChapter.words.toLocaleString('ru-RU')} / {book.goal.toLocaleString('ru-RU')} в книге</span>
        <svg width="120" height="6" viewBox="0 0 120 6">
          <rect x="0" y="2" width="120" height="2" fill="var(--surface-2)" />
          <rect x="0" y="2" width={Math.min(120, (book.words / Math.max(1, book.goal)) * 120)} height="2" fill="var(--accent)" />
        </svg>
        <span style={{ color: 'var(--accent)' }}>{book.words.toLocaleString('ru-RU')}/{book.goal.toLocaleString('ru-RU')}</span>
      </div>
    </div>
  );
}
