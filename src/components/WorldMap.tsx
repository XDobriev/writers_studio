import { useCallback, useEffect, useRef, useState } from 'react';
import { useResponsive } from '../lib/useResponsive';
import { TYPE_GLYPHS, TYPE_LABELS, type Location, type LocationPatch, type LocationType } from '../lib/locations';
import { CONNECTION_STYLES, type LocationConnection, type ConnectionPatch } from '../lib/connections';
import { getMapTemplate, type MapTemplateId } from '../lib/mapTemplates';
import type { MapMode } from '../pages/Map';
import { MapStampsLayer } from './MapStampsLayer';
import { StampPopup } from './StampPopup';
import { type MapStamp, type StampPatch } from '../lib/mapStamps';

const CW = 1600;
const CH = 900;
const SCALE_MIN = 0.15;
const SCALE_MAX = 5;
const DRAG_THRESHOLD = 5;

interface WorldMapProps {
  locations: Location[];
  connections: LocationConnection[];
  bgUrl: string | null;
  template?: string | null;
  mode: MapMode;
  onUpdate: (id: string, patch: LocationPatch) => void;
  onCreate: (x: number, y: number) => void;
  onDelete: (id: string) => void;
  onCreateConnection: (fromId: string, toId: string) => void;
  onDeleteConnection: (id: string) => void;
  onUpdateConnection: (id: string, patch: ConnectionPatch) => void;
  stamps: MapStamp[];
  onCreateStamp: (x: number, y: number) => void;
  onUpdateStamp: (id: string, patch: StampPatch) => void;
  onDeleteStamp: (id: string) => void;
}

