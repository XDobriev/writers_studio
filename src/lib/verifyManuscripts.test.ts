// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

vi.mock('./supabase', () => ({ supabase: {} }));

import { parseManuscript } from './importManuscript';
import {
  mergeChapterWithPrevious,
  splitChapterByParagraph,
  getChapterParagraphPreviews,
  splitManuscript,
} from './importSplit';

describe('Комплексная проверка склейки и разрезки на реальных форматах рукописей', () => {
  // 1. DOCX: Настоящий документ Microsoft Word
  it('1. Реальный DOCX (Word) с главами и абзацами', async () => {
    const doc = new Document({
      title: 'Роман из Word',
      sections: [{
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Глава 1. Начало')] }),
          new Paragraph({ children: [new TextRun('Первый абзац первой главы романа.')] }),
          new Paragraph({ children: [new TextRun('Второй абзац с диалогом: «Куда мы идем?»')] }),
          new Paragraph({ children: [new TextRun('Третий абзац с описанием дороги.')] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Глава 2. Путь')] }),
          new Paragraph({ children: [new TextRun('Первый абзац второй главы романа.')] }),
          new Paragraph({ children: [new TextRun('Второй абзац второй главы.')] }),
        ],
      }],
    });
    const buf = await Packer.toBuffer(doc);
    const ab = Uint8Array.from(buf).buffer;
    const parsed = await parseManuscript(ab, 'novel.docx');
    const chapters = splitManuscript(parsed.units, 'headings', parsed.title || 'Книга');

    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe('Глава 1. Начало');
    expect(chapters[1].title).toBe('Глава 2. Путь');

    // Разрезка первой главы по 2-му абзацу
    const previews = getChapterParagraphPreviews(chapters[0].html);
    expect(previews.length).toBeGreaterThanOrEqual(2);
    const [part1, part2] = splitChapterByParagraph(chapters[0], 1);
    expect(part1.title).toBe('Глава 1. Начало');
    expect(part2.title).toContain('продолжение');
    expect(part1.html).toContain('Первый абзац');
    expect(part2.html).toContain('Второй абзац');

    // Склейка главы 2 с главой 1
    const merged = mergeChapterWithPrevious(chapters, 1);
    expect(merged).toHaveLength(1);
    expect(merged[0].html).toContain('<h2>Глава 2. Путь</h2>');
    expect(merged[0].html).toContain('Первый абзац второй главы');
  }, 30_000);

  // 2. FB2: FictionBook XML
  it('2. Реальный FB2 (FictionBook) с главами', async () => {
    const fb2Xml = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
<description><title-info><book-title>Звездный путь</book-title></title-info></description>
<body>
  <section><title><p>Глава 1. Космос</p></title>
    <p>Корабль медленно скользил сквозь астероидное поле.</p>
    <p>Датчики зафиксировали странный сигнал в секторе 4.</p>
    <p>Капитан приказал сбавить ход и проверить щиты.</p>
  </section>
  <section><title><p>Глава 2. Планета</p></title>
    <p>Атмосфера планеты оказалась пригодной для дыхания.</p>
  </section>
</body>
</FictionBook>`;
    const ab = new TextEncoder().encode(fb2Xml).buffer;
    const parsed = await parseManuscript(ab, 'space.fb2');
    const chapters = splitManuscript(parsed.units, 'headings', parsed.title || 'Книга');

    expect(chapters).toHaveLength(2);

    // Разрезка главы 1
    const [p1, p2] = splitChapterByParagraph(chapters[0], 1);
    expect(p1.html).toContain('Корабль медленно скользил');
    expect(p2.html).toContain('Датчики зафиксировали');

    // Склейка главы 2 с главой 1
    const merged = mergeChapterWithPrevious(chapters, 1);
    expect(merged).toHaveLength(1);
    expect(merged[0].html).toContain('Глава 2. Планета');
  });

  // 3. TXT: Роман с русскими диалогами и разделителями «Глава N»
  it('3. Текстовый роман (TXT) с кириллицей и диалогами', async () => {
    const txt = [
      'Глава 1. Встреча',
      'За окном моросил мелкий ноябрьский дождь.',
      '— Ты уверен, что они придут? — спросил Алексей.',
      'Сергей лишь молча кивнул в ответ, глядя на темную улицу.',
      'Глава 2. Разговор',
      'Они сидели на кухне до самого утра.',
      'Кофе давно остыл, но никто не обращал на это внимания.',
    ].join('\n\n');
    const ab = new TextEncoder().encode(txt).buffer;
    const parsed = await parseManuscript(ab, 'novel.txt');
    const chapters = splitManuscript(parsed.units, 'pattern', 'Роман');

    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe('Глава 1. Встреча');
    expect(chapters[1].title).toBe('Глава 2. Разговор');

    // Разрезка главы 1
    const [p1, p2] = splitChapterByParagraph(chapters[0], 1);
    expect(p1.html).toContain('За окном моросил');
    expect(p2.html).toContain('Алексей');

    // Склейка главы 2 с главой 1
    const merged = mergeChapterWithPrevious(chapters, 1);
    expect(merged).toHaveLength(1);
    expect(merged[0].html).toContain('Они сидели на кухне');
  });

  // 4. Markdown: Файл с заголовками # и ##
  it('4. Markdown-рукопись со списками и форматированием', async () => {
    const md = [
      '# Глава первая',
      'Вступление и первый абзац истории с **жирным** текстом.',
      'Второй абзац с описанием *пейзажа* и звуков леса.',
      '# Глава вторая',
      'Продолжение приключений героев в неизведанных землях.',
    ].join('\n\n');
    const ab = new TextEncoder().encode(md).buffer;
    const parsed = await parseManuscript(ab, 'book.md');
    const chapters = splitManuscript(parsed.units, 'headings', 'Книга');

    expect(chapters).toHaveLength(2);
    const [p1, p2] = splitChapterByParagraph(chapters[0], 1);
    expect(p1.html).toContain('Вступление');
    expect(p2.html).toContain('Второй абзац');

    const merged = mergeChapterWithPrevious(chapters, 1);
    expect(merged).toHaveLength(1);
    expect(merged[0].html).toContain('Продолжение приключений');
  });
});
