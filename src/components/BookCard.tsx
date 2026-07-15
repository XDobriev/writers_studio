import { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { cardHoverTransition, dropdownVariants } from '../lib/motion';
import { useMenuDismiss } from '../lib/useMenuDismiss';
import { pluralDays } from '../lib/i18n';
import type { Book } from '../lib/supabase';

const isImageUrl = (v: string) => v.startsWith('http') || v.startsWith('blob:');

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function dayDiff(iso: string): number {
  return Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

interface BookCardProps {
  book: Book;
  onEdit: () => void;
  onCreateSequel: () => void;
}

export function BookCard({ book, onEdit, onCreateSequel }: BookCardProps) {
  const b = book;
  const hasImage = b.cover ? isImageUrl(b.cover) : false;
  const [imgLoaded, setImgLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useMenuDismiss(menuOpen, () => setMenuOpen(false), menuRef);

  return (
    <motion.div
      className="book-card"
      whileHover={{ y: -3, boxShadow: '0 16px 40px oklch(0 0 0 / 0.55)' }}
      transition={cardHoverTransition}
    >
      <Link
        to={`/books/${b.id}`}
        className="book-card__link"
        aria-label={b.title}
      >
        <div style={{
          height: 180,
          ...(!hasImage && { background: `linear-gradient(160deg, ${b.cover ?? 'oklch(0.30 0.012 50)'}, oklch(0.20 0.02 50))` }),
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '18px 20px', borderBottom: '1px solid var(--border-soft)',
          position: 'relative', overflow: 'hidden',
        }}>
          {hasImage && (
            <img
              src={b.cover!}
              alt=""
              loading="eager"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.25s ease' }}
            />
          )}
          {hasImage && (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, oklch(0.08 0.01 50 / 0.85) 0%, transparent 55%)' }} />
          )}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ font: '500 10px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'oklch(0.95 0.008 80 / 0.7)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(b.genres?.length ? b.genres.join(', ') : null) ?? b.genre ?? 'Без жанра'}
            </div>
            <div style={{ font: '600 22px var(--font-serif)', color: 'oklch(0.97 0.01 80)', letterSpacing: '-0.01em', lineHeight: 1.15, maxHeight: 'calc(1.15em * 3)', overflow: 'hidden', WebkitMaskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)' }}>{b.title}</div>
            {b.author && (
              <div style={{ font: '400 11px var(--font-mono)', color: 'oklch(0.97 0.01 80 / 0.6)', marginTop: 6, letterSpacing: '0.06em' }}>{b.author}</div>
            )}
          </div>
        </div>
        <div style={{ padding: '14px 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 11px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            {b.goal > 0 ? (
              <>
                <span>{b.words.toLocaleString('ru')} / {b.goal.toLocaleString('ru')}</span>
                <span>{Math.round((b.words / b.goal) * 100)}%</span>
              </>
            ) : (
              <span>{b.words.toLocaleString('ru')} сл.</span>
            )}
          </div>
          <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden', marginBottom: 12, visibility: b.goal > 0 ? 'visible' : 'hidden' }}>
            {b.goal > 0 && (
              <div style={{ width: `${Math.min(100, (b.words / b.goal) * 100)}%`, minWidth: 4, height: '100%', background: b.words > 0 ? 'var(--accent)' : 'var(--ink-4)' }} />
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-3)' }}>
            <span>{dayDiff(b.created_at)} {pluralDays(dayDiff(b.created_at))} в работе</span>
            <span>изм. {formatDate(b.updated_at)}</span>
          </div>
        </div>
      </Link>
      <div ref={menuRef} className="book-card__menu">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          title={`Меню книги: ${b.title}`}
          aria-label={`Меню книги: ${b.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`book-card__menu-btn${menuOpen ? ' book-card__menu-btn--open' : ''}`}
        >
          <Icon name="moremenu" size={13} />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              role="menu"
              variants={dropdownVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="book-card__menu-panel"
            >
              <button
                type="button"
                role="menuitem"
                className="sb-dropdown-item"
                onClick={() => { setMenuOpen(false); onEdit(); }}
              >
                <Icon name="pencil" size={14} />
                Редактировать
              </button>
              <button
                type="button"
                role="menuitem"
                className="sb-dropdown-item"
                onClick={() => { setMenuOpen(false); onCreateSequel(); }}
              >
                <Icon name="plus" size={14} />
                Создать продолжение
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
