import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type TelegramAuthData } from '../lib/auth';
import { supabaseConfigured } from '../lib/supabase';

type Tab = 'signin' | 'signup';

const TG_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;
const TG_CALLBACK = '__onTelegramAuth';

declare global {
  interface Window {
    [TG_CALLBACK]?: (user: TelegramAuthData) => void;
  }
}

export default function Auth() {
  const { session, signIn, signUp, signInWithGoogle, signInWithTelegram } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<'google' | 'telegram' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const tgSlotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!TG_BOT_USERNAME || !tgSlotRef.current) return;
    window[TG_CALLBACK] = async (user) => {
      setOauthBusy('telegram');
      setErr(null);
      const { error } = await signInWithTelegram(user);
      setOauthBusy(null);
      if (error) setErr(`Telegram: ${error}`);
    };
    const slot = tgSlotRef.current;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', TG_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '6');
    script.setAttribute('data-onauth', `${TG_CALLBACK}(user)`);
    script.setAttribute('data-request-access', 'write');
    slot.appendChild(script);
    return () => {
      slot.innerHTML = '';
      delete window[TG_CALLBACK];
    };
  }, [signInWithTelegram]);

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/books';
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setBusy(true);
    if (tab === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setErr(error);
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        setErr(error);
      } else {
        setInfo('Аккаунт создан. Проверьте почту, если включена верификация — иначе входите сразу.');
        setTab('signin');
      }
    }
    setBusy(false);
  };

  const onGoogle = async () => {
    setErr(null);
    setOauthBusy('google');
    const { error } = await signInWithGoogle();
    if (error) {
      setErr(`Google: ${error}`);
      setOauthBusy(null);
    }
    // при успехе редирект уходит на Google — стейт busy не сбрасываем
  };

  return (
    <div className="as" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr 1fr', background: 'var(--bg)' }}>
      <div style={{ position: 'relative', padding: '56px 64px', background: 'var(--bg-deep)', borderRight: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 18, height: 22, background: 'var(--accent)', borderRadius: '1px 4px 4px 1px', position: 'relative' }}>
            <span style={{ position: 'absolute', inset: 3, border: '0.5px solid oklch(0.98 0 0 / 0.6)' }} />
          </span>
          <span style={{ font: '500 12px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
        </div>

        <div>
          <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.2em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 18 }}>Издание для писателей · 2026</div>
          <h1 style={{ font: '600 56px/1.05 var(--font-serif)', letterSpacing: '-0.02em', marginBottom: 24 }}>Здесь<br />пишутся книги.</h1>
          <p style={{ font: '400 16px/1.65 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 480 }}>
            Манускрипт, картотека персонажей, карта мира и хронология — в одном тихом редакторе. Автосохранение, версии глав, заметки на полях. Без шума, баннеров и рекламы.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 32, paddingTop: 24, borderTop: '1px solid var(--border-soft)' }}>
          {[['12 384', 'авторов'], ['41 207', 'книг написано'], ['1.8 млрд', 'слов']].map(([n, l]) => (
            <div key={l}>
              <div style={{ font: '500 22px var(--font-serif)', color: 'var(--ink)' }}>{n}</div>
              <div style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <form onSubmit={onSubmit} style={{ width: 380 }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--border-soft)' }}>
            <button
              type="button"
              onClick={() => setTab('signin')}
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
              onClick={() => setTab('signup')}
              style={{
                padding: '10px 0',
                font: tab === 'signup' ? '500 14px var(--font-ui)' : '400 14px var(--font-ui)',
                color: tab === 'signup' ? 'var(--ink)' : 'var(--ink-3)',
                borderBottom: tab === 'signup' ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                background: 'none', cursor: 'pointer',
              }}
            >Регистрация</button>
          </div>

          <h2 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 6 }}>
            {tab === 'signin' ? 'С возвращением.' : 'Откройте студию.'}
          </h2>
          <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 24 }}>
            {tab === 'signin' ? 'Войдите по почте или через Google / Telegram.' : 'Минимальная регистрация — или один клик через Google / Telegram.'}
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
              disabled={oauthBusy !== null || !supabaseConfigured}
              className="btn"
              style={{ width: '100%', height: 42, justifyContent: 'center', gap: 10 }}
            >
              <GoogleGlyph />
              <span>{oauthBusy === 'google' ? 'Переход к Google…' : 'Войти через Google'}</span>
            </button>

            {TG_BOT_USERNAME ? (
              <div ref={tgSlotRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 42 }} />
            ) : (
              <button
                type="button"
                disabled
                className="btn"
                style={{ width: '100%', height: 42, justifyContent: 'center', gap: 10, color: 'var(--ink-4)' }}
                title="Заполните VITE_TELEGRAM_BOT_USERNAME в .env"
              >
                <TelegramGlyph />
                <span>Telegram — не сконфигурирован</span>
              </button>
            )}
            {oauthBusy === 'telegram' && (
              <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', textAlign: 'center' }}>Подтверждение Telegram…</div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 18px', color: 'var(--ink-4)', font: '400 11px var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
            <span>или по почте</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Пароль</label>
              <input
                className="input"
                type="password"
                required
                minLength={6}
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            disabled={busy || !supabaseConfigured}
            className="btn btn--primary"
            style={{ width: '100%', height: 42, fontSize: 14, justifyContent: 'center' }}
          >
            {busy ? '…' : tab === 'signin' ? 'Войти в студию' : 'Создать аккаунт'}
          </button>
        </form>
      </div>
    </div>
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

function TelegramGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M9.78 18.65l.28-4.2 7.61-6.86c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3L19.9 4.46c.73-.33 1.43.18 1.15 1.3l-2.72 12.84c-.19.91-.74 1.13-1.5.7L12.7 16.3l-2 1.96c-.23.23-.42.42-.92.42z" />
    </svg>
  );
}
