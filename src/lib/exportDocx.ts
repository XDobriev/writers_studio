import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
  type IParagraphOptions,
  type ParagraphChild,
} from 'docx';
import type { Book } from './supabase';
import type { Chapter } from './chapters';
import type { Note } from './notes';
import {
  type Appendix,
  type BuildOpts,
  type ChapterImage,
  type ParagraphStyle,
  scaleToFit,
  chapterNotes,
  bookNotes,
  noteLabel,
  CHAPTER_NOTES_TITLE,
  BOOK_NOTES_TITLE,
} from './export';
import { parseHtmlBlocks, type Align, type Block, type Run } from './exportModel';

const H_LEVELS = [
  HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
];

const ALIGN: Record<Align, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

/**
 * Собирает абзацы документа. Разрыв страницы — `pageBreakBefore` у первого абзаца
 * следующей страницы, а не отдельный абзац с PageBreak: так нет пустых страниц
 * и пустой строки сверху. Несколько `pageBreak()` подряд схлопываются в один.
 */
class DocBuilder {
  readonly out: Paragraph[] = [];
  private breakNext = false;

  pageBreak() {
    if (this.out.length) this.breakNext = true;
  }

  push(opts: IParagraphOptions) {
    this.out.push(new Paragraph({ ...opts, ...(this.breakNext ? { pageBreakBefore: true } : {}) }));
    this.breakNext = false;
  }
}

function runsToDocx(runs: Run[], extra: { italics?: boolean } = {}): ParagraphChild[] {
  return runs.map((r) => {
    if (r.kind === 'br') return new TextRun({ break: 1 });
    return new TextRun({
      text: r.text,
      bold: r.marks.includes('b') || undefined,
      italics: r.marks.includes('i') || extra.italics || undefined,
      underline: r.marks.includes('u') || r.href ? {} : undefined,
      strike: r.marks.includes('s') || undefined,
      subScript: r.marks.includes('sub') || undefined,
      superScript: r.marks.includes('sup') || undefined,
      font: r.marks.includes('code') ? 'Courier New' : undefined,
    });
  });
}

interface BlockCtx {
  paragraphStyle: ParagraphStyle;
  /** Сдвиг уровня заголовков в тексте: заголовок главы — Heading 1, текстовые — ниже. */
  headingShift: number;
  indentLeft: number;
  italics?: boolean;
  /** Первый абзац главы — без красной строки. */
  firstParagraph: { done: boolean };
}

function paragraphOpts(runs: Run[], ctx: BlockCtx, align?: Align, prefix?: string): IParagraphOptions {
  const hasIndent = ctx.paragraphStyle === 'indent' || ctx.paragraphStyle === 'both';
  const useFirstLine = hasIndent && !ctx.indentLeft && ctx.firstParagraph.done && !align;
  ctx.firstParagraph.done = true;
  const spacingAfter = ctx.paragraphStyle === 'spacing' ? 200 : ctx.paragraphStyle === 'both' ? 160 : 40;
  const children = [
    ...(prefix ? [new TextRun({ text: prefix })] : []),
    ...runsToDocx(runs, { italics: ctx.italics }),
  ];
  return {
    children: children.length ? children : [new TextRun('')],
    indent: {
      ...(ctx.indentLeft ? { left: ctx.indentLeft } : {}),
      ...(useFirstLine ? { firstLine: 720 } : {}),
    },
    spacing: { after: spacingAfter },
    ...(align ? { alignment: ALIGN[align] } : {}),
  };
}

