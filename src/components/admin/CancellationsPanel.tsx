import { fmtDate, type AdminCancellations } from '../../lib/admin';
import { CANCEL_REASON_LABELS } from '../../lib/cancellations';

interface Props {
  data: AdminCancellations | null;
}

export function CancellationsPanel({ data }: Props) {
  if (data == null) {
    return <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>Загрузка…</div>;
  }

  const total = data.by_reason.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '20px 24px' }}>
        <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 6 }}>
          Отмен пока не было
        </div>
        <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)', lineHeight: 1.5 }}>
          Причину спрашиваем при каждой отмене подписки — здесь появятся ответы и комментарии.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '20px 24px' }}>
        <div style={{ font: '500 12px var(--font-ui)', color: 'var(--ink-2)', marginBottom: 14 }}>
          По причинам · всего {total}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.by_reason.map(({ reason, count }) => {
            const pct = Math.round((count / total) * 100);
            return (
              <div key={reason}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-2)' }}>
                    {CANCEL_REASON_LABELS[reason] ?? reason}
                  </span>
                  <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)' }}>
                    {count} · {pct}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--danger)', borderRadius: 3, minWidth: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-soft)', font: '500 12px var(--font-ui)', color: 'var(--ink-2)' }}>
          Последние ответы
        </div>
        {data.recent.map((entry, i) => (
          <div
            key={entry.id}
            style={{
              padding: '10px 16px',
              borderBottom: i < data.recent.length - 1 ? '1px solid oklch(0.28 0.010 50 / 0.5)' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: entry.comment ? 5 : 0 }}>
              <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {CANCEL_REASON_LABELS[entry.reason] ?? entry.reason}
              </span>
              <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)', flexShrink: 0 }}>
                {fmtDate(entry.created_at)}
              </span>
            </div>
            {entry.comment && (
              <div style={{ font: '400 12px/1.5 var(--font-serif)', color: 'var(--ink-3)' }}>
                «{entry.comment}»
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
