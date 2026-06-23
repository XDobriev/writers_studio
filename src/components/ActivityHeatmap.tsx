import { HEATMAP_WEEKS, type ActivityData } from '../lib/activity';
import { fmtNumber, plural, pluralDays } from '../lib/i18n';
import { useResponsive } from '../lib/useResponsive';

const MOBILE_WEEKS = 13;

interface ActivityHeatmapProps {
  activityData: ActivityData | null;
}

// Карточка «История активности» дашборда: heatmap по дням, столбцы по неделям,
// легенда интенсивности и график накопленного объёма. Данные — из computeActivityData.
export function ActivityHeatmap({ activityData }: ActivityHeatmapProps) {
  const { isMobile } = useResponsive();
  return (
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
              <span>{fmtNumber(activityData.todayWords)} {plural(activityData.todayWords, 'слово', 'слова', 'слов')} сегодня</span>
            )}
            {activityData.maxDelta > 0 && (
              <span>рекорд: {fmtNumber(activityData.maxDelta)} {plural(activityData.maxDelta, 'слово', 'слова', 'слов')}</span>
            )}
          </div>
        )}
      </div>

      {!activityData || activityData.cells.every(c => c.delta === 0 || c.future) ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '8px 0' }}>
          Данных пока нет — начните писать, и здесь появится график активности.
        </div>
      ) : (() => {
        const visibleWeeks = isMobile ? MOBILE_WEEKS : HEATMAP_WEEKS;
        const weekOffset = HEATMAP_WEEKS - visibleWeeks;
        const visibleCells = activityData.cells.slice(weekOffset * 7);
        const visibleWeekBars = activityData.weeks.slice(weekOffset);
        const visibleMonthLabels = activityData.monthLabels
          .filter(({ col }) => col >= weekOffset)
          .map(({ col, label }) => ({ col: col - weekOffset, label }));

        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Month labels */}
          <div style={{ position: 'relative', height: 14, paddingLeft: 22 }}>
            {visibleMonthLabels.map(({ col, label }) => (
              <span
                key={col}
                style={{
                  position: 'absolute',
                  left: `calc(22px + ${col} * (100% - 22px) / ${visibleWeeks})`,
                  top: 0,
                  lineHeight: '14px',
                  font: '400 9px var(--font-mono)',
                  color: 'var(--ink-2)',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            ))}
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
              {Array.from({ length: visibleWeeks }, (_, w) => (
                <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  {visibleCells.slice(w * 7, w * 7 + 7).map((cell) => {
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
                        title={!cell.future ? `${new Date(cell.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}: +${fmtNumber(cell.delta)} ${plural(cell.delta, 'слово', 'слова', 'слов')}` : undefined}
                        aria-label={!cell.future ? `${new Date(cell.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}: +${fmtNumber(cell.delta)} ${plural(cell.delta, 'слово', 'слова', 'слов')}` : undefined}
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
              {visibleWeekBars.map((w, i) => {
                const h = activityData.maxWeek > 0 ? Math.max(2, Math.round((w / activityData.maxWeek) * 40)) : 2;
                return (
                  <div
                    key={i}
                    title={`${fmtNumber(w)} ${plural(w, 'слово', 'слова', 'слов')}`}
                    style={{ flex: 1, minWidth: 0, height: h, borderRadius: '2px 2px 0 0', background: w > 0 ? 'oklch(0.63 0.16 30 / 0.55)' : 'var(--surface-3)' }}
                  />
                );
              })}
            </div>
          </div>

          {/* Intensity legend */}
          <div style={{ paddingLeft: 22, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <span style={{ font: '400 9px var(--font-mono)', color: 'var(--ink-4)', marginRight: 3 }}>меньше</span>
            {(['var(--surface-3)', 'oklch(0.63 0.16 30 / 0.28)', 'oklch(0.63 0.16 30 / 0.52)', 'oklch(0.63 0.16 30 / 0.76)', 'var(--accent)'] as const).map((bg, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: bg, flexShrink: 0 }} />
            ))}
            <span style={{ font: '400 9px var(--font-mono)', color: 'var(--ink-4)', marginLeft: 3 }}>больше</span>
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
                  <span>{fmtNumber(pts[0].words)} {plural(pts[0].words, 'слово', 'слова', 'слов')}</span>
                  <span>{fmtNumber(pts[pts.length - 1].words)} {plural(pts[pts.length - 1].words, 'слово', 'слова', 'слов')} сейчас</span>
                </div>
              </div>
            );
          })()}
        </div>
        );
      })()}
    </div>
  );
}
