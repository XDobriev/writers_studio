import { TYPE_COLORS, TYPE_FILTERS, type TypeFilter } from '../lib/timeline';

export function TimelineFilters({ variant, filter, onFilter }: {
  variant: 'sidebar' | 'mobile';
  filter: TypeFilter;
  onFilter: (f: TypeFilter) => void;
}) {
  if (variant === 'sidebar') {
    return (
      <div style={{ padding: '4px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            className={'sb-item' + (filter === f.value ? ' sb-item--on' : '')}
            onClick={() => onFilter(f.value)}
            style={{ width: '100%', textAlign: 'left' }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: f.value === 'all' ? 'transparent' : TYPE_COLORS[f.value],
                border: f.value === 'all' ? '1px solid var(--border)' : 'none',
              }}
            />
            <span className="sb-item-title">{f.label}</span>
            <span />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-soft)',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {TYPE_FILTERS.map((f) => (
        <button
          key={f.value}
          className={'sb-tab' + (filter === f.value ? ' sb-tab--on' : '')}
          onClick={() => onFilter(f.value)}
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
        >
          {f.value !== 'all' && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: TYPE_COLORS[f.value],
                flexShrink: 0,
              }}
            />
          )}
          {f.label}
        </button>
      ))}
    </div>
  );
}
