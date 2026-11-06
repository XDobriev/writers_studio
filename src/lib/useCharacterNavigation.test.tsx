// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useCharacterNavigation } from './useCharacterNavigation';
import type { Character } from './characters';
const { setSearch } = vi.hoisted(() => ({ setSearch: vi.fn() }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams('char=missing&view=relationships'), setSearch] }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const el = document.createElement('div');
const root = createRoot(el);
let api: ReturnType<typeof useCharacterNavigation>;
function Harness(props: Parameters<typeof useCharacterNavigation>[0]) { api = useCharacterNavigation(props); return null; }
afterEach(() => { act(() => root.render(null)); vi.clearAllMocks(); });
it('выход в список удаляет оба имени параметра персонажа', () => {
  act(() => root.render(<Harness isMobile={true} characters={[]} filtered={[]} />));
  act(() => api.clearCharacter());
  const params = setSearch.mock.calls[0][0] as URLSearchParams;
  expect(params.has('character')).toBe(false);
  expect(params.has('char')).toBe(false);
});
it('ошибка следующей страницы останавливает автоматические повторные запросы', () => {
  const fetchNextPage = vi.fn();
  const characters = [{ id: 'a' }] as Character[];
  act(() => root.render(<Harness isMobile={false} characters={characters} filtered={characters} hasNextPage isFetchNextPageError fetchNextPage={fetchNextPage} />));
  expect(fetchNextPage).not.toHaveBeenCalled();
});
