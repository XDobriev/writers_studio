import { supabase } from './supabase';

export type TimelineEventType = 'plot' | 'character' | 'world' | 'other';

export interface TimelineEvent {
  id: string;
  book_id: string;
  user_id: string;
  era: string;
  title: string;
  description: string;
  type: TimelineEventType;
  chapter_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export type TimelineEventPatch = Partial<
  Pick<TimelineEvent, 'era' | 'title' | 'description' | 'type' | 'chapter_id' | 'position'>
>;

export async function listTimelineEvents(bookId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from('timeline_events')
    .select('*')
    .eq('book_id', bookId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TimelineEvent[];
}

export async function createTimelineEvent(
  bookId: string,
  userId: string,
  patch: { era?: string; title?: string; type?: TimelineEventType; position?: number } = {},
): Promise<TimelineEvent> {
  const { data, error } = await supabase
    .from('timeline_events')
    .insert({
      book_id: bookId,
      user_id: userId,
      era: patch.era ?? '',
      title: patch.title ?? 'Событие',
      type: patch.type ?? 'plot',
      position: patch.position ?? 0,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as TimelineEvent;
}

export async function updateTimelineEvent(id: string, patch: TimelineEventPatch): Promise<TimelineEvent> {
  const { data, error } = await supabase
    .from('timeline_events')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as TimelineEvent;
}

export async function deleteTimelineEvent(id: string): Promise<void> {
  const { error } = await supabase.from('timeline_events').delete().eq('id', id);
  if (error) throw error;
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

export async function reorderTimelineEvents(updates: { id: string; position: number }[]): Promise<void> {
  await Promise.all(
    updates.map(({ id, position }) =>
      supabase.from('timeline_events').update({ position }).eq('id', id)
    )
  );
}
