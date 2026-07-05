import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/auth';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/LogoMark';
import { supabase } from '../lib/supabase';
import { heroContainerVariants, heroItemVariants, revealVariants } from '../lib/motion';
import { SpotlightButton } from '../components/SpotlightButton';
import { LandingFeatures } from '../components/LandingFeaturesSection';
import { LandingProcess } from '../components/LandingProcessSection';
import { LandingPricing } from '../components/LandingPricingSection';
import { ExitIntentPopup } from '../components/ExitIntentPopup';
import { useFeatureFlag } from '../lib/useFeatureFlag';

export default function Landing() {
  const { session, initializing } = useAuth();
  const { enabled: exitIntentEnabled } = useFeatureFlag('exit_intent_popup');

  if (initializing) return null;
  if (session) return <Navigate to="/books" replace />;

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', overflowX: 'hidden' }}>
      <LandingNav />
      <main>
        <LandingHero />
        <LandingTrust />
        <LandingFeatures />
        <LandingProcess />
        <LandingPrinciples />
        <LandingEmailCapture />
        <LandingPricing />
        <LandingFAQ />
        <LandingCTA />
      </main>
      <LandingFooter />
      {exitIntentEnabled && <ExitIntentPopup />}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return (
    <header className="lnd-header" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
      padding: 'clamp(14px,2vw,18px) clamp(20px,4vw,56px)',
      display: 'flex', alignItems: 'center', gap: 16,
      background: scrolled ? 'var(--bg-deep)' : 'transparent',
      borderBottom: `1px solid ${scrolled ? 'var(--border-soft)' : 'transparent'}`,
      transition: 'background 0.25s ease-out, border-color 0.25s ease-out',
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
        <LogoMark size={22} />
        <span className="lnd-nav-word" style={{ font: '500 12px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink)', whiteSpace: 'nowrap' }}>авторская студия</span>
      </Link>
      <div style={{ flex: 1 }} />
      <nav className="lnd-nav-links">
        <a href="#features" style={{ textDecoration: 'none', color: 'inherit' }}>Возможности</a>
        <a href="#process" style={{ textDecoration: 'none', color: 'inherit' }}>Процесс</a>
        <a href="#pricing" style={{ textDecoration: 'none', color: 'inherit' }}>Цены</a>
        <a href="#faq" style={{ textDecoration: 'none', color: 'inherit' }}>Вопросы</a>
      </nav>
      <span className="lnd-nav-sep" style={{ width: 1, height: 18, background: 'var(--border-soft)', flexShrink: 0 }} />
      <Link to="/login" className="lnd-nav-login" style={{ fontSize: 13.5, textDecoration: 'none', padding: '12px 6px', margin: '-12px -6px', whiteSpace: 'nowrap' }}>Войти</Link>
      <Link to="/login?tab=signup" className="btn btn--primary" style={{ height: 44, padding: '0 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>Начать свою книгу</Link>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function LandingHero() {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const section = sectionRef.current;
    const tilt = tiltRef.current;
    if (!section || !tilt) return;
    const rect = section.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width * 2 - 1;
    const ny = (e.clientY - rect.top) / rect.height * 2 - 1;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!tiltRef.current) return;
      tiltRef.current.style.transition = 'transform 0.1s ease-out';
      tiltRef.current.style.transform = `rotateY(${-9 + nx * 4}deg) rotateX(${2 - ny * 4}deg)`;
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (!tiltRef.current) return;
    tiltRef.current.style.transition = 'transform 0.65s cubic-bezier(0.16,1,0.3,1)';
    tiltRef.current.style.transform = 'rotateY(-9deg) rotateX(2deg)';
  }, []);

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', padding: 'clamp(120px,14vw,160px) clamp(20px,4vw,56px) clamp(64px,8vw,80px)', background: 'var(--bg-deep)', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'linear-gradient(oklch(0.95 0.01 80) 1px,transparent 1px),linear-gradient(90deg,oklch(0.95 0.01 80) 1px,transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none', maskImage: 'radial-gradient(120% 90% at 78% 30%, #000 40%, transparent 78%)', WebkitMaskImage: 'radial-gradient(120% 90% at 78% 30%, #000 40%, transparent 78%)' }} />
      <div className="lnd-max" style={{ position: 'relative' }}>
        <div className="lnd-hero-grid">
          <motion.div
            className="lnd-hero-text"
            variants={heroContainerVariants}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={heroItemVariants} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--bg-deep)', marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
              <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink)' }}>Студия для писателей · Ранний доступ</span>
            </motion.div>
            <motion.h1 variants={heroItemVariants} style={{ font: '600 clamp(38px,4.6vw,64px)/1.03 var(--font-serif)', letterSpacing: '-0.025em', marginBottom: 28, color: 'var(--ink)' }}>
              Пишите роман целиком —
              <br />
              от первого предложения
              <br />
              до <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--accent-2)' }}>готовой книги</em>.
            </motion.h1>
            <motion.p variants={heroItemVariants} style={{ font: '400 clamp(16px,1.5vw,19px)/1.6 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 520, marginBottom: 36 }}>
              Хватит собирать книгу из заметок, таблиц и чатов. Рукопись, персонажи, карта мира и хронология — рядом, в одном чистом редакторе. А писать будете вы, не нейросеть.
            </motion.p>
            <motion.div variants={heroItemVariants} style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <SpotlightButton className="btn btn--primary" style={{ height: 46, padding: '0 22px', fontSize: 14.5, display: 'inline-flex', alignItems: 'center' }} onClick={() => navigate('/login?tab=signup')}>
                Начать свою книгу
              </SpotlightButton>
              <button type="button" className="btn" style={{ height: 46, padding: '0 18px', fontSize: 14.5, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }} onClick={() => navigate('/demo')}>
                Посмотреть, как выглядит →
              </button>
            </motion.div>
            <motion.div variants={heroItemVariants}>
              <p style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink-2)', margin: 0 }}>
                Бесплатный план — навсегда. Без привязки карты, без пробного периода.
              </p>
              <p style={{ font: '400 12px/1.6 var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.02em', margin: '10px 0 0' }}>
                4 режима письма · 7 форматов экспорта · карта мира · хронология · автосохранение
              </p>
            </motion.div>
            <div className="lnd-hero-mobile-card" aria-hidden="true">
              <div style={{ background: 'var(--paper)', padding: '24px 28px', color: 'var(--paper-ink)', fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.8 }}>
                <div style={{ font: '500 9.5px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--paper-ink-2)', marginBottom: 8 }}>Глава первая</div>
                <div style={{ font: '600 22px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 12, color: 'var(--paper-ink)' }}>Город, которого нет</div>
                <div style={{ width: 24, height: 1, background: 'var(--paper-ink)', opacity: 0.25, marginBottom: 16 }} />
                <p style={{ margin: '0 0 0.8em' }}>Ворна исчезла за одну ночь, и никто из тех, кто жил в Терее, не желал в это верить.</p>
                <p style={{ margin: 0, textIndent: '1.4em', color: 'var(--paper-ink-2)' }}>Аней Ворон узнала об этом в архиве, на третьем этаже башни, где пахло железом и устым мхом…</p>
              </div>
            </div>
          </motion.div>
          <div className="lnd-hero-sheet" style={{ position: 'relative', height: 540 }} aria-hidden="true">
            <FloatingSheet tiltRef={tiltRef} />
            <div style={{ position: 'absolute', top: 14, right: -16, width: 200, transform: 'rotate(2deg)' }}>
              <div className="lnd-note-in n1" style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 12px', boxShadow: '0 10px 30px oklch(0 0 0 / 0.35)' }}>
                <div style={{ font: '500 9.5px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 5 }}>Идея · 5 мин</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>Сделать упоминание матери Аней в начале — отзеркалит финал.</div>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 40, left: -22, width: 190, transform: 'rotate(-1.5deg)' }}>
              <div className="lnd-note-in n2" style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 12px', boxShadow: '0 10px 30px oklch(0 0 0 / 0.35)' }}>
                <div style={{ font: '500 9.5px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 5 }}>Важно · 10 мин</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>НЕ называть имя 12-го картографа до главы 8.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FloatingSheet({ tiltRef }: { tiltRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: '1600px' }}>
      <div
        ref={tiltRef}
        style={{ position: 'absolute', inset: 0, transform: 'rotateY(-9deg) rotateX(2deg)', transformOrigin: 'center center', transformStyle: 'preserve-3d', willChange: 'transform' }}
      >
      <div className="lnd-sheet-float" style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transformOrigin: 'center center', boxShadow: '-40px 60px 120px oklch(0 0 0 / 0.5)' }}>
        <div style={{ background: 'var(--paper)', borderRadius: '6px 6px 0 0', padding: '48px 56px', height: '100%', color: 'var(--paper-ink)', fontFamily: 'var(--font-serif)', fontSize: 14.5, lineHeight: 1.85, overflow: 'hidden' }}>
          <div style={{ font: '500 9.5px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--paper-ink-2)', marginBottom: 10 }}>Глава первая</div>
          <div style={{ font: '600 26px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 6, color: 'var(--paper-ink)' }}>Город, которого нет</div>
          <div style={{ width: 30, height: 1, background: 'var(--paper-ink)', opacity: 0.3, marginBottom: 20 }} />
          <p style={{ margin: '0 0 0.9em' }}>Ворна исчезла за одну ночь, и никто из тех, кто жил в Терее, не желал в это верить.</p>
          <p style={{ margin: '0 0 0.9em', textIndent: '1.4em' }}>Аней Ворон узнала об этом в архиве, на третьем этаже башни, где пахло железом и устым мхом. <span style={{ background: 'oklch(0.84 0.13 90 / 0.45)', padding: '1px 2px', borderRadius: 2 }}>Она перечерчивала контуры озера, которого никогда не видела</span>, когда чьи-то шаги остановились за её спиной.</p>
          <p style={{ margin: '0 0 0.9em', textIndent: '1.4em' }}>— Картограф Ворон, — сказал голос. Голос был старый и строгий, как страница. — Магистр требует вас немедленно.</p>
          <p style={{ margin: 0, textIndent: '1.4em' }}>Аней не подняла голову. Кисть вела мягкую кривую — северный край озера, мнимый, но обязательный для атласа.<span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--accent)', marginLeft: 1, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} /></p>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Trust bar ───────────────────────────────────────────────────────────────

const TRUST_ITEMS = [
  { icon: 'feather' as const, text: 'Без нейросети' },
  { icon: 'save' as const, text: 'Автосохранение' },
  { icon: 'download' as const, text: 'Экспорт в любой момент' },
  { icon: 'shield' as const, text: 'Данные — ваши' },
];

function LandingTrust() {
  return (
    <section style={{ padding: '28px clamp(20px,4vw,56px)', background: 'var(--bg)', borderBottom: '1px solid var(--border-soft)' }}>
      <div className="lnd-max" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '20px 40px' }}>
        {TRUST_ITEMS.map((t) => (
          <div key={t.text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name={t.icon} size={15} />
            <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink-2)', letterSpacing: '0.01em' }}>{t.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Principles ───────────────────────────────────────────────────────────────

const PRINCIPLES = [
  {
    title: 'Студия не пишет за вас',
    body: 'Никакого автодополнения, «улучши абзац», генерации текста. Всё написанное — ваше.',
  },
  {
    title: 'Всё рядом с рукописью',
    body: 'Постоянно прыгать между вкладками и программами — главный враг длинного текста. Поэтому карта, персонажи и хронология открываются рядом с той главой, которую вы пишете.',
  },
  {
    title: 'Серия молчит',
    body: 'Счётчик отмечает дни подряд. Но не пишет «вы не открывали студию 4 дня» и не сбрасывает серию.',
  },
  {
    title: 'Ваши книги — ваши',
    body: 'Перестали платить — данные остаются. Экспорт всегда доступен. Рукописи не в заложниках.',
  },
];

function LandingPrinciples() {
  return (
    <section style={{ padding: 'clamp(36px,5vw,64px) clamp(20px,4vw,56px)', background: 'var(--bg-deep)' }}>
      <div className="lnd-max">
        <div style={{ marginBottom: 40, maxWidth: 640 }}>
          <h2 style={{ font: '600 clamp(48px,5.5vw,76px)/1.02 var(--font-serif)', letterSpacing: '-0.022em', color: 'var(--ink)' }}>
            Принципы, не обещания.
          </h2>
        </div>
        <div className="lnd-manifesto">
          {PRINCIPLES.map((p, i) => (
            <motion.div
              key={p.title}
              className="lnd-manifesto-row"
              variants={revealVariants}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: Math.min(i, 3) * 0.1 }}
            >
              <div style={{ font: '600 clamp(28px,3vw,40px)/1 var(--font-serif)', color: 'var(--accent)', letterSpacing: '-0.02em', paddingTop: 6 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <h3 style={{ font: '600 clamp(20px,2.5vw,28px)/1.15 var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.012em', marginBottom: 10 }}>{p.title}</h3>
                <p style={{ font: '400 15px/1.65 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 620, margin: 0 }}>{p.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Email capture ────────────────────────────────────────────────────────────

function LandingEmailCapture() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = email.trim().toLowerCase();
    if (!val) return;
    setStatus('loading');
    const { error } = await supabase.from('waitlist').insert({ email: val });
    if (error && error.code !== '23505') {
      setStatus('error');
    } else {
      setStatus('done');
    }
  };

  return (
    <section style={{ padding: 'clamp(64px,8vw,80px) clamp(20px,4vw,56px)', background: 'var(--bg)', borderTop: '1px solid var(--border-soft)' }}>
      <motion.div
        className="lnd-max"
        style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}
        variants={revealVariants}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: '-80px' }}
      >
        <h2 style={{ font: '600 clamp(26px,3vw,40px)/1.08 var(--font-serif)', letterSpacing: '-0.018em', marginBottom: 12, color: 'var(--ink)' }}>
          Письма для авторов.
        </h2>
        <p style={{ font: '400 15px/1.6 var(--font-serif)', color: 'var(--ink-2)', marginBottom: 20 }}>
          Обновления, новые фичи, закрытые приглашения. Не чаще раза в месяц.
        </p>
        {status === 'done' ? (
          <p style={{ font: '500 15px var(--font-serif)', color: 'var(--ok)', padding: '12px 0' }}>
            Готово — будем писать.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 14, maxWidth: 400, margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ваш@email.ru"
              className="input"
              aria-label="Адрес электронной почты"
              style={{ flex: 1, minWidth: 200, height: 44 }}
              disabled={status === 'loading'}
            />
            <button
              type="submit"
              className="btn btn--primary"
              style={{ height: 44, padding: '0 20px', fontSize: 14 }}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? '…' : 'Подписаться'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p style={{ font: '400 13px var(--font-ui)', color: 'var(--danger)', marginTop: 10 }}>
            Что-то пошло не так. Попробуйте ещё раз.
          </p>
        )}
      </motion.div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FAQItem({ q, a, index, defaultOpen = false }: { q: string; a: string; index: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `faq-panel-${index}`;

  return (
    <div style={{ borderTop: '1px solid var(--border-soft)', padding: '13px 0' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="faq-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        style={{ display: 'flex', width: '100%', background: 'none', border: 'none', padding: '11px 0', cursor: 'pointer', textAlign: 'left', alignItems: 'flex-start', gap: 16 }}
      >
        <span style={{ font: '500 13px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 4, flexShrink: 0 }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{ flex: 1, font: '500 19px var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.005em' }}>{q}</span>
        <span className={`faq-chevron${open ? ' open' : ''}`} style={{ marginTop: 6, flexShrink: 0 }}>
          <Icon name="chevd" size={16} />
        </span>
      </button>
      <div id={panelId} className={`faq-body${open ? ' open' : ''}`} role="region">
        <div>
          <p style={{ font: '400 15px/1.65 var(--font-serif)', color: 'var(--ink-2)', marginTop: 14, paddingLeft: 42, maxWidth: 680 }}>{a}</p>
        </div>
      </div>
    </div>
  );
}

function LandingFAQ() {
  const items = [
    { q: 'Чем Авторская студия отличается от Google Docs?', a: 'Google Docs — универсальный офисный редактор, созданный для документооборота. Авторская студия создана для длинной прозы: здесь есть структура глав, картотека персонажей с описаниями и связями, хронология событий, карта мира и статистика прогресса. Всё заточено под написание книги, а не под корпоративные задачи.' },
    { q: 'Подходит ли Авторская студия для начинающих авторов?', a: 'Да. Интерфейс намеренно простой: список глав слева, редактор по центру. Не нужно настраивать ничего заранее — создайте книгу и начинайте писать. Продвинутые инструменты (картотека персонажей, хронология, версии главы) открываются по мере необходимости и не мешают на старте.' },
    { q: 'Это нейросеть пишет за меня?', a: 'Нет. Авторская студия — редактор и хранилище материалов книги. Никакого автодополнения, генерации абзацев или «исправь стиль» по умолчанию. Инструмент полностью контролируется автором: вы пишете, а студия организует структуру, хранит персонажей и ведёт статистику. Если когда-нибудь появятся AI-функции — это будет отдельный режим с явным выключателем.' },
    { q: 'Как работает экспорт в EPUB и FB2?', a: 'В разделе «Экспорт» выберите нужный формат — система автоматически соберёт все главы в единый файл с метаданными: название, автор, обложка. EPUB открывается в любой читалке (Kindle, Apple Books, PocketBook). FB2 — стандарт для русскоязычных читалок и Литрес. Доступно на Pro-тарифе.' },
    { q: 'Что будет, если я перестану платить?', a: 'Все ваши книги и рукописи остаются в аккаунте. Доступ к Pro-функциям (EPUB/FB2/DOCX-экспорт, неограниченные персонажи, хронология) отключается, но вы продолжаете писать в Free-режиме. Никто не блокирует и не удаляет ваши данные — они всегда ваши.' },
    { q: 'Можно ли импортировать рукопись из Word или Scrivener?', a: 'Прямого импорта пока нет. Вставьте текст напрямую в редактор или разбейте на главы вручную — это занимает несколько минут для готовой рукописи. Импорт из DOCX добавим в следующих версиях, он стоит в приоритете.' },
    { q: 'Хранятся ли мои книги в облаке?', a: 'Да, в защищённой облачной базе данных с шифрованием. Доступ только у вас — через email или Google. Данные хранятся с автоматическим резервным копированием. В любой момент можно скачать полный экспорт рукописи в DOCX, EPUB или FB2.' },
    { q: 'Я пишу не роман — поэзия, нон-фикшн, сценарий. Подойдёт?', a: 'Поэзия и эссеистика — да, без оговорок: редактор работает со свободным текстом. Нон-фикшн — отлично, особенно структурные книги с главами и частями. Сценарии — пока без разметки Fountain, можно писать в свободном формате. Специальная поддержка сценариев на дорожной карте.' },
    { q: 'Если я нашёл баг или хочу предложить фичу?', a: 'Напишите на почту или в Telegram — ответ обычно в течение суток. Pro-подписчики попадают в закрытый чат с разработчиком напрямую и влияют на приоритеты следующих версий.' },
  ];
  return (
    <section id="faq" style={{ padding: 'clamp(40px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg)' }}>
      <div className="lnd-max" style={{ maxWidth: 920 }}>
        <div style={{ marginBottom: 80, maxWidth: 780 }}>
          <h2 style={{ font: '600 clamp(32px,4vw,56px)/1.05 var(--font-serif)', letterSpacing: '-0.018em', marginBottom: 16, color: 'var(--ink)' }}>Что обычно спрашивают.</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((item, i) => (
            <FAQItem key={i} q={item.q} a={item.a} index={i} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function LandingCTA() {
  const navigate = useNavigate();
  const decoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = decoRef.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.parentElement!.getBoundingClientRect();
      const centerOffset = (window.innerHeight / 2 - rect.top - rect.height / 2) * 0.25;
      el.style.transform = `translateY(calc(-50% + ${centerOffset}px)) rotate(-8deg)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section style={{ padding: 'clamp(48px,12vw,140px) clamp(20px,4vw,56px)', background: 'var(--bg-deep)', borderTop: '1px solid var(--border-soft)', position: 'relative', overflow: 'hidden' }}>
      <div ref={decoRef} className="lnd-cta-deco" style={{ position: 'absolute', right: -100, top: '50%', transform: 'translateY(-50%) rotate(-8deg)', color: 'var(--surface-2)', pointerEvents: 'none', letterSpacing: '-0.04em', userSelect: 'none' }} aria-hidden="true">книга</div>
      <motion.div
        style={{ position: 'relative', maxWidth: 880, margin: '0 auto', textAlign: 'center' }}
        variants={revealVariants}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true, margin: '-80px' }}
      >
        <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 24 }}>Ранний доступ</div>
        <h2 style={{ font: '600 clamp(44px,6vw,76px)/1.02 var(--font-serif)', letterSpacing: '-0.022em', marginBottom: 24, color: 'var(--ink)' }}>
          Начните свою <em style={{ fontWeight: 500, color: 'var(--accent-2)' }}>книгу</em><br />сегодня вечером.
        </h2>
        <p style={{ font: '400 18px/1.55 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 560, margin: '0 auto 40px' }}>
          Бесплатно, без карты, без 14-дневного триала. Регистрация в три клика — и у вас открыт первый лист.
        </p>
        <div style={{ display: 'inline-flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <SpotlightButton className="btn btn--primary" style={{ height: 50, padding: '0 28px', fontSize: 15, display: 'inline-flex', alignItems: 'center' }} onClick={() => navigate('/login?tab=signup')}>
            Начать свою книгу
          </SpotlightButton>
          <Link to="/login" className="btn" style={{ height: 50, padding: '0 22px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Icon name="eye" size={15} /> Войти
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function TgIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.75 }}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function VkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.75 }}>
      <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.862-.525-2.049-1.714-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.576c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.864 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.253-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.762-.491h1.744c.525 0 .643.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.745-.576.745z"/>
    </svg>
  );
}

function LandingFooter() {
  return (
    <footer style={{ padding: 'clamp(36px,5vw,56px) clamp(20px,4vw,56px) 36px', background: 'var(--bg-void)', borderTop: '1px solid var(--border-soft)' }}>
      <div className="lnd-max">
        <div className="lnd-footer-grid">
          <div>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, textDecoration: 'none' }}>
              <LogoMark size={20} />
              <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
            </Link>
            <p style={{ font: '400 14px/1.65 var(--font-serif)', color: 'var(--ink-3)', fontStyle: 'italic', maxWidth: 340 }}>
              «Ворна исчезла за одну ночь, и никто из тех, кто жил в Терее, не желал в это верить.»{' '}
              <span style={{ fontStyle: 'normal', fontSize: 11.5, color: 'var(--ink-3)' }}>— первая фраза, написанная в Авторской студии, май 2026</span>
            </p>
          </div>
          {([
            ['Продукт', [
              { label: 'Возможности', href: '#features' },
              { label: 'Цены', href: '#pricing' },
              { label: 'Вопросы', href: '#faq' },
              { label: 'История изменений', href: '/changelog' },
            ]],
            ['Авторам', [
              { label: 'Войти', href: '/login' },
              { label: 'Создать книгу', href: '/login?tab=signup' },
            ]],
            ['Сообщество', [
              { label: 'Telegram', href: 'https://t.me/avtorstudio_app', icon: <TgIcon /> },
              { label: 'ВКонтакте', href: 'https://vk.com/avtorstudio_app', icon: <VkIcon /> },
            ]],
          ] as [string, { label: string; href: string; icon?: ReactNode }[]][]).map(([title, links]) => (
            <div key={title}>
              <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 14 }}>{title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {links.map(({ label, href, icon }) => {
                  const content = icon
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon}{label}</span>
                    : label;
                  return href.startsWith('/') ? (
                    <Link key={label} to={href} className="lnd-foot-link" style={{ fontSize: 13.5, textDecoration: 'none' }}>{content}</Link>
                  ) : href.startsWith('#') ? (
                    <a key={label} href={href} className="lnd-foot-link" style={{ fontSize: 13.5, textDecoration: 'none' }}>{content}</a>
                  ) : (
                    <a key={label} href={href} className="lnd-foot-link" style={{ fontSize: 13.5, textDecoration: 'none' }} rel="noopener noreferrer" target="_blank">{content}</a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 24, borderTop: '1px solid var(--border-soft)', font: '400 11.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.04em', flexWrap: 'wrap' }}>
          <span>© 2026 Авторская студия</span>
          <a href="https://t.me/avtorstudio_app" className="lnd-foot-icon" aria-label="Telegram" rel="noopener noreferrer" target="_blank"><TgIcon /></a>
          <a href="https://vk.com/avtorstudio_app" className="lnd-foot-icon" aria-label="ВКонтакте" rel="noopener noreferrer" target="_blank"><VkIcon /></a>
          <span>·</span>
          <Link to="/terms" className="lnd-foot-link--sub" style={{ textDecoration: 'none' }}>Соглашение</Link>
          <Link to="/privacy" className="lnd-foot-link--sub" style={{ textDecoration: 'none' }}>Конфиденциальность</Link>
          <Link to="/offer" className="lnd-foot-link--sub" style={{ textDecoration: 'none' }}>Оферта</Link>
          <span style={{ flex: 1 }} />
          <span>Самозанятый Добриев Хамзат Юсупович · ИНН 290133229106 · г. Назрань ·</span>
          <a href="mailto:hello@avtorstudio.com" className="lnd-foot-link--sub" style={{ textDecoration: 'none' }} rel="noopener noreferrer">hello@avtorstudio.com</a>
        </div>
      </div>
    </footer>
  );
}
