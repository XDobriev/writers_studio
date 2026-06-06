import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { RichEditor } from '../components/RichEditor';
import {
  countWords,
  updateChapter,
  type ChapterPatch,
  type SaveState,
} from '../lib/chapters';
import { useBook, useChapters, useChapterContent } from '../lib/queries';
import { updateChapterWithCache } from '../lib/chapterMutations';
import { useDebouncedSave } from '../lib/useDebouncedSave';

export default function Focus() {
  const { id: bookId } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);

  const requestedId = search.get('chapter');
  const activeId = useMemo(() => {
    if (!chapters || chapters.length === 0) return null;
    if (requestedId && chapters.some((c) => c.id === requestedId)) return requestedId;
    return chapters[0].id;
  }, [chapters, requestedId]);

  const { data: chapterContentData } = useChapterContent(activeId ?? undefined);
  const activeContent = chapterContentData?.content ?? '';

  const activeChapter = useMemo(
    () => (chapters && activeId ? chapters.find((c) => c.id === activeId) ?? null : null),
    [chapters, activeId],
  );

  const [saveState, setSaveState] = useState<SaveState>('idle');

  const { scheduleSave, flush } = useDebouncedSave<ChapterPatch>(
    async (id, patch) => {
      if (!bookId) return;
      setSaveState('saving');
      try {
        const updated = await updateChapter(id, patch);
        updateChapterWithCache(queryClient, bookId, updated);
        setSaveState('saved');
      } catch (e) {
        setSaveState('error');
        throw e;
      }
    },
    700,
  );

  const error = (bookError ?? chaptersError)?.message ?? null;

  const exit = useCallback(() => {
    void flush();
    const target = activeId
      ? `/books/${bookId}/editor?chapter=${activeId}`
      : `/books/${bookId}/editor`;
    navigate(target);
  }, [activeId, bookId, flush, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exit(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exit]);

  const onContentChange = useCallback((html: string) => {
    if (!activeId) return;
    scheduleSave(activeId, { content: html, words: countWords(html) });
  }, [activeId, scheduleSave]);

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
      <div className="as" style={{ minHeight: '100vh', background: 'oklch(0.10 0.012 50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="page-spinner" style={{ borderColor: 'oklch(0.35 0.012 50)', borderTopColor: 'var(--accent)' }} />
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
    idle:   { text: '',               color: 'var(--ink-4)'    },
    saving: { text: '● сохранение',  color: 'var(--accent-2)' },
    saved:  { text: '● сохранено',   color: 'var(--ok)'       },
    error:  { text: '● ошибка',      color: 'var(--danger)'   },
  };

  const focusEditorStyle =
    'outline:none;font-family:var(--font-serif);color:oklch(0.92 0.014 85);font-size:18px;line-height:1.85;letter-spacing:0.005em;caret-color:oklch(0.76 0.25 68);';

  return (
    <div className="as" style={{ height: '100dvh', background: 'oklch(0.10 0.012 50)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
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
        <RichEditor
          value={activeContent}
          onChange={onContentChange}
          contentKey={activeChapter.id}
          placeholder="Только текст и вы. Печатайте…"
          attributesStyle={focusEditorStyle}
          style={{ width: 720, maxWidth: '100%', minHeight: 'calc(100vh - 200px)' }}
        />
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14, font: '400 11px var(--font-mono)', color: 'var(--ink-4)' }}>
        <span>фокус-режим</span>
        <span style={{ flex: 1 }} />
        {book.goal > 0 ? (
          <>
            <span>{activeChapter.words.toLocaleString('ru-RU')} / {book.goal.toLocaleString('ru-RU')} в книге</span>
            <svg width="120" height="6" viewBox="0 0 120 6">
              <rect x="0" y="2" width="120" height="2" fill="var(--surface-2)" />
              <rect x="0" y="2" width={Math.min(120, (book.words / book.goal) * 120)} height="2" fill="var(--accent)" />
            </svg>
            <span style={{ color: 'var(--accent)' }}>{book.words.toLocaleString('ru-RU')}/{book.goal.toLocaleString('ru-RU')}</span>
          </>
        ) : (
          <span>{book.words.toLocaleString('ru-RU')} слов в книге</span>
        )}
      </div>
    </div>
  );
}
