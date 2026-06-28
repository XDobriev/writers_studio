import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { cardHoverTransition } from '../lib/motion';
import { pluralDays } from '../lib/i18n';
import type { Book } from '../lib/supabase';

const isImageUrl = (v: string) => v.startsWith('http') || v.startsWith('blob:');

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function dayDiff(iso: string): number {
  return Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function BookCard({ book, onEdit }: { book: Book; onEdit: () => void }) {
  const b = book;
  const hasImage = b.cover ? isImageUrl(b.cover) : false;

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
              loading="lazy"
              decoding="async"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
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
      <button
        type="button"
        onClick={onEdit}
        title={`Редактировать: ${b.title}`}
        aria-label={`Редактировать: ${b.title}`}
        className="book-card__edit"
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 1,
          width: 28, height: 28, borderRadius: 6,
          border: '1px solid oklch(1 0 0 / 0.12)',
          backdropFilter: 'blur(6px)',
          cursor: 'pointer',
          alignItems: 'center', justifyContent: 'center',
          color: 'oklch(0.98 0 0)',
        }}
      >
        <Icon name="pencil" size={13} />
      </button>
    </motion.div>
  );
}
