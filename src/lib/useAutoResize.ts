import { useLayoutEffect, useState } from 'react';

// Высота textarea следует за текстом. Минимум задаёт rows, потолок — max-height в CSS (.input--textarea).
// Callback-ref, а не useRef: поле часто монтируется уже с текстом (открыли редактирование),
// и пересчёт должен сработать на монтировании, даже если value не поменялся.
export function useAutoResize(value: string) {
  const [el, setEl] = useState<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [el, value]);

  return setEl;
}
