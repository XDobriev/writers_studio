import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useErrorState } from '../lib/useErrorState';
import { ErrorBanner } from '../components/ErrorBanner';
import { useResponsive } from '../lib/useResponsive';
import { Navigate, useParams } from 'react-router-dom';
import { useCreateOnMount } from '../lib/useCreateOnMount';
import { useQueryClient } from '@tanstack/react-query';
import { type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Icon } from '../components/Icon';
import { Sidebar, WithMode } from '../components/Chrome';
import { MobileSidebarDrawer } from '../components/MobileSidebarDrawer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { useAuth } from '../lib/auth';
import { getPlanLimits } from '../lib/profiles';
import {
  createTimelineEvent,
  deleteTimelineEvent,
  reorderTimelineEvents,
  updateTimelineEvent,
  type TimelineEvent,
  type TimelineEventPatch,
  type TypeFilter,
} from '../lib/timeline';
import { TimelineEventCard } from '../components/TimelineEventCard';
import { TimelineFilters } from '../components/TimelineFilters';
import { QUERY_KEYS, useBook, useChapters, useTimelineEvents, useProfile } from '../lib/queries';
import { TimelineLane } from '../components/TimelineLane';
import { EventDetailPanel } from '../components/EventDetailPanel';

type View = 'list' | 'lane';

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
  const [sbOpen, setSbOpen] = useState(false);

  const activeEvent = useMemo(
    () => events?.find((e) => e.id === activeEventId) ?? null,
    [events, activeEventId]
  );

  const switchView = (v: View) => {
    setView(v);
    localStorage.setItem('timeline-view', v);
  };

  const creatingRef = useRef(false);
  const handleCreateCore = useCallback(async () => {
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
      void handleCreateCore();
    }
  }, [events?.length, limits.maxTimelineEvents, handleCreateCore]);

  useCreateOnMount(handleCreate);

  const handleUpdate = useCallback(
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

  const handleCloseDetail = useCallback(() => setActiveEventId(null), []);

  const handleDelete = useCallback((id: string) => {
    setConfirmDeleteId(id);
  }, []);

  const handleDeleteConfirmed = useCallback(async () => {
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

  const handleDragEnd = useCallback(
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
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isMobile && (
                <button type="button" className="tb-btn" onClick={() => setSbOpen(true)} title="Навигация" aria-label="Навигация" style={{ flexShrink: 0 }}>
                  <Icon name="panel" size={16} />
                </button>
              )}
              <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)' }}>Хронология</span>
            </div>
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

          {isMobile && (
            <TimelineFilters variant="mobile" filter={filter} onFilter={setFilter} />
          )}

          {mutationError && (
            <ErrorBanner message={mutationError} onDismiss={clearError} style={{ margin: '8px 24px 0', flexShrink: 0 }} />
          )}

          {showLane ? (
            events.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{emptyState}</div>
            ) : (
              <TimelineLane
                events={filtered}
                activeEventId={activeEventId}
                dragEnabled={filter === 'all'}
                onSelect={(id) => setActiveEventId(activeEventId === id ? null : id)}
                onDragEnd={handleDragEnd}
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
                        onUpdate={(patch) => handleUpdate(ev.id, patch)}
                        onDelete={() => handleDelete(ev.id)}
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
          onUpdate={(patch) => handleUpdate(activeEvent.id, patch)}
          onDelete={() => handleDelete(activeEvent.id)}
          onClose={handleCloseDetail}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        message="Удалить это событие? Действие нельзя отменить."
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <UpgradePrompt open={showUpgrade} feature="timeline" onClose={() => setShowUpgrade(false)} />

      <MobileSidebarDrawer
        open={sbOpen}
        onClose={() => setSbOpen(false)}
        book={book}
        subtitle={`хронология · ${events.length}`}
      >
        <div className="sb-section">
          <span className="sb-section-title">Слои</span>
        </div>
        <TimelineFilters variant="sidebar" filter={filter} onFilter={setFilter} />
      </MobileSidebarDrawer>
    </WithMode>
    </motion.div>
  );
}