function TemplateBg({ id }: { id: MapTemplateId }) {
  if (id === 'sea') {
    return (
      <>
        <defs>
          <linearGradient id="wm-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#060e1c"/>
            <stop offset="100%" stopColor="#091526"/>
          </linearGradient>
          <pattern id="wm-w" width={80} height={40} patternUnits="userSpaceOnUse">
            <path d="M0 20 Q20 10 40 20 Q60 30 80 20" fill="none" stroke="#1a3a5c" strokeWidth={0.7} opacity={0.4}/>
          </pattern>
          <pattern id="wm-l" width={160} height={80} patternUnits="userSpaceOnUse">
            <line x1={80} y1={0} x2={80} y2={80} stroke="#1e4570" strokeWidth={0.3} opacity={0.3}/>
            <line x1={0} y1={40} x2={160} y2={40} stroke="#1e4570" strokeWidth={0.3} opacity={0.3}/>
          </pattern>
        </defs>
        <rect width={CW} height={CH} fill="url(#wm-g)"/>
        <rect width={CW} height={CH} fill="url(#wm-w)"/>
        <rect width={CW} height={CH} fill="url(#wm-l)"/>
        <rect width={CW} height={CH} fill="none" stroke="#1e4570" strokeWidth={1.5} opacity={0.5}/>
        <rect x={12} y={12} width={CW - 24} height={CH - 24} fill="none" stroke="#1e4570" strokeWidth={0.6} strokeDasharray="8 4" opacity={0.35}/>
      </>
    );
  }
  if (id === 'paper') {
    return (
      <>
        <defs>
          <pattern id="wm-g" width={40} height={40} patternUnits="userSpaceOnUse">
            <line x1={40} y1={0} x2={40} y2={40} stroke="#c8b89a" strokeWidth={0.4} opacity={0.5}/>
            <line x1={0} y1={40} x2={40} y2={40} stroke="#c8b89a" strokeWidth={0.4} opacity={0.5}/>
          </pattern>
          <pattern id="wm-c" width={200} height={200} patternUnits="userSpaceOnUse">
            <line x1={100} y1={0} x2={100} y2={200} stroke="#b8a080" strokeWidth={0.8} opacity={0.3}/>
            <line x1={0} y1={100} x2={200} y2={100} stroke="#b8a080" strokeWidth={0.8} opacity={0.3}/>
          </pattern>
        </defs>
        <rect width={CW} height={CH} fill="#f7f2e8" rx={6}/>
        <rect width={CW} height={CH} fill="url(#wm-g)" rx={6}/>
        <rect width={CW} height={CH} fill="url(#wm-c)" rx={6}/>
        <rect width={CW} height={CH} fill="none" rx={6} stroke="#c8b89a" strokeWidth={1.5}/>
        <rect x={16} y={16} width={CW - 32} height={CH - 32} fill="none" rx={3} stroke="#c8b89a" strokeWidth={0.6} strokeDasharray="6 4" opacity={0.6}/>
      </>
    );
  }
  if (id === 'dark') {
    return (
      <>
        <defs>
          <radialGradient id="wm-g" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#1a1a22"/>
            <stop offset="100%" stopColor="#0e0e14"/>
          </radialGradient>
          <pattern id="wm-d" width={32} height={32} patternUnits="userSpaceOnUse">
            <circle cx={16} cy={16} r={0.7} fill="#5050a0" opacity={0.12}/>
          </pattern>
          <pattern id="wm-x" width={160} height={160} patternUnits="userSpaceOnUse">
            <line x1={79} y1={76} x2={81} y2={84} stroke="#6060b0" strokeWidth={0.4} opacity={0.2}/>
            <line x1={76} y1={80} x2={84} y2={80} stroke="#6060b0" strokeWidth={0.4} opacity={0.2}/>
          </pattern>
        </defs>
        <rect width={CW} height={CH} fill="url(#wm-g)"/>
        <rect width={CW} height={CH} fill="url(#wm-d)"/>
        <rect width={CW} height={CH} fill="url(#wm-x)"/>
        <rect width={CW} height={CH} fill="none" stroke="#303060" strokeWidth={1} opacity={0.4}/>
        <rect x={14} y={14} width={CW - 28} height={CH - 28} fill="none" stroke="#404080" strokeWidth={0.5} strokeDasharray="5 5" opacity={0.25}/>
      </>
    );
  }
  // parchment (default)
  return (
    <>
      <defs>
        <radialGradient id="wm-g" cx="50%" cy="50%" r="65%">
          <stop offset="0%"   stopColor="#3d2e1e"/>
          <stop offset="100%" stopColor="#1e150d"/>
        </radialGradient>
        <pattern id="wm-d" width={48} height={48} patternUnits="userSpaceOnUse">
          <circle cx={24} cy={24} r={0.9} fill="#9a7a52" opacity={0.18}/>
        </pattern>
      </defs>
      <rect x={0} y={0} width={CW} height={CH} fill="url(#wm-g)" rx={8}/>
      <rect x={0} y={0} width={CW} height={CH} fill="url(#wm-d)" rx={8}/>
      <rect x={0} y={0} width={CW} height={CH} fill="none" rx={8} stroke="#5a3f28" strokeWidth={2}/>
      <rect x={18} y={18} width={CW - 36} height={CH - 36} fill="none" rx={4} stroke="#4a3420" strokeWidth={0.8} strokeDasharray="10 5" opacity={0.5}/>
    </>
  );
}

