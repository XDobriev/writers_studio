import { STAMP_LABELS, STAMP_SVG, STAMP_TYPES, type MapStamp, type StampPatch, type StampType } from '../lib/mapStamps';

interface StampPopupProps {
  stamp: MapStamp;
  position: { left: number; top: number };
  onUpdate: (patch: StampPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function StampPopup({ stamp, position, onUpdate, onDelete, onClose }: StampPopupProps) {
  return (
    <div
      style={{
        position: 'absolute', left: position.left, top: position.top,
        width: 248, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 14px',
        boxShadow: '0 6px 28px oklch(0 0 0 / 0.45)', zIndex: 20,
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Штамп</span>
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 3px' }}
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
        Размер {stamp.size.toFixed(1)}×
      </div>
      <input
        type="range"
        min={0.5} max={3.0} step={0.1}
        value={stamp.size}
        onChange={e => onUpdate({ size: parseFloat(e.target.value) })}
        aria-label={`Размер штампа: ${stamp.size.toFixed(1)}×`}
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
