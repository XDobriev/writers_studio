// src/pages/PaymentSuccess.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { getProfile } from '../lib/profiles';
import { QUERY_KEYS } from '../lib/queries';

type ViewState = 'checking' | 'success' | 'timeout';

export default function PaymentSuccess() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [searchParams] = useSearchParams();
  // pro_annual хранится в БД как 'pro' — нормализуем для сравнения
  const rawPlanParam = searchParams.get('Shp_plan') ?? searchParams.get('plan') ?? 'pro';
  const planParam = rawPlanParam === 'pro_annual' ? 'pro' : rawPlanParam;

  const [polling, setPolling]   = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  const { data: profile } = useQuery({
    queryKey: user?.id ? QUERY_KEYS.profile(user.id) : ['profile', null],
    queryFn:  () => getProfile(user!.id),
    enabled:  !!user?.id,
    staleTime: 0,
    refetchInterval: polling ? 2000 : false,
  });

  useEffect(() => {
    if (profile?.plan && profile.plan === planParam) {
      setPolling(false);
    }
  }, [profile?.plan, planParam]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
      setPolling(false);
    }, 30_000);
    return () => clearTimeout(timer);
  }, []);

  const state: ViewState =
    profile?.plan && profile.plan === planParam ? 'success'
    : timedOut ? 'timeout'
    : 'checking';

  const planLabel = planParam === 'lifetime' ? 'Lifetime' : 'Pro';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg)',
    }}>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          width: '100%',
          maxWidth: 400,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {state === 'checking' && (
          <>
            <div
              role="img"
              aria-label="Активируем подписку…"
              style={{
                width: 48, height: 48, borderRadius: '50%',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 0.9s linear infinite',
              }}
            />
            <p style={{ font: '500 15px var(--font-ui)', color: 'var(--ink-2)', margin: 0 }}>
              Активируем подписку {planLabel}…
            </p>
            <p style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)', margin: 0 }}>
              Это займёт несколько секунд
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'color-mix(in oklch, var(--ok) 12%, var(--bg))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
            }}>
              ✓
            </div>
            <h1 style={{ font: '600 20px var(--font-ui)', color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>
              Добро пожаловать в {planLabel}!
            </h1>
            <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', margin: 0 }}>
              Все функции уже доступны
            </p>
            <button
              className="btn btn--primary"
              style={{ height: 40, paddingInline: 28, fontSize: 14 }}
              onClick={() => navigate('/books')}
            >
              Начать писать
            </button>
          </>
        )}

        {state === 'timeout' && (
          <>
            <div style={{ fontSize: 40 }}>🕐</div>
            <h1 style={{ font: '600 17px var(--font-ui)', color: 'var(--ink)', margin: 0 }}>
              Платёж получен
            </h1>
            <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', margin: 0, maxWidth: 300 }}>
              Статус подписки обновится в течение нескольких минут. Если через 5 минут ничего не изменилось — напишите в поддержку.
            </p>
            <button
              className="btn btn--ghost"
              style={{ height: 38, paddingInline: 20, fontSize: 13 }}
              onClick={() => navigate('/books')}
            >
              Перейти в редактор
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
