import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  featTextVariants, featMockVariants,
  featTextVariantsRev, featMockVariantsRev,
  revealVariants,
} from '../lib/motion';
import { SectionLabel } from './LandingSectionLabel';

const MC = [
  { num: 1, title: 'Город, которого нет', status: 'done' as const },
  { num: 2, title: 'Архив', status: 'progress' as const },
  { num: 3, title: 'Серая Цапля', status: 'progress' as const },
  { num: 4, title: 'Дорога вдоль Тихой', status: 'draft' as const },
  { num: 5, title: 'Стопка карт', status: 'draft' as const },
];

const MS = [
  'Аней Ворон узнаёт об исчезновении Ворны.',
  'Сборы в путь. Прощание с наставником.',
  'Трактир «Серая Цапля». Встреча с Маркисом.',
  'Дорога вдоль Тихой. Колокол вдалеке.',
  'Стопка карт — 12-й картограф был здесь.',
  'Гарнизон Сольвы. Полковник Лих молчит.',
];

const _MD_WEEKS = 52;
const _MD_CELLS = Array.from({ length: _MD_WEEKS * 7 }, (_, i) => {
  const w = Math.floor(i / 7), d = i % 7;
  if ((w === 7 && d >= 4) || (w === 8 && d <= 0)) return 0;
  if ((w === 24 && d >= 5) || (w === 25 && d <= 1)) return 0;
  if (w === 38 && d >= 4) return 0;
  const p = Math.sin(w * 2.39 + d * 3.71) * Math.sin(w * 4.13 + d * 1.97 + 2.3);
  if (p > 0.72) return 0;
  if (d >= 5 && Math.cos(w * 3.17 + d) > 0.55) return 0;
  const f = Math.sin(w * 0.29 + d * 0.73) * 0.55
          + Math.cos(w * 0.47 + d * 1.03) * 0.4
          + Math.sin(w * 0.83 + 1.1) * 0.3;
  if (f > 0.9) return 4;
  if (f > 0.25) return 3;
  if (f > -0.3) return 2;
  return 1;
});
const _MD_WEEK_TOTALS = Array.from({ length: _MD_WEEKS }, (_, w) =>
  _MD_CELLS.slice(w * 7, w * 7 + 7).reduce((a, v) => a + v, 0 as number)
);
const _MD_MAX_WEEK = Math.max(..._MD_WEEK_TOTALS, 1);
const _MD_MONTHS: { [k: number]: string } = {
  0: 'июль', 4: 'авг', 9: 'сент', 13: 'окт',
  17: 'нояб', 22: 'дек', 26: 'янв', 30: 'февр',
  35: 'март', 39: 'апр', 43: 'май', 48: 'июнь',
};

// ─── Mock components ──────────────────────────────────────────────────────────

