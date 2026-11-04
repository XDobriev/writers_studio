// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import type { Character } from '../lib/characters';
import {
  findCharacterDecorations,
  CharacterHighlight,
} from './CharacterHighlight';
import { getCharacterColor } from '../lib/pov';

const testSchema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { group: 'block', content: 'text*' },
    text: { inline: true },
  },
});

function createDoc(...paragraphs: string[]) {
  const pNodes = paragraphs.map((text) =>
    testSchema.nodes.paragraph.create({}, text ? testSchema.text(text) : undefined)
  );
  return testSchema.nodes.doc.create({}, pNodes);
}

const anna: Character = {
  id: 'char-anna',
  book_id: 'book-1',
  user_id: 'user-1',
  name: 'Анна',
  aliases: ['Аня', 'Анна Каренина'],
  role: 'protagonist',
  position: 0,
  age: null,
  quote: 'Все счастливые семьи похожи друг на друга',
  appearance: '',
  personality: 'Страстная и честная',
  interior_life: '',
  exterior_life: '',
  gap: '',
  backstory: '',
  notes: '',
  avatar_url: null,
  created_at: '',
  updated_at: '',
};

const alexey: Character = {
  id: 'char-alexey',
  book_id: 'book-1',
  user_id: 'user-1',
  name: 'Алексей',
  aliases: ['Алёша'],
  role: 'secondary',
  position: 1,
  age: null,
  quote: '',
  appearance: '',
  personality: '',
  interior_life: '',
  exterior_life: '',
  gap: '',
  backstory: '',
  notes: '',
  avatar_url: null,
  created_at: '',
  updated_at: '',
};

function getAttrs(d: unknown): Record<string, string> {
  return ((d as { type?: { attrs?: Record<string, string> } }).type?.attrs ?? {}) as Record<string, string>;
}

describe('CharacterHighlight: findCharacterDecorations', () => {
  it('возвращает пустой набор декораций, если список персонажей пуст', () => {
    const doc = createDoc('В комнату вошла Анна.');
    const decos = findCharacterDecorations(doc, []);
    expect(decos.find()).toHaveLength(0);
  });

  it('возвращает пустой набор декораций для пустого документа', () => {
    const doc = createDoc('');
    const decos = findCharacterDecorations(doc, [anna]);
    expect(decos.find()).toHaveLength(0);
  });

  it('находит первое появление персонажа и помечает его .char-mention-first', () => {
    const doc = createDoc('В комнату вошла Анна.');
    const decos = findCharacterDecorations(doc, [anna]);
    const found = decos.find();

    expect(found).toHaveLength(1);
    const attrs = getAttrs(found[0]);
    expect(attrs.class).toBe('char-mention-first');
    expect(attrs['data-char-id']).toBe(anna.id);
    expect(attrs['data-char-color']).toBe(getCharacterColor(0));
    expect(attrs.style).toContain(getCharacterColor(0));
  });

  it('помечает повторные появления персонажа как .char-mention-subsequent', () => {
    const doc = createDoc('Анна посмотрела в окно. Затем Анна налила чай. Позже Анна улыбнулась.');
    const decos = findCharacterDecorations(doc, [anna]);
    const found = decos.find();

    expect(found).toHaveLength(3);

    expect(getAttrs(found[0]).class).toBe('char-mention-first');
    expect(getAttrs(found[1]).class).toBe('char-mention-subsequent');
    expect(getAttrs(found[2]).class).toBe('char-mention-subsequent');

    expect(getAttrs(found[0])['data-char-id']).toBe(anna.id);
    expect(getAttrs(found[1])['data-char-id']).toBe(anna.id);
    expect(getAttrs(found[2])['data-char-id']).toBe(anna.id);
  });

  it('поддерживает падежные окончания русских имён (склонение)', () => {
    const doc = createDoc('Он подошёл к Наташе. Он думал об Алексее и помог Алексею.');
    const natasha: Character = {
      ...anna,
      id: 'char-natasha',
      name: 'Наташа',
      aliases: [],
    };
    const decos = findCharacterDecorations(doc, [natasha, alexey]);
    const found = decos.find();

    expect(found).toHaveLength(3);

    // Первое появление Наташи (в дательном падеже «Наташе»)
    expect(getAttrs(found[0]).class).toBe('char-mention-first');
    expect(getAttrs(found[0])['data-char-id']).toBe(natasha.id);

    // Первое появление Алексея («Алексее»)
    expect(getAttrs(found[1]).class).toBe('char-mention-first');
    expect(getAttrs(found[1])['data-char-id']).toBe(alexey.id);

    // Второе появление Алексея («Алексею»)
    expect(getAttrs(found[2]).class).toBe('char-mention-subsequent');
    expect(getAttrs(found[2])['data-char-id']).toBe(alexey.id);
  });

  it('отдаёт приоритет более длинному псевдониму при наложении («Анна Каренина» > «Анна»)', () => {
    const doc = createDoc('Там была Анна Каренина, а не просто кто-то.');
    const decos = findCharacterDecorations(doc, [anna]);
    const found = decos.find();

    // Не должно быть двойного выделения «Анна Каренина» + «Анна»
    expect(found).toHaveLength(1);
    const d = found[0];
    // Длина «Анна Каренина» = 13 символов
    expect(d.to - d.from).toBe(13);
    const attrs = getAttrs(d);
    expect(attrs.class).toBe('char-mention-first');
  });

  it('корректно работает через несколько абзацев документа', () => {
    const doc = createDoc(
      'Первый абзац. Анна сидела одна.',
      'Второй абзац. Алексей вошёл.',
      'Третий абзац. Анна посмотрела на него.'
    );
    const decos = findCharacterDecorations(doc, [anna, alexey]);
    const found = decos.find();

    expect(found).toHaveLength(3);

    // Абзац 1: Анна (first)
    expect(getAttrs(found[0]).class).toBe('char-mention-first');
    expect(getAttrs(found[0])['data-char-id']).toBe(anna.id);

    // Абзац 2: Алексей (first)
    expect(getAttrs(found[1]).class).toBe('char-mention-first');
    expect(getAttrs(found[1])['data-char-id']).toBe(alexey.id);

    // Абзац 3: Анна (subsequent)
    expect(getAttrs(found[2]).class).toBe('char-mention-subsequent');
    expect(getAttrs(found[2])['data-char-id']).toBe(anna.id);
  });

  it('находит персонажа по альтернативному псевдониму (alias: «Аня»)', () => {
    const doc = createDoc('Здравствуй, Аня! Как твои дела?');
    const decos = findCharacterDecorations(doc, [anna]);
    const found = decos.find();

    expect(found).toHaveLength(1);
    const attrs = getAttrs(found[0]);
    expect(attrs.class).toBe('char-mention-first');
    expect(attrs['data-char-id']).toBe(anna.id);
  });

  it('нечувствителен к регистру (АННА / анна)', () => {
    const doc = createDoc('АННА закричала, а потом анна замолчала.');
    const decos = findCharacterDecorations(doc, [anna]);
    const found = decos.find();

    expect(found).toHaveLength(2);
    expect(getAttrs(found[0]).class).toBe('char-mention-first');
    expect(getAttrs(found[1]).class).toBe('char-mention-subsequent');
  });

  it('не добавляет декорации, если плагин отключён (getEnabled: () => false)', () => {
    const ext = CharacterHighlight.configure({
      getCharacters: () => [anna],
      getEnabled: () => false,
    });
    const plugins = (CharacterHighlight.config.addProseMirrorPlugins as (this: unknown) => unknown[]).call({ options: ext.options }) as any[];
    const plugin = plugins[0];
    const doc = createDoc('Анна была здесь.');
    const state = plugin.spec.state!.init(null as any, { doc } as any);
    expect(state.find()).toHaveLength(0);
  });
});

