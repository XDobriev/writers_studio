import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useResponsive } from '../lib/useResponsive';
import { useErrorState } from '../lib/useErrorState';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type TelegramAuthData } from '../lib/auth';
import { LogoMark } from '../components/LogoMark';
import { PasswordInput } from '../components/PasswordInput';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { useRegistrationOpen } from '../lib/queries';

type Tab = 'signin' | 'signup';
type Flow = 'auth' | 'reset-request' | 'reset-sent';

const SUPABASE_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'Неверная почта или пароль.',
  'Email not confirmed': 'Почта не подтверждена. Проверьте входящие письма.',
  'User already registered': 'Пользователь с этой почтой уже зарегистрирован.',
  'Password should be at least 6 characters.': 'Пароль должен содержать не менее 6 символов.',
  'Signup requires a valid password': 'Необходимо задать пароль.',
  'Email rate limit exceeded': 'Слишком много попыток. Повторите позже.',
  'For security purposes, you can only request this once every 60 seconds': 'По соображениям безопасности — не чаще одного запроса в 60 секунд.',
  'Unable to validate email address: invalid format': 'Неверный формат адреса электронной почты.',
};

function te(msg: string): string {
  return SUPABASE_ERRORS[msg] ?? msg;
}

const TG_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;
const TG_CALLBACK = '__onTelegramAuth';

interface VkidOneTapInstance {
  on: (event: string, handler: (payload?: unknown) => void) => VkidOneTapInstance;
}

interface VkidSDK {
  Config: {
    init: (opts: {
      app: number;
      redirectUrl: string;
      responseMode: unknown;
      source: unknown;
      scope: string;
    }) => void;
  };
  ConfigResponseMode: { Callback: unknown };
  ConfigSource: { LOWCODE: unknown };
  OneTap: new () => {
    render: (opts: { container: HTMLElement; showAlternativeLogin: boolean }) => VkidOneTapInstance;
  };
  Auth: {
    exchangeCode: (code: string, deviceId: string) => Promise<{
      access_token: string;
      user_id?: number;
      user?: { id: number };
    }>;
  };
  WidgetEvents: { ERROR: string };
  OneTapInternalEvents: { LOGIN_SUCCESS: string };
}

const VK_APP_ID = 54634821;

declare global {
  interface Window {
    [TG_CALLBACK]?: (user: TelegramAuthData) => void;
    VKIDSDK?: VkidSDK;
  }
}

