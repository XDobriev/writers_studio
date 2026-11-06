import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDropdownPosition } from '../../lib/useDropdownPosition';
import { Icon } from '../Icon';
import { LogoMark } from '../LogoMark';
import { NOVEL } from '../../data/sample';
import { type ChapterMeta, type ChapterStatus, type ChapterActions, renumberChapters } from '../../lib/chapters';
import { type DraftScene, type DraftSceneActions, type DraftConvertPlacement, type DraftInsertPosition } from '../../lib/draftScenes';
import { computeChapterRanks, recalculateBookChapterTitles, type ChapterType } from '../../lib/chapterNumbering';
import { invalidateChaptersCache } from '../../lib/chapterMutations';
import { useMemo, useCallback } from 'react';
import type { Book } from '../../lib/supabase';
import { updateBook } from '../../lib/books';
import { Skeleton } from '../Skeleton';
import { SidebarNav } from './SidebarNav';
import { SidebarFoot } from './SidebarFoot';
import { ConfirmDialog } from '../ConfirmDialog';
import { useFeatureFlag } from '../../lib/useFeatureFlag';
import { useErrorState } from '../../lib/useErrorState';
import { ErrorBanner } from '../ErrorBanner';
import { QUERY_KEYS } from '../../lib/queries';

const SB_STATUS_LABEL: Record<ChapterStatus, string> = {
  draft: 'Черновик',
  progress: 'В работе',
  done: 'Готово',
};

const SB_STATUS_COLOR: Record<ChapterStatus, string> = {
  draft: 'var(--ink-4)',
  progress: 'var(--accent-2)',
  done: 'var(--ok)',
};

