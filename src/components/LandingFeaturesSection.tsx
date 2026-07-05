import { type ReactNode, useState } from 'react';
import { motion } from 'framer-motion';
import {
  featTextVariants, featMockVariants,
  featTextVariantsRev, featMockVariantsRev,
  revealVariants,
} from '../lib/motion';
import { SectionLabel } from './LandingSectionLabel';
import { useMediaQuery } from '../lib/useResponsive';

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

const STUDIO_CHAPTERS = [
  { num: '01', title: 'Исчезновение', done: true, active: true },
  { num: '02', title: 'Архив', progress: true },
  { num: '03', title: 'Серая Цапля' },
  { num: '04', title: 'Дорога вдоль Тихой' },
  { num: '05', title: 'Стопка карт' },
];

const STUDIO_VERSIONS = [
  { tag: 'v3', name: 'Переработал начало', when: '14 мин назад', current: true },
  { tag: 'v2', name: 'Письмо наставника', when: '2 ч назад', current: false },
  { tag: 'v1', name: 'Черновик', when: 'вчера', current: false },
];

const MOCK_SOUNDS = ['Кафе', 'Дождь', 'Костёр', 'Лес', 'Волны', 'Поезд', 'Библиотека', 'Белый шум'] as const;
const MOCK_FONTS = [
  { label: 'Source Serif', family: "'Source Serif 4', Georgia, serif" },
  { label: 'Lora',         family: "'Lora', Georgia, serif" },
  { label: 'PT Serif',     family: "'PT Serif', Georgia, serif" },
  { label: 'Spectral',     family: "'Spectral', Georgia, serif" },
  { label: 'Mono',         family: "'IBM Plex Mono', monospace" },
] as const;

