import { useState } from 'react';
import { Icon } from './Icon';
import type { PlanOutlineItem } from '../lib/usePlanOutline';

interface PlanOutlineProps {
  items: PlanOutlineItem[];
  onSelect: (index: number) => void;
  /** `aside` — колонка справа (широкий экран), `collapsed` — свёрнутый список сверху (мобилка). */
  variant?: 'aside' | 'collapsed';
}

function itemLabel(item: PlanOutlineItem): string {
  return item.text || 'Без названия';
}

function OutlineList({ items, onSelect }: { items: PlanOutlineItem[]; onSelect: (i: number) => void }) {
  return (
    <nav className="plan-toc__list" aria-label="Оглавление замысла">
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          className={`plan-toc__item plan-toc__item--l${item.level}`}
          onClick={() => onSelect(i)}
        >
          {itemLabel(item)}
        </button>
      ))}
    </nav>
  );
}

export function PlanOutline({ items, onSelect, variant = 'aside' }: PlanOutlineProps) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  if (variant === 'collapsed') {
    return (
      <div className="plan-toc plan-toc--collapsed">
        <button
          type="button"
          className="plan-toc__toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <Icon name="tree" size={13} />
          <span>Оглавление</span>
          <span className="chip">{items.length}</span>
          <span className={`plan-toc__chevron${open ? ' plan-toc__chevron--open' : ''}`}>
            <Icon name="chevd" size={13} />
          </span>
        </button>
        {open && (
          <OutlineList
            items={items}
            onSelect={(i) => { onSelect(i); setOpen(false); }}
          />
        )}
      </div>
    );
  }

  return (
    <aside className="plan-toc plan-toc--aside">
      <div className="plan-toc__head">Оглавление</div>
      <OutlineList items={items} onSelect={onSelect} />
    </aside>
  );
}
