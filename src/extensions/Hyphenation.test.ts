// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import type { Character } from '../lib/characters';
import {
  buildHyphenationDecos,
  isPositionExcluded,
  collectExclusions,
  type ExclusionRange,
} from './Hyphenation';
import { findCharacterDecorations, findCharacterMatches } from './CharacterHighlight';

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

const vorna: Character = {
  id: 'char-vorna',
  book_id: 'b1',
  user_id: 'u1',
  name: 'Ворна',
  aliases: [],
  role: 'protagonist',
  position: 0,
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

const magisterTalen: Character = {
  id: 'char-talen',
  book_id: 'b1',
  user_id: 'u1',
  name: 'Магистр Тален',
  aliases: ['Тален'],
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

describe('Hyphenation переносы и исключение сущностей', () => {
  it('вставляет мягкие переносы в обычный длинный русский текст', () => {
    // «необыкновенный» переносится: не-обык-но-вен-ный
    const doc = createDoc('Это было необыкновенное приключение.');
    const decos = buildHyphenationDecos(doc, []);
    const widgets = decos.find();
    expect(widgets.length).toBeGreaterThan(0);
  });

  it('isPositionExcluded корректно определяет попадание внутрь диапазона', () => {
    const exclusions: ExclusionRange[] = [{ from: 10, to: 20 }];
    expect(isPositionExcluded(5, exclusions)).toBe(false);
    expect(isPositionExcluded(10, exclusions)).toBe(true);
    expect(isPositionExcluded(15, exclusions)).toBe(true);
    expect(isPositionExcluded(20, exclusions)).toBe(true);
    expect(isPositionExcluded(25, exclusions)).toBe(false);
  });

  it('не вставляет мягкие переносы внутрь имени персонажа (Ворна)', () => {
    // Ворна обычно разбивается Hypher как Вор-на.
    const doc = createDoc('Ворна подошла к окну.');
    // Без исключений:
    const decosWithoutExclusions = buildHyphenationDecos(doc, []);
    const widgetsWithout = decosWithoutExclusions.find();
    // Убеждаемся, что слово «Ворна» само по себе имело бы перенос
    expect(widgetsWithout.some((w) => w.from > 1 && w.from < 6)).toBe(true);

    // С исключением диапазона персонажа:
    const matches = findCharacterMatches(doc, [vorna]);
    expect(matches).toHaveLength(1);
    expect(matches[0].pmFrom).toBe(1);
    expect(matches[0].pmTo).toBe(6);

    const exclusions = matches.map((m) => ({ from: m.pmFrom, to: m.pmTo }));
    const decosWithExclusions = buildHyphenationDecos(doc, exclusions);
    const widgetsWith = decosWithExclusions.find();

    // Внутри имени «Ворна» (от 1 до 6) не должно быть ни одного виджета переноса!
    const insideVorna = widgetsWith.filter((w) => w.from >= 1 && w.from <= 6);
    expect(insideVorna).toHaveLength(0);
  });

  it('не разбивает многословное имя персонажа (Магистр Тален) на слоги', () => {
    // «Магистр Тален» -> и «Магистр», и «Тален» обычно делятся на слоги
    const doc = createDoc('Магистр Тален внимательно посмотрел на карту.');
    const matches = findCharacterMatches(doc, [magisterTalen]);
    expect(matches).toHaveLength(1);

    const exclusions = matches.map((m) => ({ from: m.pmFrom, to: m.pmTo }));
    const decos = buildHyphenationDecos(doc, exclusions);
    const widgets = decos.find();

    // Ни один виджет не должен попасть внутрь «Магистр Тален»
    const insideName = widgets.filter((w) => w.from >= matches[0].pmFrom && w.from <= matches[0].pmTo);
    expect(insideName).toHaveLength(0);

    // При этом слова за пределами имени («внимательно», «посмотрел») получают переносы
    const outside = widgets.filter((w) => w.from > matches[0].pmTo);
    expect(outside.length).toBeGreaterThan(0);
  });

  it('сохраняет цельность inline-декораций подсветки персонажей без разрывов', () => {
    const doc = createDoc('Ворна и Магистр Тален отправились в путь.');
    const charDecos = findCharacterDecorations(doc, [vorna, magisterTalen]);
    const inlineDecos = charDecos.find();

    expect(inlineDecos).toHaveLength(2);
    // Ворна
    expect(inlineDecos[0].from).toBe(1);
    expect(inlineDecos[0].to).toBe(6);

    // Магистр Тален
    expect(inlineDecos[1].from).toBe(9);
    expect(inlineDecos[1].to).toBe(22);

    const exclusions = collectExclusions(doc, undefined, {
      getCharacters: () => [vorna, magisterTalen],
    });
    const hyphDecos = buildHyphenationDecos(doc, exclusions);
    const widgets = hyphDecos.find();

    // Проверяем, что ни один виджет не делит диапазоны [1, 6] и [9, 22]
    for (const w of widgets) {
      expect(w.from > 1 && w.from < 6).toBe(false);
      expect(w.from > 9 && w.from < 22).toBe(false);
    }
  });
});
