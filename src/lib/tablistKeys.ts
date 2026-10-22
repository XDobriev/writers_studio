import type { KeyboardEvent } from 'react';

// Стрелки/Home/End в role="tablist": фокус и выбор соседней вкладки (WAI-ARIA Tabs).
// Вешается на контейнер: onKeyDown={onTablistKeyDown}.
export function onTablistKeyDown(e: KeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'));
  const current = tabs.indexOf(document.activeElement as HTMLElement);
  if (current === -1 || tabs.length === 0) return;
  e.preventDefault();
  const next = e.key === 'Home' ? 0
    : e.key === 'End' ? tabs.length - 1
    : (current + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + tabs.length) % tabs.length;
  tabs[next].focus();
  tabs[next].click();
}