function MockStatusBar() {
  const [focusOn, setFocusOn]       = useState(false);
  const [fontOpen, setFontOpen]     = useState(false);
  const [soundOpen, setSoundOpen]   = useState(false);
  const [activeFont, setActiveFont] = useState(0);
  const [activeSound, setActiveSound] = useState<string | null>('Костёр');
  const [volume, setVolume]         = useState(0.4);

  return (
    <div style={{ position: 'relative', height: 28, background: 'var(--bg-deep)', borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10, flexShrink: 0, font: '400 10.5px var(--font-ui)', color: 'var(--ink-2)' }}>

      {/* Left */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--ok)', display: 'inline-block', flexShrink: 0 }} />
        Сохранено
      </span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span>Слов: 1 247</span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span>Знаков: 7 043</span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span style={{ color: 'var(--ink-3)' }}>~6 мин чтения</span>

      <span style={{ flex: 1 }} />

      {/* Right */}
      <span style={{ color: 'var(--ink-3)' }}>сегодня · 312/1 000 слов</span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span style={{ color: 'var(--accent-2)' }}>серия 5 дней</span>

      {/* Focus mode */}
      <button
        onClick={() => setFocusOn(v => !v)}
        title="Режим фокуса"
        tabIndex={-1}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: focusOn ? 'var(--accent)' : 'var(--ink-3)', borderRadius: 4 }}
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
          <circle cx="12" cy="12" r="3"/>
          <path d="M3 12h2M19 12h2M12 3v2M12 19v2"/>
          <path d="M5.6 5.6l1.4 1.4M16.9 16.9l1.4 1.4M5.6 18.4l1.4-1.4M16.9 7.1l1.4-1.4"/>
        </svg>
      </button>

      {/* Font picker */}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <button
          onClick={() => { setFontOpen(v => !v); setSoundOpen(false); }}
          title="Шрифт редактора"
          tabIndex={-1}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: fontOpen ? 'var(--accent)' : 'var(--ink-3)', borderRadius: 4, font: '500 11px var(--font-ui)', letterSpacing: '-0.02em' }}
        >
          Aa
        </button>
        {fontOpen && (
          <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, width: 172, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: 6, zIndex: 200, boxShadow: '0 4px 16px oklch(0 0 0 / 0.18)' }}>
            {MOCK_FONTS.map((f, i) => (
              <button
                key={f.label}
                onClick={() => { setActiveFont(i); setFontOpen(false); }}
                tabIndex={-1}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '5px 8px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: 5, fontFamily: f.family, fontSize: 13, color: activeFont === i ? 'var(--ink)' : 'var(--ink-3)', textAlign: 'left' }}
              >
                {f.label}
                {activeFont === i && <span style={{ color: 'var(--accent)', fontSize: 11 }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ambient sounds */}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <button
          onClick={() => { setSoundOpen(v => !v); setFontOpen(false); }}
          title="Фоновые звуки"
          tabIndex={-1}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: activeSound ? 'var(--accent)' : 'var(--ink-3)', borderRadius: 4 }}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
        </button>
        {soundOpen && (
          <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, width: 220, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 12px', zIndex: 200, boxShadow: '0 4px 16px oklch(0 0 0 / 0.18)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {MOCK_SOUNDS.map(s => (
                <button
                  key={s}
                  onClick={() => setActiveSound(activeSound === s ? null : s)}
                  tabIndex={-1}
                  style={{ font: '400 11.5px var(--font-ui)', padding: '3px 10px', borderRadius: 999, border: activeSound === s ? '1.5px solid var(--accent)' : '1px solid var(--border-soft)', background: 'transparent', color: activeSound === s ? 'var(--ink)' : 'var(--ink-3)', cursor: 'pointer' }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: activeSound ? 8 : 0 }}>
              <input
                type="range" min={0} max={1} step={0.01} value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                tabIndex={-1}
                style={{ flex: 1, accentColor: 'var(--accent)', height: 4, cursor: 'pointer' }}
              />
              <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-3)', width: 28, textAlign: 'right' }}>
                {Math.round(volume * 100)}%
              </span>
            </div>
            {activeSound && (
              <button
                onClick={() => setActiveSound(null)}
                tabIndex={-1}
                style={{ width: '100%', font: '400 12px var(--font-ui)', padding: '4px 0', border: '1px solid var(--border-soft)', borderRadius: 4, background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer' }}
              >
                × Стоп
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type EditorMode = 'Студия' | 'Рукопись' | 'Сплит' | 'Фокус';
type RightTab = 'Заметки' | 'Версии';

const MODE_COLUMNS: Record<EditorMode, string> = {
  'Студия':   '178px 1fr 156px',
  'Рукопись': '178px 1fr 0px',
  'Сплит':    '0px 1fr 156px',
  'Фокус':    '0px 1fr 0px',
};

function MockSidebar() {
  return (
    <div style={{ background: 'var(--bg-deep)', borderRight: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
      <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
        <div style={{ font: '400 8px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 4 }}>Роман</div>
        <div style={{ font: '600 12.5px var(--font-serif)', color: 'var(--ink)', lineHeight: 1.25, marginBottom: 8 }}>Город, которого нет</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ flex: 1, height: 2, borderRadius: 1, background: 'var(--border-soft)', overflow: 'hidden' }}>
            <div style={{ width: '23%', height: '100%', background: 'var(--accent)', borderRadius: 1 }} />
          </div>
          <span style={{ font: '400 8.5px var(--font-mono)', color: 'var(--ink-4)' }}>23%</span>
        </div>
      </div>
      <div style={{ flex: 1, padding: '6px 5px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {STUDIO_CHAPTERS.map(c => (
          <div key={c.num} style={{ padding: '5px 7px', borderRadius: 4, background: c.active ? 'var(--surface)' : 'transparent', border: c.active ? '1px solid var(--border-soft)' : '1px solid transparent', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ font: '500 8.5px var(--font-mono)', color: c.done ? 'var(--accent)' : c.progress ? 'oklch(0.72 0.14 145)' : 'var(--ink-4)', flexShrink: 0, width: 14, textAlign: 'center' }}>
              {c.done ? '✓' : c.progress ? '●' : '○'}
            </span>
            <span style={{ font: `${c.active ? '500' : '400'} 11px var(--font-serif)`, color: c.active ? 'var(--ink)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-soft)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{ width: 22, height: 22, borderRadius: 999, background: 'color-mix(in oklch, var(--accent-2) 22%, var(--surface-2))', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '600 9px var(--font-ui)', color: 'var(--ink)', letterSpacing: '0.02em' }}>АВ</div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ font: '500 10px var(--font-ui)', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Аней Ворон</div>
          <div style={{ font: '400 9px var(--font-mono)', color: 'var(--accent)' }}>Pro</div>
        </div>
      </div>
    </div>
  );
}

function MockPaper({ wide }: { wide?: boolean }) {
  return (
    <div style={{ background: 'var(--bg)', display: 'flex', justifyContent: 'center', padding: wide ? '22px 10%' : '22px 18px 14px', overflow: 'hidden', height: '100%' }}>
      <div style={{ background: 'var(--paper)', width: '100%', maxWidth: wide ? 560 : 440, borderRadius: '2px 2px 0 0', padding: '26px 30px 20px', boxShadow: '0 4px 28px oklch(0 0 0 / 0.32)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ font: '400 8.5px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--paper-ink-2)', marginBottom: 6, opacity: 0.7 }}>Глава первая</div>
        <div style={{ font: '700 20px var(--font-serif)', color: 'var(--paper-ink)', letterSpacing: '-0.01em', marginBottom: 18, lineHeight: 1.1 }}>Исчезновение</div>
        <div style={{ font: '400 12.5px/1.85 var(--font-serif)', color: 'var(--paper-ink)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0 }}>Аней Ворон получила письмо утром третьего октября — за час до того, как закрыли архив.</p>
          <p style={{ margin: 0 }}>В конверте лежал один лист. Почерк она узнала сразу: наставник не пользовался машинописью принципиально. Три строки. Дата. Подпись.</p>
          <p style={{ margin: 0, fontStyle: 'italic', paddingLeft: 18, opacity: 0.78 }}>«Ворна исчезла. Никому не говори.»</p>
          <p style={{ margin: 0 }}>Она перечитала трижды. За окном синело утреннее небо над черепицей, и где-то на Торговой улице кричал разносчик газет — с той настойчивостью, что бывает лишь у людей, не понимающих смысла произносимых слов.</p>
          <p style={{ margin: 0 }}>«Никому не говори» означало, что наставник уже знает: будет кому спрашивать. Аней сложила письмо по сгибам и убрала в карман<span style={{ display: 'inline-block', width: '1.5px', height: '0.9em', background: 'var(--paper-ink)', marginLeft: 1, verticalAlign: 'text-bottom', opacity: 0.75 }} /></p>
        </div>
      </div>
    </div>
  );
}

function MockRightPanel({ activeTab, onTabChange }: { activeTab: RightTab; onTabChange: (t: RightTab) => void }) {
  return (
    <div style={{ background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
        {(['Заметки', 'Версии'] as RightTab[]).map(t => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            tabIndex={-1}
            style={{ flex: 1, height: 34, font: '500 10.5px var(--font-ui)', color: activeTab === t ? 'var(--ink)' : 'var(--ink-4)', background: 'transparent', border: 'none', borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', transition: 'color 150ms' }}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'Заметки' ? (
        <>
          {/* Notes section */}
          <div style={{ padding: '9px 9px 8px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ font: '500 8.5px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>Заметки</span>
              <span style={{ font: '500 10px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1 }}>+</span>
            </div>
            <div style={{ background: 'color-mix(in oklch, var(--accent-2) 6%, var(--surface))', border: '1px solid color-mix(in oklch, var(--accent-2) 18%, var(--border-soft))', borderRadius: 4, padding: '6px 8px' }}>
              <div style={{ font: '500 10px var(--font-serif)', color: 'var(--ink)', marginBottom: 3 }}>Архивариус Лих</div>
              <div style={{ font: '400 9.5px/1.5 var(--font-ui)', color: 'var(--ink-3)' }}>Полковник упоминает архив — проверить связь с Ворной.</div>
            </div>
          </div>

          {/* Characters section */}
          <div style={{ padding: '9px 9px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ font: '500 8.5px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 7 }}>Персонажи главы</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* POV character */}
              <div style={{ background: 'color-mix(in oklch, var(--accent) 7%, var(--surface))', border: '1px solid color-mix(in oklch, var(--accent) 20%, var(--border-soft))', borderRadius: 4, padding: '5px 7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{ font: '600 7px var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.08em', background: 'color-mix(in oklch, var(--accent) 14%, var(--surface))', padding: '1px 4px', borderRadius: 2 }}>POV</span>
                  <span style={{ font: '500 10.5px var(--font-serif)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Аней Ворон</span>
                </div>
                <div style={{ font: '400 9px var(--font-ui)', color: 'var(--ink-3)' }}>Главный герой</div>
              </div>
              {/* Other character */}
              <div style={{ background: 'transparent', border: '1px solid var(--border-soft)', borderRadius: 4, padding: '5px 7px' }}>
                <div style={{ font: '500 10.5px var(--font-serif)', color: 'var(--ink)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Наставник</div>
                <div style={{ font: '400 9px var(--font-ui)', color: 'var(--ink-3)' }}>Второй план</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Versions tab */
        <div style={{ padding: '10px 9px', flex: 1, overflow: 'hidden' }}>
          <div style={{ font: '500 8.5px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 8 }}>Версии главы</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {STUDIO_VERSIONS.map(v => (
              <div key={v.tag} style={{ background: v.current ? 'var(--surface)' : 'transparent', border: v.current ? '1px solid var(--border-soft)' : '1px solid transparent', borderRadius: 4, padding: '5px 7px', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ font: '500 8.5px var(--font-mono)', color: 'var(--accent)', flexShrink: 0, paddingTop: 1 }}>{v.tag}</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ font: '400 10px var(--font-ui)', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                  <div style={{ font: '400 8.5px var(--font-mono)', color: 'var(--ink-4)', marginTop: 1 }}>{v.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MockStudioFull() {
  const [mode, setMode] = useState<EditorMode>('Студия');
  const [rightTab, setRightTab] = useState<RightTab>('Заметки');
  const isNarrow = useMediaQuery('(max-width: 639px)');

  const showSidebar = !isNarrow && (mode === 'Студия' || mode === 'Рукопись');
  const showRight   = !isNarrow && (mode === 'Студия' || mode === 'Сплит');

  return (
    <BrowserMock mockHeight={500}>
      <div data-theme="dark" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>

        {/* Mode tabs */}
        <div style={{ height: 36, background: 'var(--bg-deep)', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 2, flexShrink: 0, overflowX: 'auto' }}>
          {(['Студия', 'Рукопись', 'Сплит', 'Фокус'] as EditorMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              tabIndex={-1}
              style={{ height: 26, padding: '0 11px', borderRadius: 5, display: 'flex', alignItems: 'center', gap: 5, font: '500 11px var(--font-ui)', color: mode === m ? 'var(--ink)' : 'var(--ink-4)', background: mode === m ? 'var(--surface)' : 'transparent', border: mode === m ? '1px solid var(--border-soft)' : '1px solid transparent', cursor: 'pointer', transition: 'all 150ms', flexShrink: 0 }}
            >
              {mode === m && <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--accent)', display: 'inline-block' }} />}
              {m}
            </button>
          ))}
        </div>

        {/* Layout */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : MODE_COLUMNS[mode], minHeight: 0, transition: 'grid-template-columns 220ms ease-out', overflow: 'hidden' }}>
          {isNarrow ? (
            <MockPaper wide={mode === 'Фокус'} />
          ) : (
            <>
              {showSidebar ? <MockSidebar /> : <div />}
              <MockPaper wide={mode === 'Фокус'} />
              {showRight ? <MockRightPanel activeTab={rightTab} onTabChange={setRightTab} /> : <div />}
            </>
          )}
        </div>

        {/* Status bar */}
        <MockStatusBar />
      </div>
    </BrowserMock>
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
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <svg viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id="lm-bg" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#3d2e1e"/>
            <stop offset="100%" stopColor="#1e150d"/>
          </radialGradient>
          <pattern id="lm-dots" width={48} height={48} patternUnits="userSpaceOnUse">
            <circle cx={24} cy={24} r={0.9} fill="#9a7a52" opacity={0.18}/>
          </pattern>
        </defs>
        <rect width={800} height={480} fill="url(#lm-bg)"/>
        <rect width={800} height={480} fill="url(#lm-dots)"/>
        <rect width={800} height={480} fill="none" stroke="#5a3f28" strokeWidth={2}/>
        <rect x={12} y={12} width={776} height={456} fill="none" stroke="#4a3420" strokeWidth={0.8} strokeDasharray="10 5" opacity={0.5}/>

        <path d="M180 60 Q220 120 260 180 Q300 250 350 310 Q400 370 460 420" fill="none" stroke="#4a7a9a" strokeWidth={3} opacity={0.5} strokeLinecap="round"/>

        <path d="M340 300 Q400 270 480 220" fill="none" stroke="#9a7a52" strokeWidth={1.2} strokeDasharray="8 5" opacity={0.6}/>

        <path d="M570 130 Q500 180 400 250 Q370 270 340 300" fill="none" stroke="#8a6a40" strokeWidth={1.5} opacity={0.5}/>

        <g transform="translate(140, 80) scale(2.2)" opacity={0.7}>
          <polygon points="20,4 6,28 34,28" fill="#8a7060" stroke="#5a3f28" strokeWidth={1.5}/>
          <polygon points="28,10 19,28 37,28" fill="#a08070" stroke="#5a3f28" strokeWidth={1}/>
          <polygon points="20,4 16,12 24,12" fill="white" opacity={0.5}/>
        </g>
        <g transform="translate(600, 60) scale(1.6)" opacity={0.6}>
          <polygon points="20,4 6,28 34,28" fill="#8a7060" stroke="#5a3f28" strokeWidth={1.5}/>
          <polygon points="28,10 19,28 37,28" fill="#a08070" stroke="#5a3f28" strokeWidth={1}/>
          <polygon points="20,4 16,12 24,12" fill="white" opacity={0.5}/>
        </g>

        <g transform="translate(250, 240) scale(1.4)" opacity={0.6}>
          <circle cx={20} cy={10} r={8} fill="#2d5a27" stroke="#1a3a15" strokeWidth={1}/>
          <rect x={18} y={17} width={4} height={10} fill="#5a3f28"/>
        </g>

        <g transform="translate(420, 340) scale(1.2)" opacity={0.5}>
          <polygon points="19,3 4,22 34,22" fill="#2d5a27" stroke="#1a3a15" strokeWidth={1.2}/>
          <polygon points="19,10 7,25 31,25" fill="#3a6e30" stroke="#1a3a15" strokeWidth={1.2}/>
          <rect x={16} y={22} width={6} height={8} fill="#5a3f28"/>
        </g>

        {([
          { x: 200, y: 370, n: 'Терея', active: false },
          { x: 570, y: 110, n: 'Ворна', active: true },
          { x: 340, y: 290, n: 'Сольва', active: false },
          { x: 480, y: 210, n: 'Серая Цапля', active: false },
          { x: 680, y: 360, n: 'Гарнизон Лиха', active: false },
        ] as const).map((p, i) => (
          <g key={i} transform={`translate(${p.x}, ${p.y})`}>
            <g transform="translate(-11, -25)">
              <path d="M11 25 C11 20 21 16 21 9 A10 10 0 1 0 1 9 C1 16 11 20 11 25Z" fill={p.active ? '#d97706' : '#6a5a48'} stroke={p.active ? '#b45309' : '#4a3a2a'} strokeWidth={1}/>
              <circle cx={11} cy={9} r={3} fill="#f5e6d0" opacity={0.9}/>
            </g>
            <text x={0} y={10} textAnchor="middle" fill="#d4c4a0" fontSize={11} fontFamily="var(--font-serif)" fontWeight={p.active ? 600 : 400} opacity={p.active ? 1 : 0.8}>{p.n}</text>
          </g>
        ))}
      </svg>
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
      <div className="lnd-mock-content" style={{ height: mockHeight, position: 'relative', overflow: 'hidden' }}>{children}</div>
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
    <section id="features" style={{ padding: 'clamp(36px,5vw,64px) clamp(20px,4vw,56px)', background: 'var(--bg)' }}>
      <div className="lnd-max">
        <SectionLabel title="Студия, а не текстовое поле." subtitle="Каждая часть книги живёт рядом с рукописью — не в отдельном приложении, не на отдельной вкладке. Открыли главу — видите её мир." />
        <FeatureRowFull
          headline="Четыре режима. Один редактор."
          body="Студия открывает все панели — для глубокой редактуры. Фокус убирает лишнее — для чистого черновика. Рукопись и Сплит — для работы между крайностями. Редактор помнит, на каком режиме вы остановились."
          mock={<MockStudioFull />}
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
