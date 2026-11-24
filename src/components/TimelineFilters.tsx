import { TYPE_COLORS, TYPE_FILTERS, type TypeFilter } from '../lib/timeline';

export function TimelineFilters({ variant, filter, onFilter }: {
  variant: 'sidebar' | 'inline';
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
            aria-pressed={filter === f.value}
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
    <div className="tl-filters" role="group" aria-label="Тип события">
      {TYPE_FILTERS.map((f) => (
        <button
          key={f.value}
          className={'tb-btn collection-filter' + (filter === f.value ? ' tb-btn--on' : '')}
          onClick={() => onFilter(f.value)}
          aria-pressed={filter === f.value}
        >
          {f.value !== 'all' && (
            <span className="tl-filter__dot" aria-hidden="true" style={{ background: TYPE_COLORS[f.value] }} />
          )}
          {f.label}
        </button>
      ))}
    </div>
  );
}
