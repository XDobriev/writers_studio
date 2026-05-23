import { supabase } from './supabase';

export type VersionTrigger = 'beforeunload' | 'chapter_switch' | 'timer' | 'manual';

export interface ChapterVersionMeta {
  id: string;
  chapter_id: string;
  user_id: string;
  word_count: number | null;
  label: string | null;
  trigger: VersionTrigger;
  created_at: string;
}

export async function listVersions(chapterId: string): Promise<ChapterVersionMeta[]> {
  const { data, error } = await supabase
    .from('chapter_versions')
    .select('id, chapter_id, user_id, word_count, label, trigger, created_at')
    .eq('chapter_id', chapterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ChapterVersionMeta[];
}

export async function getVersionContent(id: string): Promise<string> {
  const { data, error } = await supabase
    .from('chapter_versions')
    .select('content')
    .eq('id', id)
    .single();
  if (error) throw error;
  return (data as { content: string }).content;
}

export async function createVersion(
  chapterId: string,
  userId: string,
  content: string,
  wordCount: number,
  trigger: VersionTrigger,
  isPro: boolean,
  label?: string,
): Promise<void> {
  // Пропускаем если контент не изменился с последнего снимка
  const { data: last } = await supabase
    .from('chapter_versions')
    .select('content')
    .eq('chapter_id', chapterId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last && (last as { content: string }).content === content) return;

  const { error } = await supabase.from('chapter_versions').insert({
    chapter_id: chapterId,
    user_id: userId,
    content,
    word_count: wordCount,
    trigger,
    label: label ?? null,
  });
  if (error) throw error;

  await pruneVersions(chapterId, isPro);
}

async function pruneVersions(chapterId: string, isPro: boolean): Promise<void> {
  if (isPro) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('chapter_versions')
      .delete()
      .eq('chapter_id', chapterId)
      .is('label', null)
      .lt('created_at', cutoff);
  } else {
    const { data: autoSnaps } = await supabase
      .from('chapter_versions')
      .select('id')
      .eq('chapter_id', chapterId)
      .is('label', null)
      .order('created_at', { ascending: false });
    if (autoSnaps && autoSnaps.length > 10) {
      const toDelete = (autoSnaps as { id: string }[]).slice(10).map((s) => s.id);
      await supabase.from('chapter_versions').delete().in('id', toDelete);
    }
  }
}

export async function deleteVersion(id: string): Promise<void> {
  const { error } = await supabase.from('chapter_versions').delete().eq('id', id);
  if (error) throw error;
}

// Используется в beforeunload — fetch с keepalive, обычный supabase-клиент не успевает завершиться
export function createVersionKeepAlive(
  chapterId: string,
  userId: string,
  content: string,
  wordCount: number,
  supabaseUrl: string,
  anonKey: string,
  token: string,
): void {
  void fetch(`${supabaseUrl}/rest/v1/chapter_versions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      chapter_id: chapterId,
      user_id: userId,
      content,
      word_count: wordCount,
      trigger: 'beforeunload',
      label: null,
    }),
    keepalive: true,
  });
}
