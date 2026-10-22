import { supabase } from './supabase';
import type { Tables } from './database.types';

export type VersionTrigger = 'beforeunload' | 'chapter_switch' | 'timer' | 'manual';

// Выведено из БД (Tables<'chapter_versions'>) без content; trigger сужен до union.
export type ChapterVersionMeta = Omit<Tables<'chapter_versions'>, 'content' | 'content_hash' | 'trigger'> & {
  trigger: VersionTrigger;
};

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

// Дедуп и ретеншн — на сервере (20261022000500_chapter_versions_retention.sql):
// автоснимок, совпадающий по content_hash с последним, не вставляется; чистка
// идёт по плану из profiles (Pro/Lifetime — 30 дней, Free — 10 последних).
// Клиент не скачивает прошлый снимок и не решает, кто Pro.
export async function createVersion(
  chapterId: string,
  userId: string,
  content: string,
  wordCount: number,
  trigger: VersionTrigger,
  label?: string,
): Promise<void> {
  const { error } = await supabase.from('chapter_versions').insert({
    chapter_id: chapterId,
    user_id: userId,
    content,
    word_count: wordCount,
    trigger,
    label: label ?? null,
  });
  if (error) throw error;
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
