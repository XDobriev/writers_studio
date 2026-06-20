import { fmtNum, type AdminRevenue } from '../../lib/admin';

interface Props {
  revenue: AdminRevenue | null;
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

export function FinancesPanel({ revenue }: Props) {
  return (
    <>
      <SectionTitle>Revenue-метрики</SectionTitle>
      {revenue === null ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 36 }}>
          <StatCard label="MRR" value={`${fmtNum(revenue.mrr)} ₽`} sub="Pro × 390 ₽/мес" />
          <StatCard label="ARR" value={`${fmtNum(revenue.arr)} ₽`} />
          <StatCard label="Pro-подписчиков" value={revenue.pro_count} />
          <StatCard label="Lifetime" value={revenue.lifetime_count} />
          <StatCard label="Отток за 30д" value={revenue.churn_count_30d} sub={`${revenue.churn_rate}%`} />
        </div>
      )}
    </>
  );
}
