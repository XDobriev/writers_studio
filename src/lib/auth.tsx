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
  // true пока getSession() не завершился — AuthGuard не должен редиректить до этого момента.
  initializing: boolean;
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
// session — валидная (не истёкшая) сессия, иначе null.
// hadToken — был ли вообще сохранённый токен (даже истёкший). Значит юзер был залогинен
// и getSession() сейчас делает рефреш — нельзя по таймауту открывать роуты в разлогиненное
// состояние, иначе AuthGuard на мгновение редиректит на лендинг.
function readLocalSession(): { session: Session | null; hadToken: boolean } {
  try {
    // Supabase JS v2 хардкодит ключ 'supabase.auth.token' в GoTrueClient
    // (см. @supabase/auth-js/dist/main/lib/constants.js STORAGE_KEY).
    // Прежний вариант с hostname.split('.')[0] давал неверный ключ → всегда null.
    const raw = localStorage.getItem('supabase.auth.token');
    if (!raw) return { session: null, hadToken: false };
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    if (!data?.access_token) return { session: null, hadToken: false };
    // expires_at — unix секунды; истёкший токен есть, но как сессию его не отдаём
    const exp = data.expires_at as number | undefined;
    if (exp && exp < Math.floor(Date.now() / 1000)) return { session: null, hadToken: true };
    return { session: data as unknown as Session, hadToken: true };
  } catch { return { session: null, hadToken: false }; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { session: localSession, hadToken } = readLocalSession();
  const [session, setSession] = useState<Session | null>(localSession);
  const [loading, setLoading] = useState(localSession === null);
  const [initializing, setInitializing] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Различаем намеренный logout от истечения токена.
  // hadToken === true и для истёкшего токена — юзер был залогинен, рефреш в процессе.
  const hadSession = useRef(hadToken);
  const deliberateSignOut = useRef(false);
  // true пока getSession() не вернул окончательный результат.
  // onAuthStateChange может выстрелить INITIAL_SESSION(null) во время рефреша токена
  // раньше чем getSession завершится — без этого флага session обнуляется при loading=false,
  // что вызывает редирект на /login и визуальный "флэш" страницы авторизации.
  const getSessionPending = useRef(true);

  useEffect(() => {
    // Fallback-таймаут на случай медленного Supabase (throttled ISP, VPS /sb прокси).
    // Нет сохранённого токена → 5 с: юзер скорее всего реально разлогинен, открываем Landing/login.
    // Токен был (идёт рефреш истёкшего) → 15 с: НЕ открываем роуты раньше времени, иначе AuthGuard
    // мигнёт лендингом и отскочит назад. 15 с — лишь страховка от вечного спиннера на мёртвом канале;
    // на живом-но-медленном getSession() резолвится раньше.
    const fallback = setTimeout(() => {
      getSessionPending.current = false;
      setInitializing(false);
      setLoading(false);
    }, hadToken ? 15_000 : 5_000);

    supabase.auth.getSession().then(({ data }) => {
      getSessionPending.current = false;
      clearTimeout(fallback);
      if (data.session) hadSession.current = true;
      setSession(data.session);
      setInitializing(false);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // INITIAL_SESSION(null) может прийти раньше getSession() во время рефреша токена.
      // Игнорируем null-события до тех пор пока getSession() не дал окончательный ответ.
      if (getSessionPending.current && s === null) return;

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
    // hadToken читается из localStorage один раз при монтировании — эффект mount-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    try {
      await supabase.auth.signOut();
    } finally {
      // Сбрасываем флаг здесь на случай если onAuthStateChange пропустил SIGNED_OUT
      // через ранний return (getSessionPending.current === true во время логаута).
      deliberateSignOut.current = false;
    }
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
        initializing,
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
