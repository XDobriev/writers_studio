import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useErrorState } from '../lib/useErrorState';
import { useResponsive } from '../lib/useResponsive';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../components/Icon';
import { Sidebar, WithMode } from '../components/Chrome';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { useAuth } from '../lib/auth';
import { getPlanLimits } from '../lib/profiles';
import {
  createTimelineEvent,
  deleteTimelineEvent,
  reorderTimelineEvents,
  TYPE_COLORS,
  updateTimelineEvent,
  type TimelineEvent,
  type TimelineEventPatch,
  type TypeFilter,
} from '../lib/timeline';
import { TimelineEventCard } from '../components/TimelineEventCard';
import { TimelineFilters } from '../components/TimelineFilters';
import { type ChapterMeta } from '../lib/chapters';
import { QUERY_KEYS, useBook, useChapters, useTimelineEvents, useProfile } from '../lib/queries';

type View = 'list' | 'lane';

// Lane geometry constants (px)
const LANE_ZONE_H = 120;  // top / bottom card zone height
const LANE_CONN_H = 18;   // connector from zone to dot
const LANE_DOT_D = 12;    // dot diameter
const LANE_NODE_W = 168;  // node width
const LANE_NODE_H = LANE_ZONE_H * 2 + LANE_CONN_H * 2 + LANE_DOT_D; // 288px
const LANE_AXIS_Y = LANE_ZONE_H + LANE_CONN_H + LANE_DOT_D / 2;     // 144px from node top

