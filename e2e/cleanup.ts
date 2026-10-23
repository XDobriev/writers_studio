import { createClient } from '@supabase/supabase-js';

// Тесты создают записи в книге e2e-аккаунта. Без уборки они копились годами прогонов
// (десятки пустых «Глава 1», безымянные персонажи, «Событие»), и реальные главы
// фикстуры сдвигались в нумерации. Удаляем под тем же пользователем (RLS) всё,
// что создано в этой книге с начала теста.
const TABLES = ['chapters', 'characters', 'timeline_events', 'notes', 'locations'] as const;

export function bookIdFromHref(href: string): string {
  return href.split('/')[2] ?? '';
}

export async function deleteCreatedSince(bookId: string, since: Date): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!url || !key || !email || !password || !bookId) return;

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  for (const table of TABLES) {
    const { error: delError } = await sb.from(table).delete()
      .eq('book_id', bookId)
      .gte('created_at', since.toISOString());
    if (delError) throw new Error(`cleanup ${table}: ${delError.message}`);
  }
  await sb.auth.signOut();
}
