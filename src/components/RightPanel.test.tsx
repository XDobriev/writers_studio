// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { RightPanel } from './RightPanel';
import type { Character } from '../lib/characters';
import type { ChapterMemberRow } from '../lib/crossrefs';
import type { Note } from '../lib/notes';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockMembers: ChapterMemberRow[] = [
  {
    character_id: 'char-anna',
    is_pov: true,
    auto_detected: true,
    characters: {
      name: 'Анна Каренина',
      avatar_url: null,
      position: 0,
    },
  },
  {
    character_id: 'char-alexey',
    is_pov: false,
    auto_detected: true,
    characters: {
      name: 'Алексей Вронский',
      avatar_url: 'https://example.com/avatar.jpg',
      position: 1,
    },
  },
];

const mockCharacters: Character[] = [
  {
    id: 'char-anna',
    book_id: 'book-1',
    user_id: 'user-1',
    name: 'Анна Каренина',
    role: 'protagonist',
    position: 0,
    age: 28,
    quote: 'Все счастливые семьи похожи друг на друга',
    personality: 'Умная, страстная',
    appearance: 'Темные кудри',
    interior_life: '',
    exterior_life: '',
    gap: '',
    backstory: '',
    notes: '',
    avatar_url: null,
    aliases: ['Анна'],
    created_at: '',
    updated_at: '',
  },
  {
    id: 'char-alexey',
    book_id: 'book-1',
    user_id: 'user-1',
    name: 'Алексей Вронский',
    role: 'secondary',
    position: 1,
    age: 25,
    quote: 'Любовь побеждает всё',
    personality: 'Офицер, решительный',
    appearance: 'Статный',
    interior_life: '',
    exterior_life: '',
    gap: '',
    backstory: '',
    notes: '',
    avatar_url: 'https://example.com/avatar.jpg',
    aliases: ['Вронский'],
    created_at: '',
    updated_at: '',
  },
];

const mockNotes: Note[] = [
  {
    id: 'note-1',
    book_id: 'book-1',
    chapter_id: 'chap-1',
    user_id: 'user-1',
    kind: 'idea',
    text: 'Заметка к главе',
    position: 0,
    custom_color: null,
    custom_label: null,
    created_at: '',
  },
  {
    id: 'note-general',
    book_id: 'book-1',
    chapter_id: null,
    user_id: 'user-1',
    kind: 'important',
    text: 'Общая заметка всей книги',
    position: 1,
    custom_color: null,
    custom_label: null,
    created_at: '',
  },
];

vi.mock('../lib/queries', () => ({
  useNotes: () => ({ data: mockNotes }),
  useChapterMembers: () => ({ data: mockMembers }),
  useCharacters: () => ({ data: mockCharacters }),
}));

vi.mock('../lib/useNoteMutations', () => ({
  useNoteMutations: () => ({
    onAdd: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    isSaving: false,
  }),
}));

let root: Root | null = null;
function mount(props?: Partial<Parameters<typeof RightPanel>[0]>): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => {
    root!.render(
      createElement(RightPanel, {
        bookId: 'book-1',
        chapterId: 'chap-1',
        chapterTitle: 'Глава 1',
        userId: 'user-1',
        ...props,
      }),
    );
  });
  return el;
}

beforeEach(() => {
  mockNavigate.mockClear();
});

afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
});

