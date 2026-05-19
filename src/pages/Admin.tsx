import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? '';

type Plan = 'free' | 'pro' | 'lifetime';

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
  plan: Plan;
}

type SortKey = 'created_at' | 'words_total' | 'last_active';

const PLAN_COLOR: Record<Plan, string> = {
  free: 'var(--ink-4)',
  pro: 'oklch(0.62 0.18 270)',
  lifetime: 'oklch(0.62 0.18 50)',
};

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span style={{ opacity: active ? 1 : 0.3, fontSize: 10, marginLeft: 4 }}>
      {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );
}

export default function Admin() {
  const { user, loading, signOut } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [planChanging, setPlanChanging] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    Promise.all([
      supabase.rpc('get_admin_stats'),
      supabase.rpc('get_admin_users'),
    ]).then(([statsRes, usersRes]) => {
      if (statsRes.error) setErr(statsRes.error.message);
      else setStats(statsRes.data as AdminStats);
      if (usersRes.error) setErr((prev) => prev ?? usersRes.error!.message);
      else setUsers(usersRes.data as AdminUser[]);
    });
  }, [user]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handlePlanChange = async (u: AdminUser, next: Plan) => {
    if (next === u.plan) return;
    setPlanChanging(u.id);
    setErr(null);
    const { error } = await supabase.rpc('set_user_plan', {
      target_user_id: u.id,
      new_plan: next,
    });
    if (error) {
      setErr(error.message);
    } else {
      setUsers((prev) => prev?.map((x) => x.id === u.id ? { ...x, plan: next } : x) ?? prev);
    }
    setPlanChanging(null);
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.email !== ADMIN_EMAIL) return <Navigate to="/books" replace />;

  const filtered = (users ?? [])
    .filter((u) => !search || u.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === 'created_at') {
        av = new Date(a.created_at).getTime();
        bv = new Date(b.created_at).getTime();
      } else if (sortKey === 'words_total') {
        av = Number(a.words_total);
        bv = Number(b.words_total);
      } else {
        av = a.last_active ? new Date(a.last_active).getTime() : 0;
        bv = b.last_active ? new Date(b.last_active).getTime() : 0;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const thStyle = (key?: SortKey): React.CSSProperties => ({
    padding: '10px 16px',
    textAlign: 'left',
    font: '500 11px var(--font-mono)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ink-3)',
    cursor: key ? 'pointer' : 'default',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  });

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
        <button
          onClick={signOut}
          style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}
        >
          Выйти
        </button>
      </div>

      <div style={{ padding: '36px 40px', maxWidth: 1200 }}>
        {err && (
          <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 8, background: 'oklch(0.65 0.18 25 / 0.10)', color: 'var(--danger)', fontSize: 13 }}>
            {err}
          </div>
        )}

        <h1 style={{ font: '600 28px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 28 }}>Панель администратора</h1>

        <SectionTitle>Пользователи</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 36 }}>
          <StatCard label="Всего" value={stats?.users_total ?? '—'} />
          <StatCard label="Новых за 7 дней" value={stats?.users_7d ?? '—'} />
          <StatCard label="Новых за 30 дней" value={stats?.users_30d ?? '—'} />
        </div>

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

        <SectionTitle>Активность (writing snapshots)</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 40 }}>
          <StatCard label="DAU (сегодня)" value={stats?.dau ?? '—'} />
          <StatCard label="WAU (7 дней)" value={stats?.wau ?? '—'} />
          <StatCard label="MAU (30 дней)" value={stats?.mau ?? '—'} />
          <StatCard label="Сессий за 30 дней" value={stats?.snapshots_30d ?? '—'} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionTitle>Список пользователей {users != null && `(${filtered.length}/${users.length})`}</SectionTitle>
          <input
            className="input"
            placeholder="Поиск по email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240, height: 32, fontSize: 13 }}
          />
        </div>

        {users == null ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <th style={thStyle()}>Email</th>
                  <th style={thStyle('created_at')} onClick={() => handleSort('created_at')}>
                    Зарегистрирован <SortIcon active={sortKey === 'created_at'} dir={sortDir} />
                  </th>
                  <th style={thStyle()}>Книг</th>
                  <th style={thStyle('words_total')} onClick={() => handleSort('words_total')}>
                    Слов <SortIcon active={sortKey === 'words_total'} dir={sortDir} />
                  </th>
                  <th style={thStyle('last_active')} onClick={() => handleSort('last_active')}>
                    Последняя активность <SortIcon active={sortKey === 'last_active'} dir={sortDir} />
                  </th>
                  <th style={thStyle()}>План</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                      Нет результатов
                    </td>
                  </tr>
                ) : filtered.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-soft)' : 'none', background: i % 2 === 0 ? 'transparent' : 'oklch(0.96 0.002 50 / 0.4)' }}>
                    <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)', color: 'var(--ink)' }}>{u.email}</td>
                    <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{fmtDate(u.created_at)}</td>
                    <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)', color: 'var(--ink-2)', textAlign: 'center' }}>{u.books_count}</td>
                    <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)' }}>{fmtWords(Number(u.words_total))}</td>
                    <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: u.last_active ? 'var(--ink-2)' : 'var(--ink-4)' }}>
                      {u.last_active ? fmtDate(u.last_active) : '—'}
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <select
                        value={u.plan}
                        disabled={planChanging === u.id}
                        onChange={(e) => handlePlanChange(u, e.target.value as Plan)}
                        style={{
                          font: '500 11px var(--font-mono)',
                          letterSpacing: '0.08em',
                          color: PLAN_COLOR[u.plan],
                          background: 'var(--surface-2)',
                          border: `1px solid ${PLAN_COLOR[u.plan]}`,
                          borderRadius: 4,
                          padding: '3px 6px',
                          cursor: planChanging === u.id ? 'wait' : 'pointer',
                          opacity: planChanging === u.id ? 0.5 : 1,
                          outline: 'none',
                        }}
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                        <option value="lifetime">lifetime</option>
                      </select>
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
