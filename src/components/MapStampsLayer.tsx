import { STAMP_SVG, STAMP_BASE_SCALE, type MapStamp, type StampType } from '../lib/mapStamps';

const CW = 1600;
const CH = 900;

interface MapStampsLayerProps {
  stamps: MapStamp[];
  selectedId: string | null;
  dragPos: { id: string; x: number; y: number } | null;
  pendingPos?: { id: string; x: number; y: number } | null;
  sizeOverride?: { id: string; size: number } | null;
}

export function MapStampsLayer({ stamps, selectedId, dragPos, pendingPos, sizeOverride }: MapStampsLayerProps) {
  return (
    <g>
      {stamps.map(stamp => {
        const isSelected = selectedId === stamp.id;
        const isDragging = dragPos?.id === stamp.id;
        const isPending  = !isDragging && pendingPos?.id === stamp.id;
        const x = (isDragging ? dragPos!.x : isPending ? pendingPos!.x : stamp.x) * CW;
        const y = (isDragging ? dragPos!.y : isPending ? pendingPos!.y : stamp.y) * CH;
        const svgContent = STAMP_SVG[stamp.type as StampType] ?? '';
        const effectiveSize = sizeOverride?.id === stamp.id ? sizeOverride.size : stamp.size;

        return (
          <g
            key={stamp.id}
            data-stamp-id={stamp.id}
            transform={`translate(${x},${y}) scale(${effectiveSize * STAMP_BASE_SCALE})`}
            style={{ cursor: 'pointer' }}
          >
            {isSelected && (
              <ellipse rx={24} ry={20} fill="var(--accent)" opacity={0.15} />
            )}
            <g
              transform="translate(-20,-16)"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
            {isSelected && (
              <ellipse rx={24} ry={20} fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.8} />
            )}
          </g>
        );
      })}
    </g>
  );
}
