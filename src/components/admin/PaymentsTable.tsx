import { fmtDate, PLAN_COLOR, type AuditEntry, type Plan } from '../../lib/admin';

interface Props {
  payments: AuditEntry[];
  loading: boolean;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
      {children}
    </div>
  );
}

export function PaymentsTable({ payments, loading }: Props) {
  return (
    <>
      <SectionTitle>История платежей</SectionTitle>
      {loading ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
      ) : payments.length === 0 ? (
        <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '24px 0' }}>Платежей пока нет</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table--striped">
            <thead>
              <tr>
                <th scope="col" className="admin-th">Дата</th>
                <th scope="col" className="admin-th">Пользователь</th>
                <th scope="col" className="admin-th">План</th>
                <th scope="col" className="admin-th">Сумма</th>
                <th scope="col" className="admin-th">Payment ID</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((entry) => {
                const plan = (entry.payload?.plan as Plan) ?? 'free';
                const amount = entry.payload
                  ? `${Number(entry.payload.amount).toLocaleString('ru-RU')} ${entry.payload.currency ?? '₽'}`
                  : '—';
                return (
                  <tr key={entry.id}>
                    <td className="admin-td admin-td--mono admin-td--nowrap">{fmtDate(entry.created_at)}</td>
                    <td className="admin-td admin-td--ui">{entry.target_email ?? '—'}</td>
                    <td
                      className="admin-td admin-td--mono"
                      style={{ color: PLAN_COLOR[plan], letterSpacing: '0.05em', textTransform: 'uppercase' }}
                    >
                      {entry.payload?.plan ?? '—'}
                    </td>
                    <td className="admin-td admin-td--mono">{amount}</td>
                    <td className="admin-td admin-td--mono-sm">{entry.payload?.payment_id ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
