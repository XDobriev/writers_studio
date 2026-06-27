import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { markOnboarded } from '../lib/profiles';
import { QUERY_KEYS } from '../lib/queries';
import type { Book } from '../lib/supabase';

interface Props {
  books: Book[];
  userId: string;
  onboardedAt: string | null;
  onCreateBook?: () => void;
}

type StepKey = 'bookCreated' | 'wroteWords' | 'addedChar' | 'triedExport';

const STEPS: { key: StepKey; label: string; path: string | null }[] = [
  { key: 'bookCreated', label: 'Создать первую книгу',   path: null },
  { key: 'wroteWords',  label: 'Написать первые слова',  path: 'editor' },
  { key: 'addedChar',   label: 'Добавить персонажа',     path: 'characters' },
  { key: 'triedExport', label: 'Попробовать экспорт',    path: 'export' },
];

export function OnboardingChecklist({ books, userId, onboardedAt, onCreateBook }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hiding, setHiding] = useState(false);

  const completed: Record<StepKey, boolean> = {
    bookCreated: books.length > 0,
    wroteWords:  books.some(b => b.words > 0),
    addedChar:   localStorage.getItem('as_checklist_char') === '1',
    triedExport: localStorage.getItem('as_checklist_export') === '1',
  };

  const completedCount = Object.values(completed).filter(Boolean).length;
  const allDone = completedCount === STEPS.length;

  useEffect(() => {
    if (!allDone || !!onboardedAt) return;
    const t1 = setTimeout(() => setHiding(true), 800);
    const t2 = setTimeout(() => {
      markOnboarded(userId);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(userId) });
    }, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [allDone, onboardedAt, userId, queryClient]);

  const handleDismiss = () => {
    setHiding(true);
    setTimeout(() => {
      markOnboarded(userId);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(userId) });
    }, 200);
  };

  if (onboardedAt) return null;

  const firstBook = books[0];

  return (
    <div
      style={{
        background: 'color-mix(in oklch, var(--accent) 6%, var(--surface))',
        border: '1px solid color-mix(in oklch, var(--accent) 20%, var(--border-soft))',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 28,
        opacity: hiding ? 0 : 1,
        pointerEvents: hiding ? 'none' : undefined,
        transition: 'opacity 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="label">С чего начать</span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span
            aria-live="polite"
            aria-atomic="true"
            style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)' }}
          >
            {completedCount} из {STEPS.length}
          </span>
          <button
            aria-label="Скрыть чеклист"
            onClick={handleDismiss}
            className="checklist-dismiss"
          >
            ×
          </button>
        </div>
      </div>

      <div style={{
        height: 3, borderRadius: 2, marginBottom: 10, overflow: 'hidden',
        background: 'color-mix(in oklch, var(--accent) 12%, var(--surface))',
      }}>
        <div style={{
          height: '100%',
          width: '100%',
          background: 'var(--accent)',
          borderRadius: 2,
          transform: `scaleX(${completedCount / STEPS.length})`,
          transformOrigin: 'left',
          transition: 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
        }} />
      </div>

      {STEPS.map((step, i) => {
        const done = completed[step.key];
        const isCurrent = !done && STEPS.slice(0, i).every(s => completed[s.key]);
        const canClick = !done && (
          step.path !== null ? !!firstBook : step.key === 'bookCreated' && !!onCreateBook
        );

        const handleClick = () => {
          if (!canClick) return;
          if (step.path !== null && firstBook) {
            navigate(`/books/${firstBook.id}/${step.path}`);
          } else if (step.key === 'bookCreated' && onCreateBook) {
            onCreateBook();
          }
        };

        return (
          <div
            key={step.key}
            role={canClick ? 'button' : undefined}
            tabIndex={canClick ? 0 : undefined}
            onClick={handleClick}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && canClick) {
                e.preventDefault();
                handleClick();
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '5px 0',
              borderBottom: i < STEPS.length - 1 ? '1px solid var(--border-soft)' : undefined,
              cursor: canClick ? 'pointer' : 'default',
              color: done ? 'var(--ink-3)' : isCurrent ? 'var(--ink-1)' : 'var(--ink-3)',
              font: `${isCurrent ? 500 : 400} 13px/1.5 var(--font-ui)`,
            }}
          >
            <span style={{ width: 14, fontSize: 12, flexShrink: 0, color: done ? 'var(--accent)' : 'var(--ink-4)' }}>
              {done ? '✓' : '○'}
            </span>
            <span style={{ flex: 1 }}>{step.label}</span>
            {!done && (step.path || (step.key === 'bookCreated' && !!onCreateBook)) && (
              <span style={{ fontSize: 12, color: isCurrent ? 'var(--accent)' : 'var(--ink-4)' }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
