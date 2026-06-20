import type { FeatureFlag } from '../../lib/admin';

interface Props {
  flags: FeatureFlag[];
  flagToggling: string | null;
  onToggle: (key: string, enabled: boolean) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
      {children}
    </div>
  );
}

export function FlagsTable({ flags, flagToggling, onToggle }: Props) {
  return (
    <>
      <SectionTitle>Feature Flags</SectionTitle>
      {flags.length === 0 ? (
        <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '24px 0' }}>Нет флагов</div>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: 32 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col" className="admin-th">Ключ</th>
                <th scope="col" className="admin-th">Статус</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.key}>
                  <td className="admin-td admin-td--mono" style={{ color: 'var(--ink)', fontSize: 13 }}>{f.key}</td>
                  <td className="admin-td">
                    <button
                      onClick={() => onToggle(f.key, !f.enabled)}
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
  );
}
