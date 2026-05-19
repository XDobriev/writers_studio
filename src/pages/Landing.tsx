import { type ComponentProps, type ReactNode, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/LogoMark';

interface PublicStats {
  users_total: number;
  books_total: number;
  words_total: number;
}

type IName = ComponentProps<typeof Icon>['name'];

const STATS_MIN = 20;

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

export default function Landing() {
  const { session } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    supabase.rpc('get_public_stats').then(({ data }) => {
      if (data) setStats(data as PublicStats);
    });
  }, []);

  if (session) return <Navigate to="/books" replace />;

  const showStats = stats !== null && stats.users_total >= STATS_MIN;

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .lnd-max { max-width: 1300px; margin: 0 auto; }
        .lnd-hero-grid { display: grid; grid-template-columns: 1.05fr 1.15fr; gap: 64px; align-items: center; }
        .lnd-feat-row { display: grid; grid-template-columns: 0.95fr 1.15fr; gap: 80px; align-items: center; padding: 72px 0; border-top: 1px solid var(--border-soft); }
        .lnd-feat-row--rev .lnd-text { order: 2; }
        .lnd-feat-row--rev .lnd-mock { order: 1; }
        .lnd-bullets { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; max-width: 480px; }
        .lnd-proc { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; position: relative; }
        .lnd-proc::before { content:''; position:absolute; top:24px; left:12.5%; right:12.5%; height:1px; background:var(--border); }
        .lnd-quotes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; max-width: 1100px; margin: 0 auto; }
        .lnd-prices { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1100px; margin: 0 auto; }
        .lnd-nav-links { display: flex; gap: 28px; font-size: 13.5px; color: var(--ink-2); }
        @media (max-width: 1023px) {
          .lnd-hero-grid { grid-template-columns: 1fr; }
          .lnd-hero-sheet { display: none; }
          .lnd-feat-row { grid-template-columns: 1fr; gap: 40px; padding: 48px 0; }
          .lnd-feat-row--rev .lnd-text { order: 1; }
          .lnd-feat-row--rev .lnd-mock { order: 2; }
          .lnd-quotes { grid-template-columns: 1fr; }
          .lnd-prices { grid-template-columns: 1fr; }
          .lnd-proc { grid-template-columns: repeat(2, 1fr); }
          .lnd-proc::before { display: none; }
          .lnd-nav-links { display: none; }
        }
        @media (max-width: 639px) {
          .lnd-bullets { grid-template-columns: 1fr; }
          .lnd-proc { grid-template-columns: 1fr; }
        }
      `}</style>
      <LandingNav />
      <LandingHero stats={showStats ? stats! : null} />
      <LandingFeatures />
      <LandingProcess />
      <LandingTestimonials />
      <LandingPricing />
      <LandingFAQ />
      <LandingCTA />
      <LandingFooter />
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, padding: 'clamp(16px,2vw,20px) clamp(20px,4vw,56px)', display: 'flex', alignItems: 'center', gap: 16 }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <LogoMark size={22} />
        <span style={{ font: '500 12px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink)' }}>авторская студия</span>
      </Link>
      <div style={{ flex: 1 }} />
      <nav className="lnd-nav-links">
        <a href="#features" style={{ textDecoration: 'none', color: 'inherit' }}>Возможности</a>
        <a href="#process" style={{ textDecoration: 'none', color: 'inherit' }}>Процесс</a>
        <a href="#pricing" style={{ textDecoration: 'none', color: 'inherit' }}>Цены</a>
        <a href="#faq" style={{ textDecoration: 'none', color: 'inherit' }}>FAQ</a>
      </nav>
      <span style={{ width: 1, height: 18, background: 'var(--border-soft)' }} />
      <Link to="/login" style={{ fontSize: 13.5, color: 'var(--ink-2)', textDecoration: 'none' }}>Войти</Link>
      <Link to="/login" className="btn btn--primary" style={{ height: 34, padding: '0 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Начать писать</Link>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function LandingHero({ stats }: { stats: PublicStats | null }) {
  return (
    <section style={{ position: 'relative', padding: 'clamp(120px,14vw,160px) clamp(20px,4vw,56px) clamp(64px,8vw,80px)', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'linear-gradient(oklch(0.95 0.01 80) 1px,transparent 1px),linear-gradient(90deg,oklch(0.95 0.01 80) 1px,transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none' }} />
      <div className="lnd-max" style={{ position: 'relative' }}>
        <div className="lnd-hero-grid">
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 999, marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
              <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>Открытая бета · 2026</span>
            </div>
            <h1 style={{ font: '600 clamp(52px,6vw,88px)/0.98 var(--font-serif)', letterSpacing: '-0.025em', marginBottom: 28, color: 'var(--ink)' }}>
              Здесь пишутся<br />
              <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--accent-2)' }}>книги</em>.
            </h1>
            <p style={{ font: '400 clamp(16px,1.5vw,19px)/1.6 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 520, marginBottom: 36 }}>
              Рукопись, картотека персонажей, карта мира и хронология — в одном чистом редакторе. Без баннеров, всплывашек и нейросети, которая дописывает за вас.
            </p>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 36, flexWrap: 'wrap' }}>
              <Link to="/login" className="btn btn--primary" style={{ height: 46, padding: '0 22px', fontSize: 14.5, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                Начать свою книгу
              </Link>
              <Link to="/login" className="btn" style={{ height: 46, padding: '0 18px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                <Icon name="eye" size={15} /> Войти в студию
              </Link>
            </div>
            {stats && (
              <div style={{ display: 'flex', gap: 28, paddingTop: 24, borderTop: '1px solid var(--border-soft)', flexWrap: 'wrap' }}>
                <HStat n={stats.users_total.toLocaleString('ru')} l={pluralRu(stats.users_total, 'автор', 'автора', 'авторов')} />
                <HStat n={stats.books_total.toLocaleString('ru')} l={pluralRu(stats.books_total, 'книга', 'книги', 'книг')} />
                <HStat n={formatWords(stats.words_total)} l={wordsLabel(stats.words_total)} />
              </div>
            )}
          </div>
          <div className="lnd-hero-sheet" style={{ position: 'relative', height: 540 }}>
            <FloatingSheet />
            <div style={{ position: 'absolute', top: 54, right: -16, width: 200, transform: 'rotate(2deg)', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: '3px solid var(--accent-2)', borderRadius: 8, padding: '10px 12px', boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>
              <div style={{ font: '500 9.5px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 5 }}>Идея · 5 мин</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>Сделать упоминание матери Аней в начале — отзеркалит финал.</div>
            </div>
            <div style={{ position: 'absolute', bottom: 32, left: -22, width: 190, transform: 'rotate(-1.5deg)', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: '3px solid var(--danger)', borderRadius: 8, padding: '10px 12px', boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}>
              <div style={{ font: '500 9.5px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 5 }}>Важно · 10 мин</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>НЕ называть имя 12-го картографа до главы 8.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HStat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div style={{ font: '600 22px var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{n}</div>
      <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
    </div>
  );
}

function FloatingSheet() {
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: '1600px' }}>
      <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(-9deg) rotateX(2deg)', transformStyle: 'preserve-3d', transformOrigin: 'center center', boxShadow: '-40px 60px 120px rgba(0,0,0,.5)' }}>
        <div style={{ background: 'var(--paper)', borderRadius: '6px 6px 0 0', padding: '48px 56px', height: '100%', color: 'var(--paper-ink)', fontFamily: 'var(--font-serif)', fontSize: 14.5, lineHeight: 1.85, overflow: 'hidden' }}>
          <div style={{ font: '500 9.5px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--paper-ink-2)', marginBottom: 10 }}>Глава первая</div>
          <div style={{ font: '600 26px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 6, color: 'var(--paper-ink)' }}>Город, которого нет</div>
          <div style={{ width: 30, height: 1, background: 'var(--paper-ink)', opacity: 0.3, marginBottom: 20 }} />
          <p style={{ margin: '0 0 0.9em' }}>Ворна исчезла за одну ночь, и никто из тех, кто жил в Тереее, не желал в это верить.</p>
          <p style={{ margin: '0 0 0.9em', textIndent: '1.4em' }}>Аней Ворон узнала об этом в архиве, на третьем этаже башни, где пахло железом и устым мхом. <span style={{ background: 'oklch(0.84 0.13 90 / 0.45)', padding: '1px 2px', borderRadius: 2 }}>Она перечерчивала контуры озера, которого никогда не видела</span>, когда чьи-то шаги остановились за её спиной.</p>
          <p style={{ margin: '0 0 0.9em', textIndent: '1.4em' }}>— Картограф Ворон, — сказал голос. Голос был старый и строгий, как страница. — Магистр требует вас немедленно.</p>
          <p style={{ margin: 0, textIndent: '1.4em' }}>Аней не подняла голову. Кисть вела мягкую кривую — северный край озера, мнимый, но обязательный для атласа.<span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--accent)', marginLeft: 1, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} /></p>
        </div>
      </div>
    </div>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function SectionLabel({ kicker, title, subtitle, align = 'left' }: { kicker: string; title: string; subtitle?: string; align?: 'left' | 'center' }) {
  const c = align === 'center';
  return (
    <div style={{ marginBottom: 80, ...(c ? { textAlign: 'center', margin: '0 auto 80px', maxWidth: 780 } : { maxWidth: 780 }) }}>
      <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 18 }}>{kicker}</div>
      <h2 style={{ font: '600 clamp(32px,4vw,56px)/1.05 var(--font-serif)', letterSpacing: '-0.018em', marginBottom: 16, color: 'var(--ink)' }}>{title}</h2>
      {subtitle && <p style={{ font: '400 17px/1.6 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 640, ...(c ? { margin: '0 auto' } : {}) }}>{subtitle}</p>}
    </div>
  );
}

function LandingFeatures() {
  return (
    <section id="features" style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg)' }}>
      <div className="lnd-max">
        <SectionLabel kicker="01 · Что внутри" title="Студия, а не текстовое поле." subtitle="Каждая часть книги живёт рядом с рукописью — не в отдельном приложении, не на отдельной вкладке. Открыли главу — видите её мир." />
        <FeatureRow eyebrow="Редактор" headline="Четыре режима. Один редактор." body="Полная студия с заметками и оглавлением — для редактуры. Только страница — для черновика. Промежуточные режимы — для всего, что между. Состояние помнит, на каком вы остановились." bullets={[['layout','Студия','все панели открыты'],['panel','Сайдбар','только оглавление'],['note','Полей','только заметки'],['focus','Страница','только текст']]} mock={<MockEditorModes />} />
        <FeatureRow reverse eyebrow="Структура" headline="Книга как картотека. Не как длинный документ." body="Перетаскивайте главы и сцены. Смотрите доску с карточками или дерево с целями по словам. Любая глава — двойной клик и она открыта." bullets={[['layout','Outline','дерево частей и сцен'],['grid','Corkboard','индексные карточки'],['tree','Списком','плоский список'],['arrows','Drag-ord','перетаскивание']]} mock={<MockCorkboard />} />
        <FeatureRow eyebrow="Мир книги" headline="Карта, хронология, картотека персонажей." body="Всё что нужно автору длинной формы — без выхода из проекта. Локации и события привязаны к главам, в которых упоминаются. Свяжите персонажа с главой — он автоматически появится в её обзоре." bullets={[['map','Карта мира','пины + районы'],['clock','Хронология','события и эпохи'],['char','Персонажи','связи + появления'],['link','Привязки','к главам']]} mock={<MockWorld />} />
        <FeatureRow reverse eyebrow="Прогресс" headline="Серия дней без шейминга." body="Цель по словам — мягкая. Heatmap активности — для тех, кто любит данные. Серия дней — для тех, кому нужна привычка. Никаких уведомлений «вы не писали 3 дня»." bullets={[['layout','Дэшборд','графики книги'],['clock','Heatmap','год активности'],['dot','Серия','дни подряд'],['save','Снимки','версии глав']]} mock={<MockDashboard />} />
      </div>
    </section>
  );
}

function FeatureRow({ eyebrow, headline, body, bullets, mock, reverse }: {
  eyebrow: string; headline: string; body: string;
  bullets: [IName, string, string][];
  mock: ReactNode; reverse?: boolean;
}) {
  return (
    <div className={`lnd-feat-row${reverse ? ' lnd-feat-row--rev' : ''}`}>
      <div className="lnd-text">
        <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 18 }}>{eyebrow}</div>
        <h3 style={{ font: '600 clamp(24px,3vw,38px)/1.1 var(--font-serif)', letterSpacing: '-0.015em', marginBottom: 18, color: 'var(--ink)' }}>{headline}</h3>
        <p style={{ font: '400 16px/1.65 var(--font-serif)', color: 'var(--ink-2)', marginBottom: 28, maxWidth: 480 }}>{body}</p>
        <div className="lnd-bullets">
          {bullets.map(([icn, l, s]) => (
            <div key={l} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0' }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-2)', flexShrink: 0 }}>
                <Icon name={icn} size={16} />
              </span>
              <div>
                <div style={{ font: '500 13.5px var(--font-ui)', color: 'var(--ink)' }}>{l}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="lnd-mock">
        <BrowserMock>{mock}</BrowserMock>
      </div>
    </div>
  );
}

function BrowserMock({ children }: { children: ReactNode }) {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-deep)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,.4),0 4px 16px rgba(0,0,0,.3)' }}>
      <div style={{ height: 32, background: 'oklch(0.20 0.014 50)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6, borderBottom: '1px solid var(--border-soft)' }}>
        <span style={{ width: 11, height: 11, borderRadius: 999, background: 'oklch(0.62 0.16 25)' }} />
        <span style={{ width: 11, height: 11, borderRadius: 999, background: 'oklch(0.78 0.12 80)' }} />
        <span style={{ width: 11, height: 11, borderRadius: 999, background: 'oklch(0.66 0.14 145)' }} />
        <span style={{ flex: 1, textAlign: 'center', font: '400 11px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em' }}>avtorskaya-studiya.vercel.app</span>
      </div>
      <div style={{ height: 380, position: 'relative', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function MockEditorModes() {
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '180px 1fr 180px', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--bg-deep)', padding: 14, borderRight: '1px solid var(--border-soft)' }}>
        <div style={{ font: '500 9px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Часть I</div>
        {MC.map((c, i) => (
          <div key={c.num} style={{ display: 'flex', gap: 8, padding: '6px 4px', borderRadius: 4, background: i === 0 ? 'var(--surface)' : 'transparent' }}>
            <span style={{ font: '500 10px var(--font-mono)', color: i === 0 ? 'var(--accent)' : 'var(--ink-4)' }}>{String(c.num).padStart(2, '0')}</span>
            <span style={{ fontSize: 11.5, color: i === 0 ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{c.title}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 260, background: 'var(--paper)', padding: '24px 28px', color: 'var(--paper-ink)', font: '400 11px/1.7 var(--font-serif)', borderRadius: '3px 3px 0 0' }}>
          <div style={{ font: '600 16px var(--font-serif)', marginBottom: 6 }}>Город, которого нет</div>
          <div style={{ width: 18, height: 1, background: 'var(--paper-ink)', opacity: 0.3, marginBottom: 14 }} />
          <p style={{ margin: '0 0 0.8em' }}>Ворна исчезла за одну ночь, и никто из тех, кто жил в Тереее, не желал в это верить.</p>
          <p style={{ margin: '0 0 0.8em', textIndent: '1em' }}>Аней Ворон узнала об этом в архиве, на третьем этаже башни.</p>
          <p style={{ margin: 0, textIndent: '1em', color: 'var(--paper-ink-2)' }}>— Картограф Ворон, — сказал голос…</p>
        </div>
      </div>
      <div style={{ background: 'var(--bg-deep)', padding: 14, borderLeft: '1px solid var(--border-soft)' }}>
        <div style={{ font: '500 9px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>На полях</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: '2px solid var(--accent-2)', padding: '8px 10px', borderRadius: 6, marginBottom: 8 }}>
          <div style={{ font: '500 9px var(--font-mono)', color: 'var(--ink-3)', marginBottom: 3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Идея</div>
          <div style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.4 }}>Упомянуть мать в начале — отзеркалит финал.</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderLeft: '2px solid var(--info)', padding: '8px 10px', borderRadius: 6 }}>
          <div style={{ font: '500 9px var(--font-mono)', color: 'var(--ink-3)', marginBottom: 3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Вопрос</div>
          <div style={{ fontSize: 11, color: 'var(--ink)', lineHeight: 1.4 }}>Откуда серебряный ключ у трактирщика?</div>
        </div>
      </div>
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
  const cells = Array.from({ length: 14 * 7 }, (_, i) => {
    const w = Math.floor(i / 7), d = i % 7;
    if (w < 2 && d < 4) return 0;
    const r = Math.sin((w * 7 + d) * 0.7) + Math.cos(w * 0.3 + d);
    if (r > 1.2) return 4; if (r > 0.4) return 3; if (r > -0.2) return 2; if (r > -0.9) return 1; return 0;
  });
  const hc = (v: number) => (['var(--surface-2)', 'oklch(0.40 0.10 30)', 'oklch(0.50 0.13 30)', 'oklch(0.58 0.15 30)', 'var(--accent)'] as const)[v];
  return (
    <div style={{ height: '100%', padding: 24, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {([['21 540', 'слов', '+348'], ['7', 'дней подряд', 'серия'], ['48', 'рабочих дней', 'из 184']] as const).map(([v, l, d], i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ font: '500 9px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>{l}</div>
            <div style={{ font: '600 22px var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{v}</div>
            <div style={{ font: '500 10px var(--font-mono)', color: i < 2 ? 'var(--ok)' : 'var(--ink-3)', marginTop: 3 }}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ font: '500 11px var(--font-ui)', color: 'var(--ink)' }}>Активность · 14 недель</div>
          <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)' }}>Ø 161 сл/день</div>
        </div>
        <div style={{ display: 'grid', gridAutoFlow: 'column', gridTemplateRows: 'repeat(7,9px)', gridAutoColumns: '9px', gap: 2 }}>
          {cells.map((v, i) => <div key={i} style={{ background: hc(v), borderRadius: 1.5 }} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Process ──────────────────────────────────────────────────────────────────

function LandingProcess() {
  const steps = [
    { n: 1, t: 'Откройте проект', s: 'Создайте книгу — название, жанр, цель по словам. Дальше всё открывается из неё: рукопись, картотека, карта.', tag: 'Старт' },
    { n: 2, t: 'Напишите главу', s: 'TipTap-редактор, автосохранение каждые несколько секунд, версии глав. Заметки на полях — прямо рядом с абзацем.', tag: 'Письмо' },
    { n: 3, t: 'Соберите мир', s: 'Привяжите персонажа к главе — он появится в её обзоре. Поставьте пин на карте, поместите событие на хронологию. Всё связано.', tag: 'Мир' },
    { n: 4, t: 'Отдайте книгу', s: 'Экспорт в EPUB, FB2 или DOCX. С титульной страницей, оглавлением, опционально — со списком персонажей в приложении.', tag: 'Финал' },
  ];
  return (
    <section id="process" style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg-deep)', borderTop: '1px solid var(--border-soft)' }}>
      <div className="lnd-max">
        <SectionLabel kicker="02 · Один день автора" title="От пустого листа до экспорта." subtitle="Каждый шаг — на своём месте. Не нужно жонглировать четырьмя приложениями и пустыми документами Word." />
        <div className="lnd-proc">
          {steps.map(s => (
            <div key={s.n} style={{ position: 'relative' }}>
              <div style={{ width: 48, height: 48, borderRadius: 999, background: 'var(--bg-deep)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 14px var(--font-mono)', color: 'var(--accent)', marginBottom: 22, position: 'relative', zIndex: 1 }}>
                {String(s.n).padStart(2, '0')}
              </div>
              <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>{s.tag}</div>
              <div style={{ font: '600 20px var(--font-serif)', color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.005em' }}>{s.t}</div>
              <div style={{ font: '400 14px/1.55 var(--font-serif)', color: 'var(--ink-2)' }}>{s.s}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function LandingTestimonials() {
  const quotes = [
    { text: 'Я двенадцать лет писала в Word, потом четыре в Scrivener, и впервые мне не нужно держать в голове, в каком файле какая глава. Это редкий случай, когда инструмент не мешает.', author: 'Елена Гроздова', meta: 'роман «Долгое лето в Колпино», в работе', who: 'ЕГ' },
    { text: 'Карточки сцен на доске — это, по сути, мой бумажный архив за пятнадцать лет. Переставить главы и не сломать нумерацию — мелочь, которой нет нигде.', author: 'Юрий Стречнев', meta: 'автор четырёх детективных романов', who: 'ЮС' },
    { text: 'Серия дней меня не подгоняет, не пишет «вы не открывали 3 дня». Просто молча считает. Это всё, что мне было нужно от трекера.', author: 'Кариса Войт', meta: 'эссеистка, автор «Памяти места»', who: 'КВ' },
    { text: 'Хронология в одном клике от текста — оказалось, именно этого мне всю жизнь не хватало в Notion. Слежу за своими событиями, не вылезая из главы.', author: 'Тимур Пастухов', meta: 'фэнтези-цикл «Тёмный январь»', who: 'ТП' },
  ];
  return (
    <section style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg)' }}>
      <div className="lnd-max">
        <SectionLabel align="center" kicker="03 · Что говорят авторы" title="Отзывы — как на обложке." subtitle="Бета-тестеры пишут собственные книги. Их слова — не маркетинговая копия." />
        <div className="lnd-quotes">
          {quotes.map((q, i) => (
            <figure key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 14, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ font: '500 28px var(--font-serif)', color: 'var(--accent)', lineHeight: 0.8, marginBottom: -12 }}>«</div>
              <blockquote style={{ font: '400 17px/1.55 var(--font-serif)', color: 'var(--ink)', margin: 0, fontStyle: 'italic' }}>{q.text}</blockquote>
              <figcaption style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 999, background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 12px var(--font-ui)', color: 'var(--bg-deep)', flexShrink: 0 }}>{q.who}</div>
                <div>
                  <div style={{ font: '500 14px var(--font-ui)', color: 'var(--ink)' }}>{q.author}</div>
                  <div style={{ font: '400 12px var(--font-mono)', color: 'var(--ink-3)', marginTop: 2, letterSpacing: '0.02em' }}>{q.meta}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function LandingPricing() {
  const tiers = [
    {
      name: 'Free', price: '0 ₽', sub: 'навсегда',
      summary: 'Чтобы попробовать инструмент на одной книге.',
      features: [
        ['Одна книга', true],
        ['Редактор · 4 режима', true],
        ['Персонажи и хронология', true],
        ['Карта мира · заметки на полях', true],
        ['Экспорт: HTML, TXT, Markdown', true],
        ['Дэшборд и heatmap', false],
        ['Приоритетная поддержка', false],
      ] as [string, boolean][],
      cta: 'Начать бесплатно', accent: false, tag: null,
    },
    {
      name: 'Pro', price: '290 ₽', sub: 'в месяц · или 2 900 ₽/год',
      summary: 'Для тех, кто пишет больше одной книги.',
      features: [
        ['Безлимит книг и проектов', true],
        ['Все инструменты без ограничений', true],
        ['Дэшборд · heatmap · серия дней', true],
        ['История снимков глав', true],
        ['Экспорт: HTML, TXT, Markdown', true],
        ['Приоритетная поддержка', true],
        ['Скоро: EPUB, DOCX', false],
      ] as [string, boolean][],
      cta: 'Перейти на Pro', accent: true, tag: 'Чаще выбирают',
    },
    {
      name: 'Lifetime', price: '1 990 ₽', sub: 'один раз · навсегда',
      summary: 'Разовая оплата. Все обновления Pro — на всю жизнь.',
      features: [
        ['Всё из тарифа Pro', true],
        ['Все будущие обновления', true],
        ['Никаких подписок', true],
        ['Приоритетная поддержка', true],
        ['Имя в титрах беты', true],
        ['Закрытое сообщество авторов', true],
        ['Лимит: 500 мест', true],
      ] as [string, boolean][],
      cta: 'Купить Lifetime', accent: false, tag: 'Ограничено',
    },
  ];
  return (
    <section id="pricing" style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg-deep)', borderTop: '1px solid var(--border-soft)' }}>
      <div className="lnd-max">
        <SectionLabel align="center" kicker="04 · Цены" title="Простая математика." subtitle="Бесплатный план — не «триал на 14 дней». Во время открытой беты все возможности доступны бесплатно." />
        <div className="lnd-prices">
          {tiers.map((t) => (
            <div key={t.name} style={{ position: 'relative', background: t.accent ? 'var(--surface)' : 'var(--bg)', border: t.accent ? '1px solid var(--accent)' : '1px solid var(--border-soft)', borderRadius: 14, padding: '32px 28px 28px', display: 'flex', flexDirection: 'column', boxShadow: t.accent ? '0 20px 60px rgba(0,0,0,.3),0 0 0 4px var(--accent-soft)' : 'none', transform: t.accent ? 'translateY(-8px)' : 'none' }}>
              {t.tag && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '4px 12px', borderRadius: 999, background: t.accent ? 'var(--accent)' : 'var(--surface-2)', color: t.accent ? 'oklch(0.98 0 0)' : 'var(--ink-2)', font: '500 10.5px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', border: t.accent ? 'none' : '1px solid var(--border)', whiteSpace: 'nowrap' }}>{t.tag}</div>}
              <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: t.accent ? 'var(--accent)' : 'var(--ink-3)', marginBottom: 14 }}>{t.name}</div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ font: '600 48px var(--font-serif)', letterSpacing: '-0.018em', color: 'var(--ink)' }}>{t.price}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 18 }}>{t.sub}</div>
              <p style={{ font: '400 14px/1.5 var(--font-serif)', color: 'var(--ink-2)', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border-soft)' }}>{t.summary}</p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, flex: 1 }}>
                {t.features.map(([l, on], fi) => (
                  <li key={fi} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: on ? 'var(--ink)' : 'var(--ink-4)' }}>
                    <span style={{ flexShrink: 0, marginTop: 3, color: on ? 'var(--accent-2)' : 'var(--ink-4)' }}>
                      {on
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="12" x2="18" y2="12"/></svg>
                      }
                    </span>
                    {l}
                  </li>
                ))}
              </ul>
              <Link to="/login" className={t.accent ? 'btn btn--primary' : 'btn'} style={{ height: 42, fontSize: 14, justifyContent: 'center', width: '100%', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>{t.cta}</Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: 'var(--ink-3)' }}>
          Все тарифы поддерживают оплату через ЮKassa и иностранные карты. <span style={{ color: 'var(--ink-2)' }}>Возврат — 14 дней без вопросов.</span>
        </p>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function LandingFAQ() {
  const items = [
    { q: 'Это нейросеть пишет за меня?', a: 'Нет. Авторская студия — это редактор и хранилище материалов книги. Никакого автодополнения, генерации абзацев и «исправь стиль» по умолчанию. Если когда-нибудь добавим — это будет отдельный режим с явным выключателем.' },
    { q: 'Что будет, если я перестану платить?', a: 'Все ваши книги остаются. Доступ к Pro-функциям отключается, но вы продолжаете писать в Free-режиме на той книге, которую укажете главной. Никто не блокирует и не удаляет файлы.' },
    { q: 'Можно ли импортировать рукопись из Word или Scrivener?', a: 'Прямого импорта пока нет. Вставьте текст напрямую в редактор или разбейте на главы вручную — это занимает несколько минут. Импорт из DOCX добавим в следующих версиях.' },
    { q: 'Хранятся ли мои книги в облаке?', a: 'Да, в Supabase Postgres с шифрованием. Доступ только у вас — через email или Google. В любой момент можно скачать полный экспорт рукописи.' },
    { q: 'Я пишу не роман — поэзия / нон-фикшн / сценарий. Подойдёт?', a: 'Поэзия и эссеистика — да, без оговорок. Нон-фикшн — да, особенно если он структурный (главы, разделы). Сценарии — пока нет специальной разметки Fountain / Final Draft, на дорожной карте.' },
    { q: 'Если я нашёл баг или хочу фичу?', a: 'Напишите в issues на GitHub или на почту — ответ обычно в течение суток. Pro-подписчики попадают в Telegram-чат с разработчиком напрямую.' },
  ];
  return (
    <section id="faq" style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg)' }}>
      <div className="lnd-max" style={{ maxWidth: 920 }}>
        <SectionLabel kicker="05 · Частые вопросы" title="Что обычно спрашивают." />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, i) => (
            <details key={i} open={i === 0} style={{ borderTop: '1px solid var(--border-soft)', padding: '24px 0' }}>
              <summary style={{ display: 'flex', alignItems: 'flex-start', gap: 16, cursor: 'pointer', listStyle: 'none' }}>
                <span style={{ font: '500 13px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 4, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ flex: 1, font: '500 19px var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.005em' }}>{item.q}</span>
                <span style={{ color: 'var(--ink-3)', marginTop: 6, flexShrink: 0 }}><Icon name="chevd" size={16} /></span>
              </summary>
              <p style={{ font: '400 15px/1.65 var(--font-serif)', color: 'var(--ink-2)', marginTop: 14, paddingLeft: 42, maxWidth: 680 }}>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function LandingCTA() {
  return (
    <section style={{ padding: 'clamp(100px,12vw,140px) clamp(20px,4vw,56px)', background: 'var(--bg-deep)', borderTop: '1px solid var(--border-soft)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -100, top: '50%', transform: 'translateY(-50%) rotate(-8deg)', font: '600 280px/1 var(--font-serif)', color: 'var(--surface-2)', opacity: 0.4, pointerEvents: 'none', letterSpacing: '-0.04em', userSelect: 'none' }}>книга</div>
      <div style={{ position: 'relative', maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 24 }}>Открытая бета</div>
        <h2 style={{ font: '600 clamp(44px,6vw,76px)/1.02 var(--font-serif)', letterSpacing: '-0.022em', marginBottom: 24, color: 'var(--ink)' }}>
          Начните свою <em style={{ fontWeight: 500, color: 'var(--accent-2)' }}>книгу</em><br />сегодня вечером.
        </h2>
        <p style={{ font: '400 18px/1.55 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 560, margin: '0 auto 40px' }}>
          Бесплатно, без карты, без 14-дневного триала. Регистрация в три клика — и у вас открыт первый лист.
        </p>
        <div style={{ display: 'inline-flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/login" className="btn btn--primary" style={{ height: 50, padding: '0 28px', fontSize: 15, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Создать книгу</Link>
          <Link to="/login" className="btn" style={{ height: 50, padding: '0 22px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Icon name="eye" size={15} /> Войти
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer style={{ padding: 'clamp(36px,5vw,56px) clamp(20px,4vw,56px) 36px', background: 'oklch(0.13 0.012 50)', borderTop: '1px solid var(--border-soft)' }}>
      <div className="lnd-max">
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 48, marginBottom: 40 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <LogoMark size={20} />
              <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
            </div>
            <p style={{ font: '400 14px/1.65 var(--font-serif)', color: 'var(--ink-3)', fontStyle: 'italic', maxWidth: 340 }}>
              «Ворна исчезла за одну ночь, и никто из тех, кто жил в Тереее, не желал в это верить.»{' '}
              <span style={{ fontStyle: 'normal', fontSize: 11.5, color: 'var(--ink-4)' }}>— первая фраза, написанная в Авторской студии, май 2026</span>
            </p>
          </div>
          {([
            ['Продукт', ['Возможности', 'Цены', 'Дорожная карта', 'Изменения']],
            ['Авторам', ['Войти', 'Создать книгу', 'FAQ', 'Сообщество']],
            ['Студия', ['О проекте', 'Контакты', 'Блог', 'GitHub']],
          ] as [string, string[]][]).map(([title, links]) => (
            <div key={title}>
              <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 14 }}>{title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {links.map(l => <a key={l} style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{l}</a>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 24, borderTop: '1px solid var(--border-soft)', font: '400 11.5px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.04em', flexWrap: 'wrap' }}>
          <span>© 2026 Авторская студия</span>
          <span>·</span>
          <a style={{ cursor: 'pointer' }}>Договор-оферта</a>
          <a style={{ cursor: 'pointer' }}>Конфиденциальность</a>
          <a style={{ cursor: 'pointer' }}>Cookie</a>
          <span style={{ flex: 1 }} />
          <span>Москва · Тбилиси · Сан-Франциско</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.round(n)) % 100;
  const rem = abs % 10;
  if (abs >= 11 && abs <= 19) return many;
  if (rem === 1) return one;
  if (rem >= 2 && rem <= 4) return few;
  return many;
}

function formatWords(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.', ',')} млрд`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} млн`;
  return n.toLocaleString('ru');
}

function wordsLabel(n: number): string {
  if (n >= 1_000_000) return 'слов';
  return pluralRu(n, 'слово', 'слова', 'слов');
}
