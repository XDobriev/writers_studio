import { useEffect } from 'react';

// Общий стек открытых модалок: при вложенности (модалка поверх модалки)
// Escape должен закрывать только верхнюю, а не обе разом.
let stack: symbol[] = [];

export function useEscapeToClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const id = Symbol();
    stack.push(id);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === id) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      stack = stack.filter((s) => s !== id);
      document.removeEventListener('keydown', handler);
    };
  }, [active, onClose]);
}
