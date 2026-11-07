// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const mockStartCheckout = vi.fn();
const mockGetLifetimeSlotsRemaining = vi.fn();
let mockPaymentsEnabled = true;

vi.mock('../lib/checkout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/checkout')>();
  return {
    ...actual,
    startCheckout: (...args: unknown[]) => mockStartCheckout(...args),
  };
});

vi.mock('../lib/profiles', () => ({
  getLifetimeSlotsRemaining: () => mockGetLifetimeSlotsRemaining(),
}));

vi.mock('../lib/useFeatureFlag', () => ({
  useFeatureFlag: (flag: string) => {
    if (flag === 'payments_enabled') return { enabled: mockPaymentsEnabled, loading: false };
    return { enabled: false, loading: false };
  },
}));

import { UpgradeModal } from './UpgradeModal';

let root: Root | null = null;

async function mount(props: {
  onClose?: () => void;
  skipPro?: boolean;
  grandfathered?: boolean;
}): Promise<HTMLElement> {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root!.render(
      createElement(UpgradeModal, {
        onClose: props.onClose ?? vi.fn(),
        skipPro: props.skipPro,
        grandfathered: props.grandfathered,
      }),
    );
  });
  return el;
}

beforeEach(() => {
  mockPaymentsEnabled = true;
  mockStartCheckout.mockReset();
  mockGetLifetimeSlotsRemaining.mockReset();
  mockGetLifetimeSlotsRemaining.mockResolvedValue(5);
});

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('UpgradeModal', () => {
  it('рендерит диалог с корректными a11y атрибутами и стилями скролла', async () => {
    const el = await mount({});
    const dialog = el.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Перейти на Pro');

    // Проверяем гибкую высоту, отсутствие контура фокуса и flex-колонку диалога
    expect(dialog.style.maxHeight).toBe('min(92dvh, 760px)');
    expect(dialog.style.display).toBe('flex');
    expect(dialog.style.flexDirection).toBe('column');
    expect(dialog.style.overflow).toBe('hidden');
    expect(dialog.style.outline).toBe('none');

    // Проверяем наличие скроллируемого контейнера содержимого с плавным тач-скроллом
    const scrollContainer = dialog.querySelector<HTMLElement>('div[style*="overflow-y: auto"]');
    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer?.style.overflowY).toBe('auto');
    expect(scrollContainer?.style.flex).toMatch(/^1/);

    // Проверяем нативный тултип кнопки закрытия
    const closeBtn = dialog.querySelector<HTMLButtonElement>('button[aria-label="Закрыть"]');
    expect(closeBtn?.getAttribute('title')).toBe('Закрыть');
  });

  it('закрывается по клику на крестик в шапке', async () => {
    const onClose = vi.fn();
    const el = await mount({ onClose });
    const closeBtn = el.querySelector<HTMLButtonElement>('button[aria-label="Закрыть"]')!;
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.getAttribute('type')).toBe('button');

    act(() => {
      closeBtn.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('закрывается по клику на фон (overlay)', async () => {
    const onClose = vi.fn();
    const el = await mount({ onClose });
    const overlay = el.firstElementChild as HTMLElement;

    act(() => {
      overlay.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('не закрывается по клику внутри модального окна', async () => {
    const onClose = vi.fn();
    const el = await mount({ onClose });
    const dialog = el.querySelector<HTMLElement>('[role="dialog"]')!;

    act(() => {
      dialog.click();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('закрывается по клавише Escape', async () => {
    const onClose = vi.fn();
    await mount({ onClose });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('в режиме skipPro отображает шапку Lifetime и скрывает фичи Pro', async () => {
    const el = await mount({ skipPro: true });
    const dialog = el.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Перейти на Lifetime');
    expect(dialog.textContent).toContain('Перейти на Lifetime');
    expect(dialog.textContent).toContain('Один раз — навсегда');
    expect(dialog.textContent).not.toContain('Безлимитное количество книг');
  });

  it('в режиме skipPro при 0 оставшихся мест Lifetime выводит сообщение о распродаже', async () => {
    mockGetLifetimeSlotsRemaining.mockResolvedValue(0);
    const el = await mount({ skipPro: true });

    await act(async () => {
      await Promise.resolve();
    });

    expect(el.textContent).toContain('Все места по тарифу Lifetime сейчас заняты');
  });

  it('рендерит блок Lifetime после загрузки слотов и вызывает startCheckout при покупке', async () => {
    mockGetLifetimeSlotsRemaining.mockResolvedValue(3);
    mockStartCheckout.mockResolvedValue('https://auth.robokassa.ru/test');

    const el = await mount({});

    await act(async () => {
      await Promise.resolve();
    });

    expect(el.textContent).toContain('3 места');
    const lifetimeBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Купить Lifetime'),
    );
    expect(lifetimeBtn).toBeTruthy();

    await act(async () => {
      lifetimeBtn!.click();
    });

    expect(mockStartCheckout).toHaveBeenCalledWith('lifetime', false);
  });

  it('при payments_enabled = false блокирует кнопки покупки и показывает уведомление', async () => {
    mockPaymentsEnabled = false;
    const el = await mount({});

    expect(el.textContent).toContain('Оплата временно недоступна');
    const subBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Оформить подписку'),
    );
    expect(subBtn?.disabled).toBe(true);
  });

  it('активирует подписку Pro после выбора согласия и поддерживает переключение периода', async () => {
    mockStartCheckout.mockResolvedValue('https://auth.robokassa.ru/test');
    const el = await mount({});

    const subBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Оформить подписку'),
    )!;
    expect(subBtn.disabled).toBe(true);

    const checkbox = el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox).toBeTruthy();

    act(() => {
      checkbox.click();
    });
    expect(subBtn.disabled).toBe(false);

    // Переключаем на годовой период
    const annualBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Год'),
    )!;
    act(() => {
      annualBtn.click();
    });

    await act(async () => {
      subBtn.click();
    });

    expect(mockStartCheckout).toHaveBeenCalledWith('pro_annual', true);
  });

  it('корректно отображает ошибку оплаты при сбое startCheckout', async () => {
    mockStartCheckout.mockRejectedValue(new Error('Сетевая ошибка платежа'));
    const el = await mount({});

    const checkbox = el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    act(() => {
      checkbox.click();
    });

    const subBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Оформить подписку'),
    )!;

    await act(async () => {
      subBtn.click();
    });

    const alert = el.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert?.textContent).toContain('Сетевая ошибка платежа');
    expect(el.querySelectorAll('[role="alert"]').length).toBe(1);
  });

  it('удерживает фокус через trapTab при циклической навигации Tab и Shift+Tab', async () => {
    // В jsdom offsetParent всегда null — мокаем его для эмуляции видимости элементов в документе
    const origOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get() { return this.parentNode; },
    });

    try {
      const el = await mount({});
      await act(async () => {
        await Promise.resolve();
      });

      const dialog = el.querySelector<HTMLElement>('[role="dialog"]')!;
      const closeBtn = el.querySelector<HTMLButtonElement>('button[aria-label="Закрыть"]')!;
      const lifetimeBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => b.textContent?.includes('Купить Lifetime'),
      )!;

      expect(closeBtn).toBeTruthy();
      expect(lifetimeBtn).toBeTruthy();

      // 1. Shift+Tab с первого элемента (крестик) переносит фокус на последний элемент (Lifetime)
      closeBtn.focus();
      expect(document.activeElement).toBe(closeBtn);

      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        dialog.dispatchEvent(shiftTabEvent);
      });

      expect(shiftTabEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(lifetimeBtn);

      // 2. Tab с последнего элемента (Lifetime) переносит фокус обратно на первый элемент (крестик)
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: false,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        dialog.dispatchEvent(tabEvent);
      });

      expect(tabEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(closeBtn);
    } finally {
      if (origOffsetParent) {
        Object.defineProperty(HTMLElement.prototype, 'offsetParent', origOffsetParent);
      } else {
        delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetParent;
      }
    }
  });

  it('отображает ошибку оплаты рядом с кнопкой «Купить Lifetime» при сбое', async () => {
    mockStartCheckout.mockRejectedValue(new Error('Сбой шлюза оплаты Lifetime'));
    const el = await mount({});

    await act(async () => {
      await Promise.resolve();
    });

    const lifetimeBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Купить Lifetime'),
    )!;
    expect(lifetimeBtn).toBeTruthy();

    await act(async () => {
      lifetimeBtn.click();
    });

    const alert = el.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert?.textContent).toContain('Сбой шлюза оплаты Lifetime');
    expect(el.querySelectorAll('[role="alert"]').length).toBe(1);
    // Проверяем, что алерт расположен сразу после кнопки Lifetime, а не в секции Pro
    expect(lifetimeBtn.nextElementSibling).toBe(alert);
  });

  it('в режиме skipPro отображает ошибку оплаты рядом с кнопкой «Купить Lifetime» при сбое', async () => {
    mockStartCheckout.mockRejectedValue(new Error('Сбой шлюза в режиме skipPro'));
    const el = await mount({ skipPro: true });

    await act(async () => {
      await Promise.resolve();
    });

    const lifetimeBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Купить Lifetime'),
    )!;
    expect(lifetimeBtn).toBeTruthy();

    await act(async () => {
      lifetimeBtn.click();
    });

    const alert = el.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert?.textContent).toContain('Сбой шлюза в режиме skipPro');
    expect(lifetimeBtn.nextElementSibling).toBe(alert);
  });

  it('в режиме skipPro при slots === null показывает понятное сообщение и кнопку закрытия вместо вечного скелетона', async () => {
    mockGetLifetimeSlotsRemaining.mockResolvedValue(null);
    const onClose = vi.fn();
    const el = await mount({ skipPro: true, onClose });

    await act(async () => {
      await Promise.resolve();
    });

    expect(el.querySelector('.skeleton')).toBeNull();
    expect(el.textContent).toContain('Не удалось загрузить данные о тарифе. Попробуйте позже');

    const closeBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Закрыть') && b.getAttribute('aria-label') !== 'Закрыть',
    );
    expect(closeBtn).toBeTruthy();
    expect(closeBtn?.getAttribute('type')).toBe('button');

    act(() => {
      closeBtn!.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('в режиме skipPro при ошибке сети getLifetimeSlotsRemaining показывает понятное сообщение и кнопку закрытия', async () => {
    mockGetLifetimeSlotsRemaining.mockRejectedValue(new Error('Сетевой сбой при загрузке слотов'));
    const onClose = vi.fn();
    const el = await mount({ skipPro: true, onClose });

    await act(async () => {
      await Promise.resolve();
    });

    expect(el.querySelector('.skeleton')).toBeNull();
    expect(el.textContent).toContain('Не удалось загрузить данные о тарифе. Попробуйте позже');

    const closeBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Закрыть') && b.getAttribute('aria-label') !== 'Закрыть',
    );
    expect(closeBtn).toBeTruthy();

    act(() => {
      closeBtn!.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('в обычном режиме (!skipPro) при сбое загрузки слотов скрывает блок Lifetime и убирает скелетон', async () => {
    mockGetLifetimeSlotsRemaining.mockRejectedValue(new Error('Сетевой сбой'));
    const el = await mount({});

    await act(async () => {
      await Promise.resolve();
    });

    // Скелетон исчезает
    expect(el.querySelector('.skeleton')).toBeNull();
    // Блок Lifetime не отображается
    expect(el.textContent).not.toContain('Купить Lifetime');
    // Секция Pro остаётся доступной
    expect(el.textContent).toContain('Оформить подписку');
  });

  it('в обычном режиме (!skipPro) при slots === null скрывает блок Lifetime и убирает скелетон', async () => {
    mockGetLifetimeSlotsRemaining.mockResolvedValue(null);
    const el = await mount({});

    await act(async () => {
      await Promise.resolve();
    });

    expect(el.querySelector('.skeleton')).toBeNull();
    expect(el.textContent).not.toContain('Купить Lifetime');
    expect(el.textContent).toContain('Оформить подписку');
  });

  it('при некорректном отрицательном числе слотов корректно переходит в состояние ошибки', async () => {
    mockGetLifetimeSlotsRemaining.mockResolvedValue(-1);

    // В режиме skipPro показывает сообщение об ошибке
    const elSkip = await mount({ skipPro: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(elSkip.querySelector('.skeleton')).toBeNull();
    expect(elSkip.textContent).toContain('Не удалось загрузить данные о тарифе. Попробуйте позже');

    // В обычном режиме скрывает блок Lifetime
    const elNormal = await mount({});
    await act(async () => {
      await Promise.resolve();
    });
    expect(elNormal.querySelector('.skeleton')).toBeNull();
    expect(elNormal.textContent).not.toContain('Купить Lifetime');
  });
});
