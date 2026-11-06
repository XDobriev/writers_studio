// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCharacterRelationships } from './useCharacterRelationships';
import { QUERY_KEYS } from './queries';
import { relationshipEventsKey } from './useRelationshipHistory';
import type { Character } from './characters';

const createRelationshipMock = vi.fn();
const deleteRelationshipMock = vi.fn();
const updateRelationshipLabelsMock = vi.fn();
const listRelationshipEventsMock = vi.fn();

vi.mock('./relationships', () => ({
  createRelationship: (...args: unknown[]) => createRelationshipMock(...args),
  deleteRelationship: (...args: unknown[]) => deleteRelationshipMock(...args),
  updateRelationshipLabels: (...args: unknown[]) => updateRelationshipLabelsMock(...args),
  listRelationshipEvents: (...args: unknown[]) => listRelationshipEventsMock(...args),
}));

vi.mock('./supabase', () => ({
  supabase: {},
  ensureAuthReady: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useCharacterRelationships', () => {
  let client: QueryClient;
  const characters: Character[] = [
    { id: 'char-1', book_id: 'book-1', user_id: 'user-1', name: 'Иней Ворон', role: 'protagonist', position: 0 } as Character,
    { id: 'char-2', book_id: 'book-1', user_id: 'user-1', name: 'Стен Кальм', role: 'secondary', position: 1 } as Character,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    listRelationshipEventsMock.mockResolvedValue([]);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  function renderHook() {
    let result: ReturnType<typeof useCharacterRelationships> | null = null;
    const container = document.createElement('div');
    const root = createRoot(container);

    function TestComponent() {
      result = useCharacterRelationships({
        bookId: 'book-1',
        userId: 'user-1',
        activeId: 'char-1',
        characters,
      });
      return null;
    }

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/books/book-1/characters?character=char-1']}>
          <QueryClientProvider client={client}>
            <TestComponent />
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });

    return {
      get: () => result!,
      unmount: () => act(() => root.unmount()),
    };
  }

  it('создает связь и оптимистично обновляет кэш relationships', async () => {
    client.setQueryData(QUERY_KEYS.relationships('book-1'), []);
    createRelationshipMock.mockResolvedValueOnce({
      id: 'rel-1',
      book_id: 'book-1',
      char_a_id: 'char-1',
      char_b_id: 'char-2',
      label_a: 'Друг',
      label_b: 'Друг',
      is_secret: false,
    });

    const { get, unmount } = renderHook();
    try {
      let ok = false;
      await act(async () => {
        ok = await get().onCreate('char-2', 'Друг', 'Друг', false);
      });

      expect(ok).toBe(true);
      expect(createRelationshipMock).toHaveBeenCalledWith('book-1', 'user-1', 'char-1', 'char-2', 'Друг', 'Друг', false);
      expect(client.getQueryData(QUERY_KEYS.relationships('book-1'))).toEqual([
        expect.objectContaining({ id: 'rel-1', char_a_id: 'char-1' }),
      ]);
    } finally {
      unmount();
      client.clear();
    }
  });

  it('удаляет связь, убирает её из кэша и инвалидирует историю событий', async () => {
    client.setQueryData(QUERY_KEYS.relationships('book-1'), [
      { id: 'rel-1', char_a_id: 'char-1', char_b_id: 'char-2' },
    ]);
    deleteRelationshipMock.mockResolvedValueOnce(undefined);
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { get, unmount } = renderHook();
    try {
      let ok = false;
      await act(async () => {
        ok = await get().onDelete('rel-1');
      });

      expect(ok).toBe(true);
      expect(deleteRelationshipMock).toHaveBeenCalledWith('rel-1');
      expect(client.getQueryData(QUERY_KEYS.relationships('book-1'))).toEqual([]);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: relationshipEventsKey('book-1') });
    } finally {
      unmount();
      client.clear();
    }
  });

  it('обновляет метки связи в кэше', async () => {
    client.setQueryData(QUERY_KEYS.relationships('book-1'), [
      { id: 'rel-1', label_a: 'Друг', label_b: 'Друг', is_secret: false },
    ]);
    updateRelationshipLabelsMock.mockResolvedValueOnce({
      id: 'rel-1',
      label_a: 'Враг',
      label_b: 'Соперник',
      is_secret: true,
    });

    const { get, unmount } = renderHook();
    try {
      let ok = false;
      await act(async () => {
        ok = await get().onLabelChange('rel-1', { label_a: 'Враг', label_b: 'Соперник', is_secret: true });
      });

      expect(ok).toBe(true);
      expect(updateRelationshipLabelsMock).toHaveBeenCalledWith('rel-1', {
        label_a: 'Враг',
        label_b: 'Соперник',
        is_secret: true,
      });
      expect(client.getQueryData(QUERY_KEYS.relationships('book-1'))).toEqual([
        expect.objectContaining({ id: 'rel-1', label_a: 'Враг', is_secret: true }),
      ]);
    } finally {
      unmount();
      client.clear();
    }
  });

  it('управляет историей навигации pushTrail/popTrail и вычисляет previousCharacter', async () => {
    const { get, unmount } = renderHook();
    try {
      expect(get().previousCharacter).toBeUndefined();

      act(() => {
        get().pushTrail('char-2');
      });

      expect(get().previousCharacter).toBe('Стен Кальм');

      let popped: string | null = null;
      act(() => {
        popped = get().popTrail();
      });

      expect(popped).toBe('char-2');
      expect(get().previousCharacter).toBeUndefined();
    } finally {
      unmount();
      client.clear();
    }
  });

  it('вешает beforeunload-предупреждение при активном черновике связи', async () => {
    const addEventSpy = vi.spyOn(window, 'addEventListener');
    const removeEventSpy = vi.spyOn(window, 'removeEventListener');

    const { get, unmount } = renderHook();
    try {
      expect(get().hasDraft).toBe(false);

      act(() => {
        get().setDraft({
          creation: { sourceId: 'char-1', toId: 'char-2', value: { label_a: 'Союзник', label_b: '', is_secret: false } },
          history: null,
        });
      });

      expect(get().hasDraft).toBe(true);
      expect(addEventSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

      act(() => {
        get().setDraft({ creation: null, history: null });
      });

      expect(get().hasDraft).toBe(false);
      expect(removeEventSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    } finally {
      unmount();
      client.clear();
    }
  });
});
