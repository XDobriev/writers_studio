import { Link, Navigate, useParams } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Sidebar, WithMode } from '../components/Chrome';
import { updateBook } from '../lib/books';
import { type Chapter } from '../lib/chapters';
import { pluralDays, plural } from '../lib/useWritingStats';
import { QUERY_KEYS, useBook, useChapters, useCharacters, useWritingSnapshots } from '../lib/queries';
import { useWindowWidth } from '../lib/useWindowWidth';

const STATUS_LABEL: Record<Chapter['status'], string> = {
  draft: 'черновик',
  progress: 'в работе',
  done: 'готова',
};
const STATUS_DOT: Record<Chapter['status'], string> = {
  draft: 'var(--ink-4)',
  progress: 'var(--accent-2)',
  done: 'var(--ok)',
};

function fmtNumber(n: number): string {
  return n.toLocaleString('ru-RU').replace(/,/g, ' ');
}

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
  const isBookNotFound = (bookError as { code?: string } | null)?.code === 'PGRST116';

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editGoal, setEditGoal] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const [showMobileSb, setShowMobileSb] = useState(false);
  useEffect(() => { if (!isMobile) setShowMobileSb(false); }, [isMobile]);

  const openEdit = () => {
    if (!book) return;
    setEditTitle(book.title);
    setEditGenre(book.genre ?? '');
    setEditGoal(book.goal);
    setEditError(null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTitle.trim() || !id) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const data = await updateBook(id, { title: editTitle.trim(), genre: editGenre.trim() || null, goal: Math.max(0, editGoal) });
      queryClient.setQueryData(QUERY_KEYS.book(id), data);
      setEditOpen(false);
    } catch (e) {
      setEditError((e as Error).message);
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

  const activityData = useMemo(() => {
    if (snapshots === undefined) return null;
    const snap: Record<string, number> = {};
    for (const row of snapshots) snap[row.date] = row.words;

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Start = Monday of the week 25 weeks before the current week
    const dow = today.getDay();
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysFromMon - 51 * 7);

    type Cell = { date: string; delta: number; future: boolean; weekIdx: number };
    const cells: Cell[] = [];
    for (let i = 0; i < 52 * 7; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const future = ds > todayStr;
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      const prevStr = prev.toISOString().slice(0, 10);
      const delta = future ? 0 : Math.max(0, (snap[ds] ?? 0) - (snap[prevStr] ?? 0));
      cells.push({ date: ds, delta, future, weekIdx: Math.floor(i / 7) });
    }

    const weeks: number[] = Array.from({ length: 52 }, (_, w) =>
      cells.slice(w * 7, w * 7 + 7).reduce((s, c) => s + c.delta, 0)
    );

    const maxDelta = Math.max(1, ...cells.map(c => c.delta));
    const maxWeek = Math.max(1, ...weeks);

    const cellByDate: Record<string, Cell> = {};
    for (const c of cells) cellByDate[c.date] = c;

    let streak = 0;
    const cur = new Date(today);
    for (let i = 0; i < 366; i++) {
      const ds = cur.toISOString().slice(0, 10);
      if ((cellByDate[ds]?.delta ?? 0) > 0) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      } else {
        break;
      }
    }

    const todayWords = cellByDate[todayStr]?.delta ?? 0;

    const monthLabels: Array<{ col: number; label: string }> = [];
    let lastMonth = -1;
    for (let w = 0; w < 52; w++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + w * 7);
      const m = d.getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ col: w, label: d.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '') });
        lastMonth = m;
      }
    }

    const cumulativeLine: Array<{ date: string; words: number }> = [];
    let lastKnownWords = 0;
    let hasCumData = false;
    for (let w = 0; w < 52; w++) {
      const weekPastCells = cells.slice(w * 7, w * 7 + 7).filter(c => !c.future);
      if (weekPastCells.length === 0) continue;
      for (const c of weekPastCells) {
        if (snap[c.date] !== undefined) {
          lastKnownWords = snap[c.date];
          hasCumData = true;
        }
      }
      if (hasCumData) {
        cumulativeLine.push({ date: weekPastCells[weekPastCells.length - 1].date, words: lastKnownWords });
      }
    }

    return { cells, weeks, maxDelta, maxWeek, todayWords, streak, monthLabels, cumulativeLine };
  }, [snapshots]);

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
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ color: 'var(--danger)', fontSize: 14 }}>Ошибка загрузки: {error}</div>
        <Link to="/books" className="btn btn--ghost" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>← К полке</Link>
      </div>
    );
  }

  if (!book || !chapters || !characters || !stats) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink-3)', padding: 32 }}>
        Загрузка…
      </div>
    );
  }

  const navTo = (path: string) => `/books/${id}${path}`;

  return (
    <WithMode>
      <div className="as as-app as-app--no-right" style={{ height: '100%', gridTemplateColumns: isMobile ? '1fr' : undefined }}>
        {!isMobile && <Sidebar book={book} />}

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', minWidth: 0 }}>
          <div className="tb" style={{ justifyContent: 'space-between', gap: 8 }}>
            {isMobile && (
              <button type="button" className="tb-btn" onClick={() => setShowMobileSb(true)} title="Навигация" style={{ flexShrink: 0 }}>
                <Icon name="panel" size={16} />
              </button>
            )}
            <span style={{ font: '500 13px var(--font-ui)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isMobile ? book.title : `Дэшборд · ${book.title}`}
            </span>
            <div style={{ display: 'flex', gap: isMobile ? 4 : 8, alignItems: 'center', flexShrink: 0 }}>
              {isMobile ? (
                <button className="tb-btn" onClick={openEdit} title="Изменить книгу">
                  <Icon name="pencil" size={15} />
                </button>
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
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16, marginBottom: 20 }}>
              {statCards.map((s) => (
                <div key={s.l} style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>{s.l}</div>
                  <div style={{ font: '600 32px var(--font-serif)', letterSpacing: '-0.012em', color: 'var(--ink)' }}>{s.v}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{s.sub}</div>
                  <div style={{ font: '500 11px var(--font-mono)', color: 'var(--ink-3)', marginTop: 10, letterSpacing: '0.04em' }}>{s.delta}</div>
                </div>
              ))}
            </div>

            {book.goal > 0 && (
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
                    Осталось <span style={{ color: 'var(--ink-2)' }}>{fmtNumber(book.goal - book.words)}</span> слов до цели.
                  </div>
                )}
              </div>
            )}

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <div style={{ font: '500 13px var(--font-ui)' }}>Последние правки</div>
                <Link to={navTo('/editor')} className="btn btn--ghost" style={{ textDecoration: 'none', fontSize: 12 }}>все главы →</Link>
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
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 8, textDecoration: 'none', color: 'var(--ink)', border: '1px solid transparent' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: STATUS_DOT[ch.status], flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: '500 13px var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title}</div>
                        <div style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                          {STATUS_LABEL[ch.status]} · {fmtNumber(ch.words)} слов · {new Date(ch.updated_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <div style={{ font: '500 13px var(--font-ui)' }}>История активности</div>
                {activityData && (
                  <div style={{ display: 'flex', gap: 16, font: '500 11.5px var(--font-mono)', color: 'var(--ink-3)' }}>
                    {activityData.streak > 0 && (
                      <span style={{ color: 'var(--accent)' }}>
                        {activityData.streak} {pluralDays(activityData.streak)} подряд
                      </span>
                    )}
                    {activityData.todayWords > 0 && (
                      <span>{fmtNumber(activityData.todayWords)} слов сегодня</span>
                    )}
                  </div>
                )}
              </div>

              {!activityData || activityData.cells.every(c => c.delta === 0 || c.future) ? (
                <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '8px 0' }}>
                  Данных пока нет — начните писать, и здесь появится график активности.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Month labels */}
                  <div style={{ display: 'flex', gap: 2, paddingLeft: 22 }}>
                    {Array.from({ length: 52 }, (_, w) => {
                      const label = activityData.monthLabels.find(m => m.col === w);
                      return (
                        <div key={w} style={{ flex: 1, minWidth: 0, font: '400 9px var(--font-mono)', color: 'var(--ink-3)', overflow: 'visible', whiteSpace: 'nowrap' }}>
                          {label?.label ?? ''}
                        </div>
                      );
                    })}
                  </div>

                  {/* Heatmap */}
                  <div style={{ display: 'flex', gap: 2 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 20, flexShrink: 0 }}>
                      {['Пн', '', 'Ср', '', 'Пт', '', 'Вс'].map((label, i) => (
                        <div key={i} style={{ flex: 1, font: '400 9px var(--font-mono)', color: 'var(--ink-4)', textAlign: 'right', paddingRight: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {label}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 2, flex: 1, minWidth: 0 }}>
                      {Array.from({ length: 52 }, (_, w) => (
                        <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                          {activityData.cells.slice(w * 7, w * 7 + 7).map((cell) => {
                            const t = cell.delta / activityData.maxDelta;
                            const bg = cell.future
                              ? 'transparent'
                              : cell.delta === 0
                              ? 'var(--surface-3)'
                              : t < 0.25
                              ? 'oklch(0.63 0.16 30 / 0.28)'
                              : t < 0.5
                              ? 'oklch(0.63 0.16 30 / 0.52)'
                              : t < 0.75
                              ? 'oklch(0.63 0.16 30 / 0.76)'
                              : 'var(--accent)';
                            return (
                              <div
                                key={cell.date}
                                title={cell.future ? '' : `${cell.date}: +${fmtNumber(cell.delta)} слов`}
                                style={{ width: '100%', aspectRatio: '1', borderRadius: 2, background: bg }}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weekly bar chart */}
                  <div style={{ paddingLeft: 22 }}>
                    <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>Объём по неделям</div>
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 40 }}>
                      {activityData.weeks.map((w, i) => {
                        const h = activityData.maxWeek > 0 ? Math.max(2, Math.round((w / activityData.maxWeek) * 40)) : 2;
                        return (
                          <div
                            key={i}
                            title={`${fmtNumber(w)} слов`}
                            style={{ flex: 1, minWidth: 0, height: h, borderRadius: '2px 2px 0 0', background: w > 0 ? 'oklch(0.63 0.16 30 / 0.55)' : 'var(--surface-3)' }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Cumulative volume line chart */}
                  {activityData.cumulativeLine.length > 1 && (() => {
                    const pts = activityData.cumulativeLine;
                    const maxW = Math.max(1, ...pts.map(p => p.words));
                    const vH = 60, vW = 100;
                    const toX = (i: number) => (i / (pts.length - 1)) * vW;
                    const toY = (w: number) => vH - (w / maxW) * vH * 0.85 - vH * 0.05;
                    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(2)} ${toY(p.words).toFixed(2)}`).join(' ');
                    const fillPath = `${linePath} L${vW} ${vH} L0 ${vH}Z`;
                    const growth = pts[pts.length - 1].words - pts[0].words;
                    return (
                      <div style={{ paddingLeft: 22, marginTop: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                          <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>Накопленный объём</div>
                          {growth > 0 && (
                            <span style={{ font: '500 11px var(--font-mono)', color: 'var(--ink-3)' }}>+{fmtNumber(growth)} за период</span>
                          )}
                        </div>
                        <svg viewBox={`0 0 ${vW} ${vH}`} style={{ width: '100%', height: 72, display: 'block' }} preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="oklch(0.63 0.16 30)" stopOpacity="0.22" />
                              <stop offset="100%" stopColor="oklch(0.63 0.16 30)" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d={fillPath} fill="url(#cumGrad)" />
                          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                          <circle cx={toX(pts.length - 1)} cy={toY(pts[pts.length - 1].words)} r="1.8" fill="var(--accent)" />
                        </svg>
                        <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 10px var(--font-mono)', color: 'var(--ink-4)', marginTop: 4 }}>
                          <span>{fmtNumber(pts[0].words)} слов</span>
                          <span>{fmtNumber(pts[pts.length - 1].words)} слов сейчас</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      {isMobile && showMobileSb && (
        <>
          <div
            role="presentation"
            onClick={() => setShowMobileSb(false)}
            style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', zIndex: 40 }}
          />
          <div style={{ position: 'fixed', top: 0, left: 0, width: 280, height: '100%', zIndex: 41, boxShadow: '4px 0 32px oklch(0.05 0.01 50 / 0.35)' }}>
            <Sidebar book={book} />
          </div>
        </>
      )}

      {editOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'oklch(0 0 0 / 0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEditOpen(false)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 16, padding: '28px 32px', width: 440, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 24px 60px oklch(0.05 0.01 50 / 0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ font: '600 16px var(--font-ui)' }}>Редактировать книгу</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Название</label>
              <input
                className="input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditOpen(false); }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Жанр</label>
              <input
                className="input"
                value={editGenre}
                onChange={(e) => setEditGenre(e.target.value)}
                placeholder="Фэнтези, Детектив, Роман…"
                onKeyDown={(e) => { if (e.key === 'Escape') setEditOpen(false); }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="label">Цель по словам</label>
              <input
                className="input"
                type="number"
                min={0}
                step={1000}
                value={editGoal || ''}
                placeholder="необязательно"
                onChange={(e) => setEditGoal(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditOpen(false); }}
              />
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                Рассказ 1–10 тыс. · Повесть 20–50 тыс. · Роман 50–120 тыс. · Эпическое фэнтези 120–300 тыс. слов
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
              >
                {editSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </WithMode>
  );
}
