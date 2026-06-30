import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth, translateAuthError } from '../lib/auth';
import { useErrorState } from '../lib/useErrorState';
import { useRegistrationOpen } from '../lib/queries';
import { useTelegramAuth, TG_BOT_USERNAME } from '../lib/useTelegramAuth';
import { useVkAuth } from '../lib/useVkAuth';
import { supabaseConfigured } from '../lib/supabase';
import { PasswordInput } from './PasswordInput';
import { ConsentCheckbox } from './ConsentCheckbox';

type Tab = 'signin' | 'signup';
type Flow = 'auth' | 'reset-request' | 'reset-sent';

export function AuthForm() {
  const location = useLocation();
  const { signIn, signUp, resetPasswordForEmail } = useAuth();
  const { data: registrationOpen = true } = useRegistrationOpen();
  const { error: formErr, setError: setFormErr, clearError: clearFormErr } = useErrorState();

  const tgAuth = useTelegramAuth();
  const vkAuth = useVkAuth();

  const [tab, setTab] = useState<Tab>(() =>
    new URLSearchParams(location.search).get('tab') === 'signup' ? 'signup' : 'signin'
  );
  const [flow, setFlow] = useState<Flow>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const err = formErr ?? tgAuth.error ?? vkAuth.error;
  const clearErr = () => { clearFormErr(); tgAuth.clearError(); vkAuth.clearError(); };
  const oauthBusy = tgAuth.busy ? 'telegram' : vkAuth.busy ? 'vk' : null;

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setConsent(false);
    setConsentMarketing(false);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearErr();
    setInfo(null);
    setBusy(true);
    if (flow === 'reset-request') {
      const { error } = await resetPasswordForEmail(email);
      if (error) setFormErr(translateAuthError(error));
      else setFlow('reset-sent');
      setBusy(false);
      return;
    }
    if (tab === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setFormErr(translateAuthError(error));
    } else {
      const { error } = await signUp(email, password);
      if (error) setFormErr(translateAuthError(error));
      else setInfo('Аккаунт создан. Входим…');
    }
    setBusy(false);
  };

  return (
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
            style={{ width: '100%', height: 44, fontSize: 14, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {busy && <span className="btn-spinner" />}
            {busy ? 'Отправляем…' : 'Отправить ссылку'}
          </button>
        </>
      )}

      {/* ── signin / signup ── */}
      {flow === 'auth' && (
        <>
          <div role="tablist" aria-label="Режим входа" style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid var(--border-soft)' }}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signin'}
              onClick={() => handleTabChange('signin')}
              style={{
                padding: '13px 0', marginRight: 24,
                font: tab === 'signin' ? '500 14px var(--font-ui)' : '400 14px var(--font-ui)',
                color: tab === 'signin' ? 'var(--ink)' : 'var(--ink-3)',
                borderBottom: tab === 'signin' ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                background: 'none', cursor: 'pointer',
              }}
            >Войти</button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signup'}
              onClick={() => handleTabChange('signup')}
              style={{
                padding: '13px 0',
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
                style={{ width: '100%', height: 44, fontSize: 14, justifyContent: 'center', display: 'flex', alignItems: 'center' }}
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
                {tab === 'signin' ? 'Войдите по почте или через Telegram / VK.' : 'Минимальная регистрация — или один клик через Telegram / VK.'}
              </p>

              {!supabaseConfigured && (
                <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger)', background: 'oklch(0.65 0.18 25 / 0.08)', color: 'var(--ink-2)', fontSize: 12.5, lineHeight: 1.5 }}>
                  Supabase не сконфигурирован. Скопируйте <code style={{ font: '400 11px var(--font-mono)' }}>.env.example</code> в <code style={{ font: '400 11px var(--font-mono)' }}>.env</code> и заполните значения из Supabase → Project Settings → API.
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                {TG_BOT_USERNAME && (
                  <div
                    className="auth-oauth-wrap"
                    style={{ position: 'relative', height: 44, cursor: 'pointer', opacity: (tab === 'signup' && !consent) ? 0.4 : 1, pointerEvents: (tab === 'signup' && !consent) ? 'none' : 'auto' }}
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
                    <div ref={tgAuth.tgSlotRef} style={{ position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden' }} />
                  </div>
                )}
                {oauthBusy === 'telegram' && (
                  <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', textAlign: 'center' }}>Подтверждение Telegram…</div>
                )}

                {!vkAuth.sdkFailed && (
                  <div
                    className="auth-oauth-wrap"
                    style={{
                      position: 'relative',
                      height: 44,
                      cursor: 'pointer',
                      opacity: (tab === 'signup' && !consent) ? 0.4 : 1,
                      pointerEvents: (tab === 'signup' && !consent) ? 'none' : 'auto',
                    }}
                    onClick={() => { vkAuth.vkHasClickedRef.current = true; }}
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      className="btn"
                      style={{ pointerEvents: 'none', width: '100%', height: 44, justifyContent: 'center', gap: 10 }}
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
                    <div ref={vkAuth.vkSlotRef} style={{ position: 'absolute', inset: 0, opacity: 0, overflow: 'hidden' }} />
                  </div>
                )}
              </div>

              {tab === 'signup' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '4px 0 18px' }}>
                  <ConsentCheckbox checked={consent} onChange={setConsent}>
                    Я даю согласие на обработку персональных данных в соответствии с{' '}
                    <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                      Политикой конфиденциальности
                    </a>.{' '}
                    <span style={{ color: 'var(--danger)', fontSize: 11 }}>обязательно</span>
                  </ConsentCheckbox>
                  <ConsentCheckbox checked={consentMarketing} onChange={setConsentMarketing}>
                    Согласен получать письма с советами по работе со студией.{' '}
                    <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>необязательно</span>
                  </ConsentCheckbox>
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
                    onChange={(e) => { setEmail(e.target.value); clearFormErr(); }}
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
                    onChange={(v) => { setPassword(v); clearFormErr(); }}
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
                style={{ width: '100%', height: 44, fontSize: 14, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
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
  );
}

function TelegramGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
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
