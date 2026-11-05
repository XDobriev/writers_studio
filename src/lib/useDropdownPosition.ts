import { useLayoutEffect, useState, type RefObject, type CSSProperties } from 'react';

export interface DropdownPositionOptions {
  /** Ожидаемая высота меню в px. По умолчанию 360px, чтобы меню со статусом и типами не резалось экраном. */
  estimatedHeight?: number;
  /** Зазор между триггером и меню. По умолчанию 4px. */
  gap?: number;
  /** z-index для фиксации. По умолчанию 'var(--z-dropdown)'. */
  zIndex?: string | number;
  /** Минимальный отступ от края окна (безопасная зона). По умолчанию 8px. */
  screenPadding?: number;
}

function areStylesEqual(a: CSSProperties | null, b: CSSProperties | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.position === b.position &&
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.right === b.right &&
    a.maxHeight === b.maxHeight &&
    a.overflowY === b.overflowY &&
    a.zIndex === b.zIndex
  );
}

export function useDropdownPosition(
  ref: RefObject<HTMLElement | null>,
  openKey: string | null,
  optionsOrZIndex?: DropdownPositionOptions | number,
): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const opts: DropdownPositionOptions =
    typeof optionsOrZIndex === 'number'
      ? { zIndex: optionsOrZIndex }
      : (optionsOrZIndex ?? {});

  const gap = opts.gap ?? 4;
  const zIndex = opts.zIndex ?? 'var(--z-dropdown)';
  const screenPadding = opts.screenPadding ?? 8;
  const estimatedHeight = opts.estimatedHeight ?? 360;

  useLayoutEffect(() => {
    if (!openKey || !ref.current) {
      setStyle((prev) => (prev === null ? null : null));
      return;
    }

    const updatePosition = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const right = Math.max(screenPadding, window.innerWidth - rect.right);
      const spaceBelow = window.innerHeight - rect.bottom - gap - screenPadding;
      const spaceAbove = rect.top - gap - screenPadding;

      // Открываем вверх, если снизу места не хватает для полного меню и сверху места больше
      const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

      let nextStyle: CSSProperties;
      if (openUpwards) {
        const maxHeight = Math.max(120, spaceAbove);
        nextStyle = {
          position: 'fixed',
          bottom: window.innerHeight - rect.top + gap,
          right,
          maxHeight,
          overflowY: 'auto',
          zIndex,
        };
      } else {
        const maxHeight = Math.max(120, spaceBelow);
        nextStyle = {
          position: 'fixed',
          top: rect.bottom + gap,
          right,
          maxHeight,
          overflowY: 'auto',
          zIndex,
        };
      }

      setStyle((prev) => (areStylesEqual(prev, nextStyle) ? prev : nextStyle));
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [openKey, ref, gap, zIndex, screenPadding, estimatedHeight]);

  return style;
}
