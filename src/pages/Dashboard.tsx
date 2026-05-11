import { Link, Navigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { WithMode } from '../components/Chrome';
import { supabase, type Book } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { listChapters, type Chapter } from '../lib/chapters';
import { listCharacters, type Character } from '../lib/characters';

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
  const { signOut } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [bookRes, chList, charList] = await Promise.all([
          supabase.from('books').select('*').eq('id', id).single(),
          listChapters(id),
          listCharacters(id),
        ]);
        if (cancelled) return;
        if (bookRes.error) throw bookRes.error;
        setBook(bookRes.data as Book);
        setChapters(chList);
        setCharacters(charList);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const stats = useMemo(() => {
    if (!book || !chapters || !characters) return null;
    const done = chapters.filter((c) => c.status === 'done').length;
    const progress = chapters.filter((c) => c.status === 'progress').length;
    const draft = chapters.filter((c) => c.status === 'draft').length;
    const totalChars = chapters.reduce((sum, c) => sum + (c.content?.replace(/<[^>]+>/g, '').length ?? 0), 0);
    const daysActive = daysBetween(new Date(book.created_at), new Date());
    const goalPct = book.goal > 0 ? Math.min(100, Math.round((book.words / book.goal) * 100)) : 0;
    return { done, progress, draft, totalChars, daysActive, goalPct };
  }, [book, chapters, characters]);

  if (!id) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)' }}>Ошибка: {error}</div>
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
  const recentChapters = [...chapters]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);

  const statCards = [
    {
      l: 'Слов написано',
      v: fmtNumber(book.words),
      sub: `из ${fmtNumber(book.goal)}`,
      delta: `${stats.goalPct}% от цели`,
    },
    {
      l: 'Глав',
      v: `${chapters.length}`,
      sub: chapters.length === 0 ? 'пока ничего не написано' : `${stats.done} готово · ${stats.progress} в работе`,
      delta: stats.draft > 0 ? `${stats.draft} черновика` : '—',
    },
    {
      l: 'Персонажей',
      v: `${characters.length}`,
      sub: characters.length === 0 ? 'картотека пуста' : `${characters.filter((c) => c.role === 'protagonist').length} главных`,
      delta: characters.length > 0 ? `${characters.filter((c) => c.role === 'secondary').length} второстеп.` : '—',
    },
    {
      l: 'Дней в работе',
      v: `${stats.daysActive}`,
      sub: `с ${new Date(book.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`,
      delta: stats.totalChars > 0 ? `${fmtNumber(stats.totalChars)} символов` : '—',
    },
  ];

  return (
    <WithMode active="dashboard">
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <aside className="sb">
          <div className="sb-head">
            <div className="sb-book-title">{book.title}</div>
            <div className="sb-book-author">дэшборд книги</div>
          </div>
          <nav style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {([
              ['layout', 'Дэшборд', '', true],
              ['book', 'Манускрипт', '/editor', false],
              ['char', 'Персонажи', '/characters', false],
              ['map', 'Карта мира', '/map', false],
              ['clock', 'Хронология', '/timeline', false],
              ['tree', 'Структура', '/outline', false],
              ['grid', 'Доска', '/corkboard', false],
            ] as const).map(([n, l, path, on]) => (
              <Link key={l} to={navTo(path)} className={'sb-item' + (on ? ' sb-item--on' : '')} style={{ textDecoration: 'none' }}>
                <span style={{ display: 'flex', justifyContent: 'center', color: on ? 'var(--ink)' : 'var(--ink-3)' }}><Icon name={n} size={15} /></span>
                <span className="sb-item-title">{l}</span>
                <span />
              </Link>
            ))}
            <Link to="/books" className="sb-item" style={{ marginTop: 12, textDecoration: 'none' }}>
              <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--ink-3)' }}><Icon name="arrows" size={15} /></span>
              <span className="sb-item-title" style={{ color: 'var(--ink-3)' }}>← Все книги</span>
              <span />
            </Link>
          </nav>
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <span style={{ font: '500 13px var(--font-ui)' }}>Дэшборд · {book.title}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link to={navTo('/editor')} className="btn btn--primary" style={{ textDecoration: 'none' }}><Icon name="book" size={14} /> Открыть редактор</Link>
              <button className="btn btn--ghost" onClick={signOut}>Выйти</button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '28px 32px 40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              {statCards.map((s) => (
                <div key={s.l} style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>{s.l}</div>
                  <div style={{ font: '600 32px var(--font-serif)', letterSpacing: '-0.012em', color: 'var(--ink)' }}>{s.v}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{s.sub}</div>
                  <div style={{ font: '500 11px var(--font-mono)', color: 'var(--ink-3)', marginTop: 10, letterSpacing: '0.04em' }}>{s.delta}</div>
                </div>
              ))}
            </div>

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

            <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-soft)', borderRadius: 12, padding: '18px 22px', opacity: 0.7 }}>
              <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Графики прогресса</div>
              <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)' }}>
                Серия дней, накопленный объём по неделям, активность за 26 недель — появятся, когда заведём дневные снимки прогресса.
              </div>
            </div>
          </div>
        </main>
      </div>
    </WithMode>
  );
}
