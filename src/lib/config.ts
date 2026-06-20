// src/lib/config.ts
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const VK_APP_ID = 54634821;
export const VK_REDIRECT_URL = `${SUPABASE_URL}/auth/v1/callback`;
