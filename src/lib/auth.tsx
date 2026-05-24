import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithTelegram: (data: TelegramAuthData) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Читаем сессию из localStorage синхронно — чтобы не блокировать первый рендер
// на медленных соединениях (Россия, VPN). getSession() всё равно валидирует async.
function readLocalSession(): Session | null {
  try {
    const url = (import.meta.env.VITE_SUPABASE_URL ?? '') as string;
    if (!url) return null;
    const ref = new URL(url).hostname.split('.')[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    return data?.access_token ? (data as unknown as Session) : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const localSession = readLocalSession();
  const [session, setSession] = useState<Session | null>(localSession);
  const [loading, setLoading] = useState(localSession === null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Различаем намеренный logout от истечения токена
  const hadSession = useRef(localSession !== null);
  const deliberateSignOut = useRef(false);

  useEffect(() => {
    // 5-секундный таймаут: если Supabase медленно отвечает (throttled ISP),
    // разблокируем UI — но getSession() всё равно обновит сессию когда придёт.
    const fallback = setTimeout(() => setLoading(false), 5_000);

    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(fallback);
      if (data.session) hadSession.current = true;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT' && hadSession.current && !deliberateSignOut.current) {
        setSessionExpired(true);
      }
      if (s) {
        hadSession.current = true;
        setSessionExpired(false);
      }
      deliberateSignOut.current = false;
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp: AuthContextValue['signUp'] = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle: AuthContextValue['signInWithGoogle'] = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });
    return { error: error?.message ?? null };
  };

  const signInWithTelegram: AuthContextValue['signInWithTelegram'] = async (data) => {
    const { data: res, error } = await supabase.functions.invoke('telegram-auth', { body: data });
    if (error) return { error: error.message };
    const token_hash = (res as { token_hash?: string } | null)?.token_hash;
    if (!token_hash) return { error: 'telegram-auth: token_hash отсутствует' };
    const { error: verifyErr } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' });
    return { error: verifyErr?.message ?? null };
  };

  const signOut = async () => {
    deliberateSignOut.current = true;
    await supabase.auth.signOut();
  };

  const clearSessionExpired = () => setSessionExpired(false);

  const resetPasswordForEmail: AuthContextValue['resetPasswordForEmail'] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword: AuthContextValue['updatePassword'] = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithTelegram,
        signOut,
        sessionExpired,
        clearSessionExpired,
        resetPasswordForEmail,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
