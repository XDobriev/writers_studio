// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GlobalSaveHandler } from './GlobalSaveHandler';

describe('GlobalSaveHandler', () => {
  let root: Root;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('при Ctrl+S вызывает preventDefault и показывает тост', async () => {
    act(() => {
      root.render(<GlobalSaveHandler timeoutMs={30} />);
    });

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyS',
      ctrlKey: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);

    const toast = container.querySelector('[role="status"]');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain('Все изменения сохранены');

    // Ждём завершения таймера (30ms), затем даём время на анимацию исчезновения AnimatePresence
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    const toastAfter = container.querySelector('[role="status"]');
    expect(toastAfter).toBeNull();
  });

  it('при ⌘S на macOS вызывает preventDefault и показывает тост', () => {
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });

    act(() => {
      root.render(<GlobalSaveHandler />);
    });

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyS',
      metaKey: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Все изменения сохранены');

    Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true });
  });

  it('при отсутствии интернета показывает тост об ошибке сети', () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    act(() => {
      root.render(<GlobalSaveHandler />);
    });

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyS',
      ctrlKey: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    const toast = container.querySelector('[role="status"]');
    expect(toast?.textContent).toContain('Нет подключения к интернету');
    expect(toast?.className).toContain('toast--error');

    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
  });

  it('поддерживает русскую раскладку (key="ы")', () => {
    act(() => {
      root.render(<GlobalSaveHandler />);
    });

    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'KeyS',
      key: 'ы',
      ctrlKey: true,
    });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Все изменения сохранены');
  });

  it('игнорирует нажатие клавиши S без модификатора или другие клавиши', () => {
    act(() => {
      root.render(<GlobalSaveHandler />);
    });

    const sWithoutMod = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'KeyS' });
    act(() => {
      window.dispatchEvent(sWithoutMod);
    });
    expect(sWithoutMod.defaultPrevented).toBe(false);
    expect(container.querySelector('[role="status"]')).toBeNull();

    const ctrlA = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'KeyA', ctrlKey: true });
    act(() => {
      window.dispatchEvent(ctrlA);
    });
    expect(ctrlA.defaultPrevented).toBe(false);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
