import { useLayoutEffect, useState, type RefObject, type CSSProperties } from 'react';

export function useDropdownPosition(
  ref: RefObject<HTMLElement | null>,
  openKey: string | null,
  zIndex = 200,
): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!openKey || !ref.current) {
      setStyle(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    setStyle(
      spaceBelow < 180 && rect.top > 180
        ? { position: 'fixed', bottom: window.innerHeight - rect.top + 4, right, zIndex }
        : { position: 'fixed', top: rect.bottom + 4, right, zIndex },
    );
  }, [openKey, ref, zIndex]);

  return style;
}