function renderBlocks(b: DocBuilder, blocks: Block[], ctx: BlockCtx, images?: Map<string, ChapterImage>) {
  for (const bl of blocks) {
    if (bl.kind === 'image') {
      const img = images?.get(bl.src);
      if (!img) continue;
      const { width, height } = scaleToFit(img.width, img.height, 450, 600);
      b.push({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: img.data, transformation: { width, height }, type: img.ext === 'png' ? 'png' : 'jpg' })],
        spacing: { before: 120, after: 200 },
      });
    } else if (bl.kind === 'p') {
      b.push(paragraphOpts(bl.runs, ctx, bl.align));
    } else if (bl.kind === 'heading') {
      const level = Math.min(6, bl.level + ctx.headingShift);
      b.push({ heading: H_LEVELS[level - 1], children: runsToDocx(bl.runs) });
    } else if (bl.kind === 'quote') {
      renderBlocks(b, bl.blocks, { ...ctx, indentLeft: ctx.indentLeft + 720, italics: true }, images);
    } else if (bl.kind === 'list') {
      const left = ctx.indentLeft + 360;
      bl.items.forEach((item, i) => {
        const marker = bl.ordered ? `${bl.start + i}.\t` : '•\t';
        let first = true;
        for (const sub of item) {
          if (sub.kind === 'p') {
            const o = paragraphOpts(sub.runs, { ...ctx, indentLeft: left }, sub.align, first ? marker : undefined);
            b.push({ ...o, indent: { left: left + 360, hanging: first ? 360 : 0 } });
          } else {
            renderBlocks(b, [sub], { ...ctx, indentLeft: left }, images);
          }
          first = false;
        }
        if (first) b.push({ children: [new TextRun({ text: marker })], indent: { left: left + 360, hanging: 360 } });
      });
    } else if (bl.kind === 'code') {
      for (const line of bl.lines) {
        b.push({
          children: [new TextRun({ text: line, font: 'Courier New' })],
          indent: { left: ctx.indentLeft + 360 },
          spacing: { after: 0 },
        });
      }
    } else {
      b.push({ children: [new TextRun({ text: '* * *' })], alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 } });
    }
  }
}

function renderNotes(b: DocBuilder, notes: Note[], title = CHAPTER_NOTES_TITLE) {
  if (!notes.length) return;
  b.push({ heading: HeadingLevel.HEADING_3, children: [new TextRun(title)], spacing: { before: 480, after: 120 } });
  for (const n of notes) {
    b.push({
      children: [
        new TextRun({ text: `${noteLabel(n)}: `, bold: true, italics: true }),
        new TextRun({ text: n.text, italics: true }),
      ],
      spacing: { after: 60 },
      indent: { left: 360 },
    });
  }
}

function renderAppendix(b: DocBuilder, a: Appendix) {
  b.pageBreak();
  b.push({ heading: HeadingLevel.HEADING_1, children: [new TextRun(a.title)] });
  for (const e of a.entries) {
    b.push({ heading: HeadingLevel.HEADING_3, children: [new TextRun(e.title)], spacing: { before: 240, after: 60 } });
    if (e.meta.length) b.push({ children: [new TextRun({ text: e.meta.join(' · '), italics: true })], spacing: { after: 60 } });
    for (const p of e.paragraphs) {
      b.push({
        children: [
          ...(p.label ? [new TextRun({ text: `${p.label}. `, bold: true })] : []),
          new TextRun({ text: p.text, italics: p.italic || undefined }),
        ],
        spacing: { after: 60 },
      });
    }
  }
}

// docx ImageRun поддерживает только jpg/png/gif/bmp — WebP нужно перекодировать в PNG.
async function bitmapToPngBytes(bmp: ImageBitmap): Promise<Uint8Array | null> {
  try {
    let blob: Blob;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      canvas.getContext('2d')!.drawImage(bmp, 0, 0);
      blob = await canvas.convertToBlob({ type: 'image/png' });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      canvas.getContext('2d')!.drawImage(bmp, 0, 0);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
    }
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

async function pngSize(data: ArrayBuffer): Promise<{ width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(new Blob([data], { type: 'image/png' }));
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return null;
  }
}

