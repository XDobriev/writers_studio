import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useErrorState } from '../lib/useErrorState';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { LogoMark } from '../components/LogoMark';

const SUPABASE_ERRORS: Record<string, string> = {
  'Password should be at least 6 characters.': 'Пароль должен содержать не менее 6 символов.',
  'Auth session missing!': 'Сессия устарела. Запросите новую ссылку.',
  'New password should be different from the old password.': 'Новый пароль должен отличаться от текущего.',
};

function te(msg: string): string {
  return SUPABASE_ERRORS[msg] ?? msg;
}

type State = 'waiting' | 'ready' | 'busy' | 'done' | 'expired';

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('waiting');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { error: err, setError: setErr, clearError: clearErr } = useErrorState();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (timerRef.current) clearTimeout(timerRef.current);
        setState('ready');
      }
    });

    timerRef.current = setTimeout(() => {
      setState((s) => s === 'waiting' ? 'expired' : s);
    }, 4000);

    return () => {
      sub.subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setErr('Пароли не совпадают.');
      return;
    }
    setState('busy');
    clearErr();
    const { error } = await updatePassword(password);
    if (error) {
      setErr(te(error));
      setState('ready');
    } else {
      await supabase.auth.signOut();
      setState('done');
      setTimeout(() => navigate('/login'), 2500);
    }
  };

  return (
    <div className="as" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40, textDecoration: 'none' }}>
          <LogoMark size={20} />
          <span style={{ font: '500 12px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
        </Link>

        {state === 'waiting' && (
          <p style={{ font: '400 14px var(--font-ui)', color: 'var(--ink-3)' }}>Проверяем ссылку восстановления…</p>
        )}

        {state === 'expired' && (
          <>
            <h2 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 8 }}>Ссылка устарела.</h2>
            <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 24, lineHeight: 1.6 }}>
              Ссылка для сброса пароля недействительна или срок её действия истёк. Запросите новую.
            </p>
            <button
              className="btn btn--primary"
              style={{ height: 42, fontSize: 14 }}
              onClick={() => navigate('/login')}
            >
              Запросить новую ссылку
            </button>
          </>
        )}

        {state === 'done' && (
          <>
            <h2 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 8 }}>Пароль изменён.</h2>
            <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
              Используйте новый пароль при следующем входе. Перенаправляем…
            </p>
          </>
        )}

        {(state === 'ready' || state === 'busy') && (
          <form onSubmit={onSubmit}>
            <h2 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 6 }}>Новый пароль.</h2>
            <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 24 }}>
              Придумайте пароль длиной не менее 6 символов.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <div>
                <label className="label" htmlFor="rp-password">Новый пароль</label>
                <input
                  id="rp-password"
                  className="input"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="rp-confirm">Повторите пароль</label>
                <input
                  id="rp-confirm"
                  className="input"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </div>

            {err && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, background: 'oklch(0.65 0.18 25 / 0.12)', color: 'var(--danger)', fontSize: 12.5 }}>
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={state === 'busy'}
              className="btn btn--primary"
              style={{ width: '100%', height: 42, fontSize: 14, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {state === 'busy' && <span className="btn-spinner" />}
              {state === 'busy' ? 'Сохраняем…' : 'Сохранить пароль'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