export default function Auth() {
  const { session, signIn, signUp, signInWithGoogle, signInWithTelegram, signInWithVk, resetPasswordForEmail } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(() =>
    new URLSearchParams(location.search).get('tab') === 'signup' ? 'signup' : 'signin'
  );
  const [flow, setFlow] = useState<Flow>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<'google' | 'telegram' | 'vk' | null>(null);
  const [redirectingToPay, setRedirectingToPay] = useState(false);
  const { error: err, setError: setErr, clearError: clearErr } = useErrorState();
  const [info, setInfo] = useState<string | null>(null);
  const { data: registrationOpen = true } = useRegistrationOpen();
  const tgSlotRef = useRef<HTMLDivElement | null>(null);
  const vkSlotRef = useRef<HTMLDivElement | null>(null);
  const vkHasClickedRef = useRef(false);
  const [vkSdkFailed, setVkSdkFailed] = useState(false);
  const { isMobile } = useResponsive();

  useEffect(() => {
    if (!TG_BOT_USERNAME || !tgSlotRef.current) return;
    window[TG_CALLBACK] = async (user) => {
      setOauthBusy('telegram');
      clearErr();
      const { error } = await signInWithTelegram(user);
      setOauthBusy(null);
      if (error) setErr(`Telegram: ${te(error)}`);
    };
    const slot = tgSlotRef.current;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', TG_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-radius', '6');
    script.setAttribute('data-onauth', `${TG_CALLBACK}(user)`);
    script.setAttribute('data-request-access', 'write');
    const observer = new MutationObserver(() => {
      const iframe = slot.querySelector('iframe');
      if (iframe) {
        iframe.style.width = '100%';
        iframe.style.height = '42px';
        observer.disconnect();
      }
    });
    observer.observe(slot, { childList: true, subtree: true });
    slot.appendChild(script);
    return () => {
      observer.disconnect();
      slot.innerHTML = '';
      delete window[TG_CALLBACK];
    };
  }, [signInWithTelegram, clearErr, setErr]);

  useEffect(() => {
    if (!vkSlotRef.current) return;
    const slot = vkSlotRef.current;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://unpkg.com/@vkid/sdk@<3.0.0/dist-sdk/umd/index.js';

    script.onerror = () => { setVkSdkFailed(true); };

    script.onload = () => {
      const VKID = window.VKIDSDK;
      if (!VKID) return;

      VKID.Config.init({
        app: VK_APP_ID,
        redirectUrl: 'https://joaxeoavjvlqmtlepkrr.supabase.co/auth/v1/callback',
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: '',
      });

      const oneTap = new VKID.OneTap();
      oneTap
        .render({ container: slot, showAlternativeLogin: false })
        .on(VKID.WidgetEvents.ERROR, () => {
          if (!vkHasClickedRef.current) return;
          setOauthBusy(null);
          setErr('Ошибка VK ID. Попробуйте войти по почте или повторите позже.');
        })
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload) => {
          void (async () => {
            const { code, device_id } = payload as { code: string; device_id: string };
            setOauthBusy('vk');
            clearErr();
            try {
              const tokenData = await VKID.Auth.exchangeCode(code, device_id);
              const vkUserId = tokenData.user?.id ?? tokenData.user_id ?? 0;
              const { error } = await signInWithVk(tokenData.access_token, vkUserId);
              if (error) setErr(`VK: ${te(error)}`);
            } catch {
              setErr('Ошибка авторизации VK. Попробуйте ещё раз.');
            } finally {
              setOauthBusy(null);
            }
          })();
        });
    };

    slot.appendChild(script);
    return () => {
      slot.innerHTML = '';
    };
  }, [signInWithVk, clearErr, setErr]);

  // Редирект в эффекте — не в render — чтобы форма не мигала пустым кадром
  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(location.search);
    const plan = (params.get('plan') ?? sessionStorage.getItem('pending_plan')) as 'pro' | 'lifetime' | null;
    if (plan === 'pro' || plan === 'lifetime') {
      sessionStorage.removeItem('pending_plan');
      setRedirectingToPay(true);
      void (async () => {
        try {
          const { data, error } = await supabase.functions.invoke('create-payment-url', {
            body: { plan },
          });
          if (error || !data?.url) throw error ?? new Error('no url');
          window.location.href = data.url as string;
        } catch {
          setRedirectingToPay(false);
          navigate('/books', { replace: true });
        }
      })();
      return;
    }
    const rawFrom = (location.state as { from?: string } | null)?.from ?? '/books';
    // Срезаем до /books если from указывает на конкретную книгу —
    // после смены аккаунта (VK/Telegram → email и наоборот) та книга недоступна.
    const from = rawFrom.startsWith('/books/') ? '/books' : rawFrom;
    navigate(from, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearErr();
    setInfo(null);
    setBusy(true);
    if (flow === 'reset-request') {
      const { error } = await resetPasswordForEmail(email);
      if (error) {
        setErr(te(error));
      } else {
        setFlow('reset-sent');
      }
      setBusy(false);
      return;
    }
    if (tab === 'signin') {
      const { error } = await signIn(email, password);
      if (error) {
        if (error === 'Invalid login credentials') {
          setTab('signup');
          setConsent(false);
          setInfo('Аккаунт с такой почтой не найден — завершите регистрацию.');
        } else {
          setErr(te(error));
        }
      }
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        setErr(te(error));
      } else {
        setInfo('Аккаунт создан. Входим…');
      }
    }
    setBusy(false);
  };

  const onGoogle = async () => {
    clearErr();
    setOauthBusy('google');
    const { error } = await signInWithGoogle();
    if (error) {
      setErr('Ошибка подключения. Попробуйте войти по почте или повторите попытку позже.');
      setOauthBusy(null);
    }
    // при успехе редирект уходит на Google — стейт busy не сбрасываем
  };

  if (redirectingToPay) {
    return (
      <div className="as" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="btn-spinner" style={{ display: 'inline-block', marginBottom: 16 }} />
          <p style={{ font: '400 14px var(--font-ui)', color: 'var(--ink-3)' }}>Переходим к оплате…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="as" style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.05fr 1fr', background: 'var(--bg)' }}>
      <div style={{ position: 'relative', padding: isMobile ? '32px 24px' : '56px 64px', background: 'var(--bg-deep)', borderRight: isMobile ? 'none' : '1px solid var(--border-soft)', borderBottom: isMobile ? '1px solid var(--border-soft)' : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: isMobile ? 32 : 0 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <LogoMark size={20} />
          <span style={{ font: '500 12px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
        </Link>

        <div>
          <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.2em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 18 }}>Редактор для писателей · 2026</div>
          <h1 style={{ font: `600 ${isMobile ? '36px' : '56px'}/1.05 var(--font-serif)`, letterSpacing: '-0.02em', marginBottom: 24 }}>
            Здесь пишете{isMobile ? ' ' : <br />}<em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--accent-2)' }}>только вы</em>.
          </h1>
          <p style={{ font: '400 16px/1.65 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 480 }}>
            Рукопись, картотека персонажей, карта мира и хронология — в одном чистом редакторе. Без нейросети, которая дописывает за вас.
          </p>
        </div>

        {!isMobile && (
          <div style={{ paddingTop: 24, borderTop: '1px solid var(--border-soft)' }}>
            <p style={{ font: '400 14px/1.6 var(--font-serif)', color: 'var(--ink-3)', fontStyle: 'italic', margin: 0 }}>
              «Писатель пишет, потому что не может не писать.»
            </p>
          </div>
        )}

      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '32px 24px' : 48 }}>
        <form onSubmit={onSubmit} method="post" action="#" style={{ width: '100%', maxWidth: 380 }}>

          {/* ── reset-sent ── */}
          {flow === 'reset-sent' && (
            <>
              <h2 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 8 }}>Проверьте почту.</h2>
              <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 24, lineHeight: 1.6 }}>
                Ссылка для сброса пароля отправлена на <strong style={{ color: 'var(--ink-2)' }}>{email}</strong>. Перейдите по ней в течение часа.
              </p>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: 13 }}
                onClick={() => { setFlow('auth'); clearErr(); }}
              >
                ← Вернуться к входу
              </button>
            </>
          )}

          {/* ── reset-request ── */}
          {flow === 'reset-request' && (
            <>
              <button
                type="button"
                onClick={() => { setFlow('auth'); clearErr(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', font: '400 13px var(--font-ui)', color: 'var(--ink-3)', padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                ← Назад
              </button>
              <h2 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 6 }}>Сброс пароля.</h2>
              <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 24 }}>
                Введите почту — пришлём ссылку для создания нового пароля.
              </p>
              <div style={{ marginBottom: 16 }}>
                <label className="label" htmlFor="reset-email">Email</label>
                <input
                  id="reset-email"
                  className="input"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {err && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, background: 'oklch(0.65 0.18 25 / 0.12)', color: 'var(--danger)', fontSize: 12.5 }}>
                  {err}
                </div>
              )}
              <button
                type="submit"
                disabled={busy || !supabaseConfigured}
                className="btn btn--primary"
                style={{ width: '100%', height: 42, fontSize: 14, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {busy && <span className="btn-spinner" />}
                {busy ? 'Отправляем…' : 'Отправить ссылку'}
              </button>
            </>
          )}

          {/* ── signin / signup ── */}
          {flow === 'auth' && (
            <>
              <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--border-soft)' }}>
                <button
                  type="button"
                  onClick={() => { setTab('signin'); setConsent(false); setConsentMarketing(false); }}
                  style={{
                    padding: '10px 0', marginRight: 24,
                    font: tab === 'signin' ? '500 14px var(--font-ui)' : '400 14px var(--font-ui)',
                    color: tab === 'signin' ? 'var(--ink)' : 'var(--ink-3)',
                    borderBottom: tab === 'signin' ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                    background: 'none', cursor: 'pointer',
                  }}
                >Войти</button>
                <button
                  type="button"
                  onClick={() => { setTab('signup'); setConsent(false); setConsentMarketing(false); }}
                  style={{
                    padding: '10px 0',
                    font: tab === 'signup' ? '500 14px var(--font-ui)' : '400 14px var(--font-ui)',
                    color: tab === 'signup' ? 'var(--ink)' : 'var(--ink-3)',
                    borderBottom: tab === 'signup' ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                    background: 'none', cursor: 'pointer',
                  }}
                >Регистрация</button>
              </div>

              {tab === 'signup' && !registrationOpen ? (
                <div style={{ paddingTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <div>
                      <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', marginBottom: 2 }}>Регистрация временно закрыта</div>
                      <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.5 }}>Новые аккаунты сейчас не принимаются. Если вы уже зарегистрированы — войдите ниже.</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ width: '100%', height: 42, fontSize: 14, justifyContent: 'center', display: 'flex', alignItems: 'center' }}
                    onClick={() => setTab('signin')}
                  >
                    Войти в студию
                  </button>
                </div>
              ) : (
                <>
              <h2 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 6 }}>
                {tab === 'signin' ? 'С возвращением.' : 'Откройте студию.'}
              </h2>
              <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 24 }}>
                {tab === 'signin' ? 'Войдите по почте или через соцсети.' : 'Минимальная регистрация — или один клик через соцсети.'}
              </p>

              {!supabaseConfigured && (
                <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger)', background: 'oklch(0.65 0.18 25 / 0.08)', color: 'var(--ink-2)', fontSize: 12.5, lineHeight: 1.5 }}>
                  Supabase не сконфигурирован. Скопируйте <code style={{ font: '400 11px var(--font-mono)' }}>.env.example</code> в <code style={{ font: '400 11px var(--font-mono)' }}>.env</code> и заполните значения из Supabase → Project Settings → API.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                <button
                  type="button"
                  onClick={onGoogle}
                  disabled={oauthBusy !== null || !supabaseConfigured || (tab === 'signup' && !consent)}
                  className="btn"
                  style={{ width: '100%', height: 42, justifyContent: 'center', gap: 10 }}
                >
                  <GoogleGlyph />
                  <span>{oauthBusy === 'google' ? 'Переход к Google…' : (tab === 'signin' ? 'Войти через Google' : 'Зарегистрироваться через Google')}</span>
                </button>

                {TG_BOT_USERNAME && (
                  <div
                    className="auth-oauth-wrap"
                    style={{ position: 'relative', height: 42, cursor: 'pointer', opacity: (tab === 'signup' && !consent) ? 0.4 : 1, pointerEvents: (tab === 'signup' && !consent) ? 'none' : 'auto' }}
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      className="auth-tg-btn"
                      style={{ pointerEvents: 'none' }}
                    >
                      <TelegramGlyph />
                      <span>{tab === 'signin' ? 'Войти через Telegram' : 'Зарегистрироваться через Telegram'}</span>
                    </button>
                    <div ref={tgSlotRef} style={{ position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden' }} />
                  </div>
                )}
                {oauthBusy === 'telegram' && (
                  <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', textAlign: 'center' }}>Подтверждение Telegram…</div>
                )}

                {!vkSdkFailed && <div
                  className="auth-oauth-wrap"
                  style={{
                    position: 'relative',
                    height: 42,
                    cursor: 'pointer',
                    opacity: (tab === 'signup' && !consent) ? 0.4 : 1,
                    pointerEvents: (tab === 'signup' && !consent) ? 'none' : 'auto',
                  }}
                  onClick={() => { vkHasClickedRef.current = true; }}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="btn"
                    style={{ pointerEvents: 'none', width: '100%', height: 42, justifyContent: 'center', gap: 10 }}
                  >
                    <VkGlyph />
                    <span>
                      {oauthBusy === 'vk'
                        ? 'Подключение VK…'
                        : tab === 'signin'
                        ? 'Войти через VK ID'
                        : 'Зарегистрироваться через VK ID'}
                    </span>
                  </button>
                  <div ref={vkSlotRef} style={{ position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden' }} />
                </div>}
              </div>

              {tab === 'signup' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '4px 0 18px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 14, height: 14 }}
                    />
                    <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.55 }}>
                      Я даю согласие на обработку персональных данных в соответствии с{' '}
                      <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                        Политикой конфиденциальности
                      </a>.{' '}
                      <span style={{ color: 'var(--danger)', fontSize: 11 }}>обязательно</span>
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={consentMarketing}
                      onChange={(e) => setConsentMarketing(e.target.checked)}
                      style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--accent)', width: 14, height: 14 }}
                    />
                    <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.55 }}>
                      Согласен получать письма с советами по работе со студией.{' '}
                      <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>необязательно</span>
                    </span>
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 18px', color: 'var(--ink-4)', font: '400 11px var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                <span style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
                <span>или по почте</span>
                <span style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="label" htmlFor="auth-email">Email</label>
                  <input
                    id="auth-email"
                    name="email"
                    className={`input${err ? ' input--err' : ''}`}
                    type="email"
                    required
                    autoComplete="username"
                    inputMode="email"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearErr(); }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <label className="label" htmlFor="auth-password" style={{ marginBottom: 0 }}>Пароль</label>
                    {tab === 'signin' && (
                      <button
                        type="button"
                        onClick={() => { clearErr(); setInfo(null); setFlow('reset-request'); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', font: '400 12px var(--font-ui)', color: 'var(--ink-3)', padding: '16px 0', margin: '-16px 0', lineHeight: 1 }}
                      >
                        Забыли пароль?
                      </button>
                    )}
                  </div>
                  <PasswordInput
                    id="auth-password"
                    name="password"
                    value={password}
                    onChange={(v) => { setPassword(v); clearErr(); }}
                    autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                    hasError={!!err}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {err && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, background: 'oklch(0.65 0.18 25 / 0.12)', color: 'var(--danger)', fontSize: 12.5 }}>
                  {err}
                </div>
              )}
              {info && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, background: 'oklch(0.72 0.14 145 / 0.12)', color: 'var(--ok)', fontSize: 12.5 }}>
                  {info}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !supabaseConfigured || (tab === 'signup' && !consent)}
                className="btn btn--primary"
                style={{ width: '100%', height: 42, fontSize: 14, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {busy && <span className="btn-spinner" />}
                {busy
                  ? (tab === 'signin' ? 'Входим…' : 'Создаём аккаунт…')
                  : (tab === 'signin' ? 'Войти в студию' : 'Создать аккаунт')}
              </button>
              </>
            )}
            </>
          )}

        </form>
      </div>
    </div>
  );
}

function TelegramGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function GoogleGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.2 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.1l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.2 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.1z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.3 34.6 26.8 35.5 24 35.5c-5.2 0-9.6-3.3-11.2-8L6.2 32C9.6 37.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.5 5.5C41.6 35.8 44 30.2 44 24c0-1.2-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function VkGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.392 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-.9-1.49.521v1.575c0 .45-.143.722-1.318.722-1.93 0-4.074-1.168-5.57-3.358-2.267-3.196-2.888-5.586-2.888-6.075 0-.243.099-.47.328-.47h1.75c.483 0 .667.228.853.762.939 2.713 2.51 5.09 3.157 5.09.244 0 .355-.112.355-.728V9.352c-.072-1.312-.77-1.42-.77-1.89 0-.216.18-.44.47-.44h2.758c.408 0 .551.215.551.664v3.564c0 .408.18.551.293.551.244 0 .45-.143.9-.593 1.393-1.562 2.386-3.969 2.386-3.969.132-.271.357-.522.808-.522h1.75c.523 0 .638.268.523.68-.218 1.01-2.33 3.992-2.33 3.992-.185.3-.254.434 0 .773.184.267.787.8 1.187 1.287.738.843 1.3 1.55 1.453 2.041.138.484-.113.73-.549.73z" />
    </svg>
  );
}

