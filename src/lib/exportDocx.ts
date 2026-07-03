import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from 'docx';
import type { Book } from './supabase';
import type { Chapter } from './chapters';
import type { Note } from './notes';
import {
  type BuildOpts,
  type ParagraphStyle,
  scaleToFit,
  chapterNotes,
  bookNotes,
  noteLabel,
} from './export';

interface InlineFmt {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
}

function collectRuns(node: Node, fmt: InlineFmt): TextRun[] {
  const runs: TextRun[] = [];
  const visit = (n: Node, f: InlineFmt) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = n.textContent ?? '';
      if (text) runs.push(new TextRun({ text, bold: f.bold, italics: f.italics, underline: f.underline ? {} : undefined, strike: f.strike, font: f.code ? 'Courier New' : undefined }));
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') { runs.push(new TextRun({ break: 1 })); return; }
    const nf: InlineFmt = { ...f };
    if (tag === 'strong' || tag === 'b') nf.bold = true;
    if (tag === 'em' || tag === 'i') nf.italics = true;
    if (tag === 'u') nf.underline = true;
    if (tag === 's' || tag === 'del' || tag === 'strike') nf.strike = true;
    if (tag === 'code') nf.code = true;
    for (const child of n.childNodes) visit(child, nf);
  };
  for (const child of node.childNodes) visit(child, fmt);
  return runs;
}

const H_LEVELS = [
  HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
];

function parseBlockEl(el: Element, paragraphStyle: ParagraphStyle, indentLeft?: number): Paragraph[] {
  const tag = el.tagName.toLowerCase();

  if (tag === 'p') {
    const runs = collectRuns(el, {});
    const hasIndent = paragraphStyle === 'indent' || paragraphStyle === 'both';
    const isNoIndent = el.getAttribute('data-no-indent') === 'true';
    const useFirstLine = hasIndent && !indentLeft && !isNoIndent;
    const spacingAfter = paragraphStyle === 'spacing' ? 200 : paragraphStyle === 'both' ? 160 : 40;
    return [new Paragraph({
      children: runs.length ? runs : [new TextRun('')],
      indent: {
        ...(indentLeft ? { left: indentLeft } : {}),
        ...(useFirstLine ? { firstLine: 720 } : {}),
      },
      spacing: { after: spacingAfter },
    })];
  }

  if (/^h[1-6]$/.test(tag)) {
    return [new Paragraph({ heading: H_LEVELS[parseInt(tag[1], 10) - 1] ?? HeadingLevel.HEADING_1, children: collectRuns(el, {}) })];
  }

  if (tag === 'blockquote') {
    const result: Paragraph[] = [];
    for (const child of Array.from(el.children)) result.push(...parseBlockEl(child, paragraphStyle, 720));
    return result;
  }

  if (tag === 'ul') {
    return Array.from(el.querySelectorAll(':scope > li')).map((li) => {
      const content = li.querySelector('p') ?? li;
      return new Paragraph({ children: collectRuns(content, {}), bullet: { level: 0 } });
    });
  }

  if (tag === 'ol') {
    return Array.from(el.querySelectorAll(':scope > li')).map((li, i) => {
      const content = li.querySelector('p') ?? li;
      return new Paragraph({ children: [new TextRun({ text: `${i + 1}.\t` }), ...collectRuns(content, {})], indent: { left: 360 } });
    });
  }

  if (tag === 'hr') {
    return [new Paragraph({ children: [new TextRun({ text: '* * *' })], alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 } })];
  }

  const result: Paragraph[] = [];
  for (const child of Array.from(el.children)) result.push(...parseBlockEl(child, paragraphStyle, indentLeft));
  return result;
}

function parseHtmlToParagraphs(html: string, paragraphStyle: ParagraphStyle): Paragraph[] {
  if (!html.trim()) return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.querySelector('div')!;
  const firstP = root.querySelector('p');
  if (firstP) firstP.setAttribute('data-no-indent', 'true');
  const result: Paragraph[] = [];
  for (const child of Array.from(root.children)) result.push(...parseBlockEl(child, paragraphStyle));
  return result;
}

function notesParagraphs(notes: Note[]): Paragraph[] {
  if (!notes.length) return [];
  const result: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun('Примечания автора')],
      spacing: { before: 480, after: 120 },
    }),
  ];
  for (const n of notes) {
    result.push(new Paragraph({
      children: [
        new TextRun({ text: `${noteLabel(n)}: `, bold: true, italics: true }),
        new TextRun({ text: n.text, italics: true }),
      ],
      spacing: { after: 60 },
      indent: { left: 360 },
    }));
  }
  return result;
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

export async function buildDocxBlob(book: Book, chapters: Chapter[], opts: BuildOpts): Promise<Blob> {
  const children: Paragraph[] = [];

  if (opts.cover) {
    const isNativeFmt = opts.cover.ext === 'png' || opts.cover.ext === 'jpg' || opts.cover.ext === 'jpeg';
    let coverW = 400, coverH = 600;
    let coverData: ArrayBuffer | Uint8Array | null = isNativeFmt ? opts.cover.data : null;
    let docxImgType: 'png' | 'jpg' = opts.cover.ext === 'png' ? 'png' : 'jpg';
    try {
      const coverBlob = new Blob([opts.cover.data], { type: opts.cover.mime });
      const bmp = await createImageBitmap(coverBlob);
      ({ width: coverW, height: coverH } = scaleToFit(bmp.width, bmp.height, 500, 750));
      if (!isNativeFmt) {
        const png = await bitmapToPngBytes(bmp);
        if (png) { coverData = png; docxImgType = 'png'; }
      }
      bmp.close();
    } catch { /* fallback 400×600, coverData остаётся как есть */ }
    if (coverData) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ data: coverData, transformation: { width: coverW, height: coverH }, type: docxImgType })],
          spacing: { before: 720, after: 720 },
        }),
        new Paragraph({ children: [new PageBreak()] }),
      );
    }
  }

  if (opts.mapImage) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: opts.mapImage, transformation: { width: 594, height: 334 }, type: 'png' })],
        spacing: { before: 360, after: 360 },
      }),
      new Paragraph({ children: [new PageBreak()] }),
    );
  }

  if (opts.includeTitlePage) {
    children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(book.title)], alignment: AlignmentType.CENTER, spacing: { after: 480 } }));
    if (book.author) children.push(new Paragraph({ children: [new TextRun({ text: book.author, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }));
    if (book.genre) children.push(new Paragraph({ children: [new TextRun({ text: book.genre, italics: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 480 } }));
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Оглавление')] }));
    for (const ch of chapters) {
      children.push(new Paragraph({ children: [new TextRun(ch.title)], indent: { left: 360 }, spacing: { after: 60 } }));
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (i > 0 || opts.includeTitlePage) children.push(new Paragraph({ children: [new PageBreak()] }));
    if (opts.includeChapterTitles) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(ch.title)] }));
    }
    const body = parseHtmlToParagraphs(ch.content ?? '', opts.paragraphStyle);
    children.push(...(body.length ? body : [new Paragraph({ children: [new TextRun('')] })]));
    if (opts.includeNotes) children.push(...notesParagraphs(chapterNotes(opts.notes, ch.id)));
  }

  if (opts.includeNotes) {
    const bn = bookNotes(opts.notes);
    if (bn.length) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
      children.push(...notesParagraphs(bn));
    }
  }

  return Packer.toBlob(new Document({ sections: [{ properties: {}, children }] }));
}

