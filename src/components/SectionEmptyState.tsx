import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface SectionEmptyStateProps {
  icon?: IconName;
  title: string;
  description?: string;
  children: ReactNode;
}

export function SectionEmptyState({ icon, title, description, children }: SectionEmptyStateProps) {
  return (
    <div className="section-empty">
      <div className="section-empty__content">
        {icon && <span className="section-empty__icon" aria-hidden="true"><Icon name={icon} size={22} /></span>}
        <div>
          <h2 className="section-empty__title">{title}</h2>
          {description && <p className="section-empty__description">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
