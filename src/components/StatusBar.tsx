import { useState, useRef, useEffect } from 'react';
import { useResponsive } from '../lib/useResponsive';

interface StatusBarProps {
  words?: number;
  chars?: number;
  savedAt?: string;
  statusLabel?: string;
  todayWords?: number;
  goalWords?: number;
  streak?: number;
  onGoalChange?: (goal: number) => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

const SOUNDS = [
  { id: 'cafe' as const, label: 'Кафе', file: '/sounds/cafe.wav' },
  { id: 'rain' as const, label: 'Дождь', file: '/sounds/rain.wav' },
  { id: 'forest' as const, label: 'Лес', file: '/sounds/forest.wav' },
  { id: 'fire' as const, label: 'Костёр', file: '/sounds/fire.wav' },
  { id: 'noise' as const, label: 'Шум', file: '/sounds/noise.wav' },
];

type SoundId = typeof SOUNDS[number]['id'];

const FADE_STEPS = 20;
const FADE_MS = 500;

export function StatusBar({ words = 0, chars = 0, savedAt = '', statusLabel, todayWords, goalWords = 1000, streak, onGoalChange, focusMode, onToggleFocusMode }: StatusBarProps) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const { isNarrow } = useResponsive();

  const [popupOpen, setPopupOpen] = useState(false);
  const [activeSound, setActiveSound] = useState<SoundId | null>(
    () => localStorage.getItem('ambient-sound') as SoundId | null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState<number>(() => {
    const v = localStorage.getItem('ambient-volume');
    return v !== null ? parseFloat(v) : 0.4;
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const volumeRef = useRef(volume);
  const wrapperRef = useRef<HTMLDivElement>(null);

  volumeRef.current = volume;

  const clearFade = () => {
    if (fadeRef.current !== null) {
      clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
  };

  const doFadeIn = (audio: HTMLAudioElement, targetVol: number) => {
    clearFade();
    audio.volume = 0;
    let step = 0;
    fadeRef.current = window.setInterval(() => {
      step++;
      audio.volume = Math.min(targetVol, targetVol * (step / FADE_STEPS));
      if (step >= FADE_STEPS) clearFade();
    }, FADE_MS / FADE_STEPS);
  };

  const doFadeOut = (audio: HTMLAudioElement, onDone: () => void) => {
    clearFade();
    const startVol = audio.volume;
    if (startVol === 0) { onDone(); return; }
    let step = 0;
    fadeRef.current = window.setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVol * (1 - step / FADE_STEPS));
      if (step >= FADE_STEPS) { clearFade(); onDone(); }
    }, FADE_MS / FADE_STEPS);
  };

  const startNewSound = (id: SoundId) => {
    const sound = SOUNDS.find(s => s.id === id)!;
    const audio = new Audio(sound.file);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;
    audio.play().then(() => {
      // Проверяем, что этот audio всё ещё актуален (быстрое переключение / unmount)
      if (audioRef.current !== audio) { audio.pause(); return; }
      isPlayingRef.current = true;
      setIsPlaying(true);
      doFadeIn(audio, volumeRef.current);
    }).catch(() => {
      // autoplay заблокирован — сбрасываем состояние
      if (audioRef.current === audio) {
        audioRef.current = null;
        setActiveSound(null);
        localStorage.removeItem('ambient-sound');
      }
    });
  };

  const selectSound = (id: SoundId) => {
    if (activeSound === id && isPlayingRef.current) {
      const audio = audioRef.current;
      if (audio) {
        doFadeOut(audio, () => {
          audio.pause();
          audioRef.current = null;
          isPlayingRef.current = false;
          setIsPlaying(false);
          setActiveSound(null);
          localStorage.removeItem('ambient-sound');
        });
      }
      return;
    }

    setActiveSound(id);
    localStorage.setItem('ambient-sound', id);

    const prev = audioRef.current;
    if (prev && isPlayingRef.current) {
      doFadeOut(prev, () => {
        prev.pause();
        startNewSound(id);
      });
    } else {
      clearFade();
      if (prev) { prev.pause(); audioRef.current = null; }
      startNewSound(id);
    }
  };

  const stopAll = () => {
    const audio = audioRef.current;
    if (audio && isPlayingRef.current) {
      // Сбрасываем сразу, чтобы visibilitychange не возобновил звук во время fade
      isPlayingRef.current = false;
      doFadeOut(audio, () => {
        audio.pause();
        audioRef.current = null;
        setIsPlaying(false);
        setActiveSound(null);
        localStorage.removeItem('ambient-sound');
      });
    } else {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setActiveSound(null);
      localStorage.removeItem('ambient-sound');
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    localStorage.setItem('ambient-volume', String(v));
    if (audioRef.current && isPlayingRef.current) {
      clearFade();
      audioRef.current.volume = v;
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (document.hidden) {
        audio.pause();
      } else if (isPlayingRef.current) {
        audio.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    return () => {
      if (fadeRef.current !== null) clearInterval(fadeRef.current);
      audioRef.current?.pause();
      audioRef.current = null;
      isPlayingRef.current = false;
    };
  }, []);

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

  function pluralDays(n: number): string {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'день';
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'дня';
    return 'дней';
  }

  function commitGoal() {
    const n = parseInt(goalInput, 10);
    if (n > 0) onGoalChange?.(n);
    setEditingGoal(false);
  }

  return (
    <div className="status">
      <span><span className="status-dot" style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />{statusLabel ?? (savedAt ? `Сохранено · ${savedAt}` : 'Сохранение…')}</span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span>Слов: {words.toLocaleString('ru')}</span>
      {!isNarrow && (
        <>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>Знаков: {chars.toLocaleString('ru')}</span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>~{Math.ceil(words / 220)} мин чтения</span>
        </>
      )}
      <span style={{ flex: 1 }} />
      {todayWords !== undefined && (
        <>
          {editingGoal ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span>сегодня · {todayWords.toLocaleString('ru')}/</span>
              <input
                autoFocus
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitGoal();
                  if (e.key === 'Escape') setEditingGoal(false);
                }}
                onBlur={commitGoal}
                style={{
                  width: 52, font: 'inherit', fontSize: 'inherit', color: 'inherit',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4,
                  padding: '0 4px', outline: 'none', textAlign: 'right',
                }}
              />
              <span> слов</span>
            </span>
          ) : (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Дневная цель: ${goalWords.toLocaleString('ru')} слов. Нажмите, чтобы изменить`}
              title="Нажмите, чтобы изменить цель"
              onClick={() => { setGoalInput(String(goalWords)); setEditingGoal(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGoalInput(String(goalWords)); setEditingGoal(true); } }}
              style={{ cursor: 'pointer', borderBottom: '1px dashed var(--border)' }}
            >
              сегодня · {todayWords.toLocaleString('ru')}/{goalWords.toLocaleString('ru')} слов
            </span>
          )}
          {streak !== undefined && streak > 0 && (
            <>
              <span style={{ color: 'var(--ink-4)' }}>·</span>
              <span style={{ color: 'var(--accent-2)' }}>серия {streak} {pluralDays(streak)}</span>
            </>
          )}
        </>
      )}
      {!isNarrow && onToggleFocusMode && (
        <button
          onClick={onToggleFocusMode}
          title={focusMode ? 'Выключить режим фокуса' : 'Режим фокуса'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0,
            color: focusMode ? 'var(--accent)' : 'var(--ink-3)',
            borderRadius: 4,
            marginLeft: 4,
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 12h2M19 12h2M12 3v2M12 19v2"/>
            <path d="M5.6 5.6l1.4 1.4M16.9 16.9l1.4 1.4M5.6 18.4l1.4-1.4M16.9 7.1l1.4-1.4"/>
          </svg>
        </button>
      )}
      {!isNarrow && (
        <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <button
            onClick={() => setPopupOpen(o => !o)}
            title="Фоновые звуки"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 0,
              color: isPlaying ? 'var(--accent)' : 'var(--ink-3)',
              borderRadius: 4,
              marginLeft: 4,
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
              <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
            </svg>
          </button>
          {popupOpen && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              right: 0,
              width: 220,
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
              padding: '10px 12px',
              zIndex: 200,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              animation: 'dropdown-in 0.12s cubic-bezier(0.22, 1, 0.36, 1) both',
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {SOUNDS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => selectSound(s.id)}
                    style={{
                      font: '400 12px var(--font-ui)',
                      padding: '3px 10px',
                      borderRadius: 999,
                      border: activeSound === s.id ? '1.5px solid var(--accent)' : '1px solid var(--border-soft)',
                      background: 'transparent',
                      color: activeSound === s.id ? 'var(--ink)' : 'var(--ink-3)',
                      cursor: 'pointer',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isPlaying ? 8 : 0 }}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={handleVolumeChange}
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
                  onClick={stopAll}
                  style={{
                    width: '100%',
                    font: '400 12px var(--font-ui)',
                    padding: '4px 0',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 4,
                    background: 'transparent',
                    color: 'var(--ink-3)',
                    cursor: 'pointer',
                  }}
                >
                  × Стоп
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
