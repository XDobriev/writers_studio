import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { HoverState } from '../lib/useCharacterHover';

const ROLE_LABELS: Record<string, string> = {
  protagonist: 'Протагонист',
  secondary: 'Второстепенный',
  minor: 'Эпизодический',
};

const AVATAR_HUES = [30, 145, 230, 90, 310];

function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  return {
    bg: `oklch(0.63 0.16 ${hue} / 0.18)`,
    text: `oklch(0.40 0.18 ${hue})`,
  };
}

function cardPosition(x: number, y: number): { left: number; top: number } {
  const CARD_W = 256;
  let left = x + 14;
  if (left + CARD_W > window.innerWidth - 16) left = x - CARD_W - 14;
  const top = Math.max(8, y - 56);
  return { left, top };
}

interface Props {
  state: HoverState;
  bookId: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function CharacterHoverCard({ state, bookId, onMouseEnter, onMouseLeave }: Props) {
  const navigate = useNavigate();
  const { character, x, y } = state;
  const { left, top } = cardPosition(x, y);
  const color = avatarColor(character.name);
  const initials = character.name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const snippet = character.quote || character.personality?.slice(0, 90) || '';

  return createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left,
        top,
        width: 256,
        zIndex: 9000,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 12px 32px oklch(0 0 0 / 0.5)',
        padding: '12px 14px',
        animation: 'toast-in 0.15s cubic-bezier(0.22, 0.68, 0, 1.2) both',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: snippet ? 10 : 6 }}>
        {character.avatar_url ? (
          <img
            src={character.avatar_url}
            alt=""
            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: color.bg, color: color.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: '500 13px var(--font-mono)',
            }}
          >
            {initials}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{
            font: '600 14px var(--font-serif)',
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {character.name}
          </div>
          <div style={{
            font: '500 10px var(--font-mono)',
            color: 'var(--ink-3)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginTop: 2,
          }}>
            {ROLE_LABELS[character.role] ?? character.role}
          </div>
        </div>
      </div>

      {snippet && (
        <div style={{
          fontStyle: character.quote ? 'italic' : 'normal',
          font: character.quote
            ? 'italic 12px var(--font-serif)'
            : '12px var(--font-ui)',
          color: 'var(--ink-3)',
          lineHeight: 1.5,
          marginBottom: 10,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {character.quote ? `«${snippet}»` : snippet}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate(`/books/${bookId}/characters`)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          font: '500 10.5px var(--font-mono)',
          color: 'var(--accent)',
          letterSpacing: '0.06em',
        }}
      >
        Открыть карточку →
      </button>
    </div>,
    document.body,
  );
}
