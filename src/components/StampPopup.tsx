import { useState, useEffect } from 'react';
import { STAMP_LABELS, STAMP_SVG, STAMP_TYPES, type MapStamp, type StampPatch, type StampType } from '../lib/mapStamps';

interface StampPopupProps {
  stamp: MapStamp;
  position: { left: number; top: number };
  onUpdate: (patch: StampPatch) => void;
  onDelete: () => void;
  onClose: () => void;
  onSizePreview?: (size: number) => void;
  isMobile?: boolean;
}

export function StampPopup({ stamp, position, onUpdate, onDelete, onClose, onSizePreview, isMobile }: StampPopupProps) {
  const [localSize, setLocalSize] = useState(stamp.size);
  // Only sync on stamp change, not on each server update — avoids interrupting active drag
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalSize(stamp.size); }, [stamp.id]);
  return (
    <div
      style={isMobile ? {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '1px solid var(--border)',
        borderRadius: '16px 16px 0 0', padding: '0 16px 24px',
        boxShadow: '0 -4px 32px oklch(0 0 0 / 0.5)', zIndex: 30,
      } : {
        position: 'absolute', left: position.left, top: position.top,
        width: 248, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 14px',
        boxShadow: '0 6px 28px oklch(0 0 0 / 0.45)', zIndex: 20,
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      {isMobile && (
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--surface-3)', margin: '10px auto 12px' }} onPointerDown={onClose} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Штамп</span>
        <button
          onClick={onClose}
          aria-label="Закрыть"
          title="Закрыть"
          className="icon-close-btn"
          style={{ fontSize: 18, padding: '0 3px' }}
        >×</button>
      </div>

      <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Тип</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 12 }}>
        {STAMP_TYPES.map(type => (
          <button
            key={type}
            type="button"
            onClick={() => onUpdate({ type })}
            title={STAMP_LABELS[type]}
            aria-label={STAMP_LABELS[type]}
            aria-pressed={stamp.type === type}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '4px 2px', borderRadius: 5, cursor: 'pointer', border: '1px solid',
              borderColor: stamp.type === type ? 'var(--accent)' : 'var(--border-soft)',
              background: stamp.type === type
                ? 'color-mix(in oklch, var(--accent) 12%, var(--surface-2))'
                : 'var(--surface-2)',
            }}
          >
            <svg width="22" height="17" viewBox="0 0 40 32">
              <g dangerouslySetInnerHTML={{ __html: STAMP_SVG[type as StampType] }} />
            </svg>
            <span style={{ font: '400 7px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.2 }}>
              {STAMP_LABELS[type]}
            </span>
          </button>
        ))}
      </div>

      <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        Размер {localSize.toFixed(1)}×
      </div>
      <input
        type="range"
        min={0.5} max={3.0} step={0.1}
        value={localSize}
        onChange={e => { const s = parseFloat(e.target.value); setLocalSize(s); onSizePreview?.(s); }}
        onPointerUp={e => onUpdate({ size: (e.target as HTMLInputElement).valueAsNumber })}
        aria-label={`Размер штампа: ${localSize.toFixed(1)}×`}
        style={{ width: '100%', marginBottom: 12 }}
      />

      <button
        className="btn btn--danger-ghost btn--sm"
        style={{ width: '100%' }}
        onClick={onDelete}
      >
        Удалить
      </button>
    </div>
  );
}
