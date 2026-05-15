import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const ADMIN_EMAIL = 'frfrancuz@gmail.com';

interface AdminStats {
  users_total: number;
  users_7d: number;
  users_30d: number;
  books_total: number;
  chapters_total: number;
  words_total: number;
  dau: number;
  wau: number;
  mau: number;
  snapshots_30d: number;
}

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  books_count: number;
  words_total: number;
  last_active: string | null;
}

function fmt(n: number): string {
  return n.toLocaleString('ru');
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtWords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс`;
  return String(n);
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ font: '400 11px var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>{label}</div>
      <div style={{ font: '600 28px var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{typeof value === 'number' ? fmt(value) : value}</div>
      {sub && <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    Promise.all([
      supabase.rpc('get_admin_stats'),
      supabase.rpc('get_admin_users'),
    ]).then(([statsRes, usersRes]) => {
      if (statsRes.error) { setErr(statsRes.error.message); }
      else { setStats(statsRes.data as AdminStats); }
      if (usersRes.error) { setErr((prev) => prev ?? usersRes.error!.message); }
      else { setUsers(usersRes.data as AdminUser[]); }
    });
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.email !== ADMIN_EMAIL) return <Navigate to="/books" replace />;

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 12, borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-deep)' }}>
        <span style={{ width: 16, height: 20, background: 'var(--accent)', borderRadius: '1px 4px 4px 1px', position: 'relative', flexShrink: 0 }}>
          <span style={{ position: 'absolute', inset: 3, border: '0.5px solid oklch(0.98 0 0 / 0.6)' }} />
        </span>
        <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em' }}>/</span>
        <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>admin</span>
        <span style={{ flex: 1 }} />
        <a href="/books" style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', textDecoration: 'none' }}>← к полке</a>
      </div>

      <div style={{ padding: '36px 40px', maxWidth: 1100 }}>
        {err && (
          <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 8, background: 'oklch(0.65 0.18 25 / 0.10)', color: 'var(--danger)', fontSize: 13 }}>
            {err}
          </div>
        )}

        <h1 style={{ font: '600 28px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 28 }}>Панель администратора</h1>

        {/* Пользователи */}
        <SectionTitle>Пользователи</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 36 }}>
          <StatCard label="Всего" value={stats?.users_total ?? '—'} />
          <StatCard label="Новых за 7 дней" value={stats?.users_7d ?? '—'} />
          <StatCard label="Новых за 30 дней" value={stats?.users_30d ?? '—'} />
        </div>

        {/* Контент */}
        <SectionTitle>Контент</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 36 }}>
          <StatCard label="Книг" value={stats?.books_total ?? '—'} />
          <StatCard label="Глав" value={stats?.chapters_total ?? '—'} />
          <StatCard
            label="Слов написано"
            value={stats ? fmtWords(stats.words_total) : '—'}
            sub={stats ? `${fmt(stats.words_total)} слов точно` : undefined}
          />
        </div>

        {/* Активность */}
        <SectionTitle>Активность (writing snapshots)</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 40 }}>
          <StatCard label="DAU (сегодня)" value={stats?.dau ?? '—'} />
          <StatCard label="WAU (7 дней)" value={stats?.wau ?? '—'} />
          <StatCard label="MAU (30 дней)" value={stats?.mau ?? '—'} />
          <StatCard label="Сессий за 30 дней" value={stats?.snapshots_30d ?? '—'} />
        </div>

        {/* Список пользователей */}
        <SectionTitle>Список пользователей</SectionTitle>
        {users == null ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  {['Email', 'Зарегистрирован', 'Книг', 'Слов', 'Последняя активность'].map((h) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', font: '500 11px var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border-soft)' : 'none', background: i % 2 === 0 ? 'transparent' : 'oklch(0.96 0.002 50 / 0.4)' }}>
                    <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)', color: 'var(--ink)' }}>{u.email}</td>
                    <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                    <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)', color: 'var(--ink-2)', textAlign: 'center' }}>{u.books_count}</td>
                    <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)' }}>{fmtWords(Number(u.words_total))}</td>
                    <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: u.last_active ? 'var(--ink-2)' : 'var(--ink-4)' }}>
                      {u.last_active ? fmtDate(u.last_active) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
      {children}
    </div>
  );
}