interface ChapterSelectDropdownProps {
  chapters: ChapterMeta[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  prefix?: string;
}

function ChapterSelectDropdown({
  chapters,
  value,
  onChange,
  ariaLabel,
  prefix,
}: ChapterSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedIdx = chapters.findIndex((c) => c.id === value);
  const selected = selectedIdx >= 0 ? chapters[selectedIdx] : chapters[0];
  const selectedLabel = selected
    ? `${prefix ? `${prefix} ` : ''}${selectedIdx >= 0 ? selectedIdx + 1 : 1}. ${selected.title || 'Без названия'}`
    : 'Выберите главу';

  useEffect(() => {
    if (!isOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', marginBottom: 6 }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          padding: '5px 8px',
          fontSize: 11.5,
          fontFamily: 'var(--font-ui)',
          borderRadius: 6,
          border: '1px solid var(--border-soft)',
          background: 'var(--surface-2)',
          color: 'var(--ink)',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.12s, background 0.12s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {selectedLabel}
        </span>
        <span
          style={{
            transform: isOpen ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.12s',
            color: 'var(--ink-4)',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <Icon name="chevd" size={11} />
        </span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'relative',
            maxHeight: 140,
            overflowY: 'auto',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            marginTop: 4,
            padding: 2,
            boxShadow: '0 4px 12px oklch(0 0 0 / 0.18)',
            zIndex: 10,
          }}
        >
          {chapters.map((ch, idx) => {
            const isCur = ch.id === value;
            return (
              <button
                key={ch.id}
                role="option"
                aria-selected={isCur}
                type="button"
                onClick={() => {
                  onChange(ch.id);
                  setIsOpen(false);
                }}
                className="ctx-item"
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  borderRadius: 4,
                  background: isCur ? 'var(--accent-soft)' : undefined,
                  color: isCur ? 'var(--accent)' : 'var(--ink)',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prefix ? `${prefix} ` : ''}{idx + 1}. {ch.title || 'Без названия'}
                </span>
                {isCur && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)' }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Синхронизированный select для вспомогательных технологий и тестов */}
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          width: 1,
          height: 1,
          margin: -1,
          clip: 'rect(0 0 0 0)',
        }}
      >
        {chapters.map((ch, idx) => (
          <option key={ch.id} value={ch.id}>
            {prefix ? `${prefix} ` : ''}{idx + 1}. {ch.title || 'Без названия'}
          </option>
        ))}
      </select>
    </div>
  );
}

interface SidebarProps {
  book?: Book | null;
  chapters?: ChapterMeta[];
  activeChapterId?: string | null;
  chapterActions?: ChapterActions;
  draftScenes?: DraftScene[];
  activeDraftId?: string | null;
  draftActions?: DraftSceneActions;
  subtitle?: string;
  children?: ReactNode;
  /** Демо-режим: скрывает share (книга не сохраняется). */
  demo?: boolean;
}

export function Sidebar({
  book,
  chapters,
  activeChapterId,
  chapterActions,
  draftScenes,
  activeDraftId,
  draftActions,
  subtitle,
  children,
  demo = false,
}: SidebarProps) {
  const { onSelectChapter, onCreateChapter, onStatusChange, onTypeChange, onDeleteChapter, onChapterHover } = chapterActions ?? {};
  const { onSelectDraft, onCreateDraft, onDeleteDraft, onConvertDraftToChapter, onInsertDraftIntoChapter } = draftActions ?? {};
  const isReal = Boolean(chapters);
  const showDraftSection = Boolean(draftScenes || draftActions);
  const queryClient = useQueryClient();
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const [deleteConfirmFor, setDeleteConfirmFor] = useState<string | null>(null);
  const [draftsExpanded, setDraftsExpanded] = useState(true);
  const [draftMenuFor, setDraftMenuFor] = useState<string | null>(null);
  const [draftDeleteConfirmFor, setDraftDeleteConfirmFor] = useState<string | null>(null);
  const [draftConvertMode, setDraftConvertMode] = useState<'end' | 'start' | 'after'>('end');
  const [draftAfterChapterId, setDraftAfterChapterId] = useState<string>('');
  const [draftInsertChapterId, setDraftInsertChapterId] = useState<string>('');
  const [draftInsertPos, setDraftInsertPos] = useState<DraftInsertPosition>('end');
  const statusMenuRef = useRef<HTMLButtonElement>(null);
  const draftMenuRef = useRef<HTMLButtonElement>(null);
  const chapterRanks = useMemo(() => computeChapterRanks(chapters ?? []), [chapters]);

  const handleTypeChange = useCallback(async (chapterId: string, type: ChapterType) => {
    if (onTypeChange) {
      onTypeChange(chapterId, type);
      return;
    }
    if (!book?.id || !chapters) return;
    const { updates, nextChapters } = recalculateBookChapterTitles(chapters, chapterId, type);
    if (updates.length === 0) return;

    queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(book.id), nextChapters);
    try {
      await renumberChapters(updates);
    } catch {
      invalidateChaptersCache(queryClient, book.id);
    }
  }, [onTypeChange, book?.id, chapters, queryClient]);
  const dropdownStyle = useDropdownPosition(statusMenuRef, statusMenuFor, { estimatedHeight: 360 });
  const draftDropdownStyle = useDropdownPosition(draftMenuRef, draftMenuFor, { estimatedHeight: 380 });
  const draftList = draftScenes ?? [];

  useEffect(() => {
    if (activeDraftId) setDraftsExpanded(true);
  }, [activeDraftId]);

  useEffect(() => {
    if (chapters && chapters.length > 0) {
      setDraftAfterChapterId((prev) => (prev && chapters.some((c) => c.id === prev) ? prev : chapters[chapters.length - 1].id));
      setDraftInsertChapterId((prev) => (prev && chapters.some((c) => c.id === prev) ? prev : chapters[0].id));
    }
  }, [chapters]);

  useEffect(() => {
    if (!draftMenuFor) {
      setDraftDeleteConfirmFor(null);
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraftMenuFor(null);
        setDraftDeleteConfirmFor(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [draftMenuFor]);
  const [shareToken, setShareToken] = useState<string | null>(book?.share_token ?? null);
  // Синхронизация со свежими данными книги — без неё устаревший persisted-кэш
  // (react-query показывает старое значение, потом тихо ревалидирует в фоне)
  // навсегда запирает shareToken в null, и повторный клик «Поделиться»
  // сгенерирует новый токен, молча инвалидировав уже разосланную ссылку.
  useEffect(() => { setShareToken(book?.share_token ?? null); }, [book?.share_token]);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const { enabled: shareEnabled } = useFeatureFlag('share_book_enabled');
  const { error: shareError, setError: setShareError, clearError: clearShareError } = useErrorState();

  async function handleShare() {
    if (!book?.id || sharing) return;
    setSharing(true);
    clearShareError();
    const token = crypto.randomUUID();
    try {
      await updateBook(book.id, { share_token: token });
      setShareToken(token);
      queryClient.setQueryData<Book>(QUERY_KEYS.book(book.id), prev => prev ? { ...prev, share_token: token } : prev);
      void navigator.clipboard.writeText(`${window.location.origin}/share/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Не удалось создать ссылку');
    } finally {
      setSharing(false);
    }
  }

  async function handleCopy() {
    if (!shareToken) return;
    void navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDisable() {
    if (!book?.id || sharing) return;
    setSharing(true);
    clearShareError();
    try {
      await updateBook(book.id, { share_token: null });
      setShareToken(null);
      queryClient.setQueryData<Book>(QUERY_KEYS.book(book.id), prev => prev ? { ...prev, share_token: null } : prev);
      setCopied(false);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Не удалось отозвать доступ');
    } finally {
      setSharing(false);
    }
  }

  useEffect(() => {
    if (!statusMenuFor) {
      setDeleteConfirmFor(null);
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setStatusMenuFor(null); setDeleteConfirmFor(null); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [statusMenuFor]);

  // Активная глава может оказаться ниже края — на невысоком окне до неё не видно ни одной строки.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyRef.current?.querySelector('.sb-list .sb-item--on');
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeChapterId, activeDraftId, chapters?.length, draftList.length]);

  const bid = book?.id ?? '';
  return (
    <aside className="sb">
      <div className="sb-head">
        <Link to="/books" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', margin: '-10px 0 -4px', textDecoration: 'none' }}>
          <LogoMark size={20} />
          <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>авторская студия</span>
        </Link>
        {bid ? (
          <Link to={`/books/${bid}`} className="sb-book-title" title={book?.title ?? NOVEL.title} style={{ textDecoration: 'none' }}>{book?.title ?? NOVEL.title}</Link>
        ) : (
          <div className="sb-book-title" title={book?.title ?? NOVEL.title}>{book?.title ?? NOVEL.title}</div>
        )}
        <div className="sb-book-author">
          {subtitle ?? (book ? [book.author, book.genres?.length ? book.genres.join(', ') : book.genre].filter(Boolean).join(' · ') || 'без описания' : `${NOVEL.author} · ${NOVEL.genre}`)}
        </div>
        {!demo && book?.id && shareEnabled && (
          <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
            {shareToken ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  title="Скопировать ссылку"
                  className="sb-share-btn"
                  style={{ flex: 1, color: copied ? 'var(--ok)' : 'var(--ink-2)', transition: 'color var(--dur-fast)', animation: copied ? 'scale-flash 0.2s ease-out' : undefined }}
                >
                  {copied ? '✓ Скопировано' : '🔗 Ссылка'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRevoke(true)}
                  disabled={sharing}
                  title="Отозвать доступ — ссылка перестанет работать безвозвратно"
                  aria-label="Отозвать доступ по ссылке"
                  className="sb-share-btn"
                  style={{ color: 'var(--danger)' }}
                >
                  Отозвать
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void handleShare()}
                disabled={sharing}
                className="sb-share-btn"
                style={{ color: 'var(--ink-3)', width: '100%' }}
              >
                Поделиться
              </button>
            )}
          </div>
        )}
        {shareError && (
          <ErrorBanner message={shareError} onDismiss={clearShareError} size="sm" style={{ marginTop: 8 }} />
        )}
      </div>

      <ConfirmDialog
        open={confirmingRevoke}
        message="Ссылка перестанет работать немедленно и без возможности восстановления. Все, у кого она есть, потеряют доступ к книге."
        confirmLabel="Отозвать доступ"
        onCancel={() => setConfirmingRevoke(false)}
        onConfirm={async () => {
          await handleDisable();
          setConfirmingRevoke(false);
        }}
      />

      {/* Разделы и главы прокручиваются одним списком: на невысоком окне закреплённые разделы
          оставляли главам 2–3 строки. Закреплены только шапка и футер. */}
      <div className="sb-body" ref={bodyRef}>
      <SidebarNav bookId={bid} />

      <nav aria-label="Главы книги">
      {isReal ? (
        <>
          <div className="sb-section">
            <span className="sb-section-title">Главы</span>
            {onCreateChapter && (
              <button
                type="button"
                onClick={onCreateChapter}
                title="Новая глава"
                aria-label="Новая глава"
                className="sb-section-add"
              >
                <Icon name="plus" size={13} />
              </button>
            )}
          </div>
          <div className="sb-list">
            {chapters!.length === 0 && (
              <div style={{ padding: '8px 14px', font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>
                Пока нет глав.
              </div>
            )}
            {chapters!.map((c, i) => (
              <div key={c.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => onSelectChapter?.(c.id)}
                  onMouseEnter={() => onChapterHover?.(c.id)}
                  className={'sb-item' + (activeChapterId === c.id ? ' sb-item--on' : '')}
                  style={{ flex: 1, width: '100%', textAlign: 'left', cursor: 'pointer' }}
                >
                  <span className="sb-item-num">{chapterRanks.get(c.id)?.displayNumber ?? String(i + 1).padStart(2, '0')}</span>
                  <span className="sb-item-title" title={c.title || 'Без названия'}>{c.title || 'Без названия'}</span>
                </button>
                <div style={{ position: 'relative', flexShrink: 0, marginRight: 10 }}>
                  <button
                    ref={statusMenuFor === c.id ? statusMenuRef : null}
                    type="button"
                    onClick={() => setStatusMenuFor(statusMenuFor === c.id ? null : c.id)}
                    title={`Статус: ${SB_STATUS_LABEL[c.status]}`}
                    aria-label={`Статус главы: ${SB_STATUS_LABEL[c.status]}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, margin: -4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: SB_STATUS_COLOR[c.status], display: 'block' }} />
                  </button>
                  {statusMenuFor === c.id && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 'calc(var(--z-dropdown) - 1)' }}
                        onMouseDown={() => { setStatusMenuFor(null); setDeleteConfirmFor(null); }}
                      />
                      {dropdownStyle && <div style={{ ...dropdownStyle, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: 4, minWidth: 154, boxShadow: '0 4px 20px oklch(0.05 0.01 50 / 0.18)', animation: 'dropdown-in 0.12s cubic-bezier(0.22, 1, 0.36, 1) both', overscrollBehavior: 'contain' }}>
                      <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 8px 6px' }}>Статус</div>
                      {(['draft', 'progress', 'done'] as ChapterStatus[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { onStatusChange?.(c.id, s); setStatusMenuFor(null); }}
                          className="ctx-item"
                          style={c.status === s ? { background: 'var(--bg-deep)' } : undefined}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: SB_STATUS_COLOR[s], flexShrink: 0 }} />
                          {SB_STATUS_LABEL[s]}
                          {c.status === s && <span style={{ marginLeft: 'auto', font: '400 10px var(--font-mono)', color: 'var(--ink-4)' }}>✓</span>}
                        </button>
                      ))}
                      <div style={{ height: 1, background: 'var(--border-soft)', margin: '4px 0' }} />
                      <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 8px 6px' }}>Тип главы</div>
                      {(
                        [
                          { type: 'regular', label: 'Обычная глава' },
                          { type: 'prologue', label: 'Пролог' },
                          { type: 'epilogue', label: 'Эпилог' },
                          { type: 'interlude', label: 'Интерлюдия' },
                          { type: 'special', label: 'Без номера' },
                        ] as const
                      ).map((t) => {
                        const isCurrent = (chapterRanks.get(c.id)?.type ?? 'regular') === t.type;
                        return (
                          <button
                            key={t.type}
                            type="button"
                            onClick={() => { void handleTypeChange(c.id, t.type); setStatusMenuFor(null); }}
                            className="ctx-item"
                            style={isCurrent ? { background: 'var(--bg-deep)' } : undefined}
                          >
                            {t.label}
                            {isCurrent && <span style={{ marginLeft: 'auto', font: '400 10px var(--font-mono)', color: 'var(--ink-4)' }}>✓</span>}
                          </button>
                        );
                      })}
                      <div style={{ height: 1, background: 'var(--border-soft)', margin: '4px 0' }} />
                      {deleteConfirmFor === c.id ? (
                        <div style={{ padding: '6px 8px' }}>
                          <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 8, lineHeight: 1.4 }}>
                            Удалить главу? Текст будет потерян.
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => { onDeleteChapter?.(c.id); setStatusMenuFor(null); setDeleteConfirmFor(null); }}
                              className="btn-inline-danger"
                            >Удалить</button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmFor(null)}
                              style={{ flex: 1, fontSize: 11, padding: '5px 0', background: 'var(--bg-deep)', color: 'var(--ink-2)', border: 'none', borderRadius: 4, cursor: 'pointer', font: '400 11px var(--font-ui)' }}
                            >Отмена</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmFor(c.id)}
                          className="ctx-item ctx-item--danger"
                        >
                          Удалить главу
                        </button>
                      )}
                      </div>}
                    </>
                  )}
                </div>
              </div>
            ))}
            {onCreateChapter && (
              <button
                type="button"
                onClick={onCreateChapter}
                className="sb-item"
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--ink-3)' }}
              >
                <span className="sb-item-num"><Icon name="plus" size={13} /></span>
                <span className="sb-item-title">Новая глава</span>
                <span />
              </button>
            )}
          </div>

          {showDraftSection && (
            <>
              <div className="sb-section" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setDraftsExpanded((v) => !v)}
                  aria-expanded={draftsExpanded}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'inherit',
                    textAlign: 'left',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      color: 'var(--ink-4)',
                      transform: draftsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform var(--dur-fast)',
                    }}
                  >
                    <Icon name="chevd" size={12} />
                  </span>
                  <span className="sb-section-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Черновики / Свободные сцены ({draftList.length})
                  </span>
                </button>
                {onCreateDraft && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftsExpanded(true);
                      onCreateDraft();
                    }}
                    title="Новый черновик сцены"
                    aria-label="Новый черновик сцены"
                    className="sb-section-add"
                  >
                    <Icon name="plus" size={13} />
                  </button>
                )}
              </div>
              {draftsExpanded && (
                <div className="sb-list">
                  {draftList.length === 0 && (
                    <div style={{ padding: '6px 14px', font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>
                      Нет свободных сцен.
                    </div>
                  )}
                  {draftList.map((d) => (
                    <div key={d.id} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => onSelectDraft?.(d.id)}
                        className={'sb-item' + (activeDraftId === d.id ? ' sb-item--on' : '')}
                        style={{ flex: 1, width: '100%', textAlign: 'left', cursor: 'pointer' }}
                      >
                        <span className="sb-item-num" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Icon name="feather" size={12} />
                        </span>
                        <span className="sb-item-title" title={d.title || 'Без названия'}>{d.title || 'Без названия'}</span>
                        <span className="sb-item-meta">{d.words} сл</span>
                      </button>
                      {(onConvertDraftToChapter || onInsertDraftIntoChapter || onDeleteDraft) && (
                        <div style={{ position: 'relative', flexShrink: 0, marginRight: 10 }}>
                          <button
                            ref={draftMenuFor === d.id ? draftMenuRef : null}
                            type="button"
                            onClick={() => setDraftMenuFor(draftMenuFor === d.id ? null : d.id)}
                            title="Действия с черновиком"
                            aria-label={`Действия с черновиком: ${d.title || 'Без названия'}`}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, margin: -4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4, color: 'var(--ink-3)' }}
                          >
                            <Icon name="moremenu" size={13} />
                          </button>
                          {draftMenuFor === d.id && (
                            <>
                              <div
                                style={{ position: 'fixed', inset: 0, zIndex: 'calc(var(--z-dropdown) - 1)' }}
                                onMouseDown={() => { setDraftMenuFor(null); setDraftDeleteConfirmFor(null); }}
                              />
                              {draftDropdownStyle && (
                                <div
                                  style={{
                                    ...draftDropdownStyle,
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border-soft)',
                                    borderRadius: 6,
                                    padding: 6,
                                    minWidth: 210,
                                    boxShadow: '0 4px 20px oklch(0.05 0.01 50 / 0.18)',
                                    animation: 'dropdown-in 0.12s cubic-bezier(0.22, 1, 0.36, 1) both',
                                    overscrollBehavior: 'contain',
                                  }}
                                >
                                  {onConvertDraftToChapter && (
                                    <div style={{ padding: '4px 6px' }}>
                                      <div style={{ font: '500 11.5px/1.3 var(--font-ui)', color: 'var(--ink-2)', marginBottom: 8 }}>
                                        Превратить в главу
                                      </div>
                                      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                                        {([
                                          ['end', 'В конец'],
                                          ['start', 'В начало'],
                                          ...(chapters && chapters.length > 0 ? [['after', 'После…'] as const] : []),
                                        ] as const).map(([m, lbl]) => (
                                          <button
                                            key={m}
                                            type="button"
                                            onClick={() => setDraftConvertMode(m)}
                                            style={{
                                              flex: 1,
                                              padding: '5px 8px',
                                              font: '500 11px/1.2 var(--font-ui)',
                                              borderRadius: 6,
                                              border: draftConvertMode === m ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                                              background: draftConvertMode === m ? 'var(--accent-soft)' : 'var(--surface-2)',
                                              color: draftConvertMode === m ? 'var(--accent)' : 'var(--ink-2)',
                                              cursor: 'pointer',
                                              transition: 'all 0.12s ease',
                                              textAlign: 'center',
                                            }}
                                          >
                                            {lbl}
                                          </button>
                                        ))}
                                      </div>
                                      {draftConvertMode === 'after' && chapters && chapters.length > 0 && (
                                        <ChapterSelectDropdown
                                          ariaLabel="После какой главы"
                                          value={draftAfterChapterId || chapters[chapters.length - 1].id}
                                          onChange={(id) => setDraftAfterChapterId(id)}
                                          chapters={chapters}
                                          prefix="После"
                                        />
                                      )}
                                       <button
                                         type="button"
                                         className="btn btn--primary ctx-item"
                                         style={{ width: '100%', height: 28, fontSize: 11.5, justifyContent: 'center' }}
                                        onClick={() => {
                                          const placement: DraftConvertPlacement =
                                            draftConvertMode === 'start'
                                              ? { mode: 'start' }
                                              : draftConvertMode === 'after' && chapters && chapters.length > 0
                                                ? { mode: 'after', afterChapterId: draftAfterChapterId || chapters[chapters.length - 1].id }
                                                : { mode: 'end' };
                                          void onConvertDraftToChapter(d.id, placement);
                                          setDraftMenuFor(null);
                                        }}
                                      >
                                        Превратить в главу
                                      </button>
                                    </div>
                                  )}

                                  {onInsertDraftIntoChapter && chapters && chapters.length > 0 && (
                                    <>
                                      <div style={{ height: 1, background: 'var(--border-soft)', margin: '4px 0' }} />
                                      <div style={{ padding: '4px 6px' }}>
                                        <div style={{ font: '500 11.5px/1.3 var(--font-ui)', color: 'var(--ink-2)', marginBottom: 8 }}>
                                          Вставить в существующую главу
                                        </div>
                                        <ChapterSelectDropdown
                                          ariaLabel="Целевая глава для вставки"
                                          value={draftInsertChapterId || chapters[0].id}
                                          onChange={(id) => setDraftInsertChapterId(id)}
                                          chapters={chapters}
                                        />
                                        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                                          {([
                                            ['end', 'В конец главы'],
                                            ['start', 'В начало главы'],
                                          ] as const).map(([pos, lbl]) => (
                                            <button
                                              key={pos}
                                              type="button"
                                              onClick={() => setDraftInsertPos(pos)}
                                              style={{
                                                flex: 1,
                                                padding: '5px 8px',
                                                font: '500 11px/1.2 var(--font-ui)',
                                                borderRadius: 6,
                                                border: draftInsertPos === pos ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                                                background: draftInsertPos === pos ? 'var(--accent-soft)' : 'var(--surface-2)',
                                                color: draftInsertPos === pos ? 'var(--accent)' : 'var(--ink-2)',
                                                cursor: 'pointer',
                                                transition: 'all 0.12s ease',
                                                textAlign: 'center',
                                              }}
                                            >
                                              {lbl}
                                            </button>
                                          ))}
                                        </div>
                                        <button
                                          type="button"
                                          className="btn btn--primary ctx-item"
                                          style={{ width: '100%', height: 28, fontSize: 11.5, justifyContent: 'center' }}
                                          onClick={() => {
                                            const targetId = draftInsertChapterId || chapters[0].id;
                                            void onInsertDraftIntoChapter(d.id, targetId, draftInsertPos);
                                            setDraftMenuFor(null);
                                          }}
                                        >
                                          Вставить в существующую главу
                                        </button>
                                      </div>
                                    </>
                                  )}

                                  {onDeleteDraft && (
                                    <>
                                      <div style={{ height: 1, background: 'var(--border-soft)', margin: '4px 0' }} />
                                      {draftDeleteConfirmFor === d.id ? (
                                        <div style={{ padding: '6px 8px' }}>
                                          <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 8, lineHeight: 1.4 }}>
                                            Удалить черновик? Текст будет потерян.
                                          </div>
                                          <div style={{ display: 'flex', gap: 6 }}>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                onDeleteDraft(d.id);
                                                setDraftMenuFor(null);
                                                setDraftDeleteConfirmFor(null);
                                              }}
                                              className="btn-inline-danger"
                                              style={{ flex: 1, padding: '5px 0', fontSize: 11 }}
                                            >
                                              Удалить
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setDraftDeleteConfirmFor(null)}
                                              className="btn btn--ghost"
                                              style={{ flex: 1, fontSize: 11, padding: '5px 0', height: 26, justifyContent: 'center' }}
                                            >
                                              Отмена
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setDraftDeleteConfirmFor(d.id)}
                                          className="ctx-item ctx-item--danger"
                                          style={{ fontSize: 11.5, padding: '6px 8px' }}
                                        >
                                          <Icon name="trash" size={12} />
                                          Удалить черновик
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : children ? children : Boolean(book?.id) ? (
        <>
          <div className="sb-section">
            <span className="sb-section-title">Главы</span>
          </div>
          <div className="sb-list">
            <div style={{ padding: '8px 14px' }}>
              <Skeleton lines={5} height={14} />
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '6px 12px 0' }}>
          <Link to="/books" className="sb-item" style={{ color: 'var(--ink-3)' }}>
            <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--ink-3)' }}><Icon name="arrows" size={14} /></span>
            <span className="sb-item-title" style={{ color: 'var(--ink-3)' }}>← Все книги</span>
            <span />
          </Link>
        </div>
      )}

      </nav>
      </div>{/* /sb-body */}

      {!demo && <SidebarFoot />}
    </aside>
  );
}
