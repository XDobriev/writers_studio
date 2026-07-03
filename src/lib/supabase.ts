import { createClient } from '@supabase/supabase-js';
import type { Tables } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL или VITE_SUPABASE_ANON_KEY не заданы. Скопируйте .env.example в .env и заполните значения из Supabase Dashboard → Project Settings → API.',
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const supabaseConfigured = Boolean(url && anonKey);

// Выведено из БД (Tables<'books'>); genres сужен до non-null — таков контракт приложения.
export type Book = Omit<Tables<'books'>, 'genres'> & { genres: string[] };
