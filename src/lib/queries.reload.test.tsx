// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QUERY_KEYS, useNotes, useTimelineEvents } from './queries';
import { fetchNotes, type Note } from './notes';
import { listTimelineEvents, type TimelineEvent } from './timeline';

vi.mock('./supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('./notes', () => ({ fetchNotes: vi.fn() }));
vi.mock('./timeline', () => ({ listTimelineEvents: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('reload rechecks a fresh persisted notes list that predates the saved note', async () => {
  const note = { id: 'saved-note', text: 'Saved on the server' } as Note;
  vi.mocked(fetchNotes).mockResolvedValue([note]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(QUERY_KEYS.notes('book'), []);
  const container = document.createElement('div');
  const root = createRoot(container);
  function Probe() {
    const { data } = useNotes('book');
    return <span>{data?.map((n) => n.text).join(',')}</span>;
  }
  try {
    await act(async () => {
      root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(container.textContent).toBe(note.text);
  } finally {
    act(() => root.unmount());
    client.clear();
  }
});

it('reload replaces a fresh persisted event with its confirmed server title', async () => {
  const event = { id: 'event', title: 'Confirmed title' } as TimelineEvent;
  vi.mocked(listTimelineEvents).mockResolvedValue([event]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(QUERY_KEYS.timelineEvents('book'), [{ ...event, title: 'Old title' }]);
  const container = document.createElement('div');
  const root = createRoot(container);
  function Probe() {
    const { data } = useTimelineEvents('book');
    return <span>{data?.map((e) => e.title).join(',')}</span>;
  }
  try {
    await act(async () => {
      root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(container.textContent).toBe(event.title);
  } finally {
    act(() => root.unmount());
    client.clear();
  }
});
