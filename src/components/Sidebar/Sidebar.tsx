import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDropdownPosition } from '../../lib/useDropdownPosition';
import { Icon } from '../Icon';
import { LogoMark } from '../LogoMark';
import { NOVEL } from '../../data/sample';
import type { ChapterMeta, ChapterStatus, ChapterActions } from '../../lib/chapters';
import type { Book } from '../../lib/supabase';
import { updateBook } from '../../lib/books';
import { Skeleton } from '../Skeleton';
import { SidebarNav } from './SidebarNav';
import { SidebarFoot } from './SidebarFoot';

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

interface SidebarProps {
  book?: Book | null;
  chapters?: ChapterMeta[];
  activeChapterId?: string | null;
  chapterActions?: ChapterActions;
  subtitle?: string;
  children?: ReactNode;
}

export function Sidebar({
  book,
  chapters,
  activeChapterId,
  chapterActions,
  subtitle,
  children,
}: SidebarProps) {
  const { onSelectChapter, onCreateChapter, onStatusChange, onDeleteChapter, onChapterHover } = chapterActions ?? {};
  const isReal = Boolean(chapters);
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const [deleteConfirmFor, setDeleteConfirmFor] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLButtonElement>(null);
  const dropdownStyle = useDropdownPosition(statusMenuRef, statusMenuFor);
  const [shareToken, setShareToken] = useState<string | null>(book?.share_token ?? null);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!book?.id) return;
    const token = crypto.randomUUID();
    try {
      await updateBook(book.id, { share_token: token });
      setShareToken(token);
      void navigator.clipboard.writeText(`${window.location.origin}/share/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // оставляем текущее состояние при ошибке
    }
  }

  async function handleCopy() {
    if (!shareToken) return;
    void navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDisable() {
    if (!book?.id) return;
    try {
      await updateBook(book.id, { share_token: null });
      setShareToken(null);
      setCopied(false);
    } catch {
      // оставляем текущее состояние при ошибке
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

  const bid = book?.id ?? '';
  return (
    <aside className="sb">
      <div className="sb-head">
        <Link to="/books" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, textDecoration: 'none' }}>
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
        {book?.id && (
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
                  onClick={() => void handleDisable()}
                  title="Отключить доступ по ссылке"
                  className="sb-share-btn"
                  style={{ color: 'var(--danger)' }}
                >
                  Откл.
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void handleShare()}
                className="sb-share-btn"
                style={{ color: 'var(--ink-3)', width: '100%' }}
              >
                Поделиться
              </button>
            )}
          </div>
        )}
      </div>

      <SidebarNav bookId={bid} />

      <div className="sb-body">
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
                  <span className="sb-item-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="sb-item-title" title={c.title || 'Без названия'}>{c.title || 'Без названия'}</span>
                </button>
                <div style={{ position: 'relative', flexShrink: 0, marginRight: 10 }}>
                  <button
                    ref={statusMenuFor === c.id ? statusMenuRef : null}
                    type="button"
                    onClick={() => setStatusMenuFor(statusMenuFor === c.id ? null : c.id)}
                    title={`Статус: ${SB_STATUS_LABEL[c.status]}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, margin: -4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: SB_STATUS_COLOR[c.status], display: 'block' }} />
                  </button>
                  {statusMenuFor === c.id && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                        onMouseDown={() => { setStatusMenuFor(null); setDeleteConfirmFor(null); }}
                      />
                      {dropdownStyle && <div style={{ ...dropdownStyle, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: 4, minWidth: 148, boxShadow: '0 4px 20px oklch(0.05 0.01 50 / 0.18)', animation: 'dropdown-in 0.12s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
                      <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 8px 6px' }}>Статус</div>
                      {(['draft', 'progress', 'done'] as ChapterStatus[]).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { onStatusChange?.(c.id, s); setStatusMenuFor(null); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', width: '100%', borderRadius: 4, background: c.status === s ? 'var(--bg-deep)' : 'transparent', cursor: 'pointer', font: '400 12px var(--font-ui)', color: 'var(--ink)', border: 'none', textAlign: 'left' }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: SB_STATUS_COLOR[s], flexShrink: 0 }} />
                          {SB_STATUS_LABEL[s]}
                          {c.status === s && <span style={{ marginLeft: 'auto', font: '400 10px var(--font-mono)', color: 'var(--ink-4)' }}>✓</span>}
                        </button>
                      ))}
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
                              style={{ flex: 1, fontSize: 11, padding: '5px 0', background: 'var(--danger)', color: 'oklch(0.98 0 0)', border: 'none', borderRadius: 4, cursor: 'pointer', font: '500 11px var(--font-ui)' }}
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
                          onClick={() => {
                            if (c.words > 0) {
                              setDeleteConfirmFor(c.id);
                            } else {
                              onDeleteChapter?.(c.id);
                              setStatusMenuFor(null);
                            }
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', width: '100%', borderRadius: 4, background: 'transparent', cursor: 'pointer', font: '400 12px var(--font-ui)', color: 'var(--danger)', border: 'none', textAlign: 'left' }}
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

      </div>{/* /sb-body */}

      <SidebarFoot />
    </aside>
  );
}
