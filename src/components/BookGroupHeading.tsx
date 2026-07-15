import type { ReactNode } from 'react';
import { plural } from '../lib/i18n';

interface BookGroupHeadingProps {
  children: ReactNode;
  count: number;
}

// Подпись группы книг на Home (серия / отдельные книги). Заголовок принимает
// children, чтобы вызывающий мог вложить интерактив (переименование серии), не
// растаскивая визуал h2 по страницам.
export function BookGroupHeading({ children, count }: BookGroupHeadingProps) {
  return (
    <h2
      style={{
        font: '600 15px var(--font-ui)',
        color: 'var(--ink-2)',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
      }}
    >
      {children}
      <span style={{ font: '400 12px var(--font-mono)', color: 'var(--ink-4)' }}>
        {count} {plural(count, 'книга', 'книги', 'книг')}
      </span>
    </h2>
  );
}
