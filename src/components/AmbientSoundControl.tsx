import { useEffect, useRef, useState } from 'react';
import { SOUNDS, selectSound, setAmbientVolume, stopAmbientSound, useAmbientSound } from '../lib/ambientSound';
import { useDropdownPosition } from '../lib/useDropdownPosition';

interface AmbientSoundControlProps {
  variant?: 'status' | 'focus';
}

// Кнопка «Фоновые звуки» с попапом: выбор звука, громкость, стоп. Состояние плеера — в
// lib/ambientSound (переживает смену страницы); здесь только UI. `status` — иконка в StatusBar,
// `focus` — кнопка в шапке /focus.
export function AmbientSoundControl({ variant = 'status' }: AmbientSoundControlProps) {
  const { activeSound, isPlaying, volume } = useAmbientSound();
  const [popupOpen, setPopupOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // .status прокручивается по X (overflow) — absolute-попап внутри него обрезается.
  const popupPos = useDropdownPosition(wrapperRef, popupOpen ? 'sound' : null);

  useEffect(() => {
    if (!popupOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popupOpen]);

  const isActive = popupOpen || isPlaying;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={() => setPopupOpen(o => !o)}
        title="Фоновые звуки"
        aria-label="Фоновые звуки"
        aria-expanded={popupOpen}
        className={variant === 'focus' ? 'ambient-btn--focus' : 'status-icon-btn'}
        style={{ color: isActive ? 'var(--accent)' : 'var(--ink-3)' }}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
          <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
          <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
        </svg>
      </button>
      {popupOpen && popupPos && (
        <div style={{
          ...popupPos,
          width: 220,
          background: 'var(--surface)',
          border: '1px solid var(--border-soft)',
          borderRadius: 8,
          padding: '10px 12px',
          boxShadow: '0 4px 16px oklch(0 0 0 / 0.12)',
          animation: 'dropdown-in 0.12s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {SOUNDS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectSound(s.id)}
                aria-pressed={activeSound === s.id}
                className="note-kind-chip"
                style={{
                  font: '400 12px var(--font-ui)',
                  padding: '3px 10px',
                  borderRadius: 999,
                  border: activeSound === s.id ? '1.5px solid var(--accent)' : '1px solid var(--border-soft)',
                  color: activeSound === s.id ? 'var(--ink)' : 'var(--ink-3)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isPlaying ? 8 : 0 }}>
            <input
              type="range"
              aria-label="Громкость"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
              style={{
                flex: 1,
                accentColor: 'var(--accent)',
                height: 4,
                cursor: 'pointer',
              }}
            />
            <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-3)', width: 28, textAlign: 'right' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
          {isPlaying && (
            <button
              type="button"
              onClick={stopAmbientSound}
              className="vc-save-btn"
              style={{
                width: '100%',
                font: '400 12px var(--font-ui)',
                padding: '4px 0',
                border: '1px solid var(--border-soft)',
                borderRadius: 4,
                color: 'var(--ink-3)',
              }}
            >
              × Стоп
            </button>
          )}
        </div>
      )}
    </div>
  );
}
