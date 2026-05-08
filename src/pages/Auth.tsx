import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabaseConfigured } from '../lib/supabase';

type Tab = 'signin' | 'signup';

export default function Auth() {
  const { session, signIn, signUp } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
            {tab === 'signin' ? 'Введите почту и пароль.' : 'Минимальная регистрация — без верификации, если она не включена в Supabase.'}
          </p>

          {!supabaseConfigured && (
            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--danger)', background: 'oklch(0.65 0.18 25 / 0.08)', color: 'var(--ink-2)', fontSize: 12.5, lineHeight: 1.5 }}>
              Supabase не сконфигурирован. Скопируйте <code style={{ font: '400 11px var(--font-mono)' }}>.env.example</code> в <code style={{ font: '400 11px var(--font-mono)' }}>.env</code> и заполните значения из Supabase → Project Settings → API.
            </div>
          )}

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
