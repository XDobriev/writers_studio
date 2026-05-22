import { useState } from 'react';

interface StatusBarProps {
  words?: number;
  chars?: number;
  savedAt?: string;
  statusLabel?: string;
  todayWords?: number;
  goalWords?: number;
  streak?: number;
  onGoalChange?: (goal: number) => void;
}

export function StatusBar({ words = 0, chars = 0, savedAt = '', statusLabel, todayWords, goalWords = 1000, streak, onGoalChange }: StatusBarProps) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

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
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span>Знаков: {chars.toLocaleString('ru')}</span>
      <span style={{ color: 'var(--ink-4)' }}>·</span>
      <span>~{Math.ceil(words / 220)} мин чтения</span>
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
    </div>
  );
}
