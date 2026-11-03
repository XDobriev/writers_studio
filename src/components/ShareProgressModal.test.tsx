// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ShareProgressModal } from './ShareProgressModal';
import type { ProgressCardData } from '../lib/progressCard';

let root: Root | null = null;

const dummyData: ProgressCardData = {
  bookTitle: 'Тестовая книга',
  todayWords: 540,
  streak: 3,
  totalWords: 15000,
  goalWords: 1000,
};

function mount(props?: { isOpen?: boolean; onClose?: () => void; data?: ProgressCardData }): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => {
    root!.render(
      createElement(ShareProgressModal, {
        isOpen: props?.isOpen ?? true,
        onClose: props?.onClose ?? vi.fn(),
        data: props?.data ?? dummyData,
      }),
    );
  });
  return el;
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    roundRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn(() => ({ width: 50 })),
  })) as any;
});

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('ShareProgressModal', () => {
  it('не рендерит ничего при isOpen: false', () => {
    const el = mount({ isOpen: false });
    expect(el.querySelector('.modal-overlay')).toBeNull();
  });

  it('рендерит модальное окно и элементы при isOpen: true', () => {
    const el = mount({ isOpen: true });
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.textContent).toContain('Карточка прогресса');
    expect(el.textContent).toContain('Сторис 9:16');
    expect(el.textContent).toContain('Квадрат 1:1');
    expect(el.textContent).toContain('Тёмная');
    expect(el.textContent).toContain('Пергамент');
    expect(el.textContent).toContain('Скачать PNG');
  });

  it('вызывает onClose при клике на крестик закрытия', () => {
    const onClose = vi.fn();
    const el = mount({ isOpen: true, onClose });
    const closeBtn = el.querySelector('button[aria-label="Закрыть окно"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    act(() => {
      closeBtn.click();
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('переключает тему и формат без ошибок', () => {
    const el = mount({ isOpen: true });
    const buttons = Array.from(el.querySelectorAll('button'));

    const squareBtn = buttons.find((b) => b.textContent?.includes('Квадрат 1:1'));
    expect(squareBtn).toBeDefined();
    act(() => {
      squareBtn?.click();
    });

    const paperBtn = buttons.find((b) => b.textContent?.includes('Пергамент'));
    expect(paperBtn).toBeDefined();
    act(() => {
      paperBtn?.click();
    });

    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
