// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditBookModal, type EditBookModalProps } from './EditBookModal';
import type { Book } from '../lib/supabase';

let root: Root | null = null;
const mockOnClose = vi.fn();
const mockOnSave = vi.fn();
const mockOnDelete = vi.fn();

const MOCK_BOOK: Book = {
  id: 'b-edit-1',
  user_id: 'u-1',
  title: 'Старое название',
  author: 'Иван Автор',
  genre: 'Фэнтези',
  genres: ['Фэнтези'],
  goal: 60000,
  words: 15000,
  cover: '#7c1d1d',
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

function mount(props: Partial<EditBookModalProps> = {}, isOpen = true) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(EditBookModal, {
        isOpen,
        onClose: mockOnClose,
        book: MOCK_BOOK,
        onSave: mockOnSave,
        onDelete: mockOnDelete,
        ...props,
      }),
    );
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('EditBookModal', () => {
  it('не рендерится при isOpen=false', () => {
    const container = mount({}, false);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('рендерит поля с данными книги и шапкой паспорта', () => {
    const container = mount();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Паспорт книги');

    const titleInput = container.querySelector('#edit-book-title') as HTMLInputElement;
    expect(titleInput).not.toBeNull();
    expect(titleInput.value).toBe('Старое название');

    const authorInput = container.querySelector('#edit-book-author') as HTMLInputElement;
    expect(authorInput).not.toBeNull();
    expect(authorInput.value).toBe('Иван Автор');

    const goalInput = container.querySelector('#edit-book-goal') as HTMLInputElement;
    expect(goalInput).not.toBeNull();
    expect(goalInput.value).toBe('60000');
  });

  it('сохраняет обновлённые поля при нажатии «Сохранить»', async () => {
    const container = mount();

    const titleInput = container.querySelector('#edit-book-title') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(titleInput, 'Новое название');
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Сохранить'));
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn?.click();
    });

    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Новое название',
        author: 'Иван Автор',
        goal: 60000,
        cover: '#7c1d1d',
      }),
    );
  });

  it('вызывает onDelete при нажатии «Удалить книгу»', () => {
    const container = mount();
    const deleteBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Удалить книгу'));
    expect(deleteBtn).toBeDefined();

    act(() => {
      deleteBtn?.click();
    });

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });
});
