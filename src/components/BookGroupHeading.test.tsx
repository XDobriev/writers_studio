// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BookGroupHeading } from './BookGroupHeading';

let root: Root | null = null;
function mount(children: React.ReactNode, count: number): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => {
    root!.render(createElement(BookGroupHeading, { count, children }));
  });
  return el;
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
});

describe('BookGroupHeading', () => {
  it('оборачивает children в единый span-контейнер для защиты от flex gap между частями названия', () => {
    const el = mount(['Серия «', createElement('button', { key: 'btn' }, 'Равновесие нарушено'), '»'], 1);
    const h2 = el.querySelector('h2');
    expect(h2).not.toBeNull();

    // Первый прямой потомок h2 должен быть span, группирующий все части названия серии
    const titleWrapper = h2!.firstElementChild;
    expect(titleWrapper?.tagName).toBe('SPAN');
    expect(titleWrapper?.textContent).toBe('Серия «Равновесие нарушено»');

    // Второй прямой потомок — счётчик книг
    const countBadge = h2!.lastElementChild;
    expect(countBadge?.tagName).toBe('SPAN');
    expect(countBadge?.textContent).toBe('1 книга');

    // Всего у h2 ровно 2 прямых flex-элемента: заголовок и счётчик
    expect(h2!.childElementCount).toBe(2);
  });

  it('корректно форматирует множественное число книг', () => {
    const el = mount('Отдельные книги', 5);
    const countBadge = el.querySelector('h2 > span:last-child');
    expect(countBadge?.textContent).toBe('5 книг');
  });
});
