import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useResponsive } from '../lib/useResponsive';
import { Icon } from '../components/Icon';
import { RichEditor } from '../components/RichEditor';
import { SaveNotice, UnsavedBanner } from '../components/SaveStatusBanners';
import { type ChapterMeta } from '../lib/chapters';
import { useBook, useChapters, useChapterContent } from '../lib/queries';
import { useAuth } from '../lib/auth';
import { useUserDisplay } from '../lib/useUserDisplay';
import { useChapterVersioning } from '../lib/useChapterVersioning';
import {
  useChapterAutosave,
  useRecoveredChapterContent,
  type ChapterAutosave,
} from '../lib/useChapterAutosave';

type Side = 'left' | 'right';

export default function Split() {
  const { id: bookId } = useParams<{ id: string }>();
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();
  const { plan } = useUserDisplay();
  const isPro = plan === 'pro' || plan === 'lifetime';

  useEffect(() => {
    if (isMobile && bookId) navigate(`/books/${bookId}/editor`, { replace: true });
  }, [isMobile, bookId, navigate]);

  // Данные через React Query — тот же кэш, что у редактора: правки отсюда
  // сразу видны в «Студии» и не перезаписываются её устаревшей копией.
  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const loadError = (bookError ?? chaptersError)?.message ?? null;

  const autosave = useChapterAutosave({ bookId, userId: user?.id, isPro });
  const { flush, saveState } = autosave;

  const leftId = search.get('left');
  const rightId = search.get('right');

  // Одна глава в обеих панелях запрещена: два независимых редактора одного текста
  // затирали бы правки друг друга.
  useEffect(() => {
    if (!chapters || chapters.length < 2) return;
    const next = new URLSearchParams(search);
    let changed = false;
    const has = (id: string | null) => !!id && chapters.some((c) => c.id === id);
    let left = leftId;
    if (!has(left)) {
      left = chapters[0].id;
      next.set('left', left);
      changed = true;
    }
    if (!has(rightId) || rightId === left) {
      const fallback = chapters.find((c) => c.id !== left) ?? chapters[0];
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = /mac/i.test(navigator.platform) ? e.metaKey : e.ctrlKey;
      if (mod && e.code === 'KeyS') { e.preventDefault(); void flush(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flush]);

  const leftChapter = useMemo(
    () => (chapters && leftId ? chapters.find((c) => c.id === leftId) ?? null : null),
    [chapters, leftId],
  );
  const rightChapter = useMemo(
    () => (chapters && rightId && rightId !== leftId ? chapters.find((c) => c.id === rightId) ?? null : null),
    [chapters, rightId, leftId],
  );

  if (!bookId) return <Navigate to="/books" replace />;

  if (loadError) {
    return (
      <div className="as page-fill" style={{ color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)' }}>Ошибка: {loadError}</div>
        <Link to={`/books/${bookId}/editor`} className="btn" style={{ marginTop: 16, textDecoration: 'none' }}>← Назад к редактору</Link>
      </div>
    );
  }

  if (!book || !chapters) {
    return (
      <div className="as page-fill--center">
        <div className="page-spinner" />
      </div>
    );
  }

  if (isMobile) {
    return <Navigate to={`/books/${bookId}/editor${leftId ? `?chapter=${leftId}` : ''}`} replace />;
  }

  if (chapters.length < 2) {
    return (
      <div className="as page-fill--center" style={{ color: 'var(--ink-2)', padding: 32, flexDirection: 'column', gap: 14 }}>
        <div style={{ font: '500 16px var(--font-serif)' }}>Для сравнения нужно минимум две главы.</div>
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Сейчас в книге {chapters.length === 0 ? 'нет глав' : 'одна глава'}.</div>
        <Link to={`/books/${bookId}/editor`} className="btn btn--primary" style={{ textDecoration: 'none' }}>← Открыть редактор</Link>
      </div>
    );
  }

  const statusText = saveState === 'saving' ? 'сохранение…'
    : saveState === 'error' ? 'не сохранено — повтор автоматически'
    : saveState === 'saved' ? '● обе панели сохранены'
    : 'автосохранение';

  return (
    <div className="as as-app" style={{ height: '100dvh', overflow: 'hidden' }}>
      {saveState === 'error' && <UnsavedBanner onRetry={() => { void flush(); }} />}
      {autosave.notice && <SaveNotice message={autosave.notice} onDismiss={autosave.clearNotice} />}
      <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: 'var(--bg)', overflow: 'hidden', gridColumn: '1 / -1' }}>
        <div className="tb" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to={`/books/${bookId}`} className="btn btn--ghost" style={{ textDecoration: 'none', fontSize: 12 }}>← {book.title}</Link>
            <span className="chip" style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' }}>Сравнение глав</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Link to={`/books/${bookId}/editor${leftId ? `?chapter=${leftId}` : ''}`} className="tb-btn" style={{ textDecoration: 'none' }} title="Редактор" aria-label="Редактор"><Icon name="book" size={15} /></Link>
            <Link to={`/books/${bookId}/focus${leftId ? `?chapter=${leftId}` : ''}`} className="tb-btn" style={{ textDecoration: 'none' }} title="Фокус" aria-label="Фокус"><Icon name="focus" size={15} /></Link>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border-soft)', overflow: 'hidden' }}>
          {(['left', 'right'] as const).map((side) => (
            <Pane
              key={side}
              side={side}
              chapter={side === 'left' ? leftChapter : rightChapter}
              otherId={side === 'left' ? rightId : leftId}
              chapters={chapters}
              autosave={autosave}
              userId={user?.id}
              isPro={isPro}
              onSelect={(id) => select(side, id)}
            />
          ))}
        </div>

        <div className="status">
          <span>{statusText}</span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>
            слева: {leftChapter?.title ?? '—'} · справа: {rightChapter?.title ?? '—'}
          </span>
        </div>
      </main>
    </div>
  );
}

function Pane({ side, chapter, otherId, chapters, autosave, userId, isPro, onSelect }: {
  side: Side;
  chapter: ChapterMeta | null;
  otherId: string | null;
  chapters: ChapterMeta[];
  autosave: ChapterAutosave;
  userId: string | undefined;
  isPro: boolean;
  onSelect: (id: string) => void;
}) {
  const chapterId = chapter?.id ?? null;
  const { data: contentData } = useChapterContent(chapterId ?? undefined);
  const { content, ready } = useRecoveredChapterContent(
    chapterId, contentData, chapter?.updated_at, autosave, { userId, isPro },
  );
  const { onContentTracked, onChapterSwitch } = useChapterVersioning({ chapterId, userId, isPro });
  useEffect(() => { onContentTracked(content); }, [content, onContentTracked]);

  const lastIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastIdRef.current && lastIdRef.current !== chapterId) onChapterSwitch(lastIdRef.current);
    lastIdRef.current = chapterId;
  }, [chapterId, onChapterSwitch]);

  const onContentChange = useCallback((html: string) => {
    if (!chapterId) return;
    onContentTracked(html);
    autosave.scheduleContent(chapterId, html);
  }, [chapterId, autosave, onContentTracked]);

  const paneEditorStyle =
    'outline:none;font-family:var(--font-serif);color:var(--ink);font-size:15.5px;line-height:1.7;';

  return (
    <div style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ height: 36, flexShrink: 0, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-deep)' }}>
        <span style={{ font: '500 9.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', flexShrink: 0 }}>{side === 'left' ? 'слева' : 'справа'}</span>
        <select
          value={chapter?.id ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          aria-label={side === 'left' ? 'Глава слева' : 'Глава справа'}
          className="split-select"
        >
          {chapters.map((c, i) => (
            <option key={c.id} value={c.id} disabled={c.id === otherId}>
              {String(i + 1).padStart(2, '0')} · {c.title}{c.id === otherId ? ' (открыта в другой панели)' : ''}
            </option>
          ))}
        </select>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', flexShrink: 0 }}>{chapter ? `${chapter.words.toLocaleString('ru-RU')} сл` : ''}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '28px 24px 60px', background: 'var(--bg)' }}>
        {chapter && (
          <RichEditor
            value={content}
            onChange={onContentChange}
            contentKey={chapter.id}
            contentReady={ready}
            placeholder="Печатайте…"
            attributesStyle={paneEditorStyle}
            className="sheet"
            style={{ width: 520, padding: '40px 48px 60px' }}
          />
        )}
      </div>
    </div>
  );
}
