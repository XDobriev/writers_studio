import { useState, useRef, useEffect, useCallback } from 'react';
import { pluralDays, plural } from '../lib/i18n';
import { useResponsive } from '../lib/useResponsive';
import { EDITOR_FONTS, getStoredEditorFont, applyEditorFont, EDITOR_FONT_EVENT, type EditorFontId } from '../lib/editorFont';

interface StatusBarProps {
  words?: number;
  chars?: number;
  savedAt?: string;
  statusLabel?: string;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  todayWords?: number;
  goalWords?: number;
  streak?: number;
  onGoalChange?: (goal: number) => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

const SOUNDS = [
  { id: 'cafe' as const, label: 'Кафе', file: '/sounds/cafe.mp3' },
  { id: 'rain' as const, label: 'Дождь', file: '/sounds/rain.mp3' },
  { id: 'fire' as const, label: 'Костёр', file: '/sounds/fire.mp3' },
  { id: 'forest' as const, label: 'Лес', file: '/sounds/forest.mp3' },
  { id: 'waves' as const, label: 'Волны', file: '/sounds/waves.mp3' },
  { id: 'train' as const, label: 'Поезд', file: '/sounds/train.mp3' },
  { id: 'library' as const, label: 'Библиотека', file: '/sounds/library.mp3' },
  { id: 'noise' as const, label: 'Белый шум', file: '/sounds/noise.mp3' },
];

type SoundId = typeof SOUNDS[number]['id'];

const FADE_STEPS = 20;
const FADE_MS = 500;

export function StatusBar({ words = 0, chars = 0, savedAt = '', statusLabel, saveState, todayWords, goalWords = 1000, streak, onGoalChange, focusMode, onToggleFocusMode }: StatusBarProps) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const { isNarrow } = useResponsive();

