import { plural } from '../lib/i18n';

interface BookGroupHeadingProps {
  title: string;
  count: number;
}

// Подпись группы книг на Home (серия / отдельные книги).
export function BookGroupHeading({ title, count }: BookGroupHeadingProps) {
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
      {title}
      <span style={{ font: '400 12px var(--font-mono)', color: 'var(--ink-4)' }}>
        {count} {plural(count, 'книга', 'книги', 'книг')}
      </span>
    </h2>
  );
}
