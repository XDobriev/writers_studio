import { type ComponentProps, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getLifetimeSlotsRemaining } from '../lib/profiles';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/LogoMark';

type IName = ComponentProps<typeof Icon>['name'];

// ─── Animation hooks ──────────────────────────────────────────────────────────

function useInViewOnce(threshold = 0.5) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function useScramble(text: string, trigger: boolean): string {
  const [display, setDisplay] = useState(text);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!trigger || reduced) { setDisplay(text); return; }
    const start = performance.now();
    const tick = (now: number) => {
      if (now - start >= 200) { setDisplay(text); return; }
      setDisplay(text.split('').map(c => (c === ' ' || c === '·') ? c : SCRAMBLE_CHARS[Math.floor(Math.random() * 26)]).join(''));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trigger, text]);
  return display;
}

function useCounter(target: number, active: boolean, duration = 1200): number {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [value, setValue] = useState(prefersReduced ? target : 0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!active || prefersReduced) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, target, duration, prefersReduced]);
  return value;
}

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

  useEffect(() => {
    const els = document.querySelectorAll<Element>('.lnd-reveal');
    if (!els.length) return;
    const reveal = (el: Element) => {
      el.classList.add('lnd-visible');
      if (el.classList.contains('lnd-manifesto-row')) el.classList.add('lnd-line-reveal');
    };
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } }),
      { threshold: 0.08 }
    );
    els.forEach(el => io.observe(el));
    const fallback = window.setTimeout(() => {
      document.querySelectorAll<Element>('.lnd-reveal:not(.lnd-visible)').forEach(reveal);
    }, 4000);
    return () => { io.disconnect(); clearTimeout(fallback); };
  }, []);

  if (session) return <Navigate to="/books" replace />;

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes lnd-fade-up { from{opacity:0;transform:translateY(44px)} to{opacity:1;transform:translateY(0)} }
          @keyframes lnd-slide-left  { from{opacity:0;transform:translateX(-36px)} to{opacity:1;transform:none} }
          @keyframes lnd-slide-right { from{opacity:0;transform:translateX( 36px)} to{opacity:1;transform:none} }
        }
        .lnd-reveal { opacity: 0; }
        @media (prefers-reduced-motion: no-preference) {
          .lnd-reveal { transform: translateY(44px); }
          .lnd-reveal.lnd-visible { animation: lnd-fade-up 0.55s cubic-bezier(0.16,1,0.3,1) forwards; }
          .lnd-reveal.lnd-visible.d1 { animation-delay: 0.1s; }
          .lnd-reveal.lnd-visible.d2 { animation-delay: 0.2s; }
          .lnd-reveal.lnd-visible.d3 { animation-delay: 0.3s; }
          .lnd-feat-row.lnd-reveal { opacity: 1; transform: none; animation: none; }
          .lnd-feat-row .lnd-text { opacity: 0; transform: translateX(-36px); }
          .lnd-feat-row .lnd-mock { opacity: 0; transform: translateX( 36px); }
          .lnd-feat-row--rev .lnd-text { transform: translateX( 36px); }
          .lnd-feat-row--rev .lnd-mock { transform: translateX(-36px); }
          .lnd-feat-row.lnd-visible .lnd-text { animation: lnd-slide-left  0.65s cubic-bezier(0.16,1,0.3,1) both; }
          .lnd-feat-row.lnd-visible .lnd-mock { animation: lnd-slide-right 0.65s cubic-bezier(0.16,1,0.3,1) 0.12s both; }
          .lnd-feat-row--rev.lnd-visible .lnd-text { animation: lnd-slide-right 0.65s cubic-bezier(0.16,1,0.3,1) both; }
          .lnd-feat-row--rev.lnd-visible .lnd-mock { animation: lnd-slide-left  0.65s cubic-bezier(0.16,1,0.3,1) 0.12s both; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lnd-reveal { opacity: 1; transform: none; }
          .lnd-feat-row .lnd-text,
          .lnd-feat-row .lnd-mock { opacity: 1; transform: none; }
        }
        .lnd-price-card--accent { transform: translateY(-8px); }
        .lnd-sheet-float { /* base tilt lives on js-controlled wrapper */ }
        .faq-chevron.open { transform: rotate(180deg); }
        @media (prefers-reduced-motion: no-preference) {
          @keyframes lnd-hero-in { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:none} }
          .lnd-hero-el { animation: lnd-hero-in 0.65s cubic-bezier(0.16,1,0.3,1) backwards; }
          .lnd-hero-el.h2 { animation-delay: 0.2s; }
          @keyframes lnd-word-in { from{transform:translateY(105%)} to{transform:translateY(0)} }
          .lnd-word-inner { display:inline-block; animation: lnd-word-in 0.72s cubic-bezier(0.16,1,0.3,1) backwards; }
          .lnd-hero-el.h3 { animation-delay: 0.35s; }
          .lnd-hero-el.h4 { animation-delay: 0.5s; }
          @keyframes lnd-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
          .lnd-sheet-float { animation: lnd-float 7s ease-in-out infinite; }
          @keyframes lnd-note-in { from{opacity:0;transform:translateY(10px) scale(0.94)} to{opacity:1;transform:none} }
          .lnd-note-in { animation: lnd-note-in 0.5s cubic-bezier(0.16,1,0.3,1) backwards; }
          .lnd-note-in.n1 { animation-delay: 0.55s; }
          .lnd-note-in.n2 { animation-delay: 0.75s; }
          .faq-chevron { transition: transform 0.22s cubic-bezier(0.16,1,0.3,1); }
          .faq-body { transition: height 0.3s cubic-bezier(0.16,1,0.3,1); }
          .lnd-browser-mock { transition: transform 0.22s cubic-bezier(0.16,1,0.3,1); }
          .lnd-browser-mock:hover { transform: translateY(-4px); }
          .lnd-price-card { transition: transform 0.22s cubic-bezier(0.16,1,0.3,1); }
          .lnd-price-card:hover { transform: translateY(-4px); }
          .lnd-price-card--accent:hover { transform: translateY(-12px); }
        }
        .lnd-max { max-width: 1300px; margin: 0 auto; }
        .lnd-hero-grid { display: grid; grid-template-columns: 1.05fr 1.15fr; gap: 64px; align-items: center; }
        .lnd-feat-row { display: grid; grid-template-columns: 0.95fr 1.15fr; gap: 80px; align-items: center; padding: 72px 0; border-top: 1px solid var(--border-soft); }
        .lnd-feat-row--rev .lnd-text { order: 2; }
        .lnd-feat-row--rev .lnd-mock { order: 1; }
        .lnd-bullets { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; max-width: 480px; }
        .lnd-proc { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; position: relative; }
        .lnd-proc::before { content:''; position:absolute; top:24px; left:12.5%; right:12.5%; height:1px; background:var(--border); }
        .lnd-prices { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1100px; margin: 0 auto; }
        .lnd-nav-links { display: flex; gap: 28px; font-size: 13.5px; color: var(--ink-2); }
        .lnd-manifesto { display: flex; flex-direction: column; }
        .lnd-manifesto-row { display: grid; grid-template-columns: 52px 1fr; gap: 40px; padding: 36px 0; align-items: start; position: relative; }
        .lnd-manifesto-row::before { content: ''; position: absolute; top: 0; left: 0; height: 1px; background: var(--border-soft); width: 100%; }
        @media (prefers-reduced-motion: no-preference) {
          .lnd-manifesto-row::before { width: 0; transition: width 0.5s ease; }
          .lnd-manifesto-row.lnd-line-reveal::before { width: 100%; }
        }
        .lnd-footer-grid { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 48px; margin-bottom: 40px; }
        @media (max-width: 1023px) {
          .lnd-hero-grid { grid-template-columns: 1fr; }
          .lnd-hero-sheet { display: none; }
          .lnd-feat-row { grid-template-columns: 1fr; gap: 40px; padding: 48px 0; }
          .lnd-feat-row--rev .lnd-text { order: 1; }
          .lnd-feat-row--rev .lnd-mock { order: 2; }
          .lnd-prices { grid-template-columns: 1fr; }
          .lnd-proc { grid-template-columns: repeat(2, 1fr); }
          .lnd-proc::before { display: none; }
          .lnd-nav-links { display: none; }
          .lnd-footer-grid { grid-template-columns: 1fr 1fr; gap: 28px; }
        }
        @media (max-width: 639px) {
          .lnd-bullets { grid-template-columns: 1fr; }
          .lnd-proc { grid-template-columns: 1fr; }
          .lnd-manifesto-row { grid-template-columns: 40px 1fr; gap: 20px; padding: 28px 0; }
        }
        @media (max-width: 479px) {
          .lnd-footer-grid { grid-template-columns: 1fr; }
        }
        .lnd-hero-mobile-card { display: none; }
        @media (max-width: 1023px) {
          .lnd-hero-mobile-card { display: block; margin-top: 40px; border-radius: 8px; overflow: hidden; box-shadow: 0 8px 32px oklch(0 0 0 / 0.45); }
          .lnd-hero-text { max-width: 640px; }
        }
      `}</style>
      <LandingNav />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingProcess />
        <LandingPrinciples />
        <LandingPricing />
        <LandingFAQ />
        <LandingCTA />
      </main>
      <LandingFooter />
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
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
      padding: 'clamp(14px,2vw,18px) clamp(20px,4vw,56px)',
      display: 'flex', alignItems: 'center', gap: 16,
      background: scrolled ? 'var(--bg-deep)' : 'transparent',
      borderBottom: `1px solid ${scrolled ? 'var(--border-soft)' : 'transparent'}`,
      transition: 'background 0.25s ease-out, border-color 0.25s ease-out',
    }}>
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
      <Link to="/login?tab=signup" className="btn btn--primary" style={{ height: 34, padding: '0 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Начать писать</Link>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function LandingHero() {
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
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'linear-gradient(oklch(0.95 0.01 80) 1px,transparent 1px),linear-gradient(90deg,oklch(0.95 0.01 80) 1px,transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none' }} />
      <div className="lnd-max" style={{ position: 'relative' }}>
        <div className="lnd-hero-grid">
          <div className="lnd-hero-text">
            <div className="lnd-hero-el" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 999, marginBottom: 28 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
              <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>Открытая бета · 2026</span>
            </div>
            <h1 style={{ font: '600 clamp(52px,6vw,88px)/0.98 var(--font-serif)', letterSpacing: '-0.025em', marginBottom: 28, color: 'var(--ink)' }}>
              <span style={{ display:'inline-block', overflow:'hidden', verticalAlign:'bottom', paddingBottom:'0.12em', marginBottom:'-0.12em' }}>
                <span className="lnd-word-inner" style={{ animationDelay:'0.08s' }}>Здесь</span>
              </span>
              {' '}
              <span style={{ display:'inline-block', overflow:'hidden', verticalAlign:'bottom', paddingBottom:'0.12em', marginBottom:'-0.12em' }}>
                <span className="lnd-word-inner" style={{ animationDelay:'0.14s' }}>пишете</span>
              </span>
              <br />
              <em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--accent-2)' }}>
                <span style={{ display:'inline-block', overflow:'hidden', verticalAlign:'bottom', paddingBottom:'0.12em', marginBottom:'-0.12em' }}>
                  <span className="lnd-word-inner" style={{ animationDelay:'0.20s', animationDuration:'0.88s' }}>только</span>
                </span>
                {' '}
                <span style={{ display:'inline-block', overflow:'hidden', verticalAlign:'bottom', paddingBottom:'0.12em', marginBottom:'-0.12em' }}>
                  <span className="lnd-word-inner" style={{ animationDelay:'0.26s', animationDuration:'0.88s' }}>вы</span>
                </span>
              </em>
              .
            </h1>
            <p className="lnd-hero-el h2" style={{ font: '400 clamp(16px,1.5vw,19px)/1.6 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 520, marginBottom: 36 }}>
              Рукопись, картотека персонажей, карта мира и хронология — в одном чистом редакторе. Без нейросети, которая дописывает за вас.
            </p>
            <div className="lnd-hero-el h3" style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 36, flexWrap: 'wrap' }}>
              <Link to="/login?tab=signup" className="btn btn--primary" style={{ height: 46, padding: '0 22px', fontSize: 14.5, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                Начать свою книгу
              </Link>
            </div>
            <div className="lnd-hero-el h4" style={{ paddingTop: 24, borderTop: '1px solid var(--border-soft)' }}>
              <p style={{ font: '400 14px/1.6 var(--font-serif)', color: 'var(--ink-3)', maxWidth: 420, margin: 0 }}>
                Открытая бета: все функции без ограничений, без привязки карты.
              </p>
            </div>
            <div className="lnd-hero-mobile-card" aria-hidden="true">
              <div style={{ background: 'var(--paper)', padding: '24px 28px', color: 'var(--paper-ink)', fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.8 }}>
                <div style={{ font: '500 9.5px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--paper-ink-2)', marginBottom: 8 }}>Глава первая</div>
                <div style={{ font: '600 22px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 12, color: 'var(--paper-ink)' }}>Город, которого нет</div>
                <div style={{ width: 24, height: 1, background: 'var(--paper-ink)', opacity: 0.25, marginBottom: 16 }} />
                <p style={{ margin: '0 0 0.8em' }}>Ворна исчезла за одну ночь, и никто из тех, кто жил в Тереее, не желал в это верить.</p>
                <p style={{ margin: 0, textIndent: '1.4em', color: 'var(--paper-ink-2)' }}>Аней Ворон узнала об этом в архиве, на третьем этаже башни, где пахло железом и устым мхом…</p>
              </div>
            </div>
          </div>
          <div className="lnd-hero-sheet" style={{ position: 'relative', height: 540 }} aria-hidden="true">
            <FloatingSheet tiltRef={tiltRef} />
            <div style={{ position: 'absolute', top: 54, right: -16, width: 200, transform: 'rotate(2deg)' }}>
              <div className="lnd-note-in n1" style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 12px', boxShadow: '0 10px 30px oklch(0 0 0 / 0.35)' }}>
                <div style={{ font: '500 9.5px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 5 }}>Идея · 5 мин</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.45 }}>Сделать упоминание матери Аней в начале — отзеркалит финал.</div>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 32, left: -22, width: 190, transform: 'rotate(-1.5deg)' }}>
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
          <p style={{ margin: '0 0 0.9em' }}>Ворна исчезла за одну ночь, и никто из тех, кто жил в Тереее, не желал в это верить.</p>
          <p style={{ margin: '0 0 0.9em', textIndent: '1.4em' }}>Аней Ворон узнала об этом в архиве, на третьем этаже башни, где пахло железом и устым мхом. <span style={{ background: 'oklch(0.84 0.13 90 / 0.45)', padding: '1px 2px', borderRadius: 2 }}>Она перечерчивала контуры озера, которого никогда не видела</span>, когда чьи-то шаги остановились за её спиной.</p>
          <p style={{ margin: '0 0 0.9em', textIndent: '1.4em' }}>— Картограф Ворон, — сказал голос. Голос был старый и строгий, как страница. — Магистр требует вас немедленно.</p>
          <p style={{ margin: 0, textIndent: '1.4em' }}>Аней не подняла голову. Кисть вела мягкую кривую — северный край озера, мнимый, но обязательный для атласа.<span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--accent)', marginLeft: 1, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} /></p>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function SectionLabel({ kicker, title, subtitle, align = 'left' }: { kicker?: string; title: string; subtitle?: string; align?: 'left' | 'center' }) {
  const [kickerRef, kickerInView] = useInViewOnce();
  const scrambledKicker = useScramble(kicker ?? '', kickerInView);
  const c = align === 'center';
  return (
    <div style={{ marginBottom: 80, ...(c ? { textAlign: 'center', margin: '0 auto 80px', maxWidth: 780 } : { maxWidth: 780 }) }}>
      {kicker && <div ref={kickerRef} style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 18 }}>{scrambledKicker}</div>}
      <h2 style={{ font: '600 clamp(32px,4vw,56px)/1.05 var(--font-serif)', letterSpacing: '-0.018em', marginBottom: 16, color: 'var(--ink)' }}>{title}</h2>
      {subtitle && <p style={{ font: '400 17px/1.6 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 640, ...(c ? { margin: '0 auto' } : {}) }}>{subtitle}</p>}
    </div>
  );
}

function LandingFeatures() {
  return (
    <section id="features" style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg)' }}>
      <div className="lnd-max">
        <SectionLabel kicker="Возможности" title="Студия, а не текстовое поле." subtitle="Каждая часть книги живёт рядом с рукописью в этом онлайн-редакторе для писателей на русском языке — не в отдельном приложении, не на отдельной вкладке. Открыли главу — видите её мир." />
        <FeatureRow eyebrow="Редактор" headline="Четыре режима. Один редактор." body="Полная студия с заметками и оглавлением — для редактуры. Только страница — для черновика. Промежуточные режимы — для всего, что между. Состояние помнит, на каком вы остановились." bullets={[['layout','Студия','все панели открыты'],['panel','Сайдбар','только оглавление'],['note','Полей','только заметки'],['focus','Страница','только текст']]} mock={<MockEditorModes />} />
        <FeatureRow reverse eyebrow="Структура" headline="Книга как картотека. Не как длинный документ." body="Перетаскивайте главы и сцены. Смотрите доску с карточками или дерево с целями по словам. Любая глава — двойной клик и она открыта." bullets={[['layout','Outline','дерево частей и сцен'],['grid','Corkboard','индексные карточки'],['tree','Списком','плоский список'],['arrows','Drag-ord','перетаскивание']]} mock={<MockCorkboard />} />
        <FeatureRow eyebrow="Мир книги" headline="Весь мир книги — рядом с главой." body="Всё что нужно автору длинной формы — без выхода из проекта. Локации и события привязаны к главам, в которых упоминаются. Свяжите персонажа с главой — он автоматически появится в её обзоре." bullets={[['map','Карта мира','пины + районы'],['clock','Хронология','события и эпохи'],['char','Персонажи','связи + появления'],['link','Привязки','к главам']]} mock={<MockWorld />} />
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
  const [eyebrowRef, eyebrowInView] = useInViewOnce();
  const scrambledEyebrow = useScramble(eyebrow, eyebrowInView);
  return (
    <div className={`lnd-feat-row${reverse ? ' lnd-feat-row--rev' : ''} lnd-reveal`}>
      <div className="lnd-text">
        <div ref={eyebrowRef} style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 18 }}>{scrambledEyebrow}</div>
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
      <div className="lnd-mock" aria-hidden="true">
        <BrowserMock>{mock}</BrowserMock>
      </div>
    </div>
  );
}

function BrowserMock({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark">
    <div className="lnd-browser-mock" style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-deep)', border: '1px solid var(--border)', boxShadow: '0 0 0 1px var(--border), 0 24px 72px oklch(0 0 0 / 0.55), 0 0 56px oklch(0.63 0.16 30 / 0.07)' }}>
      <div style={{ height: 32, background: 'oklch(0.20 0.014 50)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6, borderBottom: '1px solid var(--border-soft)' }}>
        <span style={{ width: 11, height: 11, borderRadius: 999, background: 'oklch(0.62 0.16 25)' }} />
        <span style={{ width: 11, height: 11, borderRadius: 999, background: 'oklch(0.78 0.12 80)' }} />
        <span style={{ width: 11, height: 11, borderRadius: 999, background: 'oklch(0.66 0.14 145)' }} />
        <span style={{ flex: 1, textAlign: 'center', font: '400 11px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em' }}>avtorstudio.com</span>
      </div>
      <div style={{ height: 380, position: 'relative', overflow: 'hidden' }}>{children}</div>
    </div>
    </div>
  );
}

function MockEditorModes() {
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '1fr 1.8fr 1fr', background: 'var(--bg)' }}>
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
  const [containerRef, inView] = useInViewOnce(0.3);
  const words = useCounter(21540, inView);
  const days = useCounter(7, inView);
  const workDays = useCounter(48, inView);
  const fmtWords = (n: number) => n < 1000 ? String(n) : `${Math.floor(n / 1000)} ${String(n % 1000).padStart(3, '0')}`;

  const cells = Array.from({ length: 14 * 7 }, (_, i) => {
    const w = Math.floor(i / 7), d = i % 7;
    if (w < 2 && d < 4) return 0;
    const r = Math.sin((w * 7 + d) * 0.7) + Math.cos(w * 0.3 + d);
    if (r > 1.2) return 4; if (r > 0.4) return 3; if (r > -0.2) return 2; if (r > -0.9) return 1; return 0;
  });
  const hc = (v: number) => (['var(--surface-2)', 'oklch(0.40 0.10 30)', 'oklch(0.50 0.13 30)', 'oklch(0.58 0.15 30)', 'var(--accent)'] as const)[v];
  return (
    <div ref={containerRef} style={{ height: '100%', padding: 24, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {([
          [fmtWords(words), 'слов', '+348'],
          [String(days), 'дней подряд', 'серия'],
          [String(workDays), 'рабочих дней', 'из 184'],
        ] as [string, string, string][]).map(([v, l, d], i) => (
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
    { n: 2, t: 'Напишите главу', s: 'Форматирование без отвлечений, автосохранение каждые несколько секунд, версии глав. Заметки на полях — прямо рядом с абзацем.', tag: 'Письмо' },
    { n: 3, t: 'Соберите мир', s: 'Привяжите персонажа к главе — он появится в её обзоре. Поставьте пин на карте, поместите событие на хронологию. Всё связано.', tag: 'Мир' },
    { n: 4, t: 'Отдайте книгу', s: 'Экспорт в EPUB, FB2 или DOCX. С титульной страницей, оглавлением, опционально — со списком персонажей в конце книги.', tag: 'Финал' },
  ];
  return (
    <section id="process" style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg-deep)', borderTop: '1px solid var(--border-soft)' }}>
      <div className="lnd-max">
        <SectionLabel title="От пустого листа до экспорта." subtitle="Каждый шаг — на своём месте. Не нужно жонглировать четырьмя приложениями и папками с файлами." />
        <div className="lnd-proc">
          {steps.map((s, i) => (
            <div key={s.n} className={`lnd-reveal d${i}`} style={{ position: 'relative' }}>
              <div style={{ width: 48, height: 48, borderRadius: 999, background: 'var(--bg-deep)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '600 18px var(--font-mono)', color: 'var(--accent)', marginBottom: 22, position: 'relative', zIndex: 1 }}>
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

// ─── Principles ───────────────────────────────────────────────────────────────

const PRINCIPLES = [
  {
    title: 'Студия не пишет за вас',
    body: 'Никакого автодополнения, «улучши абзац», генерации текста. Всё написанное — ваше.',
  },
  {
    title: 'Всё рядом с рукописью',
    body: 'Переключение контекста — главный враг длинного текста. Поэтому карта, персонажи и хронология открываются рядом с той главой, которую вы пишете.',
  },
  {
    title: 'Серия молчит',
    body: 'Трекер считает дни подряд. Но не пишет «вы не открывали студию 4 дня» и не гасит полосу.',
  },
  {
    title: 'Ваши книги — ваши',
    body: 'Перестали платить — данные остаются. Экспорт всегда доступен. Рукописи не в заложниках.',
  },
];

function LandingPrinciples() {
  return (
    <section style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg)' }}>
      <div className="lnd-max">
        <div style={{ marginBottom: 64, maxWidth: 640 }}>
          <h2 style={{ font: '600 clamp(32px,4vw,56px)/1.05 var(--font-serif)', letterSpacing: '-0.018em', marginBottom: 16, color: 'var(--ink)' }}>
            Принципы, не обещания.
          </h2>
          <p style={{ font: '400 17px/1.6 var(--font-serif)', color: 'var(--ink-2)', margin: 0 }}>
            Четыре решения, принятые до первой строчки кода.
          </p>
        </div>
        <div className="lnd-manifesto">
          {PRINCIPLES.map((p, i) => (
            <div key={p.title} className={`lnd-manifesto-row lnd-reveal d${Math.min(i, 3)}`}>
              <div style={{ font: '600 clamp(28px,3vw,40px)/1 var(--font-serif)', color: 'var(--accent)', letterSpacing: '-0.02em', paddingTop: 6 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <h3 style={{ font: '600 clamp(20px,2.5vw,28px)/1.15 var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.012em', marginBottom: 10 }}>{p.title}</h3>
                <p style={{ font: '400 15px/1.65 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 620, margin: 0 }}>{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function LandingPricing() {
  const [lifetimeSlots, setLifetimeSlots] = useState<number | null>(null);

  useEffect(() => {
    getLifetimeSlotsRemaining().then((slots) => {
      if (slots !== null) setLifetimeSlots(slots);
    });
  }, []);

  const slotsLabel = lifetimeSlots !== null ? `${lifetimeSlots}` : '…';

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
      cta: 'Начать бесплатно', accent: false, tag: null, signup: true,
    },
    {
      name: 'Pro', price: '290 ₽', sub: 'в месяц · или 2 900 ₽/год',
      summary: 'Если у вас больше одной книги или нужны версии глав и полный экспорт.',
      features: [
        ['История снимков глав — rollback', true],
        ['Экспорт EPUB и DOCX (в разработке)', true],
        ['Безлимит книг и проектов', true],
        ['Дэшборд · heatmap · серия дней', true],
        ['Все инструменты без ограничений', true],
        ['Приоритетная поддержка', true],
        ['Доступ к закрытому чату автора', true],
      ] as [string, boolean][],
      cta: 'Перейти на Pro', accent: true, tag: 'Чаще выбирают', signup: true,
    },
    {
      name: 'Lifetime', price: '4 900 ₽', sub: 'один раз · навсегда',
      summary: `Разовая оплата. Все обновления Pro — на всю жизнь. Осталось ${slotsLabel} мест.`,
      features: [
        ['Всё из тарифа Pro', true],
        ['Все будущие обновления', true],
        ['Никаких подписок', true],
        ['Приоритетная поддержка', true],
        ['Имя в титрах беты', true],
        ['Закрытое сообщество авторов', true],
        [`Только первые 50 покупателей`, true],
      ] as [string, boolean][],
      cta: 'Купить Lifetime', accent: false, tag: `${slotsLabel} мест · ранний доступ`, signup: true,
    },
  ];

  // Скрываем Lifetime если слоты закончились (0)
  const visibleTiers = lifetimeSlots === 0 ? tiers.filter(t => t.name !== 'Lifetime') : tiers;

  return (
    <section id="pricing" style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg-deep)', borderTop: '1px solid var(--border-soft)' }}>
      <div className="lnd-max">
        <SectionLabel align="center" kicker="Тарифы" title="Начните бесплатно." subtitle="Бесплатный план — не «триал на 14 дней». Одна книга, навсегда, без ограничений по времени." />
        <div className="lnd-prices">
          {visibleTiers.map((t) => (
            <div key={t.name} className="lnd-reveal">
              <div className={`lnd-price-card${t.accent ? ' lnd-price-card--accent' : ''}`} style={{ position: 'relative', background: t.accent ? 'var(--surface)' : 'var(--bg)', border: t.accent ? '1px solid var(--accent)' : '1px solid var(--border-soft)', borderRadius: 14, padding: '32px 28px 28px', display: 'flex', flexDirection: 'column', boxShadow: t.accent ? '0 20px 60px oklch(0 0 0 / 0.3),0 0 0 4px var(--accent-soft)' : 'none' }}>
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
              <Link to={t.signup ? '/login?tab=signup' : '/login'} className={t.accent ? 'btn btn--primary' : 'btn'} style={{ height: 42, fontSize: 14, justifyContent: 'center', width: '100%', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>{t.cta}</Link>
              {t.name !== 'Free' && (
                <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--ink-4)', textAlign: 'center', lineHeight: 1.5 }}>
                  Нажимая кнопку, вы соглашаетесь с{' '}
                  <Link to="/offer" style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>условиями оферты</Link>
                </p>
              )}
            </div>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: 'var(--ink-3)' }}>
          <span style={{ color: 'var(--ink-2)' }}>Возврат — 14 дней без вопросов.</span>
        </p>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FAQItem({ q, a, index, defaultOpen = false }: { q: string; a: string; index: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [height, setHeight] = useState(defaultOpen ? 'auto' : '0px');
  const bodyRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const el = bodyRef.current;
    if (!el) return;
    if (open) {
      setHeight(el.scrollHeight + 'px');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setHeight('0px');
        setOpen(false);
      }));
    } else {
      setOpen(true);
      setHeight(el.scrollHeight + 'px');
    }
  };

  const onTransitionEnd = () => {
    if (open) setHeight('auto');
  };

  return (
    <div style={{ borderTop: '1px solid var(--border-soft)', padding: '24px 0' }}>
      <button
        onClick={toggle}
        style={{ display: 'flex', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', alignItems: 'flex-start', gap: 16 }}
      >
        <span style={{ font: '500 13px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 4, flexShrink: 0 }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <span style={{ flex: 1, font: '500 19px var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.005em' }}>{q}</span>
        <span className={`faq-chevron${open ? ' open' : ''}`} style={{ color: 'var(--ink-3)', marginTop: 6, flexShrink: 0 }}>
          <Icon name="chevd" size={16} />
        </span>
      </button>
      <div
        ref={bodyRef}
        className="faq-body"
        style={{ overflow: 'hidden', height }}
        onTransitionEnd={onTransitionEnd}
      >
        <p style={{ font: '400 15px/1.65 var(--font-serif)', color: 'var(--ink-2)', marginTop: 14, paddingLeft: 42, maxWidth: 680 }}>{a}</p>
      </div>
    </div>
  );
}

function LandingFAQ() {
  const items = [
    { q: 'Это нейросеть пишет за меня?', a: 'Нет. Авторская студия — это редактор и хранилище материалов книги. Никакого автодополнения, генерации абзацев и «исправь стиль» по умолчанию. Если когда-нибудь добавим — это будет отдельный режим с явным выключателем.' },
    { q: 'Что будет, если я перестану платить?', a: 'Все ваши книги остаются. Доступ к Pro-функциям отключается, но вы продолжаете писать в Free-режиме на той книге, которую укажете главной. Никто не блокирует и не удаляет файлы.' },
    { q: 'Можно ли импортировать рукопись из Word или Scrivener?', a: 'Прямого импорта пока нет. Вставьте текст напрямую в редактор или разбейте на главы вручную — это занимает несколько минут. Импорт из DOCX добавим в следующих версиях.' },
    { q: 'Хранятся ли мои книги в облаке?', a: 'Да, в защищённой облачной базе данных с шифрованием. Доступ только у вас — через email или Google. В любой момент можно скачать полный экспорт рукописи.' },
    { q: 'Я пишу не роман — поэзия / нон-фикшн / сценарий. Подойдёт?', a: 'Поэзия и эссеистика — да, без оговорок. Нон-фикшн — да, особенно если он структурный (главы, разделы). Сценарии — пока нет специальной разметки Fountain / Final Draft, на дорожной карте.' },
    { q: 'Если я нашёл баг или хочу фичу?', a: 'Напишите в issues на GitHub или на почту — ответ обычно в течение суток. Pro-подписчики попадают в Telegram-чат с разработчиком напрямую.' },
  ];
  return (
    <section id="faq" style={{ padding: 'clamp(80px,10vw,120px) clamp(20px,4vw,56px)', background: 'var(--bg)' }}>
      <div className="lnd-max" style={{ maxWidth: 920 }}>
        <SectionLabel title="Что обычно спрашивают." />
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
  const decoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = decoRef.current;
    if (!el) return;
    const onScroll = () => {
      el.style.transform = `translateY(calc(-50% + ${window.scrollY * 0.25}px)) rotate(-8deg)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section style={{ padding: 'clamp(100px,12vw,140px) clamp(20px,4vw,56px)', background: 'var(--bg-deep)', borderTop: '1px solid var(--border-soft)', position: 'relative', overflow: 'hidden' }}>
      <div ref={decoRef} style={{ position: 'absolute', right: -100, top: '50%', transform: 'translateY(-50%) rotate(-8deg)', font: '600 280px/1 var(--font-serif)', color: 'var(--surface-2)', opacity: 0.4, pointerEvents: 'none', letterSpacing: '-0.04em', userSelect: 'none' }} aria-hidden="true">книга</div>
      <div className="lnd-reveal" style={{ position: 'relative', maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 24 }}>Открытая бета</div>
        <h2 style={{ font: '600 clamp(44px,6vw,76px)/1.02 var(--font-serif)', letterSpacing: '-0.022em', marginBottom: 24, color: 'var(--ink)' }}>
          Начните свою <em style={{ fontWeight: 500, color: 'var(--accent-2)' }}>книгу</em><br />сегодня вечером.
        </h2>
        <p style={{ font: '400 18px/1.55 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 560, margin: '0 auto 40px' }}>
          Бесплатно, без карты, без 14-дневного триала. Регистрация в три клика — и у вас открыт первый лист.
        </p>
        <div style={{ display: 'inline-flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/login?tab=signup" className="btn btn--primary" style={{ height: 50, padding: '0 28px', fontSize: 15, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Создать книгу</Link>
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
    <footer style={{ padding: 'clamp(36px,5vw,56px) clamp(20px,4vw,56px) 36px', background: 'var(--bg-void)', borderTop: '1px solid var(--border-soft)' }}>
      <div className="lnd-max">
        <div className="lnd-footer-grid">
          <div>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, textDecoration: 'none' }}>
              <LogoMark size={20} />
              <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
            </Link>
            <p style={{ font: '400 14px/1.65 var(--font-serif)', color: 'var(--ink-3)', fontStyle: 'italic', maxWidth: 340 }}>
              «Ворна исчезла за одну ночь, и никто из тех, кто жил в Тереее, не желал в это верить.»{' '}
              <span style={{ fontStyle: 'normal', fontSize: 11.5, color: 'var(--ink-4)' }}>— первая фраза, написанная в Авторской студии, май 2026</span>
            </p>
          </div>
          {([
            ['Продукт', [
              { label: 'Возможности', href: '#features' },
              { label: 'Цены', href: '#pricing' },
            ]],
            ['Авторам', [
              { label: 'Войти', href: '/login' },
              { label: 'Создать книгу', href: '/login?mode=register' },
              { label: 'FAQ', href: '#faq' },
            ]],
            ['Студия', [
              { label: 'Контакты', href: 'mailto:frfrancuz@gmail.com' },
              { label: 'GitHub', href: 'https://github.com/XDobriev/writers_studio' },
            ]],
          ] as [string, { label: string; href: string }[]][]).map(([title, links]) => (
            <div key={title}>
              <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 14 }}>{title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {links.map(({ label, href }) => (
                  href.startsWith('/') ? (
                    <Link key={label} to={href} style={{ fontSize: 13.5, color: 'var(--ink-2)', textDecoration: 'none' }}>{label}</Link>
                  ) : (
                    <a key={label} href={href} style={{ fontSize: 13.5, color: 'var(--ink-2)', textDecoration: 'none' }} rel="noopener noreferrer">{label}</a>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 24, borderTop: '1px solid var(--border-soft)', font: '400 11.5px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.04em', flexWrap: 'wrap' }}>
          <span>© 2026 Авторская студия</span>
          <span>·</span>
          <Link to="/terms" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Соглашение</Link>
          <Link to="/privacy" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Конфиденциальность</Link>
          <Link to="/offer" style={{ color: 'var(--ink-4)', textDecoration: 'none' }}>Оферта</Link>
          <span style={{ flex: 1 }} />
          <span>Самозанятый Добриев Хамзат Юсупович · ИНН 290133229106 · г. Назрань ·</span>
          <a href="mailto:frfrancuz@gmail.com" style={{ color: 'var(--ink-4)', textDecoration: 'none' }} rel="noopener noreferrer">frfrancuz@gmail.com</a>
        </div>
      </div>
    </footer>
  );
}
