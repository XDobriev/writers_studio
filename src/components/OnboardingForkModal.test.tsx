// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnboardingForkModal, type OnboardingForkModalProps } from './OnboardingForkModal';
import * as onboardingLib from '../lib/onboardingTemplates';
import type { Book } from '../lib/supabase';

let root: Root | null = null;
let queryClient: QueryClient;
const mockOnClose = vi.fn();
const mockOnSelectImport = vi.fn();
const mockOnSuccess = vi.fn();
const mockUploadCover = vi.fn();

const MOCK_BOOK: Book = {
  id: 'b-created-1',
  user_id: 'user-123',
  title: 'Тестовая книга',
  author: null,
  genre: null,
  genres: [],
  goal: 70000,
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

function mount(props: Partial<OnboardingForkModalProps> = {}, isOpen = true): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  act(() => {
    root!.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(OnboardingForkModal, {
          isOpen,
          onClose: mockOnClose,
          userId: 'user-123',
          onSelectImport: mockOnSelectImport,
          onSuccess: mockOnSuccess,
          onUploadCover: mockUploadCover,
          ...props,
        }),
      ),
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
    vi.spyOn(onboardingLib, 'createBookFromLiteraryForm').mockResolvedValue(MOCK_BOOK);
    vi.spyOn(onboardingLib, 'cloneSampleBook').mockResolvedValue({
      ...MOCK_BOOK,
      id: 'b-sample-1',
      title: 'Город, которого нет',
    });
  });

  it('не рендерится при isOpen=false', () => {
    mount({}, false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('рендерит 3 стартовых сценария при открытии (Шаг 1)', () => {
    mount();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Как вы хотите начать?');
    expect(dialog?.textContent).toContain('Импортировать готовую рукопись');
    expect(dialog?.textContent).toContain('Начать новую книгу');
    expect(dialog?.textContent).toContain('Изучить студию на романе');
  });

  it('клик по карточке импорта вызывает onSelectImport и onClose', () => {
    mount();
    const cards = document.querySelectorAll('.fork-card');
    expect(cards.length).toBe(3);

    act(() => {
      (cards[0] as HTMLElement).click();
    });

    expect(mockOnSelectImport).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('клик по карточке «Изучить студию» клонирует демо-роман и вызывает onSuccess с id', async () => {
    mount();
    const cards = document.querySelectorAll('.fork-card');

    await act(async () => {
      (cards[2] as HTMLElement).click();
    });

    expect(onboardingLib.cloneSampleBook).toHaveBeenCalledWith('user-123');
    expect(mockOnSuccess).toHaveBeenCalledWith('b-sample-1');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('клик по карточке «Начать новую книгу» открывает Шаг 2 с паспортом книги', () => {
    mount();
    const cards = document.querySelectorAll('.fork-card');

    act(() => {
      (cards[1] as HTMLElement).click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Паспорт новой книги');
    expect(document.querySelector('#fork-book-title')).not.toBeNull();
    expect(dialog?.textContent).toContain('Литературная форма');
    expect(dialog?.textContent).toContain('Роман');
    expect(dialog?.textContent).toContain('Повесть');
    expect(dialog?.textContent).toContain('Рассказ');
    expect(dialog?.textContent).toContain('Свободный объём');
    expect(dialog?.textContent).toContain('Жанры');
    expect(dialog?.textContent).toContain('Обложка');
    expect(dialog?.textContent).toContain('Драматургические схемы');

    // Кнопка «Назад к вариантам» возвращает на шаг 1
    const backBtn = dialog?.querySelector('button');
    expect(backBtn?.textContent).toContain('Назад к вариантам');
    act(() => {
      backBtn?.click();
    });
    expect(dialog?.textContent).toContain('Как вы хотите начать?');
  });

  it('при клике на форму «Повесть» цель по словам обновляется на 30 000', () => {
    mount();
    const cards = document.querySelectorAll('.fork-card');

    act(() => {
      (cards[1] as HTMLElement).click();
    });

    // Находим карточку «Повесть»
    const formCards = Array.from(document.querySelectorAll('[role="radio"]'));
    const novellaCard = formCards.find((c) => c.textContent?.includes('Повесть'));
    expect(novellaCard).toBeDefined();

    act(() => {
      (novellaCard as HTMLElement).click();
    });

    const wordsInput = document.querySelector('#fork-target-words') as HTMLInputElement;
    expect(wordsInput).not.toBeNull();
    expect(wordsInput.value).toBe('30000');
  });

  it('отображает секцию переноса серии только при наличии books', () => {
    // 1. Без books секция отсутствует
    mount({ books: [] });
    act(() => {
      (document.querySelectorAll('.fork-card')[1] as HTMLElement).click();
    });
    expect(document.body.textContent).not.toContain('Это продолжение серии');

    // 2. С books секция присутствует
    act(() => root?.unmount());
    document.body.innerHTML = '';
    mount({ books: [MOCK_BOOK] });
    act(() => {
      (document.querySelectorAll('.fork-card')[1] as HTMLElement).click();
    });
    expect(document.body.textContent).toContain('Это продолжение серии');
  });

  it('создает книгу через createBookFromLiteraryForm со всеми параметрами и вызывает onSuccess с id', async () => {
    mount({ books: [MOCK_BOOK] });
    const cards = document.querySelectorAll('.fork-card');

    // Переходим на шаг 2
    act(() => {
      (cards[1] as HTMLElement).click();
    });

    // Заполняем название
    const titleInput = document.querySelector('#fork-book-title') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(titleInput, 'Северный ветер');
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Выбираем форму «Повесть»
    const formCards = Array.from(document.querySelectorAll('[role="radio"]'));
    const novellaCard = formCards.find((c) => c.textContent?.includes('Повесть'));
    act(() => {
      (novellaCard as HTMLElement).click();
    });

    // Выбираем жанр (например, Фэнтези)
    const genreButtons = Array.from(document.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Фэнтези') && !b.textContent.includes('('),
    );
    if (genreButtons[0]) {
      act(() => {
        genreButtons[0].click();
      });
    }

    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Создать книгу и начать'),
    );
    expect(submitBtn).toBeDefined();

    await act(async () => {
      submitBtn?.click();
    });

    expect(onboardingLib.createBookFromLiteraryForm).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        title: 'Северный ветер',
        formId: 'novella',
        targetWords: 30000,
        genres: expect.arrayContaining(['Фэнтези']),
        cover: expect.any(String),
      }),
    );
    expect(mockOnSuccess).toHaveBeenCalledWith('b-created-1');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('нажатие клавиши Escape закрывает модальное окно', () => {
    mount();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
