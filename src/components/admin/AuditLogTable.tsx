import { fmtDate, type AuditEntry } from '../../lib/admin';

interface Props {
  entries: AuditEntry[];
  loading: boolean;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
      {children}
    </div>
  );
}

function formatPayload(entry: AuditEntry): string {
  if (!entry.payload) return '—';
  const p = entry.payload;
  if (entry.action === 'payment_received') return `${p.plan} — ${p.amount} ${p.currency ?? '₽'}`;
  if (entry.action === 'set_lifetime_slots') return `${p.old_value} → ${p.new_value} слотов`;
  if (entry.action === 'set_feature_flag') return `${p.key}: ${p.old_enabled} → ${p.new_enabled}`;
  return `${p.old_plan ?? p.email ?? '?'} → ${p.new_plan ?? p.days ?? '?'}`;
}

export function AuditLogTable({ entries, loading }: Props) {
  return (
    <>
      <SectionTitle>Журнал действий администратора</SectionTitle>
      {loading ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
      ) : entries.length === 0 ? (
        <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '24px 0' }}>Пока нет записей</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--striped">
            <thead>
              <tr>
                <th scope="col" className="admin-th">Дата</th>
                <th scope="col" className="admin-th">Действие</th>
                <th scope="col" className="admin-th">Пользователь</th>
                <th scope="col" className="admin-th">Детали</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="admin-td admin-td--mono admin-td--nowrap">{fmtDate(entry.created_at)}</td>
                  <td className="admin-td admin-td--mono" style={{ color: 'var(--accent)', letterSpacing: '0.05em' }}>
                    {entry.action}
                  </td>
                  <td className="admin-td admin-td--ui">{entry.target_email ?? entry.target_user_id ?? '—'}</td>
                  <td className="admin-td admin-td--mono">{formatPayload(entry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
