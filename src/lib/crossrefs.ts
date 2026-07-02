import { supabase } from './supabase';
import type { Character } from './characters';
import { htmlToText } from './htmlUtils';
import { makeAliasPattern } from './characterMatching';

// Проверка по уже подготовленному plain-тексту (без повторного htmlToText).
function textMentionsAny(text: string, aliases: string[]): boolean {
  for (const alias of aliases) {
    const pattern = makeAliasPattern(alias);
    if (pattern && pattern.test(text)) return true;
  }
  return false;
}

export function extractCharacterMentions(content: string, aliases: string[]): boolean {
  return textMentionsAny(htmlToText(content), aliases);
}

export interface ChapterCharacterRow {
  id: string;
  chapter_id: string;
  character_id: string;
  auto_detected: boolean;
  is_pov: boolean;
  chapters: { title: string; position: number } | null;
}

export interface ChapterMemberRow {
  character_id: string;
  is_pov: boolean;
  auto_detected: boolean;
  characters: { name: string; avatar_url: string | null; position: number } | null;
}

export async function listChapterMembers(chapterId: string): Promise<ChapterMemberRow[]> {
  const { data, error } = await supabase
    .from('chapter_characters')
    .select('character_id, is_pov, auto_detected, characters(name, avatar_url, position)')
    .eq('chapter_id', chapterId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ChapterMemberRow[];
  return rows.sort((a, b) => (a.characters?.position ?? 0) - (b.characters?.position ?? 0));
}

export async function listChapterCharacters(characterId: string): Promise<ChapterCharacterRow[]> {
  const { data, error } = await supabase
    .from('chapter_characters')
    .select('id, chapter_id, character_id, auto_detected, is_pov, chapters(title, position)')
    .eq('character_id', characterId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ChapterCharacterRow[];
  return rows.sort((a, b) => (a.chapters?.position ?? 0) - (b.chapters?.position ?? 0));
}

export async function syncCharacterAcrossAllChapters(
  character: Character,
  bookId: string,
): Promise<void> {
  const aliases = [character.name, ...(character.aliases ?? [])].filter(Boolean);
  if (aliases.length === 0) return;

  const { error } = await supabase.rpc('sync_character_chapters', {
    p_character_id: character.id,
    p_book_id: bookId,
    p_aliases: aliases,
  });
  if (error) throw error;
}

export async function findNameVariantsInText(
  name: string,
  bookId: string,
  existingAliases: string[],
): Promise<string[]> {
  if (name.length < 2) return [];

  const { data, error } = await supabase
    .from('chapters')
    .select('content')
    .eq('book_id', bookId);
  if (error || !data) return [];

  const prefixLen = Math.max(3, Math.floor(name.length * 0.6));
  const prefix = name.slice(0, prefixLen).toLowerCase();
  const nameLower = name.toLowerCase();
  const aliasesLower = new Set(existingAliases.map((a) => a.toLowerCase()));

  const firstSeen = new Map<string, string>();
  const freq = new Map<string, number>();

  for (const chapter of data) {
    const text = htmlToText(chapter.content ?? '');
    const words = text.match(/[\p{L}]{3,}/gu) ?? [];
    for (const word of words) {
      const wl = word.toLowerCase();
      if (!firstSeen.has(wl)) firstSeen.set(wl, word);
      freq.set(wl, (freq.get(wl) ?? 0) + 1);
    }
  }

  return Array.from(freq.entries())
    .filter(([wl]) => wl !== nameLower && !aliasesLower.has(wl) && wl.startsWith(prefix))
    .sort((a, b) => b[1] - a[1])
    .map(([wl]) => firstSeen.get(wl)!)
    .slice(0, 8);
}

export async function syncBacklinks(
  chapterId: string,
  bookId: string,
  content: string,
  characters: Character[],
): Promise<void> {
  const foundRows: { book_id: string; user_id: string; chapter_id: string; character_id: string; auto_detected: boolean }[] = [];
  const notFoundIds: string[] = [];

  // htmlToText один раз на всю главу, а не на каждого персонажа.
  const text = htmlToText(content);

  for (const character of characters) {
    const aliases = [character.name, ...(character.aliases ?? [])].filter(Boolean);
    if (textMentionsAny(text, aliases)) {
      foundRows.push({
        book_id: bookId,
        user_id: character.user_id,
        chapter_id: chapterId,
        character_id: character.id,
        auto_detected: true,
      });
    } else {
      notFoundIds.push(character.id);
    }
  }

  if (foundRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from('chapter_characters')
      .upsert(foundRows, { onConflict: 'chapter_id,character_id', ignoreDuplicates: true });
    if (upsertErr) throw upsertErr;
  }

  if (notFoundIds.length > 0) {
    const { error: deleteErr } = await supabase
      .from('chapter_characters')
      .delete()
      .eq('chapter_id', chapterId)
      .in('character_id', notFoundIds)
      .eq('auto_detected', true)
      .eq('is_pov', false);
    if (deleteErr) throw deleteErr;
  }
}
