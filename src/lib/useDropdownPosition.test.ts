// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useDropdownPosition, type DropdownPositionOptions } from './useDropdownPosition';

describe('useDropdownPosition', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let mockElement: HTMLElement;
  let lastResult: ReturnType<typeof useDropdownPosition> = null;

  function renderDropdownHook(
    ref: RefObject<HTMLElement | null>,
    openKey: string | null,
    options?: DropdownPositionOptions | number,
  ) {
    function TestComponent() {
      lastResult = useDropdownPosition(ref, openKey, options);
      return null;
    }

    act(() => {
      root?.render(createElement(TestComponent));
    });
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockElement = document.createElement('button');
    document.body.appendChild(mockElement);

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 800 });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    if (container) container.remove();
    mockElement.remove();
    lastResult = null;
  });

  it('возвращает null, если openKey не задан', () => {
    const ref = { current: mockElement };
    renderDropdownHook(ref, null);
    expect(lastResult).toBeNull();
  });

  it('возвращает null, если ref.current равен null', () => {
    const ref = { current: null };
    renderDropdownHook(ref, 'chapter-1');
    expect(lastResult).toBeNull();
  });

  it('открывает меню вниз, если снизу достаточно места', () => {
    // Кнопка находится вверху экрана: top = 100, bottom = 124, right = 200
    vi.spyOn(mockElement, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 124,
      left: 176,
      right: 200,
      width: 24,
      height: 24,
      x: 176,
      y: 100,
      toJSON: () => {},
    });

    const ref = { current: mockElement };
    renderDropdownHook(ref, 'chapter-1');

    expect(lastResult).not.toBeNull();
    // top = bottom (124) + gap (4) = 128
    expect(lastResult?.top).toBe(128);
    expect(lastResult?.bottom).toBeUndefined();
    expect(lastResult?.overflowY).toBe('auto');
    expect(lastResult?.position).toBe('fixed');
  });

  it('переворачивает меню вверх, если снизу места не хватает для estimatedHeight (360px)', () => {
    // Кнопка находится в нижней части экрана: top = 650, bottom = 674 при высоте окна 800.
    // spaceBelow = 800 - 674 - 4 - 8 = 114px (< 360px).
    // spaceAbove = 650 - 4 - 8 = 638px (> 114px).
    vi.spyOn(mockElement, 'getBoundingClientRect').mockReturnValue({
      top: 650,
      bottom: 674,
      left: 176,
      right: 200,
      width: 24,
      height: 24,
      x: 176,
      y: 650,
      toJSON: () => {},
    });

    const ref = { current: mockElement };
    renderDropdownHook(ref, 'chapter-1');

    expect(lastResult).not.toBeNull();
    // bottom = innerHeight (800) - top (650) + gap (4) = 154
    expect(lastResult?.bottom).toBe(154);
    expect(lastResult?.top).toBeUndefined();
    expect(lastResult?.overflowY).toBe('auto');
    // maxHeight ограничен spaceAbove
    expect(lastResult?.maxHeight).toBe(638);
  });

  it('учитывает кастомный estimatedHeight и gap', () => {
    // top = 420, bottom = 450
    // spaceAbove = 420 - 10 - 8 = 402px.
    // spaceBelow = 800 - 450 - 10 - 8 = 332px.
    // Если estimatedHeight = 500, то 332 < 500 и 402 > 332 -> меню перевернется вверх.
    vi.spyOn(mockElement, 'getBoundingClientRect').mockReturnValue({
      top: 420,
      bottom: 450,
      left: 176,
      right: 200,
      width: 24,
      height: 30,
      x: 176,
      y: 420,
      toJSON: () => {},
    });

    const ref = { current: mockElement };
    renderDropdownHook(ref, 'chapter-1', { estimatedHeight: 500, gap: 10 });

    expect(lastResult?.bottom).toBe(800 - 420 + 10);
  });

  it('обновляет позицию при событии resize окна', () => {
    const getRectSpy = vi.spyOn(mockElement, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 124,
      left: 176,
      right: 200,
      width: 24,
      height: 24,
      x: 176,
      y: 100,
      toJSON: () => {},
    });

    const ref = { current: mockElement };
    renderDropdownHook(ref, 'chapter-1');
    expect(lastResult?.top).toBe(128);

    // Изменяем положение элемента
    getRectSpy.mockReturnValue({
      top: 650,
      bottom: 674,
      left: 176,
      right: 200,
      width: 24,
      height: 24,
      x: 176,
      y: 650,
      toJSON: () => {},
    });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(lastResult?.bottom).toBe(800 - 650 + 4);
  });

  describe('инвариант: меню никогда не выходит за пределы экрана', () => {
    it('для любой позиции кнопки на экране меню гарантированно укладывается в границы viewport', () => {
      const windowHeights = [500, 600, 768, 900, 1080];
      const gap = 4;
      const screenPadding = 8;
      const buttonHeight = 24;

      for (const h of windowHeights) {
        Object.defineProperty(window, 'innerHeight', { value: h });

        for (let top = 0; top <= h - buttonHeight; top += 25) {
          const bottom = top + buttonHeight;
          vi.spyOn(mockElement, 'getBoundingClientRect').mockReturnValue({
            top,
            bottom,
            left: 176,
            right: 200,
            width: 24,
            height: buttonHeight,
            x: 176,
            y: top,
            toJSON: () => {},
          });

          const ref = { current: mockElement };
          renderDropdownHook(ref, 'chapter-1', { estimatedHeight: 360, gap, screenPadding });

          expect(lastResult).not.toBeNull();
          expect(lastResult?.overflowY).toBe('auto');

          if (lastResult?.top !== undefined) {
            // Меню открыто вниз: top >= 0, и (top + maxHeight) не превышает h
            const topVal = Number(lastResult.top);
            const maxH = Number(lastResult.maxHeight);
            expect(topVal).toBeGreaterThanOrEqual(0);
            expect(topVal + maxH).toBeLessThanOrEqual(h);
          } else if (lastResult?.bottom !== undefined) {
            // Меню открыто вверх: bottom >= 0, и (bottom + maxHeight) не превышает h
            const bottomVal = Number(lastResult.bottom);
            const maxH = Number(lastResult.maxHeight);
            expect(bottomVal).toBeGreaterThanOrEqual(0);
            expect(bottomVal + maxH).toBeLessThanOrEqual(h);
          } else {
            throw new Error('Ни top, ни bottom не определены');
          }
        }
      }
    });
  });
});