export function WorldMap({
  locations, connections, bgUrl, template, mode,
  onUpdate, onCreate, onDelete,
  onCreateConnection, onDeleteConnection, onUpdateConnection,
  stamps,
  onCreateStamp, onUpdateStamp, onDeleteStamp,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useResponsive();

  // ── Pan / zoom state ─────────────────────────────────────────────────────
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(scale);
  const panValRef = useRef(pan);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { panValRef.current = pan; }, [pan]);

  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [dragPinPos, setDragPinPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [dragStampPos, setDragStampPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const stampDragRef = useRef<{ id: string; startPX: number; startPY: number } | null>(null);
  const [pendingPlaceId, setPendingPlaceId] = useState<string | null>(null);
  const [unmappedSheetOpen, setUnmappedSheetOpen] = useState(false);

  // ── Interaction refs ─────────────────────────────────────────────────────
  const panRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const pinDragRef = useRef<{ id: string; startPX: number; startPY: number } | null>(null);
  const touchRef = useRef<{ dist: number; scale: number; cx: number; cy: number } | null>(null);

  // Popup edit state (debounced to onUpdate)
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<LocationType>('city');
  const [editRole, setEditRole] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<LocationPatch>({});

  // Connection popup edit state
  const [editConnLabel, setEditConnLabel] = useState('');
  const [editConnStyle, setEditConnStyle] = useState<LocationConnection['style']>('road');
  const connEditTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (editTimer.current) clearTimeout(editTimer.current);
    if (connEditTimer.current) clearTimeout(connEditTimer.current);
  }, []);

  // ── Initial fit ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const s = Math.min(width / CW, height / CH) * 0.85;
    const p = { x: (width - CW * s) / 2, y: (height - CH * s) / 2 };
    setScale(s); scaleRef.current = s;
    setPan(p);   panValRef.current = p;
  }, []);

  // ── Wheel zoom ───────────────────────────────────────────────────────────
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
        setPan(p => ({ x: mx - (mx - p.x) * (ns / prev), y: my - (my - p.y) * (ns / prev) }));
        scaleRef.current = ns;
        return ns;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Pinch-to-zoom (mobile) ───────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current = {
        dist: Math.hypot(dx, dy),
        scale: scaleRef.current,
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2 || !touchRef.current) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const newDist = Math.hypot(dx, dy);
    const factor = newDist / touchRef.current.dist;
    const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, touchRef.current.scale * factor));
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = touchRef.current.cx - rect.left;
    const my = touchRef.current.cy - rect.top;
    setScale(prev => {
      setPan(p => ({
        x: mx - (mx - p.x) * (newScale / prev),
        y: my - (my - p.y) * (newScale / prev),
      }));
      scaleRef.current = newScale;
      return newScale;
    });
  }, []);

  const onTouchEnd = useCallback(() => { touchRef.current = null; }, []);

  // ── Esc ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setPendingPlaceId(null);
      setConnectFrom(null);
      setSelectedId(null);
      setSelectedConnId(null);
      setSelectedStampId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset connectFrom when mode changes away from connect
  useEffect(() => {
    if (mode !== 'connect') setConnectFrom(null);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'stamp') setSelectedStampId(null);
  }, [mode]);

  // ── Popup field sync when selection changes ──────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    const loc = locations.find(l => l.id === selectedId);
    if (!loc) return;
    setEditName(loc.name);
    setEditType(loc.type);
    setEditRole(loc.role);
    setEditDesc(loc.description);
    pendingPatch.current = {};
  }, [selectedId, locations]);

  useEffect(() => {
    if (!selectedConnId) return;
    const conn = connections.find(c => c.id === selectedConnId);
    if (!conn) return;
    setEditConnLabel(conn.label);
    setEditConnStyle(conn.style);
  }, [selectedConnId, connections]);

  // ── Debounced patch helpers ──────────────────────────────────────────────
  const scheduleUpdate = useCallback((id: string, patch: LocationPatch) => {
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    if (editTimer.current) clearTimeout(editTimer.current);
    editTimer.current = setTimeout(() => {
      const p = pendingPatch.current;
      pendingPatch.current = {};
      onUpdate(id, p);
    }, 500);
  }, [onUpdate]);

  const scheduleConnUpdate = useCallback((id: string, patch: ConnectionPatch) => {
    if (connEditTimer.current) clearTimeout(connEditTimer.current);
    connEditTimer.current = setTimeout(() => onUpdateConnection(id, patch), 500);
  }, [onUpdateConnection]);

  // ── Auto-resize textarea helper ──────────────────────────────────────────
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden';
  };

  // ── Coordinate helper ────────────────────────────────────────────────────
  const getLogical = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - panValRef.current.x) / (scaleRef.current * CW),
      y: (clientY - rect.top  - panValRef.current.y) / (scaleRef.current * CH),
    };
  };

  // ── Pointer events ───────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as Element;
    const stampEl = target.closest('[data-stamp-id]');
    const locEl   = target.closest('[data-loc-id]');

    if (mode === 'stamp' && stampEl) {
      const id = stampEl.getAttribute('data-stamp-id')!;
      e.currentTarget.setPointerCapture(e.pointerId);
      const stamp = stamps.find(s => s.id === id);
      if (!stamp) return;
      stampDragRef.current = { id, startPX: e.clientX, startPY: e.clientY };
      setDragStampPos({ id, x: stamp.x, y: stamp.y });
      return;
    }

    if (locEl && mode !== 'stamp') {
      const id = locEl.getAttribute('data-loc-id')!;
      if (mode === 'connect') return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const loc = locations.find(l => l.id === id);
      if (!loc || loc.x == null || loc.y == null) return;
      pinDragRef.current = { id, startPX: e.clientX, startPY: e.clientY };
      setDragPinPos({ id, x: loc.x, y: loc.y });
    } else {
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedId(null);
      setSelectedConnId(null);
      setSelectedStampId(null);
      panRef.current = { px: e.clientX, py: e.clientY, ox: panValRef.current.x, oy: panValRef.current.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stampDragRef.current) {
      const { x, y } = getLogical(e.clientX, e.clientY);
      setDragStampPos({ id: stampDragRef.current.id, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
    } else if (pinDragRef.current) {
      const { x, y } = getLogical(e.clientX, e.clientY);
      setDragPinPos({ id: pinDragRef.current.id, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
    } else if (panRef.current) {
      setPan({ x: panRef.current.ox + (e.clientX - panRef.current.px), y: panRef.current.oy + (e.clientY - panRef.current.py) });
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const locEl  = target.closest('[data-loc-id]');
    const connEl = target.closest('[data-conn-id]');

    if (stampDragRef.current) {
      const { id, startPX, startPY } = stampDragRef.current;
      const dragged = Math.abs(e.clientX - startPX) > DRAG_THRESHOLD || Math.abs(e.clientY - startPY) > DRAG_THRESHOLD;
      if (dragged && dragStampPos) {
        onUpdateStamp(id, { x: dragStampPos.x, y: dragStampPos.y });
      } else {
        setSelectedStampId(prev => prev === id ? null : id);
      }
      stampDragRef.current = null;
      setDragStampPos(null);
      return;
    }

    if (pinDragRef.current) {
      const { id, startPX, startPY } = pinDragRef.current;
      const dragged = Math.abs(e.clientX - startPX) > DRAG_THRESHOLD || Math.abs(e.clientY - startPY) > DRAG_THRESHOLD;
      if (dragged && dragPinPos) {
        onUpdate(id, { x: dragPinPos.x, y: dragPinPos.y });
      } else if (mode === 'place') {
        setSelectedId(prev => prev === id ? null : id);
        setSelectedConnId(null);
      }
      pinDragRef.current = null;
      setDragPinPos(null);
      return;
    }

    if (mode === 'connect' && locEl) {
      const id = locEl.getAttribute('data-loc-id')!;
      if (!connectFrom) {
        setConnectFrom(id);
      } else if (connectFrom !== id) {
        onCreateConnection(connectFrom, id);
        setConnectFrom(null);
      }
      return;
    }

    if (panRef.current) {
      const dx = Math.abs(e.clientX - panRef.current.px);
      const dy = Math.abs(e.clientY - panRef.current.py);
      if (dx <= DRAG_THRESHOLD && dy <= DRAG_THRESHOLD) {
        if (connEl && mode !== 'stamp') {
          const id = connEl.getAttribute('data-conn-id')!;
          setSelectedConnId(prev => prev === id ? null : id);
          setSelectedId(null);
        } else if (mode === 'stamp') {
          const { x, y } = getLogical(e.clientX, e.clientY);
          if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
            onCreateStamp(x, y);
          }
        } else if (mode === 'connect') {
          setConnectFrom(null);
        } else if (mode === 'place') {
          const { x, y } = getLogical(e.clientX, e.clientY);
          if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
            if (pendingPlaceId) {
              onUpdate(pendingPlaceId, { x, y });
              setPendingPlaceId(null);
            } else {
              onCreate(x, y);
            }
          }
        }
      }
      panRef.current = null;
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const mapped   = locations.filter(l => l.x != null && l.y != null);
  const unmapped = locations.filter(l => l.x == null || l.y == null);
  const selected = selectedId ? locations.find(l => l.id === selectedId) ?? null : null;

  // Popup position (desktop)
  const containerW = containerRef.current?.clientWidth ?? 800;
  const containerH = containerRef.current?.clientHeight ?? 600;
  const popupLeft = selected?.x != null
    ? Math.min(Math.max(selected.x * CW * scale + pan.x + 20, 8), containerW - 258)
    : 0;
  const popupTop = selected?.y != null
    ? Math.max(Math.min(selected.y * CH * scale + pan.y - 60, containerH - 320), 8)
    : 0;

  // Stamp popup position
  const selectedStamp = selectedStampId ? stamps.find(s => s.id === selectedStampId) ?? null : null;
  const stampPopupLeft = selectedStamp?.x != null
    ? Math.min(Math.max(selectedStamp.x * CW * scale + pan.x + 20, 8), containerW - 260)
    : 0;
  const stampPopupTop = selectedStamp?.y != null
    ? Math.max(Math.min(selectedStamp.y * CH * scale + pan.y - 80, containerH - 280), 8)
    : 0;

  // Hint text
  const hintText = mode === 'stamp'
    ? 'Кликните на карту чтобы поставить штамп · тяните штамп для перемещения'
    : mode === 'connect'
    ? connectFrom
      ? `«${locations.find(l => l.id === connectFrom)?.name ?? '…'}» → кликните вторую локацию · Esc отмена`
      : 'Режим «Связь» — кликните первую локацию'
    : mode === 'pan'
    ? 'Перетащите карту · колесо мыши — zoom'
    : pendingPlaceId
    ? 'Кликните на карту чтобы разместить · Esc отмена'
    : 'Кликните на карту чтобы добавить локацию';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: mode === 'connect' ? 'crosshair' : mode === 'stamp' ? 'cell' : pendingPlaceId ? 'cell' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <svg
          style={{ position: 'absolute', left: pan.x, top: pan.y, width: CW * scale, height: CH * scale, userSelect: 'none' }}
          viewBox={`0 0 ${CW} ${CH}`}
        >
          {/* Background */}
          {bgUrl
            ? <image href={bgUrl} x={0} y={0} width={CW} height={CH} preserveAspectRatio="xMidYMid slice" opacity={0.85} />
            : <TemplateBg id={getMapTemplate(template)} />
          }

          {/* Stamps — below connections and pins */}
          <MapStampsLayer
            stamps={stamps}
            selectedId={selectedStampId}
            dragPos={dragStampPos}
          />

          {/* Connection lines — render before pins */}
          {connections.map(conn => {
            const from = locations.find(l => l.id === conn.from_id);
            const to   = locations.find(l => l.id === conn.to_id);
            if (!from || !to || from.x == null || from.y == null || to.x == null || to.y == null) return null;
            const x1 = from.x * CW, y1 = from.y * CH;
            const x2 = to.x   * CW, y2 = to.y   * CH;
            const cs = CONNECTION_STYLES[conn.style];
            const isSel = selectedConnId === conn.id;
            return (
              <g key={conn.id} data-conn-id={conn.id} style={{ cursor: 'pointer' }}>
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isSel ? 'var(--accent)' : cs.stroke}
                  strokeWidth={cs.width + (isSel ? 1 : 0)}
                  strokeDasharray={cs.dash || undefined}
                  opacity={isSel ? 1 : 0.65}
                />
                {/* Wide transparent hitbox */}
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="transparent" strokeWidth={16} pointerEvents="stroke"
                />
              </g>
            );
          })}

          {/* Pins */}
          {mapped.map(loc => {
            const isSelected  = selectedId === loc.id;
            const isConnFrom  = connectFrom === loc.id;
            const isDragging  = dragPinPos?.id === loc.id;
            const lx = (isDragging ? dragPinPos!.x : loc.x!) * CW;
            const ly = (isDragging ? dragPinPos!.y : loc.y!) * CH;

            return (
              <g key={loc.id} data-loc-id={loc.id} transform={`translate(${lx},${ly})`} style={{ cursor: 'pointer' }}>
                {(isSelected || isConnFrom) && <circle r={22} fill="var(--accent)" opacity={0.12} />}
                <circle
                  r={14}
                  fill={isSelected || isConnFrom ? 'var(--accent)' : 'var(--surface-2)'}
                  stroke={isSelected || isConnFrom ? 'var(--accent)' : 'var(--border)'}
                  strokeWidth={2}
                />
                <text textAnchor="middle" dominantBaseline="central" fontSize={12} style={{ userSelect: 'none' }}>
                  {TYPE_GLYPHS[loc.type]}
                </text>
                <text y={26} textAnchor="middle" fontSize={9} fill="var(--ink-2)" fontFamily="var(--font-ui)" style={{ userSelect: 'none' }}>
                  {loc.name.length > 16 ? loc.name.slice(0, 15) + '…' : loc.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* ── Desktop popup ── */}
        {!isMobile && selected && selected.x != null && mode === 'place' && (
          <div
            style={{
              position: 'absolute', left: popupLeft, top: popupTop,
              width: 240, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 14px',
              boxShadow: '0 6px 28px oklch(0 0 0 / 0.45)', zIndex: 20,
            }}
            onPointerDown={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <span style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-4)', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 4, padding: '2px 7px' }}>
                {TYPE_GLYPHS[selected.type]} {TYPE_LABELS[selected.type]}
              </span>
              <button onClick={() => setSelectedId(null)} aria-label="Закрыть" title="Закрыть" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', font: '18px var(--font-ui)', lineHeight: 1, padding: '0 3px' }}>×</button>
            </div>
            <input
              value={editName}
              onChange={e => { setEditName(e.target.value); scheduleUpdate(selected.id, { name: e.target.value.trim() || 'Без названия' }); }}
              aria-label="Название локации"
              style={{ width: '100%', height: 34, padding: '0 9px', border: '1px solid var(--border-soft)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink)', font: '500 14px var(--font-serif)', outline: 'none', marginBottom: 7 }}
            />
            <select
              value={editType}
              onChange={e => { const t = e.target.value as LocationType; setEditType(t); scheduleUpdate(selected.id, { type: t }); }}
              aria-label="Тип локации"
              className="map-popup-select"
              style={{ marginBottom: 7 }}
            >
              {(['city','village','forest','sea','castle','other'] as const).map(t => (
                <option key={t} value={t}>{TYPE_GLYPHS[t]} {TYPE_LABELS[t]}</option>
              ))}
            </select>
            <input
              value={editRole}
              onChange={e => { setEditRole(e.target.value); scheduleUpdate(selected.id, { role: e.target.value }); }}
              placeholder="Роль в сюжете…"
              aria-label="Роль локации в сюжете"
              style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-soft)', color: 'var(--ink-3)', padding: '3px 0 5px', font: '400 11px var(--font-mono)', outline: 'none', marginBottom: 9, letterSpacing: '0.02em' }}
            />
            <textarea
              value={editDesc}
              onChange={e => {
                setEditDesc(e.target.value);
                scheduleUpdate(selected.id, { description: e.target.value });
                autoResize(e.target);
              }}
              ref={el => { if (el) autoResize(el); }}
              placeholder="Описание локации…"
              aria-label="Описание локации"
              style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 6, color: 'var(--ink-3)', padding: '6px 8px', font: '400 11px/1.55 var(--font-serif)', outline: 'none', resize: 'none', minHeight: 32, overflowY: 'hidden', marginBottom: 10, scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-soft)', paddingTop: 8 }}>
              <button type="button" className="map-popup-btn" onClick={() => { onUpdate(selected.id, { x: null, y: null }); setSelectedId(null); }}>
                Снять с карты
              </button>
              <button
                className="map-popup-del"
                style={{ font: '400 10px var(--font-ui)' }}
                onClick={() => { setSelectedId(null); onDelete(selected.id); }}
              >
                Удалить
              </button>
            </div>
          </div>
        )}

        {/* ── Stamp popup ── */}
        {!isMobile && selectedStamp && (
          <StampPopup
            stamp={selectedStamp}
            position={{ left: stampPopupLeft, top: stampPopupTop }}
            onUpdate={patch => onUpdateStamp(selectedStamp.id, patch)}
            onDelete={() => {
              onDeleteStamp(selectedStamp.id);
              setSelectedStampId(null);
            }}
            onClose={() => setSelectedStampId(null)}
          />
        )}

        {/* ── Connection mini-popup ── */}
        {selectedConnId && (() => {
          const conn = connections.find(c => c.id === selectedConnId);
          if (!conn) return null;
          const from = locations.find(l => l.id === conn.from_id);
          const to   = locations.find(l => l.id === conn.to_id);
          if (!from || !to || from.x == null || from.y == null || to.x == null || to.y == null) return null;
          const midX = ((from.x + to.x) / 2) * CW * scale + pan.x;
          const midY = ((from.y + to.y) / 2) * CH * scale + pan.y;
          const clampedLeft = Math.min(Math.max(midX - 120, 8), containerW - 268);
          const clampedTop  = Math.max(midY - 20, 8);
          return (
            <div
              style={{ position: 'absolute', left: clampedLeft, top: clampedTop, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', boxShadow: '0 4px 16px oklch(0 0 0 / 0.4)', zIndex: 15, display: 'flex', gap: 8, alignItems: 'center' }}
              onPointerDown={e => e.stopPropagation()}
            >
              <input
                value={editConnLabel}
                onChange={e => {
                  setEditConnLabel(e.target.value);
                  scheduleConnUpdate(conn.id, { label: e.target.value });
                }}
                placeholder="Название связи…"
                aria-label="Название связи"
                style={{ width: 120, background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 4, color: 'var(--ink-2)', padding: '3px 7px', font: '400 11px var(--font-ui)', outline: 'none' }}
              />
              <select
                value={editConnStyle}
                onChange={e => {
                  const s = e.target.value as LocationConnection['style'];
                  setEditConnStyle(s);
                  scheduleConnUpdate(conn.id, { style: s });
                }}
                aria-label="Стиль связи"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 4, color: 'var(--ink-2)', padding: '3px 22px 3px 6px', font: '400 11px var(--font-ui)', outline: 'none', appearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 5px center', cursor: 'pointer' }}
              >
                {(Object.entries(CONNECTION_STYLES) as [LocationConnection['style'], typeof CONNECTION_STYLES[keyof typeof CONNECTION_STYLES]][]).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button
                className="map-popup-del"
                style={{ font: '16px var(--font-ui)' }}
                aria-label="Удалить связь"
                title="Удалить связь"
                onClick={() => { setSelectedConnId(null); onDeleteConnection(conn.id); }}
              >×</button>
            </div>
          );
        })()}

        {/* ── Hint bar ── */}
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '6px 14px', font: '400 11px var(--font-ui)', color: 'var(--ink-3)', boxShadow: '0 2px 10px oklch(0 0 0 / 0.1)', pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap' }}>
          {hintText}
        </div>

        {/* ── Mobile: unmapped badge ── */}
        {isMobile && unmapped.length > 0 && (
          <button
            onClick={() => setUnmappedSheetOpen(true)}
            style={{ position: 'absolute', top: 10, right: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 10px 5px 8px', display: 'flex', alignItems: 'center', gap: 5, font: '400 11px var(--font-ui)', color: 'var(--ink-3)', boxShadow: '0 2px 12px oklch(0 0 0 / 0.3)', cursor: 'pointer', zIndex: 10 }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-2)', flexShrink: 0, display: 'inline-block' }} />
            {unmapped.length} не размещены
          </button>
        )}
      </div>

      {/* ── Desktop: unmapped panel ── */}
      {!isMobile && unmapped.length > 0 && (
        <div style={{ width: 186, borderLeft: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', background: 'var(--bg)', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px 6px', font: '500 9px var(--font-ui)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Не размещены · {unmapped.length}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px', scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
            {unmapped.map(loc => (
              <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 4px', borderRadius: 6, background: pendingPlaceId === loc.id ? 'var(--surface-2)' : 'transparent' }}>
                <span style={{ font: '11px var(--font-serif)', color: 'var(--ink-3)', flexShrink: 0, width: 16, textAlign: 'center' }}>{TYPE_GLYPHS[loc.type]}</span>
                <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</span>
                <button
                  title="Разместить на карте"
                  onClick={() => setPendingPlaceId(prev => prev === loc.id ? null : loc.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: pendingPlaceId === loc.id ? 'var(--accent)' : 'var(--ink-4)', padding: '2px 4px', font: '14px var(--font-ui)', lineHeight: 1, flexShrink: 0 }}
                >+</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Mobile: bottom sheet (edit location) ── */}
      {isMobile && selected && mode === 'place' && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0', padding: '0 16px 24px', boxShadow: '0 -4px 32px oklch(0 0 0 / 0.5)', zIndex: 30 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--surface-3)', margin: '10px auto 12px' }} onPointerDown={() => setSelectedId(null)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-4)', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 4, padding: '2px 7px' }}>
              {TYPE_GLYPHS[selected.type]} {TYPE_LABELS[selected.type]}
            </span>
            <button onClick={() => setSelectedId(null)} aria-label="Закрыть" title="Закрыть" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', font: '20px var(--font-ui)', lineHeight: 1, padding: '0 3px' }}>×</button>
          </div>
          <input
            value={editName}
            onChange={e => { setEditName(e.target.value); scheduleUpdate(selected.id, { name: e.target.value.trim() || 'Без названия' }); }}
            aria-label="Название локации"
            style={{ width: '100%', height: 36, padding: '0 10px', border: '1px solid var(--border-soft)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink)', font: '500 14px var(--font-serif)', outline: 'none', marginBottom: 8 }}
          />
          <select
            value={editType}
            onChange={e => { const t = e.target.value as LocationType; setEditType(t); scheduleUpdate(selected.id, { type: t }); }}
            aria-label="Тип локации"
            className="map-popup-select"
            style={{ marginBottom: 8 }}
          >
            {(['city','village','forest','sea','castle','other'] as const).map(t => (
              <option key={t} value={t}>{TYPE_GLYPHS[t]} {TYPE_LABELS[t]}</option>
            ))}
          </select>
          <input
            value={editRole}
            onChange={e => { setEditRole(e.target.value); scheduleUpdate(selected.id, { role: e.target.value }); }}
            placeholder="Роль в сюжете…"
            aria-label="Роль локации в сюжете"
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-soft)', color: 'var(--ink-3)', padding: '3px 0 5px', font: '400 11px var(--font-mono)', outline: 'none', marginBottom: 9 }}
          />
          <textarea
            value={editDesc}
            onChange={e => {
              setEditDesc(e.target.value);
              scheduleUpdate(selected.id, { description: e.target.value });
              autoResize(e.target);
            }}
            ref={el => { if (el) autoResize(el); }}
            placeholder="Описание локации…"
            aria-label="Описание локации"
            style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 6, color: 'var(--ink-3)', padding: '7px 9px', font: '400 12px/1.55 var(--font-serif)', outline: 'none', resize: 'none', minHeight: 36, overflowY: 'hidden', marginBottom: 12 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="map-loc-btn" onClick={() => { onUpdate(selected.id, { x: null, y: null }); setSelectedId(null); }}>
              Снять с карты
            </button>
            <button type="button" className="map-loc-btn map-loc-btn--danger" onClick={() => { setSelectedId(null); onDelete(selected.id); }}>
              Удалить
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile: unmapped bottom sheet ── */}
      {isMobile && unmappedSheetOpen && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0', boxShadow: '0 -4px 32px oklch(0 0 0 / 0.5)', zIndex: 30 }}>
          <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ font: '500 12px var(--font-ui)', color: 'var(--ink-2)' }}>Не размещены на карте</span>
            <button onClick={() => setUnmappedSheetOpen(false)} aria-label="Закрыть" title="Закрыть" style={{ background: 'none', border: 'none', color: 'var(--ink-4)', font: '20px var(--font-ui)', cursor: 'pointer' }}>×</button>
          </div>
          {unmapped.map(loc => (
            <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid var(--border-soft)', font: '400 13px var(--font-ui)', color: 'var(--ink-2)' }}>
              <span style={{ font: '13px var(--font-serif)', color: 'var(--ink-4)', width: 16, textAlign: 'center' }}>{TYPE_GLYPHS[loc.type]}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</span>
              <button
                onClick={() => { setPendingPlaceId(loc.id); setUnmappedSheetOpen(false); }}
                aria-label={`Разместить на карте: ${loc.name}`}
                style={{ background: 'var(--accent-soft)', border: '1px solid oklch(0.63 0.16 30 / 0.3)', borderRadius: 5, color: 'var(--accent)', font: '400 11px var(--font-ui)', padding: '3px 10px', cursor: 'pointer' }}
              >
                Разместить
              </button>
            </div>
          ))}
          <div style={{ height: 16 }} />
        </div>
      )}
    </div>
  );
}
