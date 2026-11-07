// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CharacterRelationsBlock, ChapterMomentDropdown, type RelationshipWorkspaceDraft } from './CharacterRelationsBlock';
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
  if (root) {
    act(() => root.unmount());
    document.body.innerHTML = '';
  }
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

  it('чипы предустановленных ролей отображаются, подсвечиваются и переключаются', async () => {
    await mount({ characters: [...characters, { id: 'c', name: 'Мария', position: 2 } as Character] });
    await act(async () => button('Добавить связь').click());

    const presetGroup = el.querySelector('.rel-presets');
    expect(presetGroup).not.toBeNull();
    const chips = [...presetGroup!.querySelectorAll('button.chip')];
    expect(chips.map((c) => c.textContent)).toEqual(['Друг', 'Враг', 'Родственник', 'Союзник', 'Наставник', 'Соперник']);

    // Ни один чип изначально не выбран
    chips.forEach((chip) => {
      expect(chip.classList.contains('chip--accent')).toBe(false);
      expect(chip.getAttribute('aria-pressed')).toBe('false');
    });

    // Кликаем по «Союзник» -> подсвечивается chip--accent, aria-pressed="true"
    const allyChip = button('Союзник');
    await act(async () => allyChip.click());
    expect(allyChip.classList.contains('chip--accent')).toBe(true);
    expect(allyChip.getAttribute('aria-pressed')).toBe('true');

    // Кликаем повторно по «Союзник» -> снимает выбор (toggle/clear)
    await act(async () => allyChip.click());
    expect(allyChip.classList.contains('chip--accent')).toBe(false);
    expect(allyChip.getAttribute('aria-pressed')).toBe('false');

    // Кликаем по «Наставник» -> подсвечивается «Наставник»
    const mentorChip = button('Наставник');
    await act(async () => mentorChip.click());
    expect(mentorChip.classList.contains('chip--accent')).toBe(true);
    expect(mentorChip.getAttribute('aria-pressed')).toBe('true');

    // Кликаем по «Враг» -> переключается на «Враг»
    const enemyChip = button('Враг');
    await act(async () => enemyChip.click());
    expect(enemyChip.classList.contains('chip--accent')).toBe(true);
    expect(enemyChip.getAttribute('aria-pressed')).toBe('true');
    expect(mentorChip.classList.contains('chip--accent')).toBe(false);
  });

  it('поля отношений содержат понятные плейсхолдеры и подсказку для произвольных ролей', async () => {
    await mount({ characters: [...characters, { id: 'c', name: 'Мария', position: 2 } as Character] });
    await act(async () => button('Добавить связь').click());

    const inputA = el.querySelector<HTMLInputElement>('input[aria-label="Анна → Мария"]')!;
    expect(inputA).not.toBeNull();
    expect(inputA.placeholder).toBe('друг, соперник, наставник...');

    expect(el.textContent).toContain('Можно указать любую свою роль или статус отношений');
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

describe('кастомный дропдаун «Момент истории» и панель инструментов', () => {
  it('отображает правильное название для выбранного момента (глава, конец книги, исходное)', async () => {
    await mount({ chapterId: 'c3' });
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain('Глава 3');

    const propsEnd = await mount({ chapterId: '' });
    expect(el.querySelector('#rel-moment-trigger')!.textContent).toContain('Конец книги');

    await mount({ ...propsEnd, chapterId: 'baseline' });
    expect(el.querySelector('#rel-moment-trigger')!.textContent).toContain('Исходное состояние');
  });

  it('открывает список по клику и показывает упорядоченные опции с выбранной отметкой', async () => {
    await mount({ chapterId: 'c3' });
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[role="listbox"]')).toBeNull();

    await act(async () => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const listbox = el.querySelector<HTMLDivElement>('[role="listbox"]')!;
    expect(listbox).not.toBeNull();
    expect(listbox.getAttribute('aria-label')).toBe('Момент истории');

    const options = [...el.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    expect(options).toHaveLength(4);
    expect(options[0].textContent).toContain('Конец книги');
    expect(options[0].getAttribute('aria-selected')).toBe('false');

    expect(options[1].textContent).toContain('Исходное состояние');
    expect(options[1].getAttribute('aria-selected')).toBe('false');

    expect(options[2].textContent).toContain('Глава 3');
    expect(options[2].getAttribute('aria-selected')).toBe('true');
    expect(options[2].textContent).toContain('✓');

    expect(options[3].textContent).toContain('Глава 12');
    expect(options[3].getAttribute('aria-selected')).toBe('false');
  });

  it('выбор главы кликом вызывает onChapterChange с id главы и закрывает список', async () => {
    const props = await mount({ chapterId: 'c3' });
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;
    await act(async () => trigger.click());

    const optionC12 = [...el.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((o) => o.textContent?.includes('Глава 12'))!;
    await act(async () => optionC12.click());

    expect(props.onChapterChange).toHaveBeenCalledWith('c12');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('выбор конца книги и исходного состояния передает пустую строку и baseline', async () => {
    const props = await mount({ chapterId: 'c3' });
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;

    await act(async () => trigger.click());
    const optionBaseline = [...el.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((o) => o.textContent?.includes('Исходное состояние'))!;
    await act(async () => optionBaseline.click());
    expect(props.onChapterChange).toHaveBeenCalledWith('baseline');

    await act(async () => trigger.click());
    const optionEnd = [...el.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((o) => o.textContent?.includes('Конец книги'))!;
    await act(async () => optionEnd.click());
    expect(props.onChapterChange).toHaveBeenCalledWith('');
  });

  it('закрывается по клавише Escape и клику вне компонента', async () => {
    await mount({ chapterId: 'c3' });
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;

    // Открытие и закрытие по Escape
    await act(async () => trigger.click());
    expect(el.querySelector('[role="listbox"]')).not.toBeNull();
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(el.querySelector('[role="listbox"]')).toBeNull();

    // Открытие и закрытие по клику вне
    await act(async () => trigger.click());
    expect(el.querySelector('[role="listbox"]')).not.toBeNull();
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('поддерживает клавиатурную навигацию со стрелками и Enter', async () => {
    const props = await mount({ chapterId: 'c3' });
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;

    // Открытие по ArrowDown
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(el.querySelector('[role="listbox"]')).not.toBeNull();

    // Шаг вниз к Главе 12 (индекс 3)
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    const options = [...el.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    expect(options[3].classList.contains('rel-dropdown-option--highlighted')).toBe(true);

    // Выбор по Enter
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(props.onChapterChange).toHaveBeenCalledWith('c12');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('поддерживает клавиши Home, End и выбор через Space', async () => {
    const props = await mount({ chapterId: 'c3' });
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;

    // Открытие по пробелу
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(el.querySelector('[role="listbox"]')).not.toBeNull();

    // Переход в конец списка по End
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    const options = [...el.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    expect(options[options.length - 1].classList.contains('rel-dropdown-option--highlighted')).toBe(true);

    // Переход в начало списка по Home
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(options[0].classList.contains('rel-dropdown-option--highlighted')).toBe(true);

    // Выбор по пробелу
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(props.onChapterChange).toHaveBeenCalledWith('');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('корректно обрабатывает пустой список глав, безымянные главы и неизвестный id', async () => {
    // Безымянная глава
    await mount({ chapters: [{ id: 'no-name', title: '', position: 0, created_at: '' }] });
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;
    await act(async () => trigger.click());
    const options = [...el.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    expect(options.some((o) => o.textContent?.includes('Без названия'))).toBe(true);

    // Пустой список глав
    await mount({ chapters: [], chapterId: '' });
    const triggerEmpty = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;
    await act(async () => triggerEmpty.click());
    const emptyOptions = [...el.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    expect(emptyOptions).toHaveLength(2);
    expect(emptyOptions[0].textContent).toContain('Конец книги');
    expect(emptyOptions[1].textContent).toContain('Исходное состояние');

    // Неизвестный/удаленный id главы
    await mount({ chapterId: 'deleted-chapter' });
    expect(el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!.textContent).toContain('Конец книги');
  });

  it('панель инструментов содержит переключатель Граф / Список и поле момента истории', async () => {
    await mount();
    const toolbar = el.querySelector('.rel-toolbar')!;
    expect(toolbar).not.toBeNull();
    const label = toolbar.querySelector('label[for="rel-moment-trigger"]');
    expect(label).not.toBeNull();
    expect(label?.textContent).toContain('Момент истории');
    const viewSwitch = toolbar.querySelector('.rel-view-switch');
    expect(viewSwitch).not.toBeNull();
  });

  it('соответствует WAI-ARIA для combobox и listbox', async () => {
    await mount({ chapterId: 'c3' });
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-labelledby')).toBe('rel-moment-label rel-moment-trigger');

    await act(async () => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe('rel-moment-trigger-listbox');
    expect(trigger.getAttribute('aria-activedescendant')).toBe('rel-moment-trigger-opt-2');

    const listbox = el.querySelector<HTMLDivElement>('#rel-moment-trigger-listbox')!;
    expect(listbox).not.toBeNull();
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(listbox.getAttribute('aria-labelledby')).toBe('rel-moment-label');

    const options = [...el.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    expect(options[0].id).toBe('rel-moment-trigger-opt-0');
    expect(options[2].id).toBe('rel-moment-trigger-opt-2');
  });

  it('disabled={true} блокирует кнопку триггера и предотвращает открытие по клику или ArrowDown/Space', async () => {
    if (root) {
      act(() => root.unmount());
      document.body.innerHTML = '';
    }
    el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);

    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <ChapterMomentDropdown
          id="custom-trigger"
          value="c3"
          chapters={chapters}
          onChange={onChange}
          disabled={true}
        />
      );
    });

    const trigger = el.querySelector<HTMLButtonElement>('#custom-trigger')!;
    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-labelledby')).toBeNull();
    expect(trigger.getAttribute('aria-label')).toBe('Момент истории: Глава 3');

    // Клик не открывает список
    await act(async () => {
      trigger.click();
    });
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // ArrowDown не открывает список
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // Space не открывает список
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // Проверяем интеграцию: при добавлении связи в CharacterRelationsBlock триггер блокируется
    await mount({ characters: [...characters, { id: 'c', name: 'Мария', position: 2 } as Character] });
    const blockTrigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;
    expect(blockTrigger.disabled).toBe(false);

    await act(async () => button('Добавить связь').click());
    expect(blockTrigger.disabled).toBe(true);

    await act(async () => {
      blockTrigger.click();
      blockTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      blockTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('клик по label плавно переключает дропдаун без повторного открытия', async () => {
    await mount({ chapterId: 'c3' });
    const label = el.querySelector<HTMLLabelElement>('label[for="rel-moment-trigger"]')!;
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;

    // Клик по label открывает закрытый дропдаун
    await act(async () => {
      label.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      trigger.click();
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('[role="listbox"]')).not.toBeNull();

    // Повторный клик по label закрывает открытый дропдаун (не залипает в открытом состоянии)
    await act(async () => {
      label.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      trigger.click();
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('поддерживает навигацию PageUp и PageDown в списке', async () => {
    const chaptersMany = Array.from({ length: 15 }, (_, i) => ({
      id: `ch-${i + 1}`,
      title: `Глава ${i + 1}`,
      position: i + 1,
      created_at: '',
    }));
    await mount({ chapters: chaptersMany, chapterId: 'ch-1' });
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;

    await act(async () => trigger.click());
    // PageDown прыгает на 5 пунктов вниз
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    });
    const options = [...el.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    // Начальный индекс ch-1 в options: 0=Конец, 1=Исходное, 2=Глава 1. После PageDown (+5) -> индекс 7 (Глава 6)
    expect(options[7].classList.contains('rel-dropdown-option--highlighted')).toBe(true);

    // PageUp прыгает на 5 пунктов вверх -> индекс 2 (Глава 1)
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    });
    expect(options[2].classList.contains('rel-dropdown-option--highlighted')).toBe(true);
  });

  it('корректно обрабатывает экстремально длинные названия глав', async () => {
    const longTitle = 'Экстремально_длинное_название_главы_которое_не_должно_ломать_верстку_дропдауна';
    await mount({ chapters: [{ id: 'long-ch', title: longTitle, position: 1, created_at: '' }], chapterId: 'long-ch' });
    const trigger = el.querySelector<HTMLButtonElement>('#rel-moment-trigger')!;
    expect(trigger.textContent).toContain(longTitle);
    expect(trigger.getAttribute('title')).toBe(longTitle);

    await act(async () => trigger.click());
    const option = [...el.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((o) => o.textContent?.includes(longTitle))!;
    expect(option).not.toBeNull();
    expect(option.getAttribute('title')).toBe(longTitle);
  });

  it('удерживает highlightedIndex в допустимых границах при динамическом изменении списка глав', async () => {
    if (root) {
      act(() => root.unmount());
      document.body.innerHTML = '';
    }
    el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);

    const onChange = vi.fn();
    const initialChapters = [
      { id: 'ch-1', title: 'Глава 1', position: 1, created_at: '' },
      { id: 'ch-2', title: 'Глава 2', position: 2, created_at: '' },
      { id: 'ch-3', title: 'Глава 3', position: 3, created_at: '' },
    ];

    await act(async () => {
      root.render(
        <ChapterMomentDropdown
          id="dyn-trigger"
          value="ch-3"
          chapters={initialChapters}
          onChange={onChange}
        />
      );
    });

    const trigger = el.querySelector<HTMLButtonElement>('#dyn-trigger')!;
    // Открываем дропдаун (выбран ch-3 -> индекс 4 в options)
    await act(async () => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-activedescendant')).toBe('dyn-trigger-opt-4');

    // Сокращаем список глав до 1 главы (в options останется 3 элемента: индексы 0, 1, 2)
    const shrunkChapters = [{ id: 'ch-1', title: 'Глава 1', position: 1, created_at: '' }];
    await act(async () => {
      root.render(
        <ChapterMomentDropdown
          id="dyn-trigger"
          value="ch-3"
          chapters={shrunkChapters}
          onChange={onChange}
        />
      );
    });

    // highlightedIndex автоматически скорректирован до максимального допустимого индекса 2
    expect(trigger.getAttribute('aria-activedescendant')).toBe('dyn-trigger-opt-2');

    // Навигация стрелками продолжает работать корректно
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    // Циклический переход с последнего (2) на первый (0)
    expect(trigger.getAttribute('aria-activedescendant')).toBe('dyn-trigger-opt-0');

    // Нажатие ArrowUp с первого (0) переходит на последний (2)
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(trigger.getAttribute('aria-activedescendant')).toBe('dyn-trigger-opt-2');
  });
});
