import { supabase } from './supabase';
import { createRepository } from './repository';
import type { Tables } from './database.types';

export type TimelineEventType = 'plot' | 'character' | 'world' | 'other';

// Выведено из БД (Tables<'timeline_events'>); type сужен до union.
export type TimelineEvent = Omit<Tables<'timeline_events'>, 'type'> & { type: TimelineEventType };

export type TimelineEventPatch = Partial<
  Pick<TimelineEvent, 'era' | 'title' | 'description' | 'type' | 'chapter_id' | 'position'>
>;

const DEFAULT_EVENT_TITLE = 'Событие';

const repo = createRepository<TimelineEvent>(
  'timeline_events',
  { era: '', title: DEFAULT_EVENT_TITLE, type: 'plot', position: 0 },
  [{ column: 'position', ascending: true }, { column: 'created_at', ascending: true }],
);

export function listTimelineEvents(bookId: string): Promise<TimelineEvent[]> {
  return repo.list(bookId);
}

/** Событие, которое только что создали и ни разу не тронули: заголовок по умолчанию, остальное пусто. */
export function isBlankTimelineEvent(e: TimelineEvent): boolean {
  return (
    e.title === DEFAULT_EVENT_TITLE &&
    e.era === '' &&
    e.description === '' &&
    e.type === 'plot' &&
    e.chapter_id === null
  );
}

export function createTimelineEvent(
  bookId: string,
  userId: string,
  patch: { era?: string; title?: string; type?: TimelineEventType; position?: number } = {},
): Promise<TimelineEvent> {
  return repo.create(bookId, userId, patch);
}

export function updateTimelineEvent(id: string, patch: TimelineEventPatch): Promise<TimelineEvent> {
  return repo.update(id, patch);
}

export function deleteTimelineEvent(id: string): Promise<void> {
  return repo.delete(id);
}

export const TYPE_LABELS: Record<TimelineEventType, string> = {
  plot: 'Сюжет',
  character: 'Персонаж',
  world: 'Мир',
  other: 'Другое',
};

export const TYPE_COLORS: Record<TimelineEventType, string> = {
  plot: 'var(--accent)',
  character: 'var(--info)',
  world: 'var(--ok)',
  other: 'var(--ink-3)',
};

export type TypeFilter = 'all' | TimelineEventType;

export const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all',       label: 'все'      },
  { value: 'plot',      label: 'сюжет'    },
  { value: 'character', label: 'персонаж' },
  { value: 'world',     label: 'мир'      },
  { value: 'other',     label: 'другое'   },
];

export async function reorderTimelineEvents(updates: { id: string; position: number }[]): Promise<void> {
  if (updates.length === 0) return;
  const { error } = await supabase.rpc('reorder_timeline_events', { updates });
  if (error) throw error;
}
