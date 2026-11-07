// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GenrePicker } from './GenrePicker';

let root: Root | null = null;

function mount(value: string[] = [], onChange = vi.fn()): { container: HTMLElement; onChange: typeof onChange } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(GenrePicker, { value, onChange }));
  });
  return { container, onChange };
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('GenrePicker', () => {
  it('не содержит пресет «Young Adult» в списке жанров', () => {
    const { container } = mount();
    const buttons = Array.from(container.querySelectorAll('button'));
    const texts = buttons.map((b) => b.textContent?.trim());

    expect(texts).not.toContain('Young Adult');
    expect(texts).toContain('Фэнтези');
    expect(texts).toContain('Фантастика');
    expect(texts).toContain('Детектив');
    expect(texts).toContain('Другое');
  });

  it('позволяет выбирать и снимать выбор жанра', () => {
    const onChange = vi.fn();
    const { container } = mount(['Фэнтези'], onChange);

    const fantasyBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Фэнтези');
    expect(fantasyBtn).toBeDefined();

    // Клик по выбранному жанру снимает выбор
    act(() => {
      fantasyBtn?.click();
    });
    expect(onChange).toHaveBeenCalledWith([]);

    // Клик по невыбранному жанру добавляет его
    const scifiBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Фантастика');
    act(() => {
      scifiBtn?.click();
    });
    expect(onChange).toHaveBeenCalledWith(['Фэнтези', 'Фантастика']);
  });
});
