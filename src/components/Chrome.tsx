import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { NOVEL, SAMPLE_PROSE } from '../data/sample';
import type { Chapter, ChapterStatus } from '../lib/chapters';
import type { Book } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { fetchNotes, createNote, updateNote, deleteNote, type Note, type NoteKind } from '../lib/notes';
import { useAuth } from '../lib/auth';

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user, signOut, updatePassword } = useAuth();
  const [name, setName] = useState(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSaved, setPassSaved] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSaveName = async () => {
    setNameSaving(true); setNameError(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      if (error) setNameError(error.message);
      else setNameSaved(true);
    } finally {
      setNameSaving(false);
    }
  };

  const handleSavePass = async () => {
    if (newPass.length < 6) { setPassError('Минимум 6 символов'); return; }
    setPassSaving(true); setPassError(null);
    try {
      const { error } = await updatePassword(newPass);
      if (error) setPassError(error);
      else { setPassSaved(true); setNewPass(''); }
    } finally {
      setPassSaving(false);
    }
  };

  const SL: CSSProperties = { font: '500 10.5px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 14 };
  const FL: CSSProperties = { font: '400 12px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 6 };
  const HR: CSSProperties = { border: 'none', borderTop: '1px solid var(--border-soft)', margin: '20px 0 0' };
  const FG: CSSProperties = { display: 'flex', flexDirection: 'column' };
  const ROW: CSSProperties = { display: 'flex', gap: 8 };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, width: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.55)' }}>

        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px 16px', borderBottom: '1px solid var(--border-soft)' }}>
          <span style={{ font: '600 14px var(--font-ui)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Настройки</span>
          <span style={{ flex: 1 }} />
          <button className="tb-btn" onClick={onClose} style={{ fontSize: 20, lineHeight: 1, padding: '0 6px', color: 'var(--ink-4)' }}>×</button>
        </div>

        <div style={{ padding: '24px 24px 20px', display: 'flex', flexDirection: 'column' }}>

          {/* ПРОФИЛЬ */}
          <section>
            <div style={SL}>Профиль</div>
            <div style={{ ...FG, gap: 14 }}>
              <div style={FG}>
                <span style={FL}>Имя</span>
                <div style={ROW}>
                  <input className="input" value={name} onChange={(e) => { setName(e.target.value); setNameSaved(false); }} placeholder="Ваше имя" style={{ flex: 1, fontSize: 13 }} />
                  <button className="btn btn--primary" style={{ fontSize: 13, padding: '0 14px', flexShrink: 0 }} onClick={handleSaveName} disabled={nameSaving || !name.trim()}>
                    {nameSaving ? '…' : nameSaved ? '✓' : 'Сохранить'}
                  </button>
                </div>
                {nameError && <span style={{ font: '400 12px var(--font-ui)', color: 'var(--danger)', marginTop: 6 }}>{nameError}</span>}
              </div>
              <div style={FG}>
                <span style={FL}>Email</span>
                <input className="input" value={user?.email ?? ''} readOnly style={{ fontSize: 13, opacity: 0.5, cursor: 'default' }} />
              </div>
            </div>
          </section>

          <hr style={HR} />

          {/* БЕЗОПАСНОСТЬ */}
          <section style={{ marginTop: 20 }}>
            <div style={SL}>Безопасность</div>
            <div style={FG}>
              <span style={FL}>Новый пароль</span>
              <div style={ROW}>
                <input className="input" type="password" value={newPass} onChange={(e) => { setNewPass(e.target.value); setPassSaved(false); setPassError(null); }} placeholder="Минимум 6 символов" style={{ flex: 1, fontSize: 13 }} />
                <button className="btn btn--primary" style={{ fontSize: 13, padding: '0 14px', flexShrink: 0 }} onClick={handleSavePass} disabled={passSaving || !newPass}>
                  {passSaving ? '…' : passSaved ? '✓' : 'Сменить'}
                </button>
              </div>
              {passError && <span style={{ font: '400 12px var(--font-ui)', color: 'var(--danger)', marginTop: 6 }}>{passError}</span>}
              {passSaved && <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ok)', marginTop: 6 }}>Пароль изменён</span>}
            </div>
          </section>

          <hr style={HR} />

          {/* ПОДПИСКА */}
          <section style={{ marginTop: 20 }}>
            <div style={SL}>Подписка</div>
            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', marginBottom: 3 }}>Бесплатный план</div>
                <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>1 книга · базовый редактор · без экспорта</div>
              </div>
              <button className="btn btn--ghost" style={{ fontSize: 12, padding: '5px 12px', opacity: 0.35, flexShrink: 0 }} disabled>Управление</button>
            </div>
          </section>

          <hr style={HR} />

          {/* ВЫХОД */}
          <section style={{ marginTop: 20 }}>
            <button
              onClick={() => signOut()}
              style={{ width: '100%', fontSize: 13, padding: '9px 0', color: 'var(--danger)', background: 'transparent', border: '1px solid color-mix(in oklch, var(--danger) 45%, transparent)', borderRadius: 8, cursor: 'pointer', letterSpacing: '-0.01em', transition: 'background 0.15s, border-color 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in oklch, var(--danger) 10%, transparent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >Выйти из аккаунта</button>
          </section>

        </div>
      </div>
    </div>
  );
}

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
  onSelectChapter?: (id: string) => void;
  onCreateChapter?: () => void;
  onStatusChange?: (id: string, status: ChapterStatus) => void;
  bookHref?: string;
  subtitle?: string;
  children?: ReactNode;
}

export function Sidebar({
  book,
  chapters,
  activeChapterId,
  onSelectChapter,
  onCreateChapter,
  onStatusChange,
  bookHref,
  subtitle,
  children,
}: SidebarProps) {
  const isReal = Boolean(chapters);
  const { pathname } = useLocation();
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? '';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join('') || '?';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusMenuFor, setStatusMenuFor] = useState<string | null>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!statusMenuFor) return;
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setStatusMenuFor(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusMenuFor]);
  const bid = book?.id ?? '';
  const navItems: Array<[Parameters<typeof Icon>[0]['name'], string, string | null]> = [
    ['layout', 'Дэшборд', bid ? `/books/${bid}` : null],
    ['book', 'Манускрипт', bid ? `/books/${bid}/editor` : null],
    ['char', 'Персонажи', bid ? `/books/${bid}/characters` : null],
    ['map', 'Карта мира', bid ? `/books/${bid}/map` : null],
    ['clock', 'Хронология', bid ? `/books/${bid}/timeline` : null],
    ['note', 'Заметки', bid ? `/books/${bid}/notes` : null],
    ['tree', 'Структура', bid ? `/books/${bid}/outline` : null],
    ['grid', 'Доска', bid ? `/books/${bid}/corkboard` : null],
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
        {bid ? (
          <Link to={`/books/${bid}`} className="sb-book-title" style={{ textDecoration: 'none' }}>{book?.title ?? NOVEL.title}</Link>
        ) : (
          <div className="sb-book-title">{book?.title ?? NOVEL.title}</div>
        )}
        <div className="sb-book-author">
          {subtitle ?? (book ? [book.author, book.genre].filter(Boolean).join(' · ') || 'без описания' : `${NOVEL.author} · ${NOVEL.genre}`)}
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
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, margin: -4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 4 }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: SB_STATUS_COLOR[c.status], display: 'block' }} />
                  </button>
                  {statusMenuFor === c.id && (
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: 4, minWidth: 140, boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}>
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

      <div className="sb-foot">
        <div className="sb-avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sb-foot-name">{displayName || '—'}</div>
          <div className="sb-foot-meta">Свободный план</div>
        </div>
        <button className="tb-btn" onClick={() => setSettingsOpen(true)} title="Настройки"><Icon name="settings" size={15} /></button>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
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
  todayWords?: number;
  goalWords?: number;
  streak?: number;
}

