import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

// Фокус модалок/дроверов: единая реализация вместо копий в каждом компоненте.
// - при открытии фокус переходит в модалку (на initialRef или на саму панель);
// - Tab/Shift+Tab не выходят за пределы панели (trapTab в onKeyDown панели);
// - после закрытия фокус возвращается туда, откуда модалку открыли.

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

export function trapTab(e: KeyboardEvent<HTMLElement>, container: HTMLElement | null = e.currentTarget) {
  if (e.key !== 'Tab' || !container) return;
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (focusable.length === 0) { e.preventDefault(); return; }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === container)) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault(); first.focus();
  }
}

export function useModalFocus(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  initialRef?: RefObject<HTMLElement | null>,
) {
  const returnToRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    returnToRef.current = prev instanceof HTMLElement && prev !== document.body ? prev : null;
    // Панель может смонтироваться кадром позже (анимация появления).
    const raf = requestAnimationFrame(() => {
      (initialRef?.current ?? panelRef.current)?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      const back = returnToRef.current;
      if (back && back.isConnected) back.focus();
    };
  }, [open, panelRef, initialRef]);
}
