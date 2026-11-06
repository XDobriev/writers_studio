// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CharacterRelationsBlock, type RelationshipWorkspaceDraft } from './CharacterRelationsBlock';
import type { Character } from '../lib/characters';
import type { CharacterRelationship, RelationshipEvent } from '../lib/relationships';
vi.mock('../lib/supabase', () => ({ supabase: {} }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const characters = [{ id: 'a', name: 'Анна', position: 0 }, { id: 'b', name: 'Борис', position: 1 }] as Character[];
const rel = { id: 'r', char_a_id: 'a', char_b_id: 'b', label_a: 'Враг', label_b: 'Враг', is_secret: false } as CharacterRelationship;
const chapters = [{ id: 'c3', title: 'Глава 3', position: 2, created_at: '' }, { id: 'c12', title: 'Глава 12', position: 11, created_at: '' }];
const event = { id: 'e', relationship_id: 'r', chapter_id: 'c12', chapter_title: 'Глава 12', label_a: 'Союзник', label_b: 'Доверяет', is_secret: true, note: 'Спасение' } as RelationshipEvent;
let root: Root;
let el: HTMLDivElement;
const button = (text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;
async function mount(overrides: Partial<Parameters<typeof CharacterRelationsBlock>[0]> = {}) {
  el = document.createElement('div'); document.body.appendChild(el); root = createRoot(el);
  const props = { activeId: 'a', characters, relationships: [rel], events: [event], chapters,
    chapterId: 'c3', onChapterChange: vi.fn(), onCreate: vi.fn().mockResolvedValue(true), onDelete: vi.fn().mockResolvedValue(true),
    onLabelChange: vi.fn().mockResolvedValue(true), onSaveEvent: vi.fn().mockResolvedValue(undefined), onDeleteEvent: vi.fn().mockResolvedValue(undefined),
    onSelectCharacter: vi.fn(), onNavigateChapter: vi.fn(), ...overrides };
  await act(async () => root.render(<CharacterRelationsBlock {...props} />));
  return props;
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

describe('отношения по главам', () => {
  it('новая связь сохраняет исходного героя при переходе к другому', async () => {
    const props = await mount({ characters: [...characters, { id: 'c', name: 'Мария', position: 2 } as Character] });
    await act(async () => button('Добавить связь').click());
    await act(async () => button('Друг').click());
    await act(async () => root.render(<CharacterRelationsBlock {...props} activeId="b" />));
    await act(async () => el.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(props.onCreate).toHaveBeenCalledWith('c', 'Друг', '', false, 'a');
  });

  it('удалённая извне связь не прячет несохранённую заметку и позволяет отменить черновик', async () => {
    const props = await mount({ relationships: [] });
    function Harness() {
      const [draft, setDraft] = useState<RelationshipWorkspaceDraft>({ creation: null, history: { relationshipId: 'gone', editing: 'new', value: { chapter_id: 'c3', label_a: 'Друг', label_b: 'Друг', is_secret: false, note: 'Важная несохранённая заметка' } } });
      return <CharacterRelationsBlock {...props} draft={draft} onDraftChange={setDraft} />;
    }
    await act(async () => root.render(<Harness />));
    expect(el.textContent).toContain('Важная несохранённая заметка');
    await act(async () => button('Отменить черновик').click());
    expect(el.textContent).not.toContain('Важная несохранённая заметка');
    expect(button('Добавить связь').disabled).toBe(false);
  });

  it('редактируемую историю нельзя незаметно заменить другой формой', async () => {
    await mount({ characters: [...characters, { id: 'c', name: 'Мария', position: 2 } as Character] });
    await act(async () => button('Список').click());
    await act(async () => button('История').click());
    await act(async () => button('Добавить изменение').click());
    expect(button('Добавить связь').disabled).toBe(true);
    expect(button('История').disabled).toBe(true);
  });

  it('новое событие в ранней свободной главе не наследует секретность из конца книги', async () => {
    const props = await mount({ chapterId: '' });
    await act(async () => button('Список').click());
    await act(async () => button('История').click());
    await act(async () => button('Добавить изменение').click());
    await act(async () => el.querySelector('form[data-relationship-form]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(props.onSaveEvent).toHaveBeenCalledWith('r', expect.objectContaining({ chapter_id: 'c3', label_a: 'Враг', label_b: 'Враг', is_secret: false }), undefined);
  });

  it('пустая legacy-подпись остаётся неизвестной, а не приписывается другой стороне', async () => {
    await mount({ relationships: [{ ...rel, label_b: '' }], events: [] });
    await act(async () => button('Список').click());
    expect(el.querySelector('.rel-list')?.textContent).toContain('Борис → Анна: Без подписи');
  });
  it('список показывает выбранное прошлое состояние, а не будущий секретный союз', async () => {
    await mount();
    await act(async () => button('Список').click());
    const list = el.querySelector('.rel-list')!;
    expect(list.textContent).toContain('Враг');
    expect(list.textContent).not.toContain('Союзник');
    expect(list.textContent).not.toContain('Секретная');
  });

  it('в конце книги показывает асимметрию и секретность', async () => {
    await mount({ chapterId: '' });
    await act(async () => button('Список').click());
    const list = el.querySelector('.rel-list')!;
    expect(list.textContent).toContain('Союзник');
    expect(list.textContent).toContain('Доверяет');
    expect(list.textContent).toContain('Секретная');
  });

  it('исправление исходного состояния не создаёт сюжетное событие', async () => {
    const props = await mount();
    await act(async () => button('Список').click());
    await act(async () => button('История').click());
    await act(async () => button('Исправить исходное').click());
    await act(async () => el.querySelector('form[data-relationship-form]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(props.onLabelChange).toHaveBeenCalledWith('r', { label_a: 'Враг', label_b: 'Враг', is_secret: false });
    expect(props.onSaveEvent).not.toHaveBeenCalled();
  });

  it('ошибка записи оставляет заполненную форму и показывает причину', async () => {
    const props = await mount({ onSaveEvent: vi.fn().mockRejectedValue(new Error('Нет соединения')) });
    await act(async () => button('Список').click());
    await act(async () => button('История').click());
    await act(async () => button('Добавить изменение').click());
    await act(async () => el.querySelector('form[data-relationship-form]')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(props.onSaveEvent).toHaveBeenCalled();
    expect(el.querySelector('form[data-relationship-form]')).not.toBeNull();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Нет соединения');
  });

  it('связь на графе открывает историю без перехода в другого героя', async () => {
    const props = await mount();
    const edge = el.querySelector<SVGGElement>('[data-relationship-id="r"]')!;
    await act(async () => edge.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(el.textContent).toContain('История отношений');
    expect(props.onSelectCharacter).not.toHaveBeenCalled();
  });
});
