import { Icon } from '../components/Icon';

export default function Focus() {
  return (
    <div className="as" style={{ height: '100%', background: 'oklch(0.10 0.012 50)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: 'oklch(0.20 0.014 50 / 0.7)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-soft)', borderRadius: 999, padding: '6px 10px', opacity: 0.6 }}>
        <span style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Глава 1 · Город, которого нет</span>
        <span style={{ width: 1, height: 14, background: 'var(--border-soft)' }} />
        <span style={{ font: '400 10.5px var(--font-mono)', color: 'var(--ink-3)' }}>4 720 сл</span>
        <span style={{ width: 1, height: 14, background: 'var(--border-soft)' }} />
        <span style={{ font: '400 10.5px var(--font-mono)', color: 'var(--accent-2)' }}>● пишите</span>
      </div>
      <div style={{ position: 'absolute', top: 18, right: 18, display: 'flex', gap: 6, opacity: 0.5 }}>
        <button className="tb-btn"><Icon name="speak" size={14} /></button>
        <button className="tb-btn"><Icon name="timer" size={14} /></button>
        <button className="tb-btn" style={{ padding: '0 10px' }}>
          <span style={{ font: '400 10.5px var(--font-mono)', letterSpacing: '0.06em' }}>ESC</span>
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '80px 40px 40px', overflow: 'hidden' }}>
        <div style={{ width: 720, fontFamily: 'var(--font-serif)', color: 'oklch(0.92 0.014 85)', fontSize: 18, lineHeight: 1.85, letterSpacing: '0.005em' }}>
          <p style={{ opacity: 0.18, textIndent: 0, marginBottom: '1em' }}>Корна исчезла за одну ночь, и никто из тех, кто жил в Терее, не желал в это верить.</p>
          <p style={{ opacity: 0.30, textIndent: '1.4em', marginBottom: '1em' }}>Иней Ворон узнала об этом в архиве, на третьем этаже башни, где пахло железом и сушёным мхом.</p>
          <p style={{ opacity: 0.45, textIndent: '1.4em', marginBottom: '1em' }}>— Картограф Ворон, — сказал голос. Голос был старый и сухой, как страница. — Магистр требует вас немедленно.</p>
          <p style={{ opacity: 1, textIndent: '1.4em', marginBottom: '1em', position: 'relative' }}>
            <span style={{ position: 'absolute', left: -22, top: '0.45em', width: 4, height: '1.6em', background: 'var(--accent)', borderRadius: 2 }} />
            Магистр Терей сидел спиной к окну, и от этого его лицо казалось темнее, чем зимняя дорога. Перед ним лежало письмо, чёрные печати оттиснулись неровно, и одна сломалась пополам ещё до того, как письмо попало сюда.
            <span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--accent)', marginLeft: 1, verticalAlign: 'middle', animation: 'blink 1s infinite' }} />
          </p>
          <p style={{ opacity: 0.45, textIndent: '1.4em', marginBottom: '1em' }}>— Ты слышала про Корну? — спросил он, не глядя на неё.</p>
          <p style={{ opacity: 0.30, textIndent: '1.4em', marginBottom: '1em' }}>— Северный город. Семь тысяч жителей. Сорок два дня пути по тракту через Сольву.</p>
          <p style={{ opacity: 0.18, textIndent: '1.4em', marginBottom: '1em' }}>— Шесть тысяч девятьсот сорок четыре, — поправил магистр. — И больше нет ни одного.</p>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 14, font: '400 11px var(--font-mono)', color: 'var(--ink-4)', opacity: 0.6 }}>
        <span>фокус-режим · typewriter</span>
        <span style={{ flex: 1 }} />
        <svg width="120" height="14" viewBox="0 0 120 14">
          <rect x="0" y="6" width="120" height="2" fill="var(--surface-2)" />
          <rect x="0" y="6" width="42" height="2" fill="var(--accent)" />
        </svg>
        <span style={{ color: 'var(--accent)' }}>348/1000</span>
      </div>
    </div>
  );
}
