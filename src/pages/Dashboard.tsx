import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { WithMode } from '../components/Chrome';
import { NOVEL } from '../data/sample';
import { supabase, type Book } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export default function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const { signOut } = useAuth();
  const [book, setBook] = useState<Book | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('books').select('*').eq('id', id).single();
      if (!cancelled && data) setBook(data as Book);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const navTo = (path: string) => `/books/${id}${path}`;
  const title = book?.title ?? NOVEL.title;
  const weeks = 26;
  const heat = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const r = Math.sin((w * 7 + d) * 0.7) + Math.cos(w * 0.3 + d);
      if (w < 4 && d < 5) return 0;
      if (r > 1.2) return 4;
      if (r > 0.4) return 3;
      if (r > -0.2) return 2;
      if (r > -0.9) return 1;
      return 0;
    }),
  );
  const heatColor = (v: number) =>
    ['var(--surface-2)', 'oklch(0.40 0.10 30)', 'oklch(0.50 0.13 30)', 'oklch(0.58 0.15 30)', 'var(--accent)'][v];

  const weeksData: Array<[number, number]> = [
    [1, 1240], [2, 2810], [3, 4520], [4, 6800], [5, 8200], [6, 9100],
    [7, 10840], [8, 12600], [9, 14920], [10, 17040], [11, 19280], [12, 21540],
  ];
  const target: Array<[number, number]> = weeksData.map(([w]) => [w, w * 1800]);
  const chartW = 720, chartH = 220, padL = 36, padB = 28, padT = 14, padR = 14;
  const xMax = 12, yMax = 22000;
  const xs = (x: number) => padL + ((x - 1) / (xMax - 1)) * (chartW - padL - padR);
  const ys = (y: number) => chartH - padB - (y / yMax) * (chartH - padT - padB);
  const pathLine = weeksData.map(([w, v], i) => (i ? 'L' : 'M') + xs(w) + ' ' + ys(v)).join(' ');
  const pathTarget = target.map(([w, v], i) => (i ? 'L' : 'M') + xs(w) + ' ' + ys(Math.min(v, yMax))).join(' ');

  const stats = [
    { l: 'Слов написано', v: '21 540', sub: 'из 80 000', delta: '+348 сегодня', deltaOk: true },
    { l: 'Глав', v: '6 / 10', sub: '3 готово · 3 в работе', delta: '4 черновика', deltaOk: false },
    { l: 'Дней активного письма', v: '48', sub: 'из 184 в работе', delta: 'серия 7 дней', deltaOk: true },
    { l: 'Время за рукописью', v: '71 ч', sub: 'Ø 88 мин в день', delta: '+25 мин сегодня', deltaOk: true },
  ];

  return (
    <WithMode active="dashboard">
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <aside className="sb">
          <div className="sb-head">
            <div className="sb-book-title">{title}</div>
            <div className="sb-book-author">дэшборд книги</div>
          </div>
          <nav style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {([
              ['book', 'Манускрипт', '/editor', false],
              ['layout', 'Дэшборд', '', true],
              ['char', 'Персонажи', '/characters', false],
              ['map', 'Карта мира', '/map', false],
              ['clock', 'Хронология', '/timeline', false],
              ['tree', 'Структура', '/outline', false],
              ['grid', 'Доска', '/corkboard', false],
            ] as const).map(([n, l, path, on]) => (
              <Link key={l} to={navTo(path)} className={'sb-item' + (on ? ' sb-item--on' : '')}>
                <span style={{ display: 'flex', justifyContent: 'center', color: on ? 'var(--ink)' : 'var(--ink-3)' }}><Icon name={n} size={15} /></span>
                <span className="sb-item-title">{l}</span>
                <span />
              </Link>
            ))}
            <Link to="/books" className="sb-item" style={{ marginTop: 12 }}>
              <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--ink-3)' }}><Icon name="arrows" size={15} /></span>
              <span className="sb-item-title" style={{ color: 'var(--ink-3)' }}>← Все книги</span>
              <span />
            </Link>
          </nav>
          <div className="sb-section"><span className="sb-section-title">Период</span></div>
          <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['7 дней', '30 дней', '3 месяца', 'Всё время'].map((l, i) => (
              <button key={l} className={'sb-item' + (i === 2 ? ' sb-item--on' : '')}>
                <span />
                <span className="sb-item-title">{l}</span>
                <span />
              </button>
            ))}
          </div>
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <span style={{ font: '500 13px var(--font-ui)' }}>Дэшборд · {title}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link to={navTo('/editor')} className="btn btn--primary"><Icon name="book" size={14} /> Открыть редактор</Link>
              <button className="btn btn--ghost" onClick={signOut}>Выйти</button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '28px 32px 40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              {stats.map((s, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>{s.l}</div>
                  <div style={{ font: '600 32px var(--font-serif)', letterSpacing: '-0.012em', color: 'var(--ink)' }}>{s.v}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{s.sub}</div>
                  <div style={{ font: '500 11px var(--font-mono)', color: s.deltaOk ? 'var(--ok)' : 'var(--ink-3)', marginTop: 10, letterSpacing: '0.04em' }}>{s.delta}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div style={{ font: '500 13px var(--font-ui)' }}>Цель по словам</div>
                  <button className="tb-btn" style={{ color: 'var(--ink-3)' }}>изменить</button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 18 }}>
                  При текущем темпе — <span style={{ color: 'var(--ink)' }}>23 декабря 2026</span>
                </p>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--ink-2)' }}>Книга</span>
                    <span style={{ font: '500 11.5px var(--font-mono)', color: 'var(--ink)' }}>21 540 / 80 000 · 27%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 999, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, width: '27%', background: 'linear-gradient(90deg, oklch(0.50 0.14 30), var(--accent))' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--ink-2)' }}>Сегодня</span>
                    <span style={{ font: '500 11.5px var(--font-mono)', color: 'var(--ink)' }}>348 / 1 000 · 35%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 999, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, width: '35%', background: 'var(--accent-2)' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>Ещё 652 слова до дневной нормы. Ø за неделю — 824 слова в день.</div>
                </div>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                  <div style={{ font: '500 13px var(--font-ui)' }}>Серия дней</div>
                  <span className="chip chip--accent" style={{ borderColor: 'oklch(0.78 0.10 90 / 0.5)', background: 'oklch(0.78 0.10 90 / 0.16)', color: 'var(--accent-2)' }}>Сегодня засчитан</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                  <div style={{ font: '600 56px var(--font-serif)', letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1 }}>7</div>
                  <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-2)' }}>
                    дней<br /><span style={{ color: 'var(--ink-3)', fontSize: 11 }}>лучшая серия — 24 дня</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 18 }}>
                  {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d, i) => (
                    <div key={d} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ height: 36, borderRadius: 6, background: i < 6 ? 'var(--accent)' : 'var(--accent-2)', marginBottom: 6, opacity: i === 6 ? 0.5 : 1, position: 'relative' }}>
                        {i === 6 && <span style={{ position: 'absolute', inset: 0, border: '1px dashed oklch(0.98 0 0 / 0.4)', borderRadius: 6 }} />}
                      </div>
                      <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{d}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, fontSize: 11, color: 'var(--ink-3)' }}>Сегодня — 348 слов. Ещё 652, чтобы день засчитался полностью.</div>
              </div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
                <div>
                  <div style={{ font: '500 13px var(--font-ui)' }}>Накопленный объём</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>Последние 12 недель · цель 1 800 сл/нед</div>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--ink-2)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 2, background: 'var(--accent)' }} />факт</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 0, borderTop: '1.5px dashed var(--ink-3)' }} />цель</span>
                </div>
              </div>
              <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" style={{ display: 'block' }}>
                {[0, 5500, 11000, 16500, 22000].map((v, i) => (
                  <g key={i}>
                    <line x1={padL} x2={chartW - padR} y1={ys(v)} y2={ys(v)} stroke="var(--border-soft)" strokeWidth="0.5" />
                    <text x={padL - 8} y={ys(v) + 3} textAnchor="end" style={{ font: '400 10px var(--font-mono)', fill: 'var(--ink-4)' }}>{v / 1000 + 'к'}</text>
                  </g>
                ))}
                {weeksData.map(([w]) => (
                  <text key={w} x={xs(w)} y={chartH - 8} textAnchor="middle" style={{ font: '400 10px var(--font-mono)', fill: 'var(--ink-4)' }}>{w}</text>
                ))}
                <path d={pathTarget} fill="none" stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="4 4" />
                <path d={`${pathLine} L ${xs(12)} ${ys(0)} L ${xs(1)} ${ys(0)} Z`} fill="oklch(0.63 0.16 30 / 0.12)" />
                <path d={pathLine} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
                {weeksData.map(([w, v]) => (
                  <circle key={w} cx={xs(w)} cy={ys(v)} r={w === 12 ? 4 : 2.5} fill={w === 12 ? 'var(--accent)' : 'var(--bg)'} stroke="var(--accent)" strokeWidth="1.5" />
                ))}
                <text x={xs(12) + 10} y={ys(21540) + 4} style={{ font: '500 11px var(--font-mono)', fill: 'var(--ink)' }}>21 540</text>
              </svg>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <div>
                  <div style={{ font: '500 13px var(--font-ui)' }}>Активность за 26 недель</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>134 рабочих дня · Ø 161 слово в день</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '400 11px var(--font-mono)', color: 'var(--ink-3)' }}>
                  меньше {[0, 1, 2, 3, 4].map((v) => (
                    <span key={v} style={{ width: 11, height: 11, borderRadius: 2, background: heatColor(v), display: 'inline-block' }} />
                  ))} больше
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 18, font: '400 10px var(--font-mono)', color: 'var(--ink-4)', width: 18 }}>
                  <span>пн</span><span>&nbsp;</span><span>ср</span><span>&nbsp;</span><span>пт</span><span>&nbsp;</span><span>вс</span>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', gap: 14, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginBottom: 6 }}>
                    <span>ноя</span><span>дек</span><span>янв</span><span>фев</span><span>мар</span><span>апр</span><span>май</span>
                  </div>
                  <div style={{ display: 'grid', gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 11px)', gridAutoColumns: '11px', gap: 3 }}>
                    {heat.flatMap((week, wi) => week.map((v, di) => (
                      <div key={`${wi}-${di}`} style={{ background: heatColor(v), borderRadius: 2 }} />
                    )))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </WithMode>
  );
}
