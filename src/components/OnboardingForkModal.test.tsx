// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { OnboardingForkModal } from './OnboardingForkModal';
import * as onboardingLib from '../lib/onboardingTemplates';
import type { Book } from '../lib/supabase';

let root: Root | null = null;
const mockOnClose = vi.fn();
const mockOnSelectImport = vi.fn();
const mockOnSuccess = vi.fn();

const MOCK_BOOK: Book = {
  id: 'b-created-1',
  user_id: 'user-123',
  title: 'Тестовая книга',
  author: null,
  genre: null,
  genres: [],
  goal: 500,
  words: 0,
  cover: null,
  daily_goal: 0,
  imported_words: 0,
  map_bg_url: null,
  map_template: null,
  series_id: null,
  series_order: null,
  share_token: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function mount(isOpen = true): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => {
    root!.render(
      createElement(OnboardingForkModal, {
        isOpen,
        onClose: mockOnClose,
        userId: 'user-123',
        onSelectImport: mockOnSelectImport,
        onSuccess: mockOnSuccess,
      }),
    );
  });
  return el;
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('OnboardingForkModal', () => {
  beforeEach(() => {
    vi.spyOn(onboardingLib, 'createBookFromTemplate').mockResolvedValue(MOCK_BOOK);
    vi.spyOn(onboardingLib, 'cloneSampleBook').mockResolvedValue({
      ...MOCK_BOOK,
      id: 'b-sample-1',
      title: 'Город, которого нет',
    });
  });

  it('не рендерится при isOpen=false', () => {
    mount(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('рендерит 3 стартовых сценария при открытии', () => {
    mount(true);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Как вы хотите начать?');
    expect(dialog?.textContent).toContain('Импортировать готовую рукопись');
    expect(dialog?.textContent).toContain('Начать новую книгу');
    expect(dialog?.textContent).toContain('Изучить студию на романе');
  });

  it('клик по карточке импорта вызывает onSelectImport и onClose', () => {
    mount(true);
    const cards = document.querySelectorAll('.fork-card');
    expect(cards.length).toBe(3);

    act(() => {
      (cards[0] as HTMLElement).click();
    });

    expect(mockOnSelectImport).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('клик по карточке «Начать новую книгу» открывает шаг настройки', () => {
    mount(true);
    const cards = document.querySelectorAll('.fork-card');

    act(() => {
      (cards[1] as HTMLElement).click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Настройка новой книги');
    expect(dialog?.textContent).toContain('Сюжетная структура');
    expect(dialog?.textContent).toContain('Щадящая цель старта');

    // Кнопка «Назад к вариантам» возвращает на шаг 1
    const backBtn = dialog?.querySelector('button');
    expect(backBtn?.textContent).toContain('Назад к вариантам');
    act(() => {
      backBtn?.click();
    });
    expect(dialog?.textContent).toContain('Как вы хотите начать?');
  });

  it('создает книгу из шаблона на шаге 2 и вызывает onSuccess', async () => {
    mount(true);
    const cards = document.querySelectorAll('.fork-card');

    // Переходим на шаг 2
    act(() => {
      (cards[1] as HTMLElement).click();
    });

    const titleInput = document.querySelector('#fork-book-title') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(titleInput, 'Мой детектив');
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Создать книгу и начать'),
    );
    expect(submitBtn).toBeDefined();

    await act(async () => {
      submitBtn?.click();
    });

    expect(onboardingLib.createBookFromTemplate).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        title: 'Мой детектив',
        templateId: 'three-act',
        goalWords: 500,
      }),
    );
    expect(mockOnSuccess).toHaveBeenCalledWith(MOCK_BOOK);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('клик по карточке «Изучить студию» клонирует демо-роман и вызывает onSuccess', async () => {
    mount(true);
    const cards = document.querySelectorAll('.fork-card');

    await act(async () => {
      (cards[2] as HTMLElement).click();
    });

    expect(onboardingLib.cloneSampleBook).toHaveBeenCalledWith('user-123');
    expect(mockOnSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Город, которого нет' }),
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('нажатие клавиши Escape закрывает модальное окно', () => {
    mount(true);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
