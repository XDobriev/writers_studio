import { useEffect, useRef, type RefObject } from 'react';

/**
 * Общее поведение дропдаун-меню: фокус на первом пункте при открытии, закрытие по
 * клику вне и Escape, стрелочная навигация по `[role="menuitem"]`.
 *
 * `onClose` держится в ref: вызывающие передают инлайн-стрелку, и без ref эффект
 * перезапускался бы на каждый рендер — то есть возвращал фокус на первый пункт.
 */
export function useMenuDismiss(
  open: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const rafId = requestAnimationFrame(() => {
      containerRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = containerRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
        if (!items?.length) return;
        const idx = Array.from(items).indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown'
          ? (idx + 1) % items.length
          : (idx - 1 + items.length) % items.length;
        items[next].focus();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, containerRef]);
}
