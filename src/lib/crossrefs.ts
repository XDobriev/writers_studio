import { supabase } from './supabase';
import type { Character } from './characters';

function htmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractCharacterMentions(content: string, aliases: string[]): boolean {
  const text = htmlToText(content);
  for (const alias of aliases) {
    const trimmed = alias.trim();
    if (!trimmed) continue;
    try {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // \b не работает для кириллицы — используем Unicode-границы через lookaround
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'vi');
      if (pattern.test(text)) return true;
    } catch {
      // skip invalid pattern
    }
  }
  return false;
}

export interface ChapterCharacterRow {
  id: string;
  chapter_id: string;
  character_id: string;
  auto_detected: boolean;
  chapters: { title: string; position: number } | null;
}

export async function listChapterCharacters(characterId: string): Promise<ChapterCharacterRow[]> {
  const { data, error } = await supabase
    .from('chapter_characters')
    .select('id, chapter_id, character_id, auto_detected, chapters(title, position)')
    .eq('character_id', characterId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as ChapterCharacterRow[];
  return rows.sort((a, b) => (a.chapters?.position ?? 0) - (b.chapters?.position ?? 0));
}

export async function syncBacklinks(
  chapterId: string,
  bookId: string,
  content: string,
  characters: Character[],
): Promise<void> {
  await Promise.all(
    characters.map(async (character) => {
      const aliases = [character.name, ...(character.aliases ?? [])].filter(Boolean);
      const found = extractCharacterMentions(content, aliases);

      if (found) {
        await supabase
          .from('chapter_characters')
          .upsert(
            {
              book_id: bookId,
              user_id: character.user_id,
              chapter_id: chapterId,
              character_id: character.id,
              auto_detected: true,
            },
            { onConflict: 'chapter_id,character_id', ignoreDuplicates: true },
          );
      } else {
        await supabase
          .from('chapter_characters')
          .delete()
          .eq('chapter_id', chapterId)
          .eq('character_id', character.id)
          .eq('auto_detected', true);
      }
    }),
  );
}
