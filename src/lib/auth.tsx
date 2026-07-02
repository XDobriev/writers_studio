import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

const SUPABASE_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'Неверная почта или пароль. Проверьте раскладку и регистр.',
  'Email not confirmed': 'Почта не подтверждена. Проверьте входящие письма.',
  'User already registered': 'Пользователь с этой почтой уже зарегистрирован.',
  'Password should be at least 6 characters.': 'Пароль должен содержать не менее 6 символов.',
  'Signup requires a valid password': 'Необходимо задать пароль.',
  'Email rate limit exceeded': 'Слишком много попыток. Повторите позже.',
  'For security purposes, you can only request this once every 60 seconds': 'По соображениям безопасности — не чаще одного запроса в 60 секунд.',
  'Unable to validate email address: invalid format': 'Неверный формат адреса электронной почты.',
};

export function translateAuthError(msg: string): string {
  return SUPABASE_ERRORS[msg] ?? msg;
}

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
  signInWithVk: (accessToken: string, userId: number) => Promise<{ error: string | null }>;
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
  // Ключ формируется ИДЕНТИЧНО supabase-js: createClient передаёт в GoTrueClient
  // storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  // (см. @supabase/supabase-js SupabaseClient.ts). Дефолт 'supabase.auth.token' из auth-js
  // читать нельзя — createClient его ВСЕГДА переопределяет, такого ключа в localStorage нет.
  try {
    const url = (import.meta.env.VITE_SUPABASE_URL ?? '') as string;
    if (!url) return { session: null, hadToken: false };
    const key = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
    const raw = localStorage.getItem(key);
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
    // мигнёт логином и отскочит назад. 15 с — лишь страховка от вечного спиннера на мёртвом канале;
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

  // Мемоизированы: useTelegramAuth/useVkAuth держат их в deps эффекта, монтирующего
  // SDK-виджет. Нестабильная идентичность → эффект перезапускается на каждый рендер
  // AuthProvider (в т.ч. на SIGNED_IN, вызванном самим логином) → повторный монтаж
  // виджета и риск двойного входа.
  const signInWithTelegram = useCallback<AuthContextValue['signInWithTelegram']>(async (data) => {
    const { data: res, error } = await supabase.functions.invoke('telegram-auth', { body: data });
    if (error) return { error: error.message };
    const token_hash = (res as { token_hash?: string } | null)?.token_hash;
    if (!token_hash) return { error: 'telegram-auth: token_hash отсутствует' };
    const { error: verifyErr } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' });
    return { error: verifyErr?.message ?? null };
  }, []);

  const signInWithVk = useCallback<AuthContextValue['signInWithVk']>(async (accessToken, userId) => {
    const { data: res, error } = await supabase.functions.invoke('vk-auth', {
      body: { access_token: accessToken, user_id: userId },
    });
    if (error) {
      let detail = error.message;
      try {
        const body = await (error.context as Response | undefined)?.json() as { error?: string } | undefined;
        if (body?.error) detail = body.error;
      } catch { /* ignore */ }
      console.error('[vk-auth] edge function error:', detail);
      return { error: detail };
    }
    const token_hash = (res as { token_hash?: string } | null)?.token_hash;
    if (!token_hash) return { error: 'vk-auth: token_hash отсутствует' };
    const { error: verifyErr } = await supabase.auth.verifyOtp({ token_hash, type: 'magiclink' });
    return { error: verifyErr?.message ?? null };
  }, []);

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
        signInWithVk,
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
