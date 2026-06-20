import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CSSProperties } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './Icon';
import { TYPE_COLORS, type TimelineEvent } from '../lib/timeline';

const LANE_ZONE_H = 120;
const LANE_CONN_H = 18;
const LANE_DOT_D = 12;
const LANE_NODE_W = 168;
const LANE_NODE_H = LANE_ZONE_H * 2 + LANE_CONN_H * 2 + LANE_DOT_D;
const LANE_AXIS_Y = LANE_ZONE_H + LANE_CONN_H + LANE_DOT_D / 2;
const ROW_H = LANE_NODE_H + 54; // row label ~20px + connector gap ~34px

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, (i + 1) * size)
  );
}

export function TimelineLane({
  events,
  activeEventId,
  dragEnabled,
  onSelect,
  onDragEnd,
  onAdd,
}: {
  events: TimelineEvent[];
  activeEventId: string | null;
  dragEnabled: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (e: DragEndEvent) => void;
  onAdd: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingEvent = events.find((e) => e.id === draggingId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => { setDraggingId(null); onDragEnd(e); };
  const handleDragCancel = () => setDraggingId(null);

  const eventsPerRow = containerWidth > 0 ? Math.max(3, Math.floor((containerWidth - 80) / LANE_NODE_W)) : 0;
  const rows = eventsPerRow > 0 ? chunkArray(events, eventsPerRow) : [];

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_H,
    paddingStart: 24,
    paddingEnd: 24,
    overscan: 2,
  });

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minHeight: 0, overflowX: 'hidden', overflowY: 'auto', position: 'relative' }}
    >
      {!dragEnabled && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            font: '400 11px var(--font-ui)',
            color: 'var(--ink-4)',
            background: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: 6,
            padding: '3px 10px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Перетаскивание доступно при фильтре «все»
        </div>
      )}

      {containerWidth > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={events.map((e) => e.id)} strategy={rectSortingStrategy}>
            <div style={{ position: 'relative', height: rowVirtualizer.getTotalSize() }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const rowIndex = virtualRow.index;
                const rowEvents = rows[rowIndex];
                const isLastRow = rowIndex === rows.length - 1;
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      padding: '0 40px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span
                        style={{
                          font: '400 10px var(--font-mono)',
                          color: 'var(--ink-4)',
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                        }}
                      >
                        строка {rowIndex + 1}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 1,
                          background:
                            'repeating-linear-gradient(90deg, var(--border-soft) 0, var(--border-soft) 4px, transparent 4px, transparent 10px)',
                        }}
                      />
                    </div>

                    <div style={{ position: 'relative', height: LANE_NODE_H }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: LANE_AXIS_Y,
                          height: 2,
                          background: 'var(--border-soft)',
                          pointerEvents: 'none',
                          zIndex: 0,
                        }}
                      />
                      <div style={{ display: 'flex', position: 'relative', zIndex: 1 }}>
                        {rowEvents.map((ev, rowEventIndex) => (
                          <SortableNode
                            key={ev.id}
                            event={ev}
                            index={rowIndex * eventsPerRow + rowEventIndex}
                            isSelected={activeEventId === ev.id}
                            dragEnabled={dragEnabled}
                            onSelect={() => onSelect(ev.id)}
                          />
                        ))}
                        {isLastRow && (
                          <button
                            onClick={onAdd}
                            aria-label="Добавить событие"
                            title="Добавить событие"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              background: 'var(--surface)',
                              border: '1px dashed var(--border-strong)',
                              color: 'var(--ink-3)',
                              cursor: 'pointer',
                              flexShrink: 0,
                              marginLeft: 16,
                              alignSelf: 'flex-start',
                              position: 'relative',
                              zIndex: 1,
                              marginTop: LANE_AXIS_Y - 17,
                            }}
                          >
                            <Icon name="plus" size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {isLastRow ? (
                      <div style={{ height: 24 }} />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 0 16px',
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: 1,
                            background:
                              'repeating-linear-gradient(90deg, var(--border-soft) 0, var(--border-soft) 4px, transparent 4px, transparent 10px)',
                          }}
                        />
                        <span style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-4)' }}>
                          ↓ строка {rowIndex + 2}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {draggingEvent ? <DragCard event={draggingEvent} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function DragCard({ event }: { event: TimelineEvent }) {
  const color = TYPE_COLORS[event.type];
  return (
    <div
      style={{
        width: 148,
        background: 'var(--surface-2)',
        border: `1px solid ${color}`,
        borderTop: `3px solid ${color}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'grabbing',
        boxShadow: `0 8px 28px oklch(0 0 0 / 0.45), 0 0 0 2px ${color}44`,
        pointerEvents: 'none',
      }}
    >
      {event.era && (
        <div
          style={{
            font: '400 10px var(--font-mono)',
            color: 'var(--ink-3)',
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.era}
        </div>
      )}
      <div
        style={{
          font: '500 12px var(--font-ui)',
          color: 'var(--ink)',
          lineHeight: 1.4,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {event.title || '—'}
      </div>
    </div>
  );
}

function SortableNode({
  event,
  index,
  isSelected,
  dragEnabled,
  onSelect,
}: {
  event: TimelineEvent;
  index: number;
  isSelected: boolean;
  dragEnabled: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
    disabled: !dragEnabled,
  });

  const isTop = index % 2 === 0;
  const color = TYPE_COLORS[event.type];

  const nodeStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform ? { ...transform, y: 0 } : null),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 20 : 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: LANE_NODE_W,
    flexShrink: 0,
    height: LANE_NODE_H,
    position: 'relative',
  };

  const card = (
    <div
      onClick={onSelect}
      style={{
        width: 148,
        background: isSelected ? 'var(--surface-2)' : 'var(--surface)',
        border: `1px solid ${isSelected ? color : 'var(--border-soft)'}`,
        borderTop: `3px solid ${color}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        userSelect: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.12s, background 0.12s',
        boxShadow: isSelected ? `0 0 0 2px ${color}33` : 'none',
      }}
    >
      {dragEnabled && (
        <div
          {...attributes}
          {...listeners}
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            color: 'var(--ink-4)',
            marginBottom: 6,
            display: 'flex',
            touchAction: 'none',
          }}
          title="Перетащить"
        >
          <Icon name="drag" size={12} />
        </div>
      )}
      {event.era && (
        <div
          style={{
            font: '400 10px var(--font-mono)',
            color: 'var(--ink-3)',
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.era}
        </div>
      )}
      <div
        style={{
          font: '500 12px var(--font-ui)',
          color: 'var(--ink)',
          lineHeight: 1.4,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {event.title || '—'}
      </div>
    </div>
  );

  return (
    <div ref={setNodeRef} style={nodeStyle}>
      <div
        style={{
          height: LANE_ZONE_H,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {isTop && card}
      </div>

      <div
        style={{
          width: 2,
          height: LANE_CONN_H,
          background: isTop ? color : 'transparent',
          flexShrink: 0,
        }}
      />

      <div
        onClick={onSelect}
        style={{
          width: LANE_DOT_D,
          height: LANE_DOT_D,
          borderRadius: 999,
          background: color,
          border: isSelected ? `2px solid var(--bg)` : '3px solid var(--bg)',
          outline: isSelected ? `2px solid ${color}` : 'none',
          outlineOffset: 1,
          flexShrink: 0,
          zIndex: 2,
          cursor: 'pointer',
        }}
      />

      <div
        style={{
          width: 2,
          height: LANE_CONN_H,
          background: isTop ? 'transparent' : color,
          flexShrink: 0,
        }}
      />

      <div
        style={{
          height: LANE_ZONE_H,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        {!isTop && card}
      </div>
    </div>
  );
}