export function StatusBar({ words = 4720, chars = 28140, savedAt = '14:32', statusLabel, todayWords, goalWords = 1000, streak }: StatusBarProps) {
  function pluralDays(n: number): string {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'день';
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'дня';
    return 'дней';
  }
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
      {todayWords !== undefined && (
        <>
          <span>сегодня · {todayWords.toLocaleString('ru')}/{goalWords.toLocaleString('ru')} слов</span>
          {streak !== undefined && streak > 0 && (
            <>
              <span style={{ color: 'var(--ink-4)' }}>·</span>
              <span style={{ color: 'var(--accent-2)' }}>серия {streak} {pluralDays(streak)}</span>
            </>
          )}
        </>
      )}
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<NoteKind>('idea');
  const [editText, setEditText] = useState('');

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

  const startEdit = (n: Note) => {
    setEditingId(n.id);
    setEditKind(n.kind);
    setEditText(n.text);
  };

  const handleUpdate = async () => {
    if (!editingId || !editText.trim()) return;
    setSaving(true);
    try {
      const updated = await updateNote(editingId, editKind, editText.trim());
      setNotes((prev) => prev.map((n) => n.id === editingId ? updated : n));
      setEditingId(null);
    } finally {
      setSaving(false);
    }
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
                {editingId === n.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <select
                      value={editKind}
                      onChange={(e) => setEditKind(e.target.value as NoteKind)}
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
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      style={{ fontSize: 12, resize: 'vertical' }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn--ghost"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => setEditingId(null)}
                      >Отмена</button>
                      <button
                        className="btn btn--primary"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={handleUpdate}
                        disabled={saving || !editText.trim()}
                      >Сохранить</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mn-head">
                      <span className="mn-label">{labels[n.kind]}</span>
                      <span style={{ color: 'var(--ink-4)', margin: '0 4px' }}>·</span>
                      <span className="mn-time">{new Date(n.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                      <span style={{ flex: 1 }} />
                      <button
                        className="tb-btn"
                        onClick={() => startEdit(n)}
                        title="Редактировать"
                        style={{ opacity: 0.5, padding: '2px 5px', minWidth: 24 }}
                      ><Icon name="pencil" size={11} /></button>
                      <button
                        className="tb-btn"
                        onClick={() => handleDelete(n.id)}
                        title="Удалить"
                        style={{ opacity: 0.5, fontSize: 14, lineHeight: 1, padding: '2px 6px', minWidth: 24 }}
                      >×</button>
                    </div>
                    <div className="mn-text">{n.text}</div>
                  </>
                )}
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

type RailKey = 'editor' | 'characters' | 'map' | 'timeline' | 'notes' | 'dashboard' | 'outline' | 'corkboard';

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
  const showToggle = active === 'editor';
  return (
    <div className={mode === 'page' ? 'mode-page' : ''} style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {children}
      {mode === 'page' && <RailNav active={active} />}
      {showToggle && <ScreenModeToggle mode={mode} setMode={setMode} />}
    </div>
  );
}
