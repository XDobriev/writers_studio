import { useEffect, useRef, useState } from 'react';
import { TYPE_GLYPHS, TYPE_LABELS, type Location, type LocationPatch } from '../lib/locations';

const CW = 1600;
const CH = 900;
const SCALE_MIN = 0.15;
const SCALE_MAX = 5;
const DRAG_THRESHOLD = 5;

interface WorldMapProps {
  locations: Location[];
  onUpdate: (id: string, patch: LocationPatch) => void;
  onCreate: (x: number, y: number) => void;
}

export function WorldMap({ locations, onUpdate, onCreate }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragPinPos, setDragPinPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null);

  const panRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const pinDragRef = useRef<{ id: string; startPX: number; startPY: number } | null>(null);
  const scaleRef = useRef(scale);
  const panValRef = useRef(pan);

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { panValRef.current = pan; }, [pan]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const s = Math.min(width / CW, height / CH) * 0.85;
    const p = { x: (width - CW * s) / 2, y: (height - CH * s) / 2 };
    setScale(s);
    scaleRef.current = s;
    setPan(p);
    panValRef.current = p;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setScale(prev => {
        const ns = Math.max(SCALE_MIN, Math.min(SCALE_MAX, prev * factor));
        setPan(p => ({
          x: mx - (mx - p.x) * (ns / prev),
          y: my - (my - p.y) * (ns / prev),
        }));
        scaleRef.current = ns;
        return ns;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingPlaceId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const getLogical = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const p = panValRef.current;
    const s = scaleRef.current;
    return {
      x: (clientX - rect.left - p.x) / (s * CW),
      y: (clientY - rect.top - p.y) / (s * CH),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const locEl = (e.target as Element).closest('[data-loc-id]');
    e.currentTarget.setPointerCapture(e.pointerId);

    if (locEl) {
      const id = locEl.getAttribute('data-loc-id')!;
      const loc = locations.find(l => l.id === id);
      if (!loc || loc.x == null || loc.y == null) return;
      pinDragRef.current = { id, startPX: e.clientX, startPY: e.clientY };
      setDragPinPos({ id, x: loc.x, y: loc.y });
    } else {
      panRef.current = { px: e.clientX, py: e.clientY, ox: panValRef.current.x, oy: panValRef.current.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pinDragRef.current) {
      const { x, y } = getLogical(e.clientX, e.clientY);
      setDragPinPos({
        id: pinDragRef.current.id,
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      });
    } else if (panRef.current) {
      setPan({
        x: panRef.current.ox + (e.clientX - panRef.current.px),
        y: panRef.current.oy + (e.clientY - panRef.current.py),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pinDragRef.current) {
      const { id, startPX, startPY } = pinDragRef.current;
      const dragged = Math.abs(e.clientX - startPX) > DRAG_THRESHOLD || Math.abs(e.clientY - startPY) > DRAG_THRESHOLD;
      if (dragged && dragPinPos) {
        onUpdate(id, { x: dragPinPos.x, y: dragPinPos.y });
      } else {
        setSelectedId(prev => (prev === id ? null : id));
      }
      pinDragRef.current = null;
      setDragPinPos(null);
    } else if (panRef.current) {
      const dx = Math.abs(e.clientX - panRef.current.px);
      const dy = Math.abs(e.clientY - panRef.current.py);
      if (dx <= DRAG_THRESHOLD && dy <= DRAG_THRESHOLD) {
        const { x, y } = getLogical(e.clientX, e.clientY);
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
          setSelectedId(null);
          if (pendingPlaceId) {
            onUpdate(pendingPlaceId, { x, y });
            setPendingPlaceId(null);
          } else {
            onCreate(x, y);
          }
        }
      }
      panRef.current = null;
    }
  };

  const mapped = locations.filter(l => l.x != null && l.y != null);
  const unmapped = locations.filter(l => l.x == null || l.y == null);
  const selected = selectedId ? (locations.find(l => l.id === selectedId) ?? null) : null;

  const containerW = containerRef.current?.clientWidth ?? 800;
  const popupLeft = selected && selected.x != null ? Math.min(selected.x * CW * scale + pan.x + 20 * scale, containerW - 240) : 0;
  const popupTop = selected && selected.y != null ? Math.max(8, selected.y * CH * scale + pan.y - 90) : 0;

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          cursor: pendingPlaceId ? 'cell' : 'crosshair',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <svg
          style={{
            position: 'absolute',
            left: pan.x,
            top: pan.y,
            width: CW * scale,
            height: CH * scale,
            userSelect: 'none',
          }}
          viewBox={`0 0 ${CW} ${CH}`}
        >
          <rect x={0} y={0} width={CW} height={CH} fill="var(--surface)" rx={8} stroke="var(--border-soft)" strokeWidth={2} />
          <defs>
            <pattern id="wm-grid" width={80} height={80} patternUnits="userSpaceOnUse">
              <circle cx={40} cy={40} r={1.2} fill="var(--ink-4)" opacity={0.25} />
            </pattern>
          </defs>
          <rect x={0} y={0} width={CW} height={CH} fill="url(#wm-grid)" rx={8} />

          {mapped.map(loc => {
            const isSelected = selectedId === loc.id;
            const isDragging = dragPinPos?.id === loc.id;
            const lx = (isDragging ? dragPinPos!.x : loc.x!) * CW;
            const ly = (isDragging ? dragPinPos!.y : loc.y!) * CH;

            return (
              <g
                key={loc.id}
                data-loc-id={loc.id}
                transform={`translate(${lx},${ly})`}
                style={{ cursor: 'pointer' }}
              >
                {isSelected && <circle r={22} fill="var(--accent)" opacity={0.12} />}
                <circle
                  r={13}
                  fill={isSelected ? 'var(--accent)' : 'var(--surface-2)'}
                  stroke={isSelected ? 'var(--accent)' : 'var(--border)'}
                  strokeWidth={2}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  style={{ userSelect: 'none' }}
                >
                  {TYPE_GLYPHS[loc.type]}
                </text>
                <text
                  y={24}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--ink-2)"
                  fontFamily="var(--font-ui)"
                  style={{ userSelect: 'none' }}
                >
                  {loc.name.length > 16 ? loc.name.slice(0, 15) + '…' : loc.name}
                </text>
              </g>
            );
          })}
        </svg>

        {selected && selected.x != null && (
          <div
            style={{
              position: 'absolute',
              left: popupLeft,
              top: popupTop,
              width: 220,
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: 10,
              padding: '10px 12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
              zIndex: 20,
            }}
            onPointerDown={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <div style={{ font: '500 14px var(--font-serif)', color: 'var(--ink)' }}>{selected.name}</div>
              <button
                onClick={() => setSelectedId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', padding: '0 2px', font: '16px var(--font-ui)', lineHeight: 1, flexShrink: 0 }}
              >
                ×
              </button>
            </div>
            <div style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', marginBottom: 4 }}>
              {TYPE_LABELS[selected.type]}
            </div>
            {selected.role && (
              <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-2)', marginBottom: 2 }}>{selected.role}</div>
            )}
            {selected.description && (
              <div style={{ font: '400 12px/1.5 var(--font-serif)', color: 'var(--ink-3)', marginTop: 4 }}>{selected.description}</div>
            )}
            <button
              onClick={() => { onUpdate(selected.id, { x: null, y: null }); setSelectedId(null); }}
              style={{ marginTop: 8, font: '400 11px var(--font-ui)', color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Снять с карты
            </button>
          </div>
        )}

        {pendingPlaceId && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
              padding: '7px 14px',
              font: '400 12px var(--font-ui)',
              color: 'var(--ink-2)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              pointerEvents: 'none',
              zIndex: 30,
              whiteSpace: 'nowrap',
            }}
          >
            Кликните на карту чтобы разместить · <span style={{ color: 'var(--ink-4)' }}>Esc — отмена</span>
          </div>
        )}
      </div>

      {unmapped.length > 0 && (
        <div
          style={{
            width: 186,
            borderLeft: '1px solid var(--border-soft)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg)',
            flexShrink: 0,
          }}
        >
          <div style={{ padding: '10px 12px 6px', font: '500 10px var(--font-ui)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Не размещены
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
            {unmapped.map(loc => (
              <div
                key={loc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 4px',
                  borderRadius: 6,
                  background: pendingPlaceId === loc.id ? 'var(--surface-2)' : 'transparent',
                }}
              >
                <span style={{ font: '11px var(--font-serif)', color: 'var(--ink-3)', flexShrink: 0, width: 16, textAlign: 'center' }}>
                  {TYPE_GLYPHS[loc.type]}
                </span>
                <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {loc.name}
                </span>
                <button
                  title="Разместить на карте"
                  onClick={() => setPendingPlaceId(prev => (prev === loc.id ? null : loc.id))}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: pendingPlaceId === loc.id ? 'var(--accent)' : 'var(--ink-4)',
                    padding: '2px 4px',
                    font: '14px var(--font-ui)',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
