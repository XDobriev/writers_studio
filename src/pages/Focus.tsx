import { useCallback, useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RichEditor } from '../components/RichEditor';
import { type SaveState } from '../lib/chapters';
import { plural } from '../lib/i18n';
import { useBook, useChapters, useChapterContent } from '../lib/queries';
import { useAuth } from '../lib/auth';
import { useUserDisplay } from '../lib/useUserDisplay';
import { useChapterVersioning } from '../lib/useChapterVersioning';
import { useChapterAutosave, useRecoveredChapterContent } from '../lib/useChapterAutosave';
import { SaveNotice, UnsavedBanner } from '../components/SaveStatusBanners';

export default function Focus() {
  const { id: bookId } = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan } = useUserDisplay();
  const isPro = plan === 'pro' || plan === 'lifetime';

  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);

  const requestedId = search.get('chapter');
  const activeId = useMemo(() => {
    if (!chapters || chapters.length === 0) return null;
    if (requestedId && chapters.some((c) => c.id === requestedId)) return requestedId;
    return chapters[0].id;
  }, [chapters, requestedId]);

  // Тот же путь сохранения, что в редакторе: очередь, черновик, версии, бэклинки.
  const autosave = useChapterAutosave({ bookId, userId: user?.id, isPro });
  const { flush, saveState } = autosave;
  const { data: chapterContentData } = useChapterContent(activeId ?? undefined);
  const activeUpdatedAt = chapters?.find((c) => c.id === activeId)?.updated_at;
  const { content: activeContent, ready: contentReady } = useRecoveredChapterContent(
    activeId, chapterContentData, activeUpdatedAt, autosave, { userId: user?.id, isPro },
  );
  const { onContentTracked } = useChapterVersioning({ chapterId: activeId, userId: user?.id, isPro });
  useEffect(() => { onContentTracked(activeContent); }, [activeContent, onContentTracked]);

  const activeChapter = useMemo(
    () => (chapters && activeId ? chapters.find((c) => c.id === activeId) ?? null : null),
    [chapters, activeId],
  );

  const error = (bookError ?? chaptersError)?.message ?? null;

  // Выход: дождаться записи (не дольше 3 с), чтобы редактор открылся с актуальной
  // точкой отсчёта на сервере. Текст в любом случае уже в кэше и в локальном черновике.
  const exit = useCallback(async () => {
    await Promise.race([flush(), new Promise((r) => setTimeout(r, 3000))]);
    const target = activeId
      ? `/books/${bookId}/editor?chapter=${activeId}`
      : `/books/${bookId}/editor`;
    navigate(target);
  }, [activeId, bookId, flush, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { void exit(); return; }
      const mod = /mac/i.test(navigator.platform) ? e.metaKey : e.ctrlKey;
      if (mod && e.code === 'KeyS') { e.preventDefault(); void flush(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exit, flush]);

  const onContentChange = useCallback((html: string) => {
    if (!activeId) return;
    onContentTracked(html);
    autosave.scheduleContent(activeId, html);
  }, [activeId, autosave, onContentTracked]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100dvh', background: 'oklch(0.10 0.012 50)', color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)' }}>Ошибка: {error}</div>
        <button className="btn" style={{ marginTop: 16 }} onClick={() => { void exit(); }}>← Назад к редактору</button>
      </div>
    );
  }

  if (!book || !chapters) {
    return (
      <div className="as" style={{ minHeight: '100dvh', background: 'oklch(0.10 0.012 50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="page-spinner" style={{ borderColor: 'oklch(0.35 0.012 50)', borderTopColor: 'var(--accent)' }} />
      </div>
    );
  }

  if (!activeChapter) {
    return (
      <div className="as" style={{ minHeight: '100dvh', background: 'oklch(0.10 0.012 50)', color: 'var(--ink-3)', padding: 32, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
        <div>В книге ещё нет глав.</div>
        <button className="btn" onClick={() => { void exit(); }}>← Открыть редактор</button>
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
      <div className="focus-pill">
        <span className="focus-pill__where"><span className="focus-pill__book">{book.title} · </span>{String(idx + 1).padStart(2, '0')} · {activeChapter.title}</span>
        <span className="focus-pill__sep" />
        <span>{activeChapter.words.toLocaleString('ru-RU')} сл</span>
        {saveLabel[saveState].text && (
          <>
            <span className="focus-pill__sep" />
            <span style={{ color: saveLabel[saveState].color }}>{saveLabel[saveState].text}</span>
          </>
        )}
      </div>

      {saveState === 'error' && <UnsavedBanner onRetry={() => { void flush(); }} />}
      {autosave.notice && <SaveNotice message={autosave.notice} onDismiss={autosave.clearNotice} />}

      <button
        onClick={() => { void exit(); }}
        title="Выйти из фокус-режима (Esc)"
        className="tb-btn"
        style={{ position: 'absolute', top: 18, right: 18, padding: '0 12px', height: 30, font: '400 10.5px var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-3)', border: '1px solid var(--border-soft)', background: 'oklch(from var(--bg-deep) l c h / 0.7)', backdropFilter: 'blur(8px)', borderRadius: 8 }}
      >
        ESC ↩
      </button>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '80px 40px 60px', overflow: 'auto' }}>
        <RichEditor
          value={activeContent}
          onChange={onContentChange}
          contentKey={activeChapter.id}
          contentReady={contentReady}
          placeholder="Только текст и вы. Печатайте…"
          attributesStyle={focusEditorStyle}
          style={{ width: 720, maxWidth: '100%', minHeight: 'calc(100dvh - 200px)' }}
        />
      </div>

      <div className="focus-foot">
        <span className="focus-foot__label">фокус-режим</span>
        <span style={{ flex: 1 }} />
        {book.goal > 0 ? (
          <>
            <span>{activeChapter.words.toLocaleString('ru-RU')} / {book.goal.toLocaleString('ru-RU')} в книге</span>
            <svg className="focus-foot__bar" width="120" height="6" viewBox="0 0 120 6">
              <rect x="0" y="2" width="120" height="2" fill="var(--surface-2)" />
              <rect x="0" y="2" width={Math.min(120, (book.words / book.goal) * 120)} height="2" fill="var(--accent)" />
            </svg>
            <span style={{ color: 'var(--accent)' }}>{book.words.toLocaleString('ru-RU')}/{book.goal.toLocaleString('ru-RU')}</span>
          </>
        ) : (
          <span>{book.words.toLocaleString('ru-RU')} {plural(book.words, 'слово', 'слова', 'слов')} в книге</span>
        )}
      </div>
    </div>
  );
}
