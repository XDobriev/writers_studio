import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useErrorState } from '../lib/useErrorState';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { LogoMark } from '../components/LogoMark';
import AdminAnalytics, { type TopUser } from './AdminAnalytics';

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
  suspended: boolean;
}

type SortKey = 'created_at' | 'words_total' | 'last_active';
type Tab = 'users' | 'analytics' | 'audit' | 'payments' | 'finances' | 'flags';

interface AuditEntry {
  id: string;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  payload: Record<string, string> | null;
  created_at: string;
}

interface AdminRevenue {
  mrr: number;
  arr: number;
  pro_count: number;
  lifetime_count: number;
  churn_count_30d: number;
  churn_rate: number;
}

interface FeatureFlag {
  key: string;
  enabled: boolean;
}

const PLAN_COLOR: Record<Plan, string> = {
  free: 'var(--ink-4)',
  pro: 'oklch(0.62 0.18 270)',
  lifetime: 'oklch(0.62 0.18 50)',
};

const TAB_LABELS: Record<Tab, string> = {
  users: 'Пользователи',
  analytics: 'Аналитика',
  audit: 'Аудит',
  payments: 'Платежи',
  finances: 'Финансы',
  flags: 'Флаги',
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
  const { error: err, setError: setErr, clearError: clearErr } = useErrorState();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [planChanging, setPlanChanging] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('users');
  const [auditLog, setAuditLog] = useState<AuditEntry[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [suspending, setSuspending] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null);
  const [lifetimeSlots, setLifetimeSlots] = useState('');
  const [slotsSaving, setSlotsSaving] = useState(false);
  const [revenue, setRevenue] = useState<AdminRevenue | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[] | null>(null);
  const [flagToggling, setFlagToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      supabase.rpc('get_admin_stats'),
      supabase.rpc('get_admin_users'),
    ]).then(([statsRes, usersRes]) => {
      if (cancelled) return;
      if (statsRes.error?.code === '42501' || usersRes.error?.code === '42501') {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(true);
      const firstErr = statsRes.error?.message ?? usersRes.error?.message ?? null;
      if (firstErr) setErr(firstErr);
      if (!statsRes.error) setStats(statsRes.data as AdminStats);
      if (!usersRes.error) setUsers(usersRes.data as AdminUser[]);
    }).catch((e: Error) => {
      if (cancelled) return;
      setIsAdmin(false);
      setErr(e.message);
    });
    return () => { cancelled = true; };
  }, [user, setErr]);

  const loadAuditLog = async () => {
    if (auditLog !== null) return;
    setAuditLoading(true);
    const { data, error } = await supabase.rpc('get_admin_audit_log');
    if (error) setErr(error.message);
    else setAuditLog(data as AuditEntry[]);
    setAuditLoading(false);
  };

  const handleTabChange = (next: Tab) => {
    setTab(next);
    if (next === 'audit' || next === 'payments') loadAuditLog();
    if (next === 'finances' && revenue === null) {
      supabase.rpc('get_admin_revenue').then(({ data, error: e }) => {
        if (e) setErr(e.message);
        else setRevenue(data as AdminRevenue);
      });
    }
    if (next === 'flags' && flags === null) {
      supabase.rpc('get_feature_flags').then(({ data, error: e }) => {
        if (e) setErr(e.message);
        else setFlags(data as FeatureFlag[]);
      });
    }
  };

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
    clearErr();
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

  const handleSuspend = async (u: AdminUser) => {
    setSuspending(u.id);
    clearErr();
    const { error } = await supabase.rpc('suspend_user', {
      target_user_id: u.id,
      suspend: !u.suspended,
    });
    if (error) {
      setErr(error.message);
    } else {
      setUsers((prev) => prev?.map((x) => x.id === u.id ? { ...x, suspended: !u.suspended } : x) ?? prev);
    }
    setSuspending(null);
  };

  const handleExtendPlan = async (u: AdminUser) => {
    setExtending(u.id);
    clearErr();
    const { error } = await supabase.rpc('extend_plan', {
      target_user_id: u.id,
      days: 7,
    });
    if (error) {
      setErr(error.message);
    } else {
      setUsers((prev) => prev?.map((x) => x.id === u.id ? { ...x, plan: 'pro' as Plan } : x) ?? prev);
    }
    setExtending(null);
  };

  const handleSaveSlots = async () => {
    const n = parseInt(lifetimeSlots, 10);
    if (isNaN(n) || n < 0) return;
    setSlotsSaving(true);
    clearErr();
    const { error } = await supabase.rpc('set_lifetime_slots', { new_value: n });
    if (error) setErr(error.message);
    setSlotsSaving(false);
  };

  const handleExportCsv = () => {
    if (!users) return;
    const header = ['email', 'created_at', 'plan', 'last_active'].join(',');
    const rows = users.map((u) =>
      [u.email, u.created_at, u.plan, u.last_active ?? ''].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleFlag = async (key: string, enabled: boolean) => {
    setFlagToggling(key);
    clearErr();
    const { error } = await supabase.rpc('set_feature_flag', { p_key: key, p_enabled: enabled });
    if (error) {
      setErr(error.message);
    } else {
      setFlags((prev) => prev?.map((f) => f.key === key ? { ...f, enabled } : f) ?? prev);
    }
    setFlagToggling(null);
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin === null) return null;
  if (isAdmin === false) return <Navigate to="/books" replace />;

  const top10: TopUser[] = [...(users ?? [])]
    .sort((a, b) => b.words_total - a.words_total)
    .slice(0, 10)
    .map((u) => ({ email: u.email, words_total: Number(u.words_total) }));

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
        <Link to="/books" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <LogoMark size={18} />
          <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
        </Link>
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

        <h1 style={{ font: '600 28px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 20 }}>Панель администратора</h1>

        <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderBottom: '1px solid var(--border-soft)' }}>
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              style={{
                padding: '10px 20px',
                font: '500 11px var(--font-mono)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: tab === t ? 'var(--accent)' : 'var(--ink-4)',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1,
                cursor: 'pointer',
              }}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === 'analytics' && <AdminAnalytics topUsers={top10} />}

        {tab === 'audit' && (
          <>
            <SectionTitle>Журнал действий администратора</SectionTitle>
            {auditLoading ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
            ) : auditLog === null ? null : auditLog.length === 0 ? (
              <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '24px 0' }}>Пока нет записей</div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <th style={thStyle()}>Дата</th>
                      <th style={thStyle()}>Действие</th>
                      <th style={thStyle()}>Пользователь</th>
                      <th style={thStyle()}>Детали</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry, i) => (
                      <tr key={entry.id} style={{ borderBottom: i < auditLog.length - 1 ? '1px solid var(--border-soft)' : 'none', background: i % 2 === 0 ? 'transparent' : 'oklch(0.96 0.002 50 / 0.4)' }}>
                        <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
                          {fmtDate(entry.created_at)}
                        </td>
                        <td style={{ padding: '10px 16px', font: '500 12px var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.05em' }}>
                          {entry.action}
                        </td>
                        <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)', color: 'var(--ink)' }}>
                          {entry.target_email ?? entry.target_user_id ?? '—'}
                        </td>
                        <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)' }}>
                          {entry.payload
                            ? entry.action === 'payment_received'
                              ? `${entry.payload.plan} — ${entry.payload.amount} ${entry.payload.currency}`
                              : entry.action === 'set_lifetime_slots'
                              ? `${entry.payload.old_value} → ${entry.payload.new_value} слотов`
                              : entry.action === 'set_feature_flag'
                              ? `${entry.payload.key}: ${entry.payload.old_enabled} → ${entry.payload.new_enabled}`
                              : `${entry.payload.old_plan ?? entry.payload.email ?? '?'} → ${entry.payload.new_plan ?? entry.payload.days ?? '?'}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'payments' && (
          <>
            <SectionTitle>История платежей</SectionTitle>
            {auditLoading ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
            ) : (() => {
              const payments = (auditLog ?? []).filter((e) => e.action === 'payment_received');
              return payments.length === 0 ? (
                <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '24px 0' }}>
                  Платежей пока нет
                </div>
              ) : (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <th style={thStyle()}>Дата</th>
                        <th style={thStyle()}>Пользователь</th>
                        <th style={thStyle()}>План</th>
                        <th style={thStyle()}>Сумма</th>
                        <th style={thStyle()}>Payment ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((entry, i) => (
                        <tr key={entry.id} style={{ borderBottom: i < payments.length - 1 ? '1px solid var(--border-soft)' : 'none', background: i % 2 === 0 ? 'transparent' : 'oklch(0.96 0.002 50 / 0.4)' }}>
                          <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{fmtDate(entry.created_at)}</td>
                          <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)', color: 'var(--ink)' }}>{entry.target_email ?? '—'}</td>
                          <td style={{ padding: '10px 16px', font: '500 12px var(--font-mono)', color: PLAN_COLOR[(entry.payload?.plan as Plan) ?? 'free'], letterSpacing: '0.05em', textTransform: 'uppercase' }}>{entry.payload?.plan ?? '—'}</td>
                          <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)' }}>{entry.payload ? `${entry.payload.amount} ${entry.payload.currency}` : '—'}</td>
                          <td style={{ padding: '10px 16px', font: '400 11px var(--font-mono)', color: 'var(--ink-4)' }}>{entry.payload?.payment_id ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}

        {tab === 'finances' && (
          <>
            <SectionTitle>Revenue-метрики</SectionTitle>
            {revenue === null ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 36 }}>
                <StatCard label="MRR" value={`${fmt(revenue.mrr)} ₽`} sub="Pro × 390 ₽/мес" />
                <StatCard label="ARR" value={`${fmt(revenue.arr)} ₽`} />
                <StatCard label="Pro-подписчиков" value={revenue.pro_count} />
                <StatCard label="Lifetime" value={revenue.lifetime_count} />
                <StatCard label="Отток за 30д" value={revenue.churn_count_30d} sub={`${revenue.churn_rate}%`} />
              </div>
            )}
          </>
        )}

        {tab === 'flags' && (
          <>
            <SectionTitle>Feature Flags</SectionTitle>
            {flags === null ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
            ) : flags.length === 0 ? (
              <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '24px 0' }}>Нет флагов</div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden', marginBottom: 32 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <th style={thStyle()}>Ключ</th>
                      <th style={thStyle()}>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flags.map((f, i) => (
                      <tr key={f.key} style={{ borderBottom: i < flags.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        <td style={{ padding: '10px 16px', font: '500 13px var(--font-mono)', color: 'var(--ink)' }}>{f.key}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <button
                            onClick={() => handleToggleFlag(f.key, !f.enabled)}
                            disabled={flagToggling === f.key}
                            style={{
                              font: '500 11px var(--font-mono)',
                              letterSpacing: '0.08em',
                              color: f.enabled ? 'oklch(0.55 0.18 155)' : 'var(--ink-4)',
                              background: f.enabled ? 'oklch(0.55 0.18 155 / 0.10)' : 'var(--surface-2)',
                              border: `1px solid ${f.enabled ? 'oklch(0.55 0.18 155 / 0.4)' : 'var(--border-soft)'}`,
                              borderRadius: 4,
                              padding: '3px 10px',
                              cursor: flagToggling === f.key ? 'wait' : 'pointer',
                              opacity: flagToggling === f.key ? 0.5 : 1,
                            }}
                          >
                            {f.enabled ? 'ON' : 'OFF'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'users' && <>
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

        <SectionTitle>Lifetime-слоты</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }}>
          <input
            className="input"
            type="number"
            min={0}
            placeholder="Кол-во слотов"
            value={lifetimeSlots}
            onChange={(e) => setLifetimeSlots(e.target.value)}
            style={{ width: 120, height: 32, fontSize: 13 }}
          />
          <button
            onClick={handleSaveSlots}
            disabled={slotsSaving || lifetimeSlots === ''}
            style={{ font: '400 12px var(--font-ui)', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 14px', cursor: slotsSaving ? 'wait' : 'pointer', opacity: slotsSaving ? 0.5 : 1 }}
          >
            Сохранить
          </button>
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleExportCsv}
              disabled={!users}
              style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', background: 'none', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
            >
              Выгрузить CSV
            </button>
            <input
              className="input"
              placeholder="Поиск по email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 240, height: 32, fontSize: 13 }}
            />
          </div>
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
                  <th style={thStyle()}>+7д</th>
                  <th style={thStyle()}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                      Нет результатов
                    </td>
                  </tr>
                ) : filtered.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-soft)' : 'none', background: i % 2 === 0 ? 'transparent' : 'oklch(0.96 0.002 50 / 0.4)' }}>
                    <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)' }}>
                      <Link to={`/admin/users/${u.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                        {u.email}
                      </Link>
                    </td>
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
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="lifetime">Lifetime</option>
                      </select>
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <button
                        onClick={() => handleExtendPlan(u)}
                        disabled={extending === u.id}
                        style={{ font: '400 11px var(--font-mono)', color: 'oklch(0.62 0.18 270)', background: 'none', border: '1px solid oklch(0.62 0.18 270 / 0.4)', borderRadius: 4, padding: '2px 7px', cursor: extending === u.id ? 'wait' : 'pointer', opacity: extending === u.id ? 0.5 : 1 }}
                      >
                        +7д
                      </button>
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <button
                        onClick={() => handleSuspend(u)}
                        disabled={suspending === u.id}
                        style={{ font: '400 11px var(--font-mono)', color: u.suspended ? 'var(--danger)' : 'var(--ink-3)', background: 'none', border: `1px solid ${u.suspended ? 'oklch(0.65 0.18 25 / 0.5)' : 'var(--border-soft)'}`, borderRadius: 4, padding: '2px 7px', cursor: suspending === u.id ? 'wait' : 'pointer', opacity: suspending === u.id ? 0.5 : 1 }}
                      >
                        {u.suspended ? 'Разблок.' : 'Suspend'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>}
      </div>
    </div>
  );
}
