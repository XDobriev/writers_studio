import { createClient } from '@supabase/supabase-js';

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

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  genre: string | null;
  genres: string[];
  words: number;
  goal: number;
  daily_goal: number;
  cover: string | null;
  share_token: string | null;
  map_bg_url: string | null;
  created_at: string;
  updated_at: string;
}
