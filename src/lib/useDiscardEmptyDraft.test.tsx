// @vitest-environment jsdom
// React 18: поддержка act() вне testing-library.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useDiscardEmptyDraft } from './useDiscardEmptyDraft';

vi.mock('./supabase', () => ({ supabase: { from: vi.fn() } }));

import { isBlankCharacter, type Character } from './characters';
import { isBlankTimelineEvent, type TimelineEvent } from './timeline';

// B-4: пустая запись-«призрак» должна исчезать, а тронутая — никогда.
describe('useDiscardEmptyDraft', () => {
  let root: Root;
  let container: HTMLElement;
  let api: { markDraft: (id: string) => void };

  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  function mount(opts: { isEmpty: (id: string) => boolean; discard: (id: string) => void; isViewing?: (id: string) => boolean }) {
    function Probe(props: { open: boolean }) {
      api = useDiscardEmptyDraft({ ...opts, isViewing: opts.isViewing ?? (() => props.open) });
      return null;
    }
    const render = (open: boolean) => act(() => root.render(createElement(Probe, { open })));
    render(true);
    return render;
  }

  it('уход со страницы без ввода удаляет запись', () => {
    const discard = vi.fn();
    mount({ isEmpty: () => true, discard });
    act(() => api.markDraft('a'));
    act(() => root.unmount());
    expect(discard).toHaveBeenCalledWith('a');
    root = createRoot(container);
  });

  it('закрытие карточки без ввода удаляет запись', () => {
    const discard = vi.fn();
    const render = mount({ isEmpty: () => true, discard });
    act(() => api.markDraft('a'));
    render(false);
    expect(discard).toHaveBeenCalledWith('a');
  });

  it('пока карточка открыта — запись не трогаем', () => {
    const discard = vi.fn();
    mount({ isEmpty: () => true, discard });
    act(() => api.markDraft('a'));
    expect(discard).not.toHaveBeenCalled();
  });

  it('тронутую запись не удаляем и больше не считаем черновиком', () => {
    const discard = vi.fn();
    let empty = false;
    const render = mount({ isEmpty: () => empty, discard });
    act(() => api.markDraft('a'));
    render(false);
    expect(discard).not.toHaveBeenCalled();
    // пользователь вернулся и стёр текст — запись уже не черновик
    empty = true;
    render(true);
    render(false);
    expect(discard).not.toHaveBeenCalled();
  });

  it('создание следующей записи удаляет предыдущую пустую', () => {
    const discard = vi.fn();
    mount({ isEmpty: () => true, discard });
    act(() => api.markDraft('a'));
    act(() => api.markDraft('b'));
    expect(discard).toHaveBeenCalledTimes(1);
    expect(discard).toHaveBeenCalledWith('a');
  });
});

const character = (patch: Partial<Character> = {}): Character => ({
  age: null, aliases: [], appearance: '', avatar_url: null, backstory: '', book_id: 'b',
  created_at: '', exterior_life: '', gap: '', id: 'c', interior_life: '', name: '', notes: '',
  personality: '', position: 0, quote: '', role: 'protagonist', updated_at: '', user_id: 'u',
  ...patch,
});

describe('isBlankCharacter', () => {
  it('свежесозданный персонаж пуст', () => {
    expect(isBlankCharacter(character())).toBe(true);
  });

  it('пробелы вместо имени — всё ещё пусто', () => {
    expect(isBlankCharacter(character({ name: '   ' }))).toBe(true);
  });

  it.each([
    ['имя', { name: 'Ворна' }],
    ['цитата', { quote: 'Привет' }],
    ['внешность', { appearance: 'высокий' }],
    ['заметки', { notes: 'x' }],
    ['возраст, даже 0', { age: 0 }],
    ['аватар', { avatar_url: 'https://x/y.png' }],
    ['псевдоним', { aliases: ['Вор'] }],
    ['смена роли', { role: 'secondary' as const }],
  ])('%s — персонаж не пуст', (_label, patch) => {
    expect(isBlankCharacter(character(patch))).toBe(false);
  });
});

const event = (patch: Partial<TimelineEvent> = {}): TimelineEvent => ({
  book_id: 'b', chapter_id: null, created_at: '', description: '', era: '', id: 'e',
  position: 0, title: 'Событие', type: 'plot', updated_at: '', user_id: 'u',
  ...patch,
});

describe('isBlankTimelineEvent', () => {
  it('свежесозданное событие пусто', () => {
    expect(isBlankTimelineEvent(event())).toBe(true);
  });

  it.each([
    ['заголовок', { title: 'Падение Ворны' }],
    ['эпоха', { era: 'III эра' }],
    ['описание', { description: 'x' }],
    ['тип', { type: 'world' as const }],
    ['глава', { chapter_id: 'ch1' }],
  ])('%s — событие не пусто', (_label, patch) => {
    expect(isBlankTimelineEvent(event(patch))).toBe(false);
  });
});