describe('CharacterHighlight: handleClick', () => {
  it('вызывает onMentionClick при Alt/Ctrl-клике или клике по индикатору', () => {
    const onMentionClick = vi.fn();
    const ext = CharacterHighlight.configure({
      getCharacters: () => [anna],
      onMentionClick,
    });

    const plugins = (CharacterHighlight.config.addProseMirrorPlugins as (this: unknown) => unknown[]).call({ options: ext.options }) as any[];
    const plugin = plugins[0];
    const handleClick = plugin.props.handleClick!;

    // Создаём DOM-элемент упоминания
    const span = document.createElement('span');
    span.className = 'char-mention-first';
    span.setAttribute('data-char-id', 'char-anna');
    document.body.appendChild(span);

    // 1. Обычный клик не по индикатору -> handleClick возвращает false (штатный клик в текст)
    const normalEvent = {
      target: span,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      clientX: 50,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent;
    span.getBoundingClientRect = () => ({ left: 10 } as DOMRect);

    const normalHandled = handleClick({} as any, 0, normalEvent);
    expect(normalHandled).toBe(false);
    expect(onMentionClick).not.toHaveBeenCalled();

    // 2. Alt-клик -> обрабатывается и вызывает onMentionClick
    const altEvent = {
      target: span,
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      clientX: 50,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent;

    const altHandled = handleClick({} as any, 0, altEvent);
    expect(altHandled).toBe(true);
    expect(onMentionClick).toHaveBeenCalledWith('char-anna');

    // 3. Клик по индикатору (clientX - left <= 18) без Alt
    onMentionClick.mockClear();
    const indicatorEvent = {
      target: span,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      clientX: 20, // 20 - 10 = 10 <= 18
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent;

    const indicatorHandled = handleClick({} as any, 0, indicatorEvent);
    expect(indicatorHandled).toBe(true);
    expect(onMentionClick).toHaveBeenCalledWith('char-anna');

    span.remove();
  });
});
