import { useEffect, useRef } from 'react';
import { TimelineEventCard } from './TimelineEventCard';
import { TYPE_COLORS, type TimelineEvent, type TimelineEventPatch } from '../lib/timeline';
import type { ChapterMeta } from '../lib/chapters';

export function EventDetailPanel({
  event,
  chapters,
  onUpdate,
  onDelete,
  onClose,
}: {
  event: TimelineEvent;
  chapters: ChapterMeta[];
  onUpdate: (patch: TimelineEventPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const color = TYPE_COLORS[event.type];

  useEffect(() => {
    panelRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'oklch(0 0 0 / 0.22)',
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Детали события"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          const focusable = e.currentTarget.querySelectorAll<HTMLElement>(
            'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
          }
        }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(380px, 100vw)',
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border-soft)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px oklch(0 0 0 / 0.1)',
          outline: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-soft)',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: color,
              flexShrink: 0,
            }}
          />
          <span style={{ font: '500 13px var(--font-ui)', flex: 1 }}>Детали события</span>
          <button
            type="button"
            onClick={onClose}
            className="icon-close-btn"
            title="Закрыть"
            aria-label="Закрыть панель"
            style={{ color: 'var(--ink-4)', padding: '4px 8px', fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 18px 20px 28px' }}>
          <TimelineEventCard
            event={event}
            chapters={chapters}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </div>
      </div>
    </>
  );
}