export async function buildDocxDocument(book: Book, chapters: Chapter[], opts: BuildOpts): Promise<Document> {
  const b = new DocBuilder();

  if (opts.cover) {
    const isNativeFmt = opts.cover.ext === 'png' || opts.cover.ext === 'jpg' || opts.cover.ext === 'jpeg';
    let coverW = 400, coverH = 600;
    let coverData: ArrayBuffer | Uint8Array | null = isNativeFmt ? opts.cover.data : null;
    let docxImgType: 'png' | 'jpg' = opts.cover.ext === 'png' ? 'png' : 'jpg';
    try {
      const bmp = await createImageBitmap(new Blob([opts.cover.data], { type: opts.cover.mime }));
      ({ width: coverW, height: coverH } = scaleToFit(bmp.width, bmp.height, 500, 750));
      if (!isNativeFmt) {
        const png = await bitmapToPngBytes(bmp);
        if (png) { coverData = png; docxImgType = 'png'; }
      }
      bmp.close();
    } catch { /* fallback 400×600, coverData остаётся как есть */ }
    if (coverData) {
      b.push({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: coverData, transformation: { width: coverW, height: coverH }, type: docxImgType })],
        spacing: { before: 720, after: 720 },
      });
      b.pageBreak();
    }
  }

  if (opts.mapImage) {
    const size = await pngSize(opts.mapImage);
    const { width, height } = size ? scaleToFit(size.width, size.height, 594, 800) : { width: 594, height: 334 };
    b.push({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: opts.mapImage, transformation: { width, height }, type: 'png' })],
      spacing: { before: 360, after: 360 },
    });
    b.pageBreak();
  }

  if (opts.includeTitlePage) {
    b.push({ heading: HeadingLevel.TITLE, children: [new TextRun(book.title)], alignment: AlignmentType.CENTER, spacing: { after: 480 } });
    if (book.author) b.push({ children: [new TextRun({ text: book.author, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 120 } });
    if (book.genre) b.push({ children: [new TextRun({ text: book.genre, italics: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 480 } });
    b.pageBreak();
    b.push({ children: [new TextRun({ text: 'Оглавление', bold: true, size: 32 })], spacing: { after: 240 } });
    for (const ch of chapters) {
      b.push({ children: [new TextRun(ch.title)], indent: { left: 360 }, spacing: { after: 60 } });
    }
    for (const a of opts.appendices ?? []) {
      b.push({ children: [new TextRun(a.title)], indent: { left: 360 }, spacing: { after: 60 } });
    }
  }

  const headingShift = opts.includeChapterTitles ? 1 : 0;
  for (const ch of chapters) {
    b.pageBreak();
    if (opts.includeChapterTitles) {
      b.push({ heading: HeadingLevel.HEADING_1, children: [new TextRun(ch.title)] });
    }
    const ctx: BlockCtx = { paragraphStyle: opts.paragraphStyle, headingShift, indentLeft: 0, firstParagraph: { done: false } };
    const blocks = parseHtmlBlocks(ch.content ?? '');
    if (blocks.length) renderBlocks(b, blocks, ctx, opts.chapterImages);
    else b.push({ children: [new TextRun('')] });
    if (opts.includeNotes) renderNotes(b, chapterNotes(opts.notes, ch.id));
  }

  for (const a of opts.appendices ?? []) renderAppendix(b, a);

  if (opts.includeNotes) {
    const bn = bookNotes(opts.notes);
    if (bn.length) {
      b.pageBreak();
      renderNotes(b, bn, BOOK_NOTES_TITLE);
    }
  }

  return new Document({
    title: book.title,
    creator: book.author ?? undefined,
    description: book.genre ?? undefined,
    styles: {
      default: {
        document: { run: { font: 'Times New Roman', size: 24, language: { value: opts.language } } },
      },
    },
    sections: [{ properties: {}, children: b.out }],
  });
}

export async function buildDocxBlob(book: Book, chapters: Chapter[], opts: BuildOpts): Promise<Blob> {
  return Packer.toBlob(await buildDocxDocument(book, chapters, opts));
}
