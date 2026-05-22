import { useState, useEffect, useRef, useMemo, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { LogoMark } from './LogoMark';
import { NOVEL } from '../data/sample';
import type { Chapter, ChapterStatus, ChapterActions } from '../lib/chapters';
import type { Book } from '../lib/supabase';
import { updateBook } from '../lib/books';
import { useUserDisplay } from '../lib/useUserDisplay';
import { SettingsModal } from './SettingsModal';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  lifetime: 'Lifetime',
};


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
  chapters?: Chapter[];
  activeChapterId?: string | null;
  chapterActions?: ChapterActions;
  bookHref?: string;
  subtitle?: string;
  children?: ReactNode;
}

export function Sidebar({
  book,
  chapters,
  activeChapterId,
  chapterActions,
  bookHref,
  subtitle,
  children,
}: SidebarProps) {
  const { onSelectChapter, onCreateChapter, onStatusChange, onDeleteChapter } = chapterActions ?? {};
  const isReal = Boolean(chapters);
  const { pathname } = useLocation();
  const { displayName, initials, plan } = useUserDisplay();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const [deleteConfirmFor, setDeleteConfirmFor] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
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
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setStatusMenuFor(null);
        setDeleteConfirmFor(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusMenuFor]);
  const bid = book?.id ?? '';
  const navItems = useMemo<Array<[Parameters<typeof Icon>[0]['name'], string, string | null]>>(() => [
    ['layout', 'Дэшборд', bid ? `/books/${bid}` : null],
    ['book', 'Манускрипт', bid ? `/books/${bid}/editor` : null],
    ['char', 'Персонажи', bid ? `/books/${bid}/characters` : null],
    ['map', 'Карта мира', bid ? `/books/${bid}/map` : null],
    ['clock', 'Хронология', bid ? `/books/${bid}/timeline` : null],
    ['note', 'Заметки', bid ? `/books/${bid}/notes` : null],
    ['tree', 'Структура', bid ? `/books/${bid}/outline` : null],
  ], [bid]);
  function isNavActive(href: string | null): boolean {
    if (!href) return false;
    if (href === `/books/${bid}`) return pathname === href;
    return pathname.startsWith(href);
  }
  return (
    <aside className="sb">
      <div className="sb-head">
        <Link to="/books" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, textDecoration: 'none' }}>
          <LogoMark size={20} />
          <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>авторская студия</span>
        </Link>
        {bid ? (
          <Link to={`/books/${bid}`} className="sb-book-title" style={{ textDecoration: 'none' }}>{book?.title ?? NOVEL.title}</Link>
        ) : (
          <div className="sb-book-title">{book?.title ?? NOVEL.title}</div>
        )}
        <div className="sb-book-author">
          {subtitle ?? (book ? [book.author, book.genre].filter(Boolean).join(' · ') || 'без описания' : `${NOVEL.author} · ${NOVEL.genre}`)}
        </div>
        {book?.id && (
          <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
            {shareToken ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  title="Скопировать ссылку"
                  style={{ flex: 1, font: '500 11px var(--font-ui)', color: copied ? 'var(--ok)' : 'var(--ink-2)', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', transition: 'color 0.15s' }}
                >
                  {copied ? '✓ Скопировано' : '🔗 Ссылка'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDisable()}
                  title="Отключить доступ по ссылке"
                  style={{ font: '500 11px var(--font-ui)', color: 'var(--danger)', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer' }}
                >
                  Откл.
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void handleShare()}
                style={{ font: '500 11px var(--font-ui)', color: 'var(--ink-3)', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', width: '100%' }}
              >
                Поделиться
              </button>
            )}
          </div>
        )}
      </div>

      <nav style={{ padding: '10px 8px 4px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {navItems.map(([icn, label, href]) => {
          const on = isNavActive(href);
          const cls = 'sb-item' + (on ? ' sb-item--on' : '');
          const style = on ? { background: 'var(--surface)' } : {};
          const inner = (
            <>
              <span style={{ display: 'flex', justifyContent: 'center', color: on ? 'var(--ink)' : 'var(--ink-3)' }}>
                <Icon name={icn} size={15} />
              </span>
              <span className="sb-item-title" style={{ color: on ? 'var(--ink)' : 'var(--ink-2)' }}>{label}</span>
            </>
          );
          if (!href) {
            return (
              <span key={label} className={cls} style={{ ...style, opacity: 0.5, cursor: 'default' }}>
                {inner}
              </span>
            );
          }
          return (
            <Link key={label} to={href} className={cls} style={style}>
              {inner}
            </Link>
          );
        })}
      </nav>

      <div className="sb-body">
      {isReal ? (
        <>
          <div className="sb-section">
            <span className="sb-section-title">Главы</span>
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
                  className={'sb-item' + (activeChapterId === c.id ? ' sb-item--on' : '')}
                  style={{ flex: 1, width: '100%', textAlign: 'left', cursor: 'pointer' }}
                >
                  <span className="sb-item-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="sb-item-title">{c.title || 'Без названия'}</span>
                </button>
                <div ref={statusMenuFor === c.id ? statusMenuRef : null} style={{ position: 'relative', flexShrink: 0, marginRight: 10 }}>
                  <button
                    type="button"
                    onClick={() => setStatusMenuFor(statusMenuFor === c.id ? null : c.id)}
                    title={`Статус: ${SB_STATUS_LABEL[c.status]}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, margin: -4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: SB_STATUS_COLOR[c.status], display: 'block' }} />
                  </button>
                  {statusMenuFor === c.id && (
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: 4, minWidth: 148, boxShadow: '0 4px 20px oklch(0.05 0.01 50 / 0.18)' }}>
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
                              style={{ flex: 1, fontSize: 11, padding: '5px 0', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', font: '500 11px var(--font-ui)' }}
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
                    </div>
                  )}
                </div>
              </div>
            ))}
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
          </div>
          {bookHref && (
            <div style={{ padding: '6px 12px 0' }}>
              <Link to={bookHref} className="sb-item" style={{ color: 'var(--ink-3)' }}>
                <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--ink-3)' }}><Icon name="arrows" size={14} /></span>
                <span className="sb-item-title" style={{ color: 'var(--ink-3)' }}>← К дэшборду</span>
                <span />
              </Link>
            </div>
          )}
        </>
      ) : children ? children : (
        <div style={{ padding: '6px 12px 0' }}>
          <Link to="/books" className="sb-item" style={{ color: 'var(--ink-3)' }}>
            <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--ink-3)' }}><Icon name="arrows" size={14} /></span>
            <span className="sb-item-title" style={{ color: 'var(--ink-3)' }}>← Все книги</span>
            <span />
          </Link>
        </div>
      )}

      {bid && (
        <div style={{ padding: '4px 12px 0' }}>
          <Link to={`/books/${bid}/export`} className="sb-item" style={{ color: 'var(--ink-4)' }}>
            <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--ink-4)' }}><Icon name="download" size={14} /></span>
            <span className="sb-item-title" style={{ color: 'var(--ink-4)' }}>Экспорт</span>
            <span />
          </Link>
        </div>
      )}
      </div>{/* /sb-body */}

      <div className="sb-foot">
        <div className="sb-avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sb-foot-name">{displayName || '—'}</div>
          <div className="sb-foot-meta">{PLAN_LABEL[plan] ?? plan}</div>
        </div>
        <button className="tb-btn" onClick={() => setSettingsOpen(true)} title="Настройки"><Icon name="settings" size={15} /></button>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </aside>
  );
}

type RailKey = 'editor' | 'characters' | 'map' | 'timeline' | 'notes' | 'dashboard' | 'outline';

interface RailNavProps {
  active?: RailKey;
  bookId?: string;
  style?: CSSProperties;
}

export function RailNav({ active = 'editor', bookId, style }: RailNavProps) {
  const { initials } = useUserDisplay();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const items: Array<[RailKey, Parameters<typeof Icon>[0]['name'], string, string]> = [
    ['dashboard',  'layout', 'Дэшборд',   ''],
    ['editor',     'book',   'Манускрипт', 'editor'],
    ['characters', 'char',   'Персонажи',  'characters'],
    ['map',        'map',    'Карта мира', 'map'],
    ['timeline',   'clock',  'Хронология', 'timeline'],
    ['notes',      'note',   'Заметки',    'notes'],
    ['outline',    'tree',   'Структура',  'outline'],
  ];

  const href = (segment: string) =>
    bookId ? `/books/${bookId}${segment ? `/${segment}` : ''}` : '#';

  return (
    <aside style={{
      position: 'absolute', left: 0, top: 0, bottom: 0, width: 56,
      background: 'var(--bg-deep)', borderRight: '1px solid var(--border-soft)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '14px 0', gap: 6, zIndex: 4, ...style,
    }}>
      <Link to="/books" title="Библиотека" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <LogoMark size={28} />
      </Link>
      {items.map(([k, icn, label, segment]) => (
        <Link
          key={k}
          to={href(segment)}
          title={label}
          className={'tb-btn' + (k === active ? ' tb-btn--on' : '')}
          style={{ width: 36, height: 36, borderRadius: 8 }}
        >
          <Icon name={icn} size={17} />
        </Link>
      ))}
      <div style={{ flex: 1 }} />
      <button className="tb-btn" title="Настройки" style={{ width: 36, height: 36, borderRadius: 8 }} onClick={() => setSettingsOpen(true)}><Icon name="settings" size={17} /></button>
      <div className="sb-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{initials}</div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </aside>
  );
}

interface WithModeProps {
  active?: RailKey;
  bookId?: string;
  children: ReactNode;
}

export function WithMode({ children }: WithModeProps) {
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
