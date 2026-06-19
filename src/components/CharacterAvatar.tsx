interface CharacterAvatarProps {
  name: string;
  /** Цвет персонажа из getCharacterColor(index). */
  color: string;
  /** Диаметр в px. По умолчанию 18. */
  size?: number;
}

// Круглый аватар-инициал персонажа. Размер шрифта выводится из диаметра.
export function CharacterAvatar({ name, color, size = 18 }: CharacterAvatarProps) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.max(8, Math.round(size * 0.5)),
      color: 'oklch(0.98 0 0)', fontWeight: 600, flexShrink: 0,
    }}>
      {name[0]?.toUpperCase() ?? '?'}
    </span>
  );
}
