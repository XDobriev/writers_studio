import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fmtNum, fmtDate, fmtWords, displayEmail,
  PLAN_COLOR,
  type AdminStats, type AdminUser, type Plan, type SortKey,
} from '../../lib/admin';

interface Props {
  stats: AdminStats | null;
  users: AdminUser[] | null;
  planChanging: string | null;
  suspending: string | null;
  extending: string | null;
  markingTest: string | null;
  slotsSaving: boolean;
  onPlanChange: (u: AdminUser, plan: Plan) => void;
  onSuspend: (u: AdminUser) => void;
  onExtendPlan: (u: AdminUser) => void;
  onMarkTest: (u: AdminUser) => void;
  onSaveSlots: (n: number) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ font: '400 11px var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>{label}</div>
      <div style={{ font: '600 28px var(--font-serif)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
        {typeof value === 'number' ? fmtNum(value) : value}
      </div>
      {sub && <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>}
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

function handleExportCsv(users: AdminUser[]) {
  const csvEscape = (v: string) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['email', 'created_at', 'plan', 'last_active'].join(',');
  const rows = users.map((u) =>
    [u.email, u.created_at, u.plan, u.last_active ?? ''].map(csvEscape).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function UsersPanel({
  stats, users,
  planChanging, suspending, extending, markingTest, slotsSaving,
  onPlanChange, onSuspend, onExtendPlan, onMarkTest, onSaveSlots,
}: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [lifetimeSlots, setLifetimeSlots] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

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

  return (
    <>
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
          sub={stats ? `${fmtNum(stats.words_total)} слов точно` : undefined}
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
          onClick={() => onSaveSlots(parseInt(lifetimeSlots, 10))}
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
        <SectionTitle>
          Список пользователей{users != null && ` (${filtered.length}/${users.length})`}
        </SectionTitle>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => users && handleExportCsv(users)}
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
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col" className="admin-th">Email</th>
                <th
                  scope="col"
                  className="admin-th admin-th--sort"
                  aria-sort={sortKey === 'created_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onClick={() => handleSort('created_at')}
                >
                  Зарегистрирован <SortIcon active={sortKey === 'created_at'} dir={sortDir} />
                </th>
                <th scope="col" className="admin-th">Книг</th>
                <th
                  scope="col"
                  className="admin-th admin-th--sort"
                  aria-sort={sortKey === 'words_total' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onClick={() => handleSort('words_total')}
                >
                  Слов <SortIcon active={sortKey === 'words_total'} dir={sortDir} />
                </th>
                <th
                  scope="col"
                  className="admin-th admin-th--sort"
                  aria-sort={sortKey === 'last_active' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onClick={() => handleSort('last_active')}
                >
                  Последняя активность <SortIcon active={sortKey === 'last_active'} dir={sortDir} />
                </th>
                <th scope="col" className="admin-th">План</th>
                <th scope="col" className="admin-th">+7д</th>
                <th scope="col" className="admin-th">Тест</th>
                <th scope="col" className="admin-th">Статус</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                    Нет результатов
                  </td>
                </tr>
              ) : filtered.map((u) => (
                <tr key={u.id}>
                  <td className="admin-td admin-td--ui">
                    <Link to={`/admin/users/${u.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                      {displayEmail(u.email)}
                    </Link>
                  </td>
                  <td className="admin-td admin-td--mono admin-td--nowrap">{fmtDate(u.created_at)}</td>
                  <td className="admin-td admin-td--ui" style={{ color: 'var(--ink-2)', textAlign: 'center' }}>{u.books_count}</td>
                  <td className="admin-td admin-td--mono">{fmtWords(Number(u.words_total))}</td>
                  <td className="admin-td admin-td--mono" style={{ color: u.last_active ? 'var(--ink-2)' : 'var(--ink-4)' }}>
                    {u.last_active ? fmtDate(u.last_active) : '—'}
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <select
                      value={u.plan}
                      disabled={planChanging === u.id}
                      onChange={(e) => onPlanChange(u, e.target.value as Plan)}
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
                      onClick={() => onExtendPlan(u)}
                      disabled={extending === u.id}
                      style={{ font: '400 11px var(--font-mono)', color: 'oklch(0.62 0.18 270)', background: 'none', border: '1px solid oklch(0.62 0.18 270 / 0.4)', borderRadius: 4, padding: '2px 7px', cursor: extending === u.id ? 'wait' : 'pointer', opacity: extending === u.id ? 0.5 : 1 }}
                    >
                      +7д
                    </button>
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <button
                      onClick={() => onMarkTest(u)}
                      disabled={markingTest === u.id}
                      title={u.is_test ? 'Снять метку тестового' : 'Пометить как тестовый'}
                      style={{ font: '500 10px var(--font-mono)', letterSpacing: '0.06em', color: u.is_test ? 'oklch(0.62 0.14 50)' : 'var(--ink-4)', background: u.is_test ? 'oklch(0.62 0.14 50 / 0.10)' : 'none', border: `1px solid ${u.is_test ? 'oklch(0.62 0.14 50 / 0.5)' : 'var(--border-soft)'}`, borderRadius: 4, padding: '2px 7px', cursor: markingTest === u.id ? 'wait' : 'pointer', opacity: markingTest === u.id ? 0.5 : 1 }}
                    >
                      {u.is_test ? 'TEST' : 'test'}
                    </button>
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <button
                      onClick={() => onSuspend(u)}
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
    </>
  );
}