  const barRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const checkOverflow = useCallback(() => {
    const el = barRef.current;
    if (el) setOverflowing(el.scrollWidth > el.clientWidth + 1);
  }, []);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkOverflow]);
  // Ререндер бара всегда сопровождается сменой отображаемого текста
  // (слова/знаки/цель/сегодня) — дешёвая проверка после каждого коммита
  // ловит content-driven overflow, который ResizeObserver не видит
  // (сам .status не меняет размер, меняется только scrollWidth).
  useEffect(() => {
    checkOverflow();
  });

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
  const fontWrapperRef = useRef<HTMLDivElement>(null);
  const [fontOpen, setFontOpen] = useState(false);
  const [activeFont, setActiveFont] = useState<EditorFontId>(getStoredEditorFont);

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
        // Сбрасываем сразу, чтобы visibilitychange не возобновил звук во время fade
        isPlayingRef.current = false;
        doFadeOut(audio, () => {
          audio.pause();
          audioRef.current = null;
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
      if (!audio || document.hidden) return;
      if (isPlayingRef.current) {
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

  useEffect(() => {
    if (!fontOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (fontWrapperRef.current && !fontWrapperRef.current.contains(e.target as Node)) {
        setFontOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [fontOpen]);

  useEffect(() => {
    const handler = (e: Event) => setActiveFont((e as CustomEvent<EditorFontId>).detail);
    window.addEventListener(EDITOR_FONT_EVENT, handler);
    return () => window.removeEventListener(EDITOR_FONT_EVENT, handler);
  }, []);

  function commitGoal() {
    const n = parseInt(goalInput, 10);
    if (n > 0) onGoalChange?.(n);
    setEditingGoal(false);
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
    <div className="status" ref={barRef}>
      <span><span className="status-dot" style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'middle', background: saveState === 'error' ? 'var(--danger)' : saveState === 'saving' ? 'var(--accent-2)' : 'var(--ok)' }} />{statusLabel ?? (savedAt ? `Сохранено · ${savedAt}` : 'Сохранение…')}</span>
      {!isNarrow && (
        <>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>Слов: {words.toLocaleString('ru')}</span>
        </>
      )}
      {!isNarrow && (
        <>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>Знаков: {chars.toLocaleString('ru')}</span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>{words < 220 ? '< 1 мин чтения' : `~${Math.round(words / 220)} мин чтения`}</span>
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
              <span> {plural(parseInt(goalInput, 10) || 0, 'слово', 'слова', 'слов')}</span>
            </span>
          ) : (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Дневная цель: ${goalWords.toLocaleString('ru')} слов. Нажмите, чтобы изменить`}
              title="Нажмите, чтобы изменить цель"
              onClick={() => { setGoalInput(String(goalWords)); setEditingGoal(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGoalInput(String(goalWords)); setEditingGoal(true); } }}
              style={{ cursor: 'pointer', borderBottom: '1px dashed var(--border)', display: 'inline-flex', alignItems: 'center', alignSelf: 'stretch', padding: '0 2px' }}
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
          aria-label={focusMode ? 'Выключить режим фокуса' : 'Режим фокуса'}
          className="status-icon-btn"
          style={{ color: focusMode ? 'var(--accent)' : 'var(--ink-3)' }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 12h2M19 12h2M12 3v2M12 19v2"/>
            <path d="M5.6 5.6l1.4 1.4M16.9 16.9l1.4 1.4M5.6 18.4l1.4-1.4M16.9 7.1l1.4-1.4"/>
          </svg>
        </button>
      )}
      {!isNarrow && (
        <div ref={fontWrapperRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <button
            onClick={() => setFontOpen(o => !o)}
            title="Шрифт редактора"
            aria-label="Шрифт редактора"
            aria-expanded={fontOpen}
            aria-haspopup="listbox"
            className="status-icon-btn"
            style={{
              color: fontOpen ? 'var(--accent)' : 'var(--ink-3)',
              font: '500 12px var(--font-ui)',
              letterSpacing: '-0.02em',
            }}
          >
            Aa
          </button>
          {fontOpen && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              right: 0,
              width: 180,
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
              padding: 6,
              zIndex: 200,
              boxShadow: '0 4px 16px oklch(0 0 0 / 0.12)',
              animation: 'dropdown-in 0.12s cubic-bezier(0.22, 1, 0.36, 1) both',
            }}>
              {EDITOR_FONTS.map(f => (
                <button
                  key={f.id}
                  className="status-font-item"
                  onClick={() => { applyEditorFont(f.id); setFontOpen(false); }}
                  style={{
                    fontFamily: f.family,
                    fontSize: 13,
                    color: activeFont === f.id ? 'var(--ink)' : 'var(--ink-3)',
                  }}
                >
                  {f.label}
                  {activeFont === f.id && (
                    <span style={{ color: 'var(--accent)', fontSize: 11, flexShrink: 0 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!isNarrow && (
        <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <button
            onClick={() => setPopupOpen(o => !o)}
            title="Фоновые звуки"
            aria-label="Фоновые звуки"
            className="status-icon-btn"
            style={{ color: popupOpen || isPlaying ? 'var(--accent)' : 'var(--ink-3)' }}
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
                  type="button"
                  onClick={stopAll}
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
      )}
    </div>
    {/* Индикатор скролла: fade у правого края .status, вынесен в несклолящийся
        родитель — иначе внутри overflow-x:auto контейнера уезжал бы вместе с
        контентом. В отличие от тулбара, тут нет фонового зазора справа
        (последняя кнопка стоит впритык к краю) — поэтому рендерим fade
        ТОЛЬКО при реальном overflow (checkOverflow), иначе он приглушал бы
        иконку «Фоновые звуки» даже когда скроллить нечего. */}
    {overflowing && (
      <div aria-hidden style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 40,
        pointerEvents: 'none',
        background: 'linear-gradient(to right, transparent, var(--bg-deep))',
      }} />
    )}
    </div>
  );
}
