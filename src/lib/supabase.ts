import { createClient } from '@supabase/supabase-js';
import type { Database, Tables } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL или VITE_SUPABASE_ANON_KEY не заданы. Скопируйте .env.example в .env и заполните значения из Supabase Dashboard → Project Settings → API.',
  );
}

export const supabase = createClient<Database>(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const supabaseConfigured = Boolean(url && anonKey);

// Гарантирует, что сессия загружена из localStorage и пользовательский токен прикреплён
// к внутренним клиентам (в т.ч. Storage) ДО первого запроса. Без этого supabase-js может
// успеть отправить Storage-запрос с дефолтным anon-ключом (роль anon, auth.uid() = null),
// и RLS-политика бакета `TO authenticated` отклонит загрузку:
// «new row violates row-level security policy». Вызывать перед storage.upload().
export async function ensureAuthReady(): Promise<void> {
  await supabase.auth.getSession();
}

// Выведено из БД (Tables<'books'>); genres сужен до non-null — таков контракт приложения.
export type Book = Omit<Tables<'books'>, 'genres'> & { genres: string[] };
