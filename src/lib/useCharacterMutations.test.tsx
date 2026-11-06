// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useCharacterMutations } from './useCharacterMutations';
import type { Character } from './characters';
const { deleteCharacter, createRelationship } = vi.hoisted(() => ({ deleteCharacter: vi.fn().mockResolvedValue(undefined), createRelationship: vi.fn().mockResolvedValue({ id: 'r' }) }));
vi.mock('./characters', () => ({ deleteCharacter, createCharacter: vi.fn(), updateCharacter: vi.fn() }));
vi.mock('./relationships', () => ({ createRelationship, deleteRelationship: vi.fn(), updateRelationshipLabels: vi.fn() }));
vi.mock('./profiles', () => ({ isPlanLimitError: () => false }));
vi.mock('./crossrefs', () => ({ syncCharacterAcrossAllChapters: vi.fn() }));
vi.mock('./queries', () => ({ QUERY_KEYS: { characters: (id: string) => ['characters', id], relationships: (id: string) => ['relationships', id], matchableCharacters: (id: string) => ['characters-match', id], chapterPovMap: (id: string) => ['chapter-pov-map', id] } }));
vi.mock('./useRelationshipHistory', () => ({ relationshipEventsKey: (id: string) => ['relationship-events', id] }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('удаление на неполном списке не превращает страницу из 50 в конечную из 49', async () => {
  const client = new QueryClient();
  const characters = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}` } as Character));
  client.setQueryData(['characters', 'book'], { pages: [characters], pageParams: [0] });
  let api: ReturnType<typeof useCharacterMutations>;
  function Harness() { api = useCharacterMutations({ bookId: 'book', userId: 'user', characters, active: characters[0], hasNextPage: true, cancelSave: vi.fn(), onError: vi.fn(), onCreated: vi.fn(), onDeleted: vi.fn() }); return null; }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(QueryClientProvider, { client }, createElement(Harness))));
  await act(async () => api.onDeleteConfirmed('c0'));
  expect(client.getQueryData<InfiniteData<Character[]>>(['characters', 'book'])!.pages[0]).toHaveLength(50);
  expect(client.getQueryState(['characters', 'book'])!.isInvalidated).toBe(true);
  act(() => root.unmount()); client.clear();
});
