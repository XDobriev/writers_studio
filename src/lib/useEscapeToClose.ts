import { useEffect, useRef } from 'react';

// Общий стек открытых модалок: при вложенности (модалка поверх модалки)
// Escape должен закрывать только верхнюю, а не обе разом.
// onClose держится в ref: инлайн-стрелка вызывающего иначе на каждом рендере
// переставляла бы модалку на вершину стека, и нижняя перехватывала бы Escape.
let stack: symbol[] = [];

export function useEscapeToClose(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const id = Symbol();
    stack.push(id);
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === id) {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      stack = stack.filter((s) => s !== id);
      document.removeEventListener('keydown', handler);
    };
  }, [active]);
}
