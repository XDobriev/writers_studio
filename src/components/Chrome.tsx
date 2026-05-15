import { useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { NOVEL, SAMPLE_PROSE } from '../data/sample';
import type { Chapter } from '../lib/chapters';
import type { Book } from '../lib/supabase';
import { fetchNotes, createNote, deleteNote, type Note, type NoteKind } from '../lib/notes';

interface SidebarProps {
  book?: Book | null;
  chapters?: Chapter[];
  activeChapterId?: string | null;
  onSelectChapter?: (id: string) => void;
  onCreateChapter?: () => void;
  bookHref?: string;
}

export function Sidebar({
  book,
  chapters,
  activeChapterId,
  onSelectChapter,
  onCreateChapter,
  bookHref,
}: SidebarProps) {
  const isReal = Boolean(chapters);
  const { pathname } = useLocation();
  const bid = book?.id ?? '';
  const navItems: Array<[Parameters<typeof Icon>[0]['name'], string, string | null]> = [
    ['book', 'Манускрипт', bid ? `/books/${bid}/editor` : null],
    ['char', 'Персонажи', bid ? `/books/${bid}/characters` : null],
    ['map', 'Карта мира', bid ? `/books/${bid}/map` : null],
    ['clock', 'Хронология', bid ? `/books/${bid}/timeline` : null],
    ['note', 'Заметки', null],
    ['layout', 'Дэшборд', bid ? `/books/${bid}` : null],
  ];
  function isNavActive(href: string | null): boolean {
    if (!href) return false;
    if (href === `/books/${bid}`) return pathname === href;
    return pathname.startsWith(href);
  }
  return (
    <aside className="sb">
      <div className="sb-head">
        <Link to="/books" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, textDecoration: 'none' }}>
          <span style={{ width: 18, height: 22, background: 'var(--accent)', borderRadius: '1px 4px 4px 1px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 3, top: 3, right: 3, bottom: 3, border: '0.5px solid oklch(0.98 0 0 / 0.6)' }} />
          </span>
          <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>авторская студия</span>
        </Link>
        <div className="sb-book-title">{book?.title ?? NOVEL.title}</div>
        <div className="sb-book-author">
          {book ? [book.author, book.genre].filter(Boolean).join(' · ') || 'без описания' : `${NOVEL.author} · ${NOVEL.genre}`}
        </div>
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

      {isReal ? (
        <>
          <div className="sb-section">
            <span className="sb-section-title">Главы</span>
            <span className="sb-section-meta">{chapters!.length}</span>
          </div>
          <div className="sb-list">
            {chapters!.length === 0 && (
              <div style={{ padding: '8px 14px', font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>
                Пока нет глав.
              </div>
            )}
            {chapters!.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectChapter?.(c.id)}
                className={'sb-item' + (activeChapterId === c.id ? ' sb-item--on' : '')}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                <span className="sb-item-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="sb-item-title">{c.title || 'Без названия'}</span>
                <span className={'sb-item-dot sb-item-dot--' + c.status} />
              </button>
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
      ) : (
        <>
          <div className="sb-tabs" style={{ paddingTop: 14 }}>
            <button className="sb-tab sb-tab--on">Список</button>
            <button className="sb-tab">Доска</button>
            <button className="sb-tab">Структура</button>
          </div>

          <div className="sb-section">
            <span className="sb-section-title">Часть I · Снег</span>
            <span className="sb-section-meta">3/3</span>
          </div>
          <div className="sb-list">
            {NOVEL.chapters.slice(0, 3).map((c) => (
              <div key={c.num} className={'sb-item' + ('')}>
                <span className="sb-item-num">{String(c.num).padStart(2, '0')}</span>
                <span className="sb-item-title">{c.title}</span>
                <span className={'sb-item-dot sb-item-dot--' + c.status} />
              </div>
            ))}
          </div>

          <div className="sb-section">
            <span className="sb-section-title">Часть II · Тракт</span>
            <span className="sb-section-meta">0/3</span>
          </div>
          <div className="sb-list">
            {NOVEL.chapters.slice(3, 6).map((c) => (
              <div key={c.num} className={'sb-item' + ('')}>
                <span className="sb-item-num">{String(c.num).padStart(2, '0')}</span>
                <span className="sb-item-title">{c.title}</span>
                <span className={'sb-item-dot sb-item-dot--' + c.status} />
              </div>
            ))}
          </div>

          <div className="sb-section">
            <span className="sb-section-title">Часть III · Корна</span>
            <span className="sb-section-meta">0/4</span>
          </div>
          <div className="sb-list">
            {NOVEL.chapters.slice(6).map((c) => (
              <div key={c.num} className={'sb-item' + ('')}>
                <span className="sb-item-num">{String(c.num).padStart(2, '0')}</span>
                <span className="sb-item-title" style={{ color: 'var(--ink-3)' }}>{c.title}</span>
                <span className={'sb-item-dot sb-item-dot--' + c.status} />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sb-foot">
        <div className="sb-avatar">АК</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sb-foot-name">Анна Корвин</div>
          <div className="sb-foot-meta">Свободный план</div>
        </div>
        <button className="tb-btn"><Icon name="settings" size={15} /></button>
      </div>
    </aside>
  );
}

export function Toolbar() {
  return (
    <div className="tb">
      <button className="tb-btn"><Icon name="bold" /></button>
      <button className="tb-btn"><Icon name="italic" /></button>
      <button className="tb-btn"><Icon name="underline" /></button>
      <button className="tb-btn"><Icon name="strike" /></button>
      <span className="tb-sep" />
      <button className="tb-sel">Заголовок 2 <Icon name="chevd" size={12} /></button>
      <span className="tb-sep" />
      <button className="tb-btn"><Icon name="list" /></button>
      <button className="tb-btn"><Icon name="olist" /></button>
      <button className="tb-btn"><Icon name="quote" /></button>
      <span className="tb-sep" />
      <button className="tb-btn"><Icon name="align" /></button>
      <button className="tb-btn"><Icon name="link" /></button>
      <button className="tb-btn"><Icon name="color" /></button>
      <span className="tb-sep" />
      <button className="tb-btn tb-btn--on"><Icon name="track" size={15} /> Правки</button>
      <div className="tb-spacer" />
      <button className="tb-btn"><Icon name="sound" size={15} /></button>
      <button className="tb-btn"><Icon name="timer" size={15} /></button>
      <button className="tb-btn"><Icon name="speak" size={15} /></button>
      <button className="tb-btn"><Icon name="split" size={15} /></button>
      <button className="tb-btn"><Icon name="focus" size={15} /></button>
      <span className="tb-sep" />
      <button className="tb-btn"><Icon name="download" size={15} /> Экспорт</button>
    </div>
  );
}

interface StatusBarProps {
  words?: number;
  chars?: number;
  savedAt?: string;
  statusLabel?: string;
}

export function StatusBar({ words = 4720, chars = 28140, savedAt = '14:32', statusLabel }: StatusBarProps) {
  return (
    <div className="status">
      <span><span className="status-dot" style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />{statusLabel ?? `Сохранено · ${savedAt}`}</span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span>Слов: {words.toLocaleString('ru')}</span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span>Знаков: {chars.toLocaleString('ru')}</span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span>~{Math.ceil(words / 220)} мин чтения</span>
      <span style={{ flex: 1 }} />
    </div>
  );
}

interface SheetProps { wide?: boolean }

export function Sheet({ wide = false }: SheetProps) {
  return (
    <div className="sheet-wrap">
      <div
        className="sheet"
        style={wide ? { width: 760 } : {}}
        dangerouslySetInnerHTML={{ __html: SAMPLE_PROSE }}
      />
    </div>
  );
}

interface RightPanelProps {
  tab?: 'margins' | 'versions';
  bookId?: string;
}

export function RightPanel({ tab = 'margins', bookId }: RightPanelProps) {
  const labels: Record<string, string> = { idea: 'Идея', question: 'Вопрос', todo: 'TODO', important: 'Важно' };
  const [notes, setNotes] = useState<Note[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState<NoteKind>('idea');
  const [formText, setFormText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    fetchNotes(bookId).then(setNotes).catch(() => {});
  }, [bookId]);

  const handleAdd = async () => {
    if (!bookId || !formText.trim()) return;
    setSaving(true);
    try {
      const note = await createNote(bookId, formKind, formText.trim());
      setNotes((prev) => [note, ...prev]);
      setFormText('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    deleteNote(id).catch(() => {});
  };

  return (
    <aside className="rp">
      <div className="rp-head">
        <span className={'rp-tab' + (tab === 'margins' ? ' rp-tab--on' : '')}>Заметки на полях</span>
        <span className={'rp-tab' + (tab === 'versions' ? ' rp-tab--on' : '')}>Версии</span>
        <span style={{ flex: 1 }} />
        <button className="tb-btn" onClick={() => setShowForm((v) => !v)} title="Добавить заметку">
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="rp-body">
        {tab === 'margins' && (
          <>
            {showForm && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <select
                  value={formKind}
                  onChange={(e) => setFormKind(e.target.value as NoteKind)}
                  className="input"
                  style={{ fontSize: 12 }}
                >
                  <option value="idea">Идея</option>
                  <option value="question">Вопрос</option>
                  <option value="todo">TODO</option>
                  <option value="important">Важно</option>
                </select>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Текст заметки…"
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  style={{ fontSize: 12, resize: 'vertical' }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn--ghost"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => { setShowForm(false); setFormText(''); }}
                  >Отмена</button>
                  <button
                    className="btn btn--primary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={handleAdd}
                    disabled={saving || !formText.trim()}
                  >Сохранить</button>
                </div>
              </div>
            )}
            {notes.length === 0 && !showForm && (
              <div style={{ padding: '24px 14px', color: 'var(--ink-4)', fontSize: 12, textAlign: 'center' }}>Нет заметок</div>
            )}
            {notes.map((n) => (
              <div key={n.id} className={'mn' + (n.kind !== 'idea' ? ' mn--' + n.kind : '')}>
                <div className="mn-head">
                  <span className="mn-label">{labels[n.kind]}</span>
                  <span style={{ color: 'var(--ink-4)', margin: '0 4px' }}>·</span>
                  <span className="mn-time">{new Date(n.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                  <span style={{ flex: 1 }} />
                  <button
                    className="tb-btn"
                    onClick={() => handleDelete(n.id)}
                    title="Удалить"
                    style={{ opacity: 0.5, fontSize: 14, lineHeight: 1, padding: '2px 6px', minWidth: 24 }}
                  >×</button>
                </div>
                <div className="mn-text">{n.text}</div>
              </div>
            ))}
          </>
        )}
        {tab === 'versions' && NOVEL.versions.map((v, i) => (
          <div key={i} className="mn" style={v.active ? { borderColor: 'var(--accent)' } : {}}>
            <div className="mn-head">
              <span className="mn-label">{v.label}</span>
              <span className="mn-time">{v.words.toLocaleString('ru')} сл</span>
            </div>
            <div className="mn-text" style={{ color: 'var(--ink-2)' }}>{v.date}</div>
            {v.active && (
              <div style={{ font: '500 10px var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>текущая</div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

type RailKey = 'editor' | 'characters' | 'map' | 'timeline' | 'notes' | 'dashboard';

interface RailNavProps {
  active?: RailKey;
  style?: CSSProperties;
}

export function RailNav({ active = 'editor', style }: RailNavProps) {
  const items: Array<[RailKey, Parameters<typeof Icon>[0]['name']]> = [
    ['editor', 'book'],
    ['characters', 'char'],
    ['map', 'map'],
    ['timeline', 'clock'],
    ['notes', 'note'],
    ['dashboard', 'layout'],
  ];
  return (
    <aside style={{
      position: 'absolute', left: 0, top: 0, bottom: 0, width: 56,
      background: 'var(--bg-deep)', borderRight: '1px solid var(--border-soft)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '14px 0', gap: 6, zIndex: 4, ...style,
    }}>
      <div style={{ width: 24, height: 30, background: 'var(--accent)', borderRadius: '1px 4px 4px 1px', marginBottom: 8, position: 'relative' }}>
        <span style={{ position: 'absolute', inset: 3, border: '0.5px solid oklch(0.98 0 0 / 0.5)' }} />
      </div>
      {items.map(([k, icn]) => (
        <button key={k} className={'tb-btn' + (k === active ? ' tb-btn--on' : '')} style={{ width: 36, height: 36, borderRadius: 8 }}>
          <Icon name={icn} size={17} />
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button className="tb-btn" style={{ width: 36, height: 36, borderRadius: 8 }}><Icon name="settings" size={17} /></button>
      <div className="sb-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>АК</div>
    </aside>
  );
}

type ScreenMode = 'studio' | 'page';

interface ScreenModeToggleProps {
  mode: ScreenMode;
  setMode: (m: ScreenMode) => void;
}

function ScreenModeToggle({ mode, setMode }: ScreenModeToggleProps) {
  const labels: Record<ScreenMode, [Parameters<typeof Icon>[0]['name'], string]> = {
    studio: ['layout', 'Студия'],
    page: ['focus', 'Страница'],
  };
  const opts: ScreenMode[] = ['studio', 'page'];
  return (
    <div style={{
      position: 'absolute', bottom: 14, right: 14, zIndex: 10,
      display: 'inline-flex', gap: 2, padding: 3, borderRadius: 10,
      background: 'var(--bg-deep)', border: '1px solid var(--border)',
      boxShadow: '0 8px 28px rgba(0,0,0,.35)',
    }}>
      {opts.map((k) => {
        const [icn, l] = labels[k];
        return (
          <button
            key={k}
            onClick={() => setMode(k)}
            className={'tb-btn' + (mode === k ? ' tb-btn--on' : '')}
            style={{ height: 26, padding: '0 10px', borderRadius: 7, gap: 5, color: mode === k ? 'var(--ink)' : 'var(--ink-3)' }}
          >
            <Icon name={icn} size={14} />
            <span style={{ fontSize: 11.5, fontWeight: 500 }}>{l}</span>
          </button>
        );
      })}
    </div>
  );
}

interface WithModeProps {
  active?: RailKey;
  children: ReactNode;
}

export function WithMode({ active = 'editor', children }: WithModeProps) {
  const [mode, setMode] = useState<ScreenMode>('studio');
  return (
    <div className={mode === 'page' ? 'mode-page' : ''} style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {children}
      {mode === 'page' && <RailNav active={active} />}
      <ScreenModeToggle mode={mode} setMode={setMode} />
    </div>
  );
}