function MockEditorModesStrip() {
  const textLines = (ws: number[]) => ws.map((w, i) => (
    <div key={i} style={{ height: 3, background: 'var(--paper-ink)', opacity: 0.18, borderRadius: 1, marginBottom: 4, width: `${w * 100}%` }} />
  ));

  const Paper = ({ narrow }: { narrow?: boolean }) => (
    <div style={{ width: narrow ? '72%' : '82%', background: 'var(--paper)', borderRadius: '2px 2px 0 0', padding: '10px 8px' }}>
      <div style={{ height: 6, background: 'var(--paper-ink)', opacity: 0.6, borderRadius: 1, marginBottom: 6, width: '65%' }} />
      <div style={{ height: 2, background: 'var(--paper-ink)', opacity: 0.2, borderRadius: 1, marginBottom: 8, width: '18%' }} />
      {textLines([0.92, 0.88, 0.65, 0.82, 0.55, 0.9])}
    </div>
  );

  const ModePane = ({ label, desc, children }: { label: string; desc: string; children: ReactNode }) => (
    <div>
      <div data-theme="dark" style={{ borderRadius: 10, overflow: 'hidden', background: 'var(--bg-deep)', border: '1px solid var(--border)', boxShadow: '0 0 0 1px var(--border), 0 12px 36px oklch(0 0 0 / 0.45)' }}>
        <div style={{ height: 26, background: 'oklch(0.20 0.014 50)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 5, borderBottom: '1px solid var(--border-soft)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'oklch(0.62 0.16 25)' }} />
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'oklch(0.78 0.12 80)' }} />
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'oklch(0.66 0.14 145)' }} />
        </div>
        <div style={{ height: 190, overflow: 'hidden', position: 'relative' }}>{children}</div>
      </div>
      <div style={{ marginTop: 14, textAlign: 'center' }}>
        <div style={{ font: '500 13.5px var(--font-ui)', color: 'var(--ink)', marginBottom: 3 }}>{label}</div>
        <div style={{ font: '400 12px var(--font-serif)', color: 'var(--ink-3)' }}>{desc}</div>
      </div>
    </div>
  );

  const RightCards = () => (
    <div style={{ background: 'var(--bg-deep)', padding: '8px 5px', borderLeft: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ background: 'color-mix(in oklch, var(--accent-2) 8%, var(--surface))', border: '1px solid color-mix(in oklch, var(--accent-2) 22%, var(--border-soft))', borderRadius: 3, padding: '4px 5px' }}>
        <div style={{ height: 2, background: 'var(--ink-3)', opacity: 0.5, borderRadius: 1, marginBottom: 3, width: '60%' }} />
        <div style={{ height: 2, background: 'var(--ink)', opacity: 0.4, borderRadius: 1, width: '85%' }} />
        <div style={{ height: 2, background: 'var(--ink)', opacity: 0.35, borderRadius: 1, marginTop: 2, width: '70%' }} />
      </div>
      <div style={{ background: 'color-mix(in oklch, var(--info) 8%, var(--surface))', border: '1px solid color-mix(in oklch, var(--info) 22%, var(--border-soft))', borderRadius: 3, padding: '4px 5px' }}>
        <div style={{ height: 2, background: 'var(--ink-3)', opacity: 0.5, borderRadius: 1, marginBottom: 3, width: '50%' }} />
        <div style={{ height: 2, background: 'var(--ink)', opacity: 0.4, borderRadius: 1, width: '90%' }} />
      </div>
    </div>
  );

  return (
    <div data-theme="dark" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
      <ModePane label="Студия" desc="все панели открыты">
        <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', background: 'var(--bg)' }}>
          <div style={{ background: 'var(--bg-deep)', padding: '8px 5px', borderRight: '1px solid var(--border-soft)' }}>
            {MC.slice(0, 4).map((c, i) => (
              <div key={c.num} style={{ height: 8, borderRadius: 2, background: i === 0 ? 'var(--surface)' : 'transparent', marginBottom: 4 }} />
            ))}
          </div>
          <div style={{ padding: '10px 5px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <Paper />
          </div>
          <RightCards />
        </div>
      </ModePane>

      <ModePane label="Рукопись" desc="оглавление + текст">
        <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 2.5fr', background: 'var(--bg)' }}>
          <div style={{ background: 'var(--bg-deep)', padding: '8px 5px', borderRight: '1px solid var(--border-soft)' }}>
            {MC.slice(0, 4).map((c, i) => (
              <div key={c.num} style={{ height: 8, borderRadius: 2, background: i === 0 ? 'var(--surface)' : 'transparent', marginBottom: 4 }} />
            ))}
          </div>
          <div style={{ padding: '10px 6px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <Paper />
          </div>
        </div>
      </ModePane>

      <ModePane label="Сплит" desc="текст + заметки">
        <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '2.5fr 1fr', background: 'var(--bg)' }}>
          <div style={{ padding: '10px 6px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <Paper />
          </div>
          <RightCards />
        </div>
      </ModePane>

      <ModePane label="Фокус" desc="только текст">
        <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 18 }}>
          <Paper narrow />
        </div>
      </ModePane>
    </div>
  );
}

function MockCorkboard() {
  return (
    <div style={{ height: '100%', padding: 24, background: 'repeating-linear-gradient(45deg,var(--bg) 0 24px,var(--bg-deep) 24px 25px)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(2,1fr)', gap: 14 }}>
      {MC.slice(0, 6).map((c, i) => (
        <div key={c.num} style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '10px 12px', position: 'relative' }}>
          <span style={{ position: 'absolute', top: -5, left: 14, width: 8, height: 8, borderRadius: 999, background: 'var(--accent-2)', border: '1.5px solid var(--bg-deep)' }} />
          <div style={{ font: '500 9px var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 4 }}>Гл. {String(c.num).padStart(2, '0')}</div>
          <div style={{ font: '500 12px var(--font-serif)', color: 'var(--ink)', marginBottom: 6 }}>{c.title}</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>{MS[i]}</div>
        </div>
      ))}
    </div>
  );
}

function MockWorld() {
  return (
    <div style={{ height: '100%', background: 'oklch(0.86 0.03 85)', position: 'relative', overflow: 'hidden' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <path d="M0 75 Q 12 70 22 75 T 50 78 Q 65 82 80 80 T 100 75 L 100 100 L 0 100 Z" fill="oklch(0.68 0.06 230)" opacity="0.5" />
        <g opacity="0.7" stroke="oklch(0.30 0.04 50)" strokeWidth="0.18" fill="none">
          <path d="M20 20 l3-4 3 4" /><path d="M40 14 l3-4 3 4" /><path d="M55 20 l3-4 3 4" /><path d="M70 28 l3-4 3 4" />
        </g>
        <g opacity="0.4" fill="oklch(0.46 0.06 130)">
          {Array.from({ length: 50 }, (_, i) => <circle key={i} cx={20 + (i * 7) % 50} cy={32 + ((i * 11) % 18)} r="0.7" />)}
        </g>
        <path d="M30 22 Q 38 36 44 48 T 52 68 Q 58 75 70 80" fill="none" stroke="oklch(0.62 0.08 230)" strokeWidth="0.6" opacity="0.7" />
        <path d="M28 60 Q 40 56 46 50 Q 52 42 56 38 Q 60 30 64 24" fill="none" stroke="oklch(0.35 0.04 50)" strokeWidth="0.18" strokeDasharray="0.6 0.6" />
      </svg>
      {([
        { x: 25, y: 60, n: 'Тереея', active: false },
        { x: 62, y: 24, n: 'Ворна', active: true },
        { x: 45, y: 48, n: 'Сольва', active: false },
        { x: 54, y: 38, n: 'Серая Цапля', active: false },
      ] as const).map((p, i) => (
        <div key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg viewBox="0 0 22 26" width={p.active ? 22 : 16} height={p.active ? 26 : 19}>
            <path d="M11 25 C 11 20 21 16 21 9 A 10 10 0 1 0 1 9 C 1 16 11 20 11 25 Z" fill={p.active ? 'var(--accent)' : 'oklch(0.30 0.04 50)'} />
            <circle cx="11" cy="9" r="3" fill="oklch(0.95 0.014 85)" />
          </svg>
          <div style={{ font: '500 9px var(--font-serif)', color: 'oklch(0.22 0.02 60)', background: 'oklch(0.95 0.014 85 / 0.85)', padding: '1px 4px', borderRadius: 2, marginTop: 1, whiteSpace: 'nowrap', border: p.active ? '1px solid var(--accent)' : 'none' }}>{p.n}</div>
        </div>
      ))}
    </div>
  );
}

function MockDashboard() {
  const CELL = 7, GAP = 2, DAY_W = 16;
  const hc = (v: number) => (
    ['var(--surface-2)', 'oklch(0.63 0.16 30/0.25)', 'oklch(0.63 0.16 30/0.5)', 'oklch(0.63 0.16 30/0.75)', 'oklch(0.63 0.16 30)'] as const
  )[v];

  return (
    <div style={{ height: '100%', padding: '14px 14px 10px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 7, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
        <span style={{ font: '500 11px var(--font-ui)', color: 'var(--ink)' }}>История активности</span>
        <span style={{ font: '400 9.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.04em' }}>рекорд: 2 341 слов</span>
      </div>

      <div style={{ display: 'flex', gap: GAP, paddingLeft: DAY_W + GAP, flexShrink: 0, height: 11 }}>
        {Array.from({ length: _MD_WEEKS }, (_, w) => (
          <div key={w} style={{ flex: 1, minWidth: 0, font: '400 8px var(--font-mono)', color: 'var(--ink-4)', overflow: 'visible', whiteSpace: 'nowrap', lineHeight: 1 }}>
            {_MD_MONTHS[w] ?? ''}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: GAP, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP, width: DAY_W, flexShrink: 0 }}>
          {['Пн', '', 'Ср', '', 'Пт', '', 'Вс'].map((d, i) => (
            <div key={i} style={{ height: CELL, font: '400 7px var(--font-mono)', color: 'var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 3 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: GAP, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {Array.from({ length: _MD_WEEKS }, (_, w) => (
            <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: GAP, flex: 1, minWidth: 0 }}>
              {_MD_CELLS.slice(w * 7, w * 7 + 7).map((v, d) => (
                <div key={d} style={{ height: CELL, borderRadius: 2, background: hc(v) }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <div style={{ font: '500 8px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4, paddingLeft: DAY_W + GAP }}>Объём по неделям</div>
        <div style={{ display: 'flex', gap: GAP, paddingLeft: DAY_W + GAP, alignItems: 'flex-end', height: 24 }}>
          {_MD_WEEK_TOTALS.map((wt, i) => (
            <div key={i} style={{ flex: 1, minWidth: 0, height: Math.max(1, (wt / _MD_MAX_WEEK) * 24), borderRadius: '1.5px 1.5px 0 0', background: wt > 0 ? 'oklch(0.63 0.16 30/0.5)' : 'var(--surface-2)' }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span style={{ font: '400 8px var(--font-mono)', color: 'var(--ink-4)' }}>меньше</span>
        {[0, 1, 2, 3, 4].map(v => <div key={v} style={{ width: 8, height: 8, borderRadius: 2, background: hc(v) }} />)}
        <span style={{ font: '400 8px var(--font-mono)', color: 'var(--ink-4)' }}>больше</span>
      </div>

      <div style={{ flex: 1, minHeight: 44, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexShrink: 0 }}>
          <span style={{ font: '500 8px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Накопленный объём</span>
          <span style={{ font: '400 9px var(--font-mono)', color: 'var(--ink-3)' }}>+143 200 за год</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <svg viewBox="0 0 300 56" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
            <defs>
              <linearGradient id="mdAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.63 0.16 30)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="oklch(0.63 0.16 30)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d="M0 54 C 35 53 80 48 130 36 C 175 24 230 12 300 4 L300 56 L0 56Z" fill="url(#mdAreaGrad)" />
            <path d="M0 54 C 35 53 80 48 130 36 C 175 24 230 12 300 4" fill="none" stroke="oklch(0.63 0.16 30)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ font: '400 8px var(--font-mono)', color: 'var(--ink-4)' }}>8 400 слов</span>
          <span style={{ font: '400 8px var(--font-mono)', color: 'var(--ink-4)' }}>151 600 слов</span>
        </div>
      </div>
    </div>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function BrowserMock({ children, mockHeight = 380 }: { children: ReactNode; mockHeight?: number }) {
  return (
    <div data-theme="dark">
    <div className="lnd-browser-mock" style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-deep)', border: '1px solid var(--border)', boxShadow: '0 0 0 1px var(--border), 0 24px 72px oklch(0 0 0 / 0.55), 0 0 56px oklch(0.63 0.16 30 / 0.07)' }}>
      <div style={{ height: 32, background: 'oklch(0.20 0.014 50)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6, borderBottom: '1px solid var(--border-soft)' }}>
        <span style={{ width: 11, height: 11, borderRadius: 999, background: 'oklch(0.62 0.16 25)' }} />
        <span style={{ width: 11, height: 11, borderRadius: 999, background: 'oklch(0.78 0.12 80)' }} />
        <span style={{ width: 11, height: 11, borderRadius: 999, background: 'oklch(0.66 0.14 145)' }} />
        <span style={{ flex: 1, textAlign: 'center', font: '400 11px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em' }}>avtorstudio.com</span>
      </div>
      <div style={{ height: mockHeight, position: 'relative', overflow: 'hidden' }}>{children}</div>
    </div>
    </div>
  );
}

function FeatureRowFull({ headline, body, mock }: { headline: string; body: string; mock: ReactNode }) {
  return (
    <motion.div
      className="lnd-feat-row-full"
      variants={revealVariants}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: '-80px' }}
    >
      <div style={{ marginBottom: 36, maxWidth: 700 }}>
        <h3 style={{ font: '600 clamp(24px,3vw,38px)/1.1 var(--font-serif)', letterSpacing: '-0.015em', marginBottom: 16, color: 'var(--ink)' }}>{headline}</h3>
        <p style={{ font: '400 16px/1.65 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 580 }}>{body}</p>
      </div>
      <div aria-hidden="true">{mock}</div>
    </motion.div>
  );
}

function FeatureRow({ headline, body, mock, reverse, noBrowserChrome, mockHeight, largeHeadline }: {
  headline: string; body: string;
  mock: ReactNode; reverse?: boolean;
  noBrowserChrome?: boolean;
  mockHeight?: number;
  largeHeadline?: boolean;
}) {
  return (
    <motion.div
      className={`lnd-feat-row${reverse ? ' lnd-feat-row--rev' : ''}`}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: '-80px' }}
    >
      <motion.div variants={reverse ? featTextVariantsRev : featTextVariants}>
        <h3 style={{ font: `600 ${largeHeadline ? 'clamp(28px,3.5vw,48px)' : 'clamp(24px,3vw,38px)'}/1.1 var(--font-serif)`, letterSpacing: '-0.015em', marginBottom: 18, color: 'var(--ink)' }}>{headline}</h3>
        <p style={{ font: '400 16px/1.65 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 480 }}>{body}</p>
      </motion.div>
      <motion.div variants={reverse ? featMockVariantsRev : featMockVariants} aria-hidden="true">
        {noBrowserChrome
          ? (
            <div data-theme="dark">
              <div className="lnd-browser-mock" style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 0 0 1px var(--border), 0 24px 72px oklch(0 0 0 / 0.55)', height: mockHeight ?? 380 }}>
                {mock}
              </div>
            </div>
          )
          : <BrowserMock mockHeight={mockHeight}>{mock}</BrowserMock>
        }
      </motion.div>
    </motion.div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function LandingFeatures() {
  return (
    <section id="features" style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg)' }}>
      <div className="lnd-max">
        <SectionLabel title="Студия, а не текстовое поле." subtitle="Каждая часть книги живёт рядом с рукописью — не в отдельном приложении, не на отдельной вкладке. Открыли главу — видите её мир." />
        <FeatureRowFull
          headline="Четыре режима. Один редактор."
          body="Студия открывает все панели — для глубокой редактуры. Фокус убирает лишнее — для чистого черновика. Рукопись и Сплит — для работы между крайностями. Редактор помнит, на каком режиме вы остановились."
          mock={<MockEditorModesStrip />}
        />
        <FeatureRow
          reverse
          headline="Книга как картотека. Не как длинный документ."
          body="Перетаскивайте главы и сцены. Смотрите доску с карточками или дерево с целями по словам."
          mock={<MockCorkboard />}
        />
        <FeatureRow
          headline="Весь мир книги — рядом с главой."
          body="Всё что нужно автору длинной формы — без выхода из проекта. Локации и события привязаны к главам, в которых упоминаются. Свяжите персонажа с главой — он автоматически появится в её обзоре."
          mock={<MockWorld />}
          noBrowserChrome
          mockHeight={480}
          largeHeadline
        />
        <FeatureRow
          reverse
          headline="Серия дней без упрёков."
          body="Серия показывает, сколько дней вы писали подряд. Но не пишет «вы пропустили 4 дня» и не сбрасывает прогресс. Потому что жизнь случается, и чувство вины не помогает закончить книгу."
          mock={<MockDashboard />}
        />
      </div>
    </section>
  );
}
