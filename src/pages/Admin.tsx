import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useAdminData } from '../lib/useAdminData';
import { TAB_LABELS, type Tab } from '../lib/admin';
import { ErrorBanner } from '../components/ErrorBanner';
import { LogoMark } from '../components/LogoMark';
import { AuditLogTable } from '../components/admin/AuditLogTable';
import { PaymentsTable } from '../components/admin/PaymentsTable';
import { FinancesPanel } from '../components/admin/FinancesPanel';
import { FlagsTable } from '../components/admin/FlagsTable';
import { UsersPanel } from '../components/admin/UsersPanel';
import AdminAnalytics, { type TopUser } from './AdminAnalytics';

export default function Admin() {
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('users');
  const {
    stats, users, isAdmin, error, clearError,
    auditLog, auditLoading, revenue, flags,
    planChanging, suspending, extending, slotsSaving, flagToggling, markingTest,
    loadAuditLog, loadRevenue, loadFlags,
    handlePlanChange, handleSuspend, handleExtendPlan, handleSaveSlots,
    handleToggleFlag, handleMarkTest,
  } = useAdminData(user ?? null);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin === null) return null;
  if (isAdmin === false) return <Navigate to="/books" replace />;

  const handleTabChange = (next: Tab) => {
    setTab(next);
    clearError();
    if (next === 'audit' || next === 'payments') loadAuditLog();
    if (next === 'finances') loadRevenue();
    if (next === 'flags') loadFlags();
  };

  const top10: TopUser[] = [...(users ?? [])]
    .sort((a, b) => b.words_total - a.words_total)
    .slice(0, 10)
    .map((u) => ({ email: u.email, words_total: Number(u.words_total) }));

  const payments = (auditLog ?? []).filter((e) => e.action === 'payment_received');

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 12, borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-deep)' }}>
        <Link to="/books" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <LogoMark size={18} />
          <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>Р°РІС‚РѕСЂСЃРєР°СЏ СЃС‚СѓРґРёСЏ</span>
        </Link>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em' }}>/</span>
        <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)' }}>admin</span>
        <span style={{ flex: 1 }} />
        <Link to="/books" style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', textDecoration: 'none' }}>в†ђ Рє РїРѕР»РєРµ</Link>
        <button
          onClick={signOut}
          style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}
        >
          Р’С‹Р№С‚Рё
        </button>
      </div>

      <div style={{ padding: '36px 40px', maxWidth: 1200 }}>
        {error && <ErrorBanner message={error} style={{ marginBottom: 20 }} />}

        <h1 style={{ font: '600 28px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 20 }}>РџР°РЅРµР»СЊ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°</h1>

        <div role="tablist" aria-label="Р Р°Р·РґРµР»С‹ РїР°РЅРµР»Рё Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°" style={{ display: 'flex', gap: 0, marginBottom: 32, borderBottom: '1px solid var(--border-soft)' }}>
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
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
          <AuditLogTable entries={auditLog ?? []} loading={auditLoading} />
        )}

        {tab === 'payments' && (
          <PaymentsTable payments={payments} loading={auditLoading} />
        )}

        {tab === 'finances' && <FinancesPanel revenue={revenue} />}

        {tab === 'flags' && flags !== null && (
          <FlagsTable flags={flags} flagToggling={flagToggling} onToggle={handleToggleFlag} />
        )}
        {tab === 'flags' && flags === null && (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Р—Р°РіСЂСѓР·РєР°вЂ¦</div>
        )}

        {tab === 'users' && (
          <UsersPanel
            stats={stats}
            users={users}
            planChanging={planChanging}
            suspending={suspending}
            extending={extending}
            markingTest={markingTest}
            slotsSaving={slotsSaving}
            onPlanChange={handlePlanChange}
            onSuspend={handleSuspend}
            onExtendPlan={handleExtendPlan}
            onMarkTest={handleMarkTest}
            onSaveSlots={handleSaveSlots}
          />
        )}
      </div>
    </div>
  );
}