describe('RightPanel: оживление блока «Персонажи главы» (Сценарий 1)', () => {
  it('ссылка в связи сохраняет контекст главы редактора', () => {
    const el = mount({ focusedCharacterId: 'char-anna', focusedCharacterTs: 99 });
    const link = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Связи персонажа'))!;
    expect(link).toBeDefined();
    act(() => link.click());
    expect(mockNavigate).toHaveBeenCalledWith('/books/book-1/characters?character=char-anna&view=relationships&chapter=chap-1&from=editor');
  });
  it('рендерит список персонажей главы с кликабельными кнопками-аватарками', () => {
    const el = mount();
    const membersBlock = el.querySelector('.rp-members');
    expect(membersBlock).not.toBeNull();

    const buttons = el.querySelectorAll<HTMLButtonElement>('.rp-member-btn');
    expect(buttons).toHaveLength(2);

    expect(buttons[0].getAttribute('data-member-id')).toBe('char-anna');
    expect(buttons[0].textContent).toContain('Анна Каренина');
    expect(buttons[0].textContent).toContain('POV');

    expect(buttons[1].getAttribute('data-member-id')).toBe('char-alexey');
    expect(buttons[1].textContent).toContain('Алексей Вронский');
  });

  it('при клике по аватарке открывает досье персонажа и подсвечивает кнопку рамкой/кольцом', () => {
    const el = mount();
    const annaBtn = el.querySelector<HTMLButtonElement>('button[data-member-id="char-anna"]')!;

    // До клика: досье закрыто
    expect(el.querySelector('.rp-char-dossier')).toBeNull();
    expect(annaBtn.classList.contains('rp-member-btn--selected')).toBe(false);

    // Клик по Анне
    act(() => {
      annaBtn.click();
    });

    // После клика: кнопка выбрана, карточка досье открыта
    expect(annaBtn.classList.contains('rp-member-btn--selected')).toBe(true);
    expect(annaBtn.getAttribute('aria-expanded')).toBe('true');

    const dossier = el.querySelector('.rp-char-dossier');
    expect(dossier).not.toBeNull();
    expect(dossier?.textContent).toContain('Анна Каренина');
    expect(dossier?.textContent).toContain('Главный герой');
    expect(dossier?.textContent).toContain('Все счастливые семьи похожи друг на друга');
  });

  it('кнопка «В картотеку →» переходит по ссылке /books/:id/characters?char=:charId', () => {
    const el = mount();
    const alexeyBtn = el.querySelector<HTMLButtonElement>('button[data-member-id="char-alexey"]')!;

    act(() => {
      alexeyBtn.click();
    });

    const link = el.querySelector<HTMLButtonElement>('.rp-char-dossier-link')!;
    expect(link).not.toBeNull();
    expect(link.textContent).toBe('В картотеку →');

    act(() => {
      link.click();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/books/book-1/characters?char=char-alexey');
  });

  it('кнопка ✕ закрывает карточку досье и снимает выделение', () => {
    const el = mount();
    const annaBtn = el.querySelector<HTMLButtonElement>('button[data-member-id="char-anna"]')!;

    act(() => {
      annaBtn.click();
    });
    expect(el.querySelector('.rp-char-dossier')).not.toBeNull();

    const closeBtn = el.querySelector<HTMLButtonElement>('.rp-char-dossier-close')!;
    act(() => {
      closeBtn.click();
    });

    expect(el.querySelector('.rp-char-dossier')).toBeNull();
    expect(annaBtn.classList.contains('rp-member-btn--selected')).toBe(false);
  });

  it('повторный клик по тому же персонажу закрывает досье (toggle)', () => {
    const el = mount();
    const annaBtn = el.querySelector<HTMLButtonElement>('button[data-member-id="char-anna"]')!;

    act(() => {
      annaBtn.click();
    });
    expect(el.querySelector('.rp-char-dossier')).not.toBeNull();

    act(() => {
      annaBtn.click();
    });
    expect(el.querySelector('.rp-char-dossier')).toBeNull();
  });

  it('при внешнем фокусе (focusedCharacterId из текста) переключает на вкладку Заметки и открывает досье', () => {
    const el = mount({
      focusedCharacterId: 'char-alexey',
      focusedCharacterTs: 12345,
    });

    // Карточка досье должна быть сразу открыта для Алексея
    const dossier = el.querySelector('.rp-char-dossier');
    expect(dossier).not.toBeNull();
    expect(dossier?.textContent).toContain('Алексей Вронский');
    expect(dossier?.textContent).toContain('Второстепенный');

    // Кнопка Алексея подсвечена
    const alexeyBtn = el.querySelector<HTMLButtonElement>('button[data-member-id="char-alexey"]')!;
    expect(alexeyBtn.classList.contains('rp-member-btn--selected')).toBe(true);

    // Вкладка «Заметки» активна
    const notesTab = el.querySelector('#rp-tab-notes')!;
    expect(notesTab.getAttribute('aria-selected')).toBe('true');
  });

  it('заметки к главе остаются на месте прямо под блоком персонажей', () => {
    const el = mount();
    expect(el.querySelector('.rp-members')).not.toBeNull();
    expect(el.textContent).toContain('Заметка к главе');
  });

  it('в свободной сцене (черновике) заметки других глав и общие заметки не утекают', () => {
    const el = mount({ chapterId: undefined, isDraft: true, draftId: 'draft-scene-1' });
    // Заметка от chap-1 НЕ должна отображаться
    expect(el.textContent).not.toContain('Заметка к главе');
    // Общая заметка книги также НЕ должна вываливаться в черновик
    expect(el.textContent).not.toContain('Общая заметка всей книги');
    // Показывается изолированное состояние
    expect(el.textContent).toContain('Заметок для этого черновика нет');
  });

  it('в свободной сцене (черновике) во вкладке Версии показывает корректный статус вместо Выберите главу', () => {
    const el = mount({ chapterId: undefined, isDraft: true, draftId: 'draft-scene-1' });
    const versionsTab = el.querySelector<HTMLButtonElement>('#rp-tab-versions')!;
    act(() => {
      versionsTab.click();
    });
    expect(el.textContent).toContain('История версий доступна только для глав книги');
    expect(el.textContent).not.toContain('Выберите главу');
  });
});
