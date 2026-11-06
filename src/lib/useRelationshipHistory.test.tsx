// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { relationshipEventsKey, useRelationshipHistory } from './useRelationshipHistory';
import { listRelationshipEvents, type RelationshipEvent } from './relationships';

vi.mock('./relationships', () => ({
  listRelationshipEvents: vi.fn(), createRelationshipEvent: vi.fn(), updateRelationshipEvent: vi.fn(), deleteRelationshipEvent: vi.fn(),
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('перепроверяет восстановленный свежий кэш истории при открытии страницы', async () => {
  const event = { id: 'saved-event', relationship_id: 'relationship', chapter_id: 'chapter-12', is_secret: true } as RelationshipEvent;
  vi.mocked(listRelationshipEvents).mockResolvedValue([event]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Перезагрузка успела восстановить кэш до записи последнего изменения на диск.
  client.setQueryData(relationshipEventsKey('book'), []);
  const container = document.createElement('div');
  const root = createRoot(container);
  function Probe() {
    const query = useRelationshipHistory('book', 'user', true);
    return <span>{query.data?.map((e) => e.id).join(',')}</span>;
  }
  try {
    await act(async () => {
      root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
    });
    await act(async () => {
      await vi.waitFor(() => expect(client.getQueryData(relationshipEventsKey('book'))).toEqual([event]));
    });
    expect(listRelationshipEvents).toHaveBeenCalledWith('book');
    expect(container.textContent).toBe('saved-event');
  } finally {
    act(() => root.unmount());
    client.clear();
  }
});
