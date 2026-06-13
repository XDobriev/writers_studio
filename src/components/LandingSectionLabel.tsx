import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

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

export function SectionLabel({ kicker, title, subtitle, align = 'left' }: { kicker?: string; title: string; subtitle?: string; align?: 'left' | 'center' }) {
  const kickerRef = useRef<HTMLDivElement>(null);
  const kickerInView = useInView(kickerRef, { once: true, margin: '-40px' });
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