export default function Timeline() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const limits = getPlanLimits(profile?.plan);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { data: book } = useBook(bookId);
  const { data: events, error: eventsQueryError } = useTimelineEvents(bookId);
  const { data: chapters } = useChapters(bookId);
  const { error: mutationError, setError, clearError } = useErrorState();
  const queryError = eventsQueryError?.message ?? null;
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [view, setView] = useState<View>(
    () => (localStorage.getItem('timeline-view') as View | null) ?? 'list'
  );
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  const { isMobile } = useResponsive();

  const activeEvent = useMemo(
    () => events?.find((e) => e.id === activeEventId) ?? null,
    [events, activeEventId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const switchView = (v: View) => {
    setView(v);
    localStorage.setItem('timeline-view', v);
  };

  const creatingRef = useRef(false);
  const onCreate = useCallback(async () => {
    if (!bookId || !user || creatingRef.current) return;
    creatingRef.current = true;
    const position = events?.length ?? 0;
    try {
      const created = await createTimelineEvent(bookId, user.id, { position });
      queryClient.setQueryData<TimelineEvent[]>(
        QUERY_KEYS.timelineEvents(bookId),
        (prev) => [...(prev ?? []), created]
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      creatingRef.current = false;
    }
  }, [bookId, user, events, queryClient, setError]);

  const handleCreate = useCallback(() => {
    if ((events?.length ?? 0) >= limits.maxTimelineEvents) {
      setShowUpgrade(true);
    } else {
      void onCreate();
    }
  }, [events?.length, limits.maxTimelineEvents, onCreate]);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('create') !== 'true') return;
    setSearchParams({}, { replace: true });
    handleCreate();
  }, [searchParams, setSearchParams, handleCreate]);

  const onUpdate = useCallback(
    async (id: string, patch: TimelineEventPatch) => {
      if (!bookId) return;
      queryClient.setQueryData<TimelineEvent[]>(QUERY_KEYS.timelineEvents(bookId), (prev) =>
        prev ? prev.map((e) => (e.id === id ? ({ ...e, ...patch } as TimelineEvent) : e)) : prev
      );
      try {
        const updated = await updateTimelineEvent(id, patch);
        queryClient.setQueryData<TimelineEvent[]>(QUERY_KEYS.timelineEvents(bookId), (prev) =>
          prev ? prev.map((e) => (e.id === id ? updated : e)) : prev
        );
      } catch (e) {
        setError((e as Error).message);
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timelineEvents(bookId) });
      }
    },
    [bookId, queryClient, setError]
  );

  const onDelete = useCallback((id: string) => {
    setConfirmDeleteId(id);
  }, []);

  const onDeleteConfirmed = useCallback(async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (!bookId || !id) return;
    if (activeEventId === id) setActiveEventId(null);
    try {
      await deleteTimelineEvent(id);
      queryClient.setQueryData<TimelineEvent[]>(QUERY_KEYS.timelineEvents(bookId), (prev) =>
        prev ? prev.filter((e) => e.id !== id) : prev
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, confirmDeleteId, activeEventId, queryClient, setError]);

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || !bookId || !events || active.id === over.id) return;

      const oldIndex = events.findIndex((e) => e.id === active.id);
      const newIndex = events.findIndex((e) => e.id === over.id);
      const reordered = arrayMove(events, oldIndex, newIndex).map((e, i) => ({
        ...e,
        position: i,
      }));

      queryClient.setQueryData<TimelineEvent[]>(QUERY_KEYS.timelineEvents(bookId), reordered);

      try {
        await reorderTimelineEvents(reordered.map((e) => ({ id: e.id, position: e.position })));
      } catch (e) {
        setError((e as Error).message);
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timelineEvents(bookId) });
      }
    },
    [bookId, events, queryClient, setError]
  );

  const filtered = useMemo(() => {
    if (!events) return [];
    if (filter === 'all') return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (queryError) {
    return (
      <div
        className="as"
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <span style={{ font: '500 14px var(--font-ui)', color: 'var(--danger)' }}>
          Ошибка загрузки
        </span>
        <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>{queryError}</span>
      </div>
    );
  }

  if (!book || events === undefined || chapters === undefined) {
    return (
      <div
        className="as"
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="page-spinner" />
      </div>
    );
  }

  const emptyState = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        padding: '48px 24px',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
          background: 'var(--surface)',
          color: 'var(--ink-4)',
          border: '1px solid var(--border-soft)',
        }}
      >
        <Icon name="clock" size={22} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 260 }}>
        <div style={{ font: '500 14px var(--font-ui)', color: 'var(--ink-2)', marginBottom: 6 }}>
          Хронология пуста
        </div>
        <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
          Фиксируйте ключевые события вашего мира в хронологическом порядке
        </div>
      </div>
      <button onClick={handleCreate} className="btn btn--primary">
        <Icon name="plus" size={13} /> Создать событие
      </button>
    </div>
  );

  const showLane = view === 'lane' && !isMobile;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }} style={{ height: '100%' }}>
    <WithMode>
      <div
        className="as as-app as-app--no-right"
        style={{ height: '100%', gridTemplateColumns: isMobile ? '1fr' : undefined }}
      >
        {!isMobile && (
          <Sidebar book={book} subtitle={`хронология · ${events.length}`}>
            <div className="sb-section">
              <span className="sb-section-title">Слои</span>
            </div>
            <TimelineFilters variant="sidebar" filter={filter} onFilter={setFilter} />
          </Sidebar>
        )}

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)' }}>Хронология</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {!isMobile && (
                <div
                  style={{
                    display: 'flex',
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                    overflow: 'hidden',
                    marginRight: 4,
                  }}
                >
                  <button
                    onClick={() => switchView('list')}
                    className="btn"
                    aria-pressed={view === 'list'}
                    style={{
                      borderRadius: 0,
                      border: 'none',
                      gap: 5,
                      background: view === 'list' ? 'var(--surface)' : 'transparent',
                      color: view === 'list' ? 'var(--ink)' : 'var(--ink-3)',
                    }}
                    title="Список"
                  >
                    <Icon name="list" size={14} />
                    Список
                  </button>
                  <button
                    onClick={() => switchView('lane')}
                    className="btn"
                    aria-pressed={view === 'lane'}
                    style={{
                      borderRadius: 0,
                      border: 'none',
                      borderLeft: '1px solid var(--border-soft)',
                      gap: 5,
                      background: view === 'lane' ? 'var(--surface)' : 'transparent',
                      color: view === 'lane' ? 'var(--ink)' : 'var(--ink-3)',
                    }}
                    title="Лента"
                  >
                    <Icon name="arrows" size={14} />
                    Лента
                  </button>
                </div>
              )}
              <button onClick={handleCreate} className="btn">
                <Icon name="plus" size={14} /> Событие
              </button>
            </div>
          </div>

          {/* Mobile filter tabs */}
          {isMobile && (
            <TimelineFilters variant="mobile" filter={filter} onFilter={setFilter} />
          )}

          {mutationError && (
            <div style={{ margin: '8px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 14px', borderRadius: 8, background: 'oklch(0.65 0.18 25 / 0.10)', border: '1px solid oklch(0.65 0.18 25 / 0.25)', color: 'var(--danger)', fontSize: 13, flexShrink: 0 }}>
              <span>{mutationError}</span>
              <button type="button" onClick={clearError} className="icon-close-btn" style={{ color: 'var(--danger)', fontSize: 16, padding: '0 2px', flexShrink: 0 }} title="Закрыть" aria-label="Закрыть">×</button>
            </div>
          )}
          {/* Content */}
          {showLane ? (
            events.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{emptyState}</div>
            ) : (
              <TimelineLane
                events={filtered}
                sensors={sensors}
                activeEventId={activeEventId}
                dragEnabled={filter === 'all'}
                onSelect={(id) => setActiveEventId(activeEventId === id ? null : id)}
                onDragEnd={onDragEnd}
                onAdd={handleCreate}
              />
            )
          ) : (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '32px 48px' }}>
              {filtered.length === 0 ? (
                events.length === 0 ? (
                  emptyState
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: 12,
                      color: 'var(--ink-3)',
                      padding: '48px 0',
                    }}
                  >
                    <div style={{ font: '500 14px var(--font-ui)' }}>
                      Нет событий в этом слое
                    </div>
                    <button
                      className="btn btn--ghost"
                      style={{ fontSize: 12 }}
                      onClick={() => setFilter('all')}
                    >
                      Сбросить фильтр
                    </button>
                  </div>
                )
              ) : (
                <div style={{ position: 'relative', paddingLeft: 24 }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 7,
                      top: 6,
                      bottom: 6,
                      width: 2,
                      background: 'var(--border-soft)',
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {filtered.map((ev) => (
                      <TimelineEventCard
                        key={ev.id}
                        event={ev}
                        chapters={chapters}
                        onUpdate={(patch) => onUpdate(ev.id, patch)}
                        onDelete={() => onDelete(ev.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {activeEvent && (
        <EventDetailPanel
          event={activeEvent}
          chapters={chapters}
          onUpdate={(patch) => onUpdate(activeEvent.id, patch)}
          onDelete={() => onDelete(activeEvent.id)}
          onClose={() => setActiveEventId(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        message="Удалить это событие? Действие нельзя отменить."
        onConfirm={onDeleteConfirmed}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <UpgradePrompt open={showUpgrade} feature="timeline" onClose={() => setShowUpgrade(false)} />
    </WithMode>
    </motion.div>
  );
}

// ─── Horizontal Lane ───────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, (i + 1) * size)
  );
}

function TimelineLane({
  events,
  sensors,
  activeEventId,
  dragEnabled,
  onSelect,
  onDragEnd,
  onAdd,
}: {
  events: TimelineEvent[];
  sensors: ReturnType<typeof useSensors>;
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

  const handleDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => { setDraggingId(null); onDragEnd(e); };
  const handleDragCancel = () => setDraggingId(null);

  const eventsPerRow = containerWidth > 0 ? Math.max(3, Math.floor((containerWidth - 80) / LANE_NODE_W)) : 0;
  const rows = eventsPerRow > 0 ? chunkArray(events, eventsPerRow) : [];

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
            <div style={{ padding: '24px 40px' }}>
              {rows.map((rowEvents, rowIndex) => {
                const isLastRow = rowIndex === rows.length - 1;
                return (
                  <div key={rowIndex}>
                    {/* Row header */}
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

                    {/* Nodes */}
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

                    {/* Row separator / continuation */}
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
                        <span
                          style={{
                            font: '400 10px var(--font-mono)',
                            color: 'var(--ink-4)',
                          }}
                        >
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

// ─── Drag overlay card ─────────────────────────────────────────────────────────

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

// ─── Sortable node ──────────────────────────────────────────────────────────────

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

  const nodeStyle: React.CSSProperties = {
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
      {/* Top zone */}
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

      {/* Upper connector */}
      <div
        style={{
          width: 2,
          height: LANE_CONN_H,
          background: isTop ? color : 'transparent',
          flexShrink: 0,
        }}
      />

      {/* Dot */}
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

      {/* Lower connector */}
      <div
        style={{
          width: 2,
          height: LANE_CONN_H,
          background: isTop ? 'transparent' : color,
          flexShrink: 0,
        }}
      />

      {/* Bottom zone */}
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

// ─── Event detail panel (slide-in) ─────────────────────────────────────────────

function EventDetailPanel({
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
  const color = TYPE_COLORS[event.type];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'oklch(0 0 0 / 0.22)',
        }}
      />
      <div
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
            aria-label="Закрыть"
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
