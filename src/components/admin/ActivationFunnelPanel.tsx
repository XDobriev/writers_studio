import type { ActivationFunnel } from '../../lib/admin';

interface Props {
  data: ActivationFunnel | null;
}

const STEPS: { key: keyof ActivationFunnel; label: string; note?: string }[] = [
  { key: 'signed_up',       label: 'Зарегистрировались' },
  { key: 'created_book',    label: 'Создали книгу' },
  { key: 'wrote_words',     label: 'Написали первые слова' },
  { key: 'added_character', label: 'Добавили персонажа' },
  { key: 'tried_export',    label: 'Попробовали экспорт', note: 'с 15 июля' },
];

export function ActivationFunnelPanel({ data }: Props) {
  if (data == null) {
    return <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>Загрузка…</div>;
  }

  const total = data.signed_up;

  if (total === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '20px 24px' }}>
        <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 6 }}>
          Нет нетестовых пользователей
        </div>
        <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)', lineHeight: 1.5 }}>
          Воронка считается по аккаунтам без метки «тест». Появятся реальные регистрации — появятся и цифры.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '20px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STEPS.map((step) => {
          const value = data[step.key];
          const pct = Math.round((value / total) * 100);
          return (
            <div key={step.key}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-2)' }}>
                  {step.label}
                  {step.note && (
                    <span style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-4)', marginLeft: 6 }}>
                      {step.note}
                    </span>
                  )}
                </span>
                <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', flexShrink: 0, marginLeft: 12 }}>
                  {value} · {pct}%
                </span>
              </div>
              <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 4, minWidth: value > 0 ? 3 : 0 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
        <div>
          <div style={{ font: '400 11px var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>
            Активированы
          </div>
          <div style={{ font: '600 20px var(--font-serif)', color: 'var(--ok)' }}>
            {data.activated} · {Math.round((data.activated / total) * 100)}%
          </div>
        </div>
        <div>
          <div style={{ font: '400 11px var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>
            Закрыли чеклист
          </div>
          <div style={{ font: '600 20px var(--font-serif)', color: 'var(--warn)' }}>
            {data.dismissed_early}
          </div>
        </div>
      </div>
    </div>
  );
}
