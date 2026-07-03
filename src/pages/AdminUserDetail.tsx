import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { LogoMark } from '../components/LogoMark';
import { useErrorState } from '../lib/useErrorState';
import { ErrorBanner } from '../components/ErrorBanner';

function displayEmail(email: string): string {
  const m = email.match(/^vk-(\d+)@vk\.local$/);
  return m ? `ВКонтакте #${m[1]}` : email;
}

function isVkEmail(email: string): boolean {
  return /^vk-\d+@vk\.local$/.test(email);
}

interface BookSummary {
  id: string;
  title: string;
  chapters_count: number;
  words_total: number;
}

interface PlanHistoryEntry {
  action: string;
  payload: Record<string, string> | null;
  created_at: string;
}

interface UserDetail {
  email: string | null;
  created_at: string | null;
  plan: string | null;
  suspended: boolean | null;
  books: BookSummary[];
  plan_history: PlanHistoryEntry[];
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtWords(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс`;
  return String(n);
}

function formatHistoryDetail(action: string, payload: Record<string, string> | null): string {
  if (!payload) return '—';
  if (action === 'extend_plan') return `+${payload.days}д → до ${payload.new_expires_at ? fmtDate(payload.new_expires_at) : '?'}`;
  if (action === 'payment_received') return `${payload.plan} — ${payload.amount} ${payload.currency}`;
  if (payload.old_plan) return `${payload.old_plan} → ${payload.new_plan}`;
  if (payload.email) return payload.email;
  return JSON.stringify(payload);
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  font: '500 11px var(--font-mono)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
};

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading } = useAuth();
  const { error, setError } = useErrorState();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (!user || !userId) return;
    let cancelled = false;
    supabase.rpc('get_admin_user_detail', { target_user_id: userId }).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err?.code === '42501') { setIsAdmin(false); return; }
      setIsAdmin(true);
      if (err) { setError(err.message); return; }
      const d = data as unknown as UserDetail;
      setDetail(d);
      if (d.email) setUserEmail(d.email);
    });
    return () => { cancelled = true; };
  }, [user, userId, setError]);

  const handleResetPassword = async () => {
    if (!userEmail) return;
    setResetting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) setError(err.message);
    else setResetDone(true);
    setResetting(false);
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin === null) return null;
  if (isAdmin === false) return <Navigate to="/books" replace />;

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 12, borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-deep)' }}>
        <Link to="/books" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <LogoMark size={18} />
          <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
        </Link>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)' }}>/</span>
        <Link to="/admin" style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', textDecoration: 'none' }}>admin</Link>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)' }}>/</span>
        <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-2)' }}>пользователь</span>
      </div>

      <div style={{ padding: '36px 40px', maxWidth: 900 }}>
        {error && (
          <ErrorBanner message={error} style={{ marginBottom: 20 }} />
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 32 }}>
          <h1 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', margin: 0 }}>
            {userEmail ? displayEmail(userEmail) : userId}
          </h1>
          {userEmail && !isVkEmail(userEmail) && (
            <button
              onClick={handleResetPassword}
              disabled={resetting || resetDone}
              style={{ font: '400 12px var(--font-ui)', color: resetDone ? 'var(--ink-3)' : 'var(--accent)', background: 'none', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '4px 12px', cursor: resetting || resetDone ? 'default' : 'pointer' }}
            >
              {resetDone ? 'Письмо отправлено' : resetting ? '…' : 'Сбросить пароль'}
            </button>
          )}
        </div>

        {detail === null ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
        ) : (
          <>
            <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
              Книги ({detail.books.length})
            </div>
            {detail.books.length === 0 ? (
              <div style={{ color: 'var(--ink-4)', fontSize: 13, marginBottom: 32 }}>Нет книг</div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden', marginBottom: 36 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      {(['Название', 'Глав', 'Слов'] as const).map((h) => (
                        <th key={h} scope="col" style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.books.map((b, i) => (
                      <tr key={b.id} style={{ borderBottom: i < detail.books.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)', color: 'var(--ink)' }}>{b.title || '(без названия)'}</td>
                        <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)' }}>{b.chapters_count}</td>
                        <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)' }}>{fmtWords(Number(b.words_total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
              История действий
            </div>
            {detail.plan_history.length === 0 ? (
              <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>Нет записей</div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      {(['Дата', 'Действие', 'Детали'] as const).map((h) => (
                        <th key={h} scope="col" style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.plan_history.map((e, i) => (
                      <tr key={i} style={{ borderBottom: i < detail.plan_history.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{fmtDate(e.created_at)}</td>
                        <td style={{ padding: '10px 16px', font: '500 12px var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.05em' }}>{e.action}</td>
                        <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)' }}>
                          {formatHistoryDetail(e.action, e.payload)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
