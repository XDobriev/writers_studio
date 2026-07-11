import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toastVariants } from '../lib/motion';
import { useMemo, useState, useEffect } from 'react';
import { useErrorState } from '../lib/useErrorState';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Sidebar, WithMode } from '../components/Chrome';
import { Skeleton } from '../components/Skeleton';
import { GenrePicker } from '../components/GenrePicker';
import { updateBook } from '../lib/books';
import { DbError } from '../lib/repository';
import { type Chapter } from '../lib/chapters';
import { plural, pluralDays, fmtNumber } from '../lib/i18n';
import { QUERY_KEYS, useBook, useChapters, useCharacters, useWritingSnapshots } from '../lib/queries';
import { useResponsive } from '../lib/useResponsive';
import { computeActivityData } from '../lib/activity';
import { toLocalISODate } from '../lib/dates';
import { ActivityHeatmap } from '../components/ActivityHeatmap';

const STATUS_DOT: Record<Chapter['status'], string> = {
  draft: 'var(--ink-4)',
  progress: 'var(--accent-2)',
  done: 'var(--ok)',
};

const QUICK_ACTIONS: Array<{ title: string; dest: string; icon: 'tree' | 'char' | 'note' | 'clock'; path: string }> = [
  { title: 'Новая глава',    dest: 'Структура →',  icon: 'tree',  path: '/outline?create=true'    },
  { title: 'Новый персонаж', dest: 'Картотека →',  icon: 'char',  path: '/characters?create=true' },
  { title: 'Новая заметка',  dest: 'Заметки →',    icon: 'note',  path: '/notes?create=true'      },
  { title: 'Новое событие',  dest: 'Хронология →', icon: 'clock', path: '/timeline?create=true'   },
];

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.max(1, Math.floor(ms / 86400000));
}

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: book, error: bookError } = useBook(id);
  const { data: chapters, error: chaptersError } = useChapters(id);
  const { data: characters, error: charsError } = useCharacters(id);
  const { data: snapshots, error: snapsError } = useWritingSnapshots(id);
  const error = (bookError ?? chaptersError ?? charsError ?? snapsError)?.message ?? null;
  const isBookNotFound = bookError instanceof DbError && bookError.code === 'PGRST116';

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editGoal, setEditGoal] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const { error: editError, setError: setEditError, clearError: clearEditError } = useErrorState();
  const [weeklyToast, setWeeklyToast] = useState<string | null>(null);

  const navigate = useNavigate();

  const { isMobile } = useResponsive();
  const [showMobileSb, setShowMobileSb] = useState(false);
  useEffect(() => { if (!isMobile) setShowMobileSb(false); }, [isMobile]);

  const openEdit = () => {
    if (!book) return;
    setEditTitle(book.title);
    setEditGenres(book.genres?.length ? book.genres : book.genre ? [book.genre] : []);
    setEditGoal(book.goal);
    clearEditError();
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (editSaving || !editTitle.trim() || !id) return;
    setEditSaving(true);
    clearEditError();
    try {
      const data = await updateBook(id, { title: editTitle.trim(), genres: editGenres, goal: Math.max(0, editGoal) });
      queryClient.setQueryData(QUERY_KEYS.book(id), data);
      setEditOpen(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setEditSaving(false);
    }
  };

  const stats = useMemo(() => {
    if (!book || !chapters || !characters) return null;
    const done = chapters.filter((c) => c.status === 'done').length;
    const progress = chapters.filter((c) => c.status === 'progress').length;
    const draft = chapters.filter((c) => c.status === 'draft').length;
    const daysActive = daysBetween(new Date(book.created_at), new Date());
    const goalPct = book.goal > 0 ? Math.min(100, Math.round((book.words / book.goal) * 100)) : 0;
    return { done, progress, draft, daysActive, goalPct };
  }, [book, chapters, characters]);

  const activityData = useMemo(
    () => (snapshots === undefined ? null : computeActivityData(snapshots)),
    [snapshots],
  );

  useEffect(() => {
    if (!activityData || activityData.lastWeekWords <= 0) return;
    const today = new Date();
    if (today.getDay() !== 1) return;
    const key = `weekly-toast-${toLocalISODate(today)}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    setWeeklyToast(`На прошлой неделе — ${fmtNumber(activityData.lastWeekWords)} ${plural(activityData.lastWeekWords, 'слово', 'слова', 'слов')}`);
  }, [activityData]);

  useEffect(() => {
    if (!weeklyToast) return;
    const t = setTimeout(() => { setWeeklyToast(null); }, 5100);
    return () => clearTimeout(t);
  }, [weeklyToast]);

  const recentChapters = useMemo(
    () =>
      chapters
        ? [...chapters]
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, 6)
        : [],
    [chapters]
  );

  const statCards = useMemo(() => {
    if (!book || !chapters || !characters || !stats) return [];
    const protagonistCount = characters.filter((c) => c.role === 'protagonist').length;
    const secondaryCount = characters.filter((c) => c.role === 'secondary').length;
    return [
      {
        l: 'Слов написано',
        v: fmtNumber(book.words),
        sub: book.goal > 0 ? `из ${fmtNumber(book.goal)}` : 'цель не задана',
        delta: book.goal > 0 ? `${stats.goalPct}% от цели` : '—',
      },
      {
        l: 'Глав',
        v: `${chapters.length}`,
        sub: chapters.length === 0 ? 'пока ничего не написано' : `${stats.done} готово · ${stats.progress} в работе`,
        delta: stats.draft > 0 ? `${stats.draft} ${plural(stats.draft, 'черновик', 'черновика', 'черновиков')}` : '—',
      },
      {
        l: 'Персонажей',
        v: `${characters.length}`,
        sub: characters.length === 0 ? 'картотека пуста' : `${protagonistCount} ${plural(protagonistCount, 'главный', 'главных', 'главных')}`,
        delta: characters.length > 0 ? `${secondaryCount} ${plural(secondaryCount, 'второстепенный', 'второстепенных', 'второстепенных')}` : '—',
      },
      {
        l: 'Дней в работе',
        v: `${stats.daysActive}`,
        sub: `с ${new Date(book.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`,
        delta: book.words > 0
          ? `в среднем ${fmtNumber(Math.round(book.words / stats.daysActive))} слов/день`
          : '—',
      },
      (() => {
        const totalMins = Math.round(book.words / 200);
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        const pages = Math.round(book.words / 250);
        return {
          l: 'Время чтения',
          v: hours > 0 ? `${hours} ч ${mins} мин` : totalMins === 0 && book.words > 0 ? '< 1 мин' : `${totalMins} мин`,
          sub: book.words > 0 ? `≈ ${pages} ${plural(pages, 'страница', 'страницы', 'страниц')} А4` : 'нет текста',
          delta: '200 слов/мин',
        };
      })(),
    ];
  }, [book, chapters, characters, stats]);

  if (!id) return <Navigate to="/books" replace />;

  if (isBookNotFound) {
    return (
      <div
        className="as"
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-deep)',
          userSelect: 'none',
        }}
      >
        <div style={{ font: '300 9rem/1 var(--font-serif)', color: 'var(--surface-3)', letterSpacing: '-0.04em', lineHeight: 1 }}>
          404
        </div>
        <div style={{ font: '400 1.125rem var(--font-serif)', color: 'var(--ink-2)', marginTop: 20 }}>
          Книга не найдена
        </div>
        <div style={{ font: '400 0.8125rem var(--font-ui)', color: 'var(--ink-4)', marginTop: 8, maxWidth: 300, textAlign: 'center', lineHeight: 1.5 }}>
          Книга удалена или у вас нет к ней доступа.
        </div>
        <Link to="/books" className="btn btn--primary" style={{ textDecoration: 'none', marginTop: 28 }}>
          ← К полке
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="as page-fill--error" style={{ gap: 16 }}>
        <div style={{ color: 'var(--danger)', fontSize: 14 }}>Ошибка загрузки: {error}</div>
        <Link to="/books" className="btn btn--ghost" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>← К полке</Link>
      </div>
    );
  }

  if (!book || !chapters || !characters) {
    return (
      <div className="as as-app as-app--no-right" style={{ height: '100vh', gridTemplateColumns: isMobile ? '1fr' : undefined }}>
        {!isMobile && (
          <div className="skeleton" style={{ height: '100%', borderRadius: 0 }} />
        )}
        <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--bg)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton" style={{ height: 116, borderRadius: 12 }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: 72, borderRadius: 12 }} />
          <Skeleton lines={4} height={18} widths={[60, 75, 50, 70]} />
        </div>
      </div>
    );
  }

  const isEmpty = book.words === 0 && chapters.length === 0 && characters.length === 0;

  const navTo = (path: string) => `/books/${id}${path}`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }} style={{ height: '100%' }}>
    <WithMode>
      <div className="as as-app as-app--no-right" style={{ height: '100%', gridTemplateColumns: isMobile ? '1fr' : undefined }}>
        {!isMobile && (
          <Sidebar
            book={book}
            chapters={chapters}
            chapterActions={{ onSelectChapter: (cid) => navigate(`/books/${id}/editor?chapter=${cid}`) }}
          />
        )}

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', minWidth: 0 }}>
          <div className="tb" style={{ justifyContent: 'space-between', gap: 8 }}>
            {isMobile && (
              <button type="button" className="tb-btn" onClick={() => setShowMobileSb(true)} title="Навигация" aria-label="Навигация" style={{ flexShrink: 0 }}>
                <Icon name="panel" size={16} />
              </button>
            )}
            <span style={{ font: '500 13px var(--font-ui)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isMobile ? book.title : `Дэшборд · ${book.title}`}
            </span>
            <div style={{ display: 'flex', gap: isMobile ? 4 : 8, alignItems: 'center', flexShrink: 0 }}>
              {isMobile ? (
                <>
                  <button className="tb-btn" onClick={openEdit} title="Изменить книгу" aria-label="Изменить книгу">
                    <Icon name="pencil" size={15} />
                  </button>
                  <Link to={navTo('/export')} className="tb-btn" title="Экспорт" aria-label="Экспорт">
                    <Icon name="download" size={15} />
                  </Link>
                </>
              ) : (
                <>
                  <button className="btn btn--ghost" onClick={openEdit}><Icon name="pencil" size={14} /> Изменить</button>
                  <Link to={navTo('/export')} className="btn btn--ghost" style={{ textDecoration: 'none' }}><Icon name="download" size={14} /> Экспорт</Link>
                </>
              )}
              <Link to={navTo('/editor')} className="btn btn--primary" style={{ textDecoration: 'none' }}>
                <Icon name="book" size={14} />{!isMobile && ' Открыть редактор'}
              </Link>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: isMobile ? '20px 16px 40px' : '28px 32px 40px' }}>
            {isEmpty ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: isMobile ? '24px 20px' : '28px 32px', marginBottom: 20 }}>
                <div style={{ font: '500 15px var(--font-ui)', color: 'var(--ink)', marginBottom: 6 }}>Книга создана. Пора начинать.</div>
                <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 20, lineHeight: 1.5 }}>
                  Добавьте первую главу или сразу откройте редактор.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link to={navTo('/outline?create=true')} className="btn btn--primary" style={{ textDecoration: 'none' }}>
                    <Icon name="tree" size={14} /> Новая глава
                  </Link>
                  <Link to={navTo('/editor')} className="btn btn--ghost" style={{ textDecoration: 'none' }}>
                    <Icon name="book" size={14} /> Открыть редактор
                  </Link>
                  <button className="btn btn--ghost" onClick={openEdit}>Настроить книгу</button>
                </div>
              </div>
            ) : (
              <div className="dash-stat-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: isMobile ? 10 : 16, marginBottom: 20 }}>
                {statCards.map((s) => (
                  <div key={s.l} style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '18px 20px' }}>
                    <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>{s.l}</div>
                    <div style={{ font: '600 32px var(--font-mono)', letterSpacing: '-0.012em', color: 'var(--ink)' }}>{s.v}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{s.sub}</div>
                    <div style={{ font: '500 11px var(--font-mono)', color: 'var(--ink-3)', marginTop: 10, letterSpacing: '0.04em' }}>{s.delta}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <ActivityHeatmap activityData={activityData} />
            </div>

            <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 10, marginTop: 4 }}>
              Быстрые действия
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
              {QUICK_ACTIONS.map(({ title, dest, icon, path }) => (
                <Link
                  key={title}
                  to={navTo(path)}
                  className="dash-quick-action"
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    background: 'oklch(0.63 0.16 30 / 0.13)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                    flexShrink: 0,
                  }}>
                    <Icon name={icon} size={15} />
                  </div>
                  <div style={{ font: '500 12.5px var(--font-ui)', color: 'var(--ink)' }}>{title}</div>
                  <div style={{ font: '400 10.5px var(--font-mono)', letterSpacing: '0.06em', color: 'var(--ink-3)', marginTop: 'auto' }}>{dest}</div>
                </Link>
              ))}
            </div>

            {book.goal > 0 && stats && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                  <div style={{ font: '500 13px var(--font-ui)' }}>Цель по словам</div>
                  <span style={{ font: '500 11.5px var(--font-mono)', color: 'var(--ink)' }}>{fmtNumber(book.words)} / {fmtNumber(book.goal)} · {stats.goalPct}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 999, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${stats.goalPct}%`, background: 'linear-gradient(90deg, oklch(0.50 0.14 30), var(--accent))' }} />
                </div>
                {book.goal > book.words && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-3)' }}>
                    Осталось <span style={{ color: 'var(--ink-2)' }}>{fmtNumber(book.goal - book.words)}</span> {plural(book.goal - book.words, 'слово', 'слова', 'слов')} до цели.
                  </div>
                )}
                {activityData && Math.round(activityData.avg7) > 0 && book.goal > book.words && (() => {
                  const pace = Math.round(activityData.avg7);
                  const etaDays = Math.ceil((book.goal - book.words) / pace);
                  return (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ink-3)' }}>
                      Темп за 7 дней:{' '}
                      <span style={{ color: 'var(--ink-2)' }}>{fmtNumber(pace)} слов/день</span>
                      {' · '}завершение через{' '}
                      <span style={{ color: 'var(--ink-2)' }}>≈ {etaDays} {pluralDays(etaDays)}</span>
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <div style={{ font: '500 13px var(--font-ui)' }}>Последние правки</div>
                <Link to={navTo('/outline')} className="btn btn--ghost" style={{ textDecoration: 'none', fontSize: 12 }}>все главы →</Link>
              </div>
              {recentChapters.length === 0 ? (
                <div style={{ padding: '24px 0', color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
                  В книге ещё нет глав. <Link to={navTo('/editor')} style={{ color: 'var(--accent)' }}>Открыть редактор →</Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {recentChapters.map((ch) => (
                    <Link
                      key={ch.id}
                      to={navTo(`/editor?chapter=${ch.id}`)}
                      className="db-recent-link"
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: STATUS_DOT[ch.status], flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: '500 13px var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title}</div>
                        <div style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                          {fmtNumber(ch.words)} {plural(ch.words, 'слово', 'слова', 'слов')} · {new Date(ch.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {editOpen && (
          <div className="modal-overlay" onClick={() => { if (!editSaving) setEditOpen(false); }}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Редактировать книгу"
              tabIndex={-1}
              className="modal-panel"
              style={{ width: 460 }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setEditOpen(false); return; }
                if (e.key === 'Tab') {
                  const focusable = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
                  const arr = Array.from(focusable);
                  if (!arr.length) return;
                  const first = arr[0], last = arr[arr.length - 1];
                  if (e.shiftKey ? document.activeElement === first : document.activeElement === last) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
                }
              }}
            >
              <div style={{ font: '600 16px var(--font-ui)' }}>Редактировать книгу</div>

              <div>
                <label className="label" htmlFor="edit-book-title">Название</label>
                <input
                  id="edit-book-title"
                  className="input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditOpen(false); }}
                  autoFocus
                  maxLength={120}
                />
              </div>

              <GenrePicker value={editGenres} onChange={setEditGenres} />

              <div>
                <label className="label" htmlFor="edit-book-goal">Цель по словам</label>
                <input
                  id="edit-book-goal"
                  className="input"
                  type="number"
                  min={0}
                  step={1000}
                  value={editGoal || ''}
                  placeholder="необязательно"
                  onChange={(e) => setEditGoal(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditOpen(false); }}
                />
                <div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Рассказ 1–10 тыс. · Новелла 10–20 тыс. · Повесть 20–50 тыс. · Роман 50–120 тыс. · Эпос / сага 120–300 тыс. слов
                </div>
              </div>

              {editError && (
                <div style={{ fontSize: 12, color: 'var(--danger)' }}>{editError}</div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost" onClick={() => setEditOpen(false)}>Отмена</button>
                <button
                  className="btn btn--primary"
                  onClick={saveEdit}
                  disabled={editSaving || !editTitle.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {editSaving && <span className="btn-spinner" />}
                  {editSaving ? 'Сохраняем…' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {isMobile && showMobileSb && (
        <>
          <div
            role="presentation"
            onClick={() => setShowMobileSb(false)}
            style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', zIndex: 40 }}
          />
          <div className="as" style={{ position: 'fixed', top: 0, left: 0, width: 280, height: '100%', zIndex: 41, boxShadow: '4px 0 32px oklch(0.05 0.01 50 / 0.35)' }}>
            <Sidebar
              book={book}
              chapters={chapters}
              chapterActions={{ onSelectChapter: (cid) => navigate(`/books/${id}/editor?chapter=${cid}`) }}
            />
          </div>
        </>
      )}
    </WithMode>

    <AnimatePresence>
      {weeklyToast && (
        <motion.div
          className="toast toast--info"
          variants={toastVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <span style={{ fontSize: 16 }}>📅</span>
          {weeklyToast}
        </motion.div>
      )}
    </AnimatePresence>
    </motion.div>
  );
}
