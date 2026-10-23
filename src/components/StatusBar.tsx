import { useState, useRef, useEffect, useCallback } from 'react';
import { pluralDays, plural } from '../lib/i18n';
import { useResponsive } from '../lib/useResponsive';
import { useDropdownPosition } from '../lib/useDropdownPosition';
import { AmbientSoundControl } from './AmbientSoundControl';
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

  const fontWrapperRef = useRef<HTMLDivElement>(null);
  const [fontOpen, setFontOpen] = useState(false);
  // .status прокручивается по X (overflow) — absolute-попап внутри него обрезается.
  const fontPopupPos = useDropdownPosition(fontWrapperRef, fontOpen ? 'font' : null);
  const [activeFont, setActiveFont] = useState<EditorFontId>(getStoredEditorFont);

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
          {fontOpen && fontPopupPos && (
            <div style={{
              ...fontPopupPos,
              width: 180,
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
              padding: 6,
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
      {!isNarrow && <AmbientSoundControl />}
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
