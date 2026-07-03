import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../Icon';

interface SidebarNavProps {
  bookId: string;
}

export function SidebarNav({ bookId }: SidebarNavProps) {
  const { pathname } = useLocation();
  const navItems = useMemo<Array<[Parameters<typeof Icon>[0]['name'], string, string | null]>>(() => [
    ['layout', 'Дэшборд',   bookId ? `/books/${bookId}` : null],
    ['book',   'Манускрипт', bookId ? `/books/${bookId}/editor` : null],
    ['char',   'Персонажи',  bookId ? `/books/${bookId}/characters` : null],
    ['clock',  'Хронология', bookId ? `/books/${bookId}/timeline` : null],
    ['note',   'Заметки',    bookId ? `/books/${bookId}/notes` : null],
    ['tree',   'Структура',  bookId ? `/books/${bookId}/outline` : null],
    ['map',    'Карта мира', bookId ? `/books/${bookId}/map` : null],
    ['download', 'Экспорт',  bookId ? `/books/${bookId}/export` : null],
  ], [bookId]);

  function isNavActive(href: string | null): boolean {
    if (!href) return false;
    if (href === `/books/${bookId}`) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <nav style={{ padding: '10px 8px 4px', display: 'flex', flexDirection: 'column', gap: 1 }}>
      {navItems.map(([icn, label, href]) => {
        const on = isNavActive(href);
        const cls = 'sb-item' + (on ? ' sb-item--on' : '');
        const style = on ? { background: 'var(--surface)' } : {};
        const inner = (
          <>
            <span style={{ display: 'flex', justifyContent: 'center', color: on ? 'var(--ink)' : 'var(--ink-3)' }}>
              <Icon name={icn} size={15} />
            </span>
            <span className="sb-item-title" style={{ color: on ? 'var(--ink)' : 'var(--ink-2)' }}>{label}</span>
          </>
        );
        if (!href) {
          return (
            <span key={label} className={cls} style={{ ...style, opacity: 0.5, cursor: 'default' }}>
              {inner}
            </span>
          );
        }
        return (
          <Link key={label} to={href} className={cls} style={style} aria-current={on ? 'page' : undefined}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
