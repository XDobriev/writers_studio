# Cover in Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Встраивать обложку книги (если это изображение, не цвет) во все форматы экспорта: HTML, EPUB, FB2, DOCX.

**Architecture:** Один fetch обложки в `onDownload` до вызова любого билдера; результат (`ArrayBuffer + mime + ext`) передаётся через `BuildOpts.cover`. HTML использует URL напрямую. EPUB: cover.xhtml + manifest/spine. FB2: `<coverpage>` + `<binary>`. DOCX: `ImageRun` на отдельной странице перед содержимым.

**Tech Stack:** TypeScript, React, `docx@9`, `jszip`, Supabase Storage (public URLs)

---

## File Map

| Файл | Что меняется |
|------|-------------|
| `src/pages/Export.tsx` | Всё. Один файл, 6 точечных изменений |

---

### Task 1: Imports, `BuildOpts`, утилиты

**Files:**
- Modify: `src/pages/Export.tsx`

Все изменения в первой части файла (строки 1–200).

- [ ] **Шаг 1: Добавить `ImageRun` к импорту `docx` (строка 9–16)**

Найти блок:
```ts
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from 'docx';
```

Заменить на:
```ts
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
```

- [ ] **Шаг 2: Импортировать `isImageUrl` из `CoverPicker` (после строки 18)**

После строки:
```ts
import { Icon } from '../components/Icon';
```

Добавить:
```ts
import { isImageUrl } from '../components/CoverPicker';
```

- [ ] **Шаг 3: Расширить `BuildOpts` (строка 169–176)**

Найти:
```ts
interface BuildOpts {
  includeChapterTitles: boolean;
  includeTitlePage: boolean;
  language: string;
  includeNotes: boolean;
  notes: Note[];
  paragraphStyle: 'indent' | 'spacing';
}
```

Заменить на:
```ts
interface BuildOpts {
  includeChapterTitles: boolean;
  includeTitlePage: boolean;
  language: string;
  includeNotes: boolean;
  notes: Note[];
  paragraphStyle: 'indent' | 'spacing';
  cover?: { data: ArrayBuffer; mime: string; ext: string };
}
```

- [ ] **Шаг 4: Добавить утилиты после `slugify` (после строки 75)**

После функции `slugify` (строка ~75) вставить:

```ts
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}

function scaleToFit(w: number, h: number, maxW: number, maxH: number) {
  const r = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * r), height: Math.round(h * r) };
}
```

- [ ] **Шаг 5: Typecheck**

```bash
npm run typecheck
```

Ожидание: 0 ошибок (новые утилиты ещё не используются — это нормально, `noUnusedLocals` не должен сработать на module-level функции без экспорта... если сработает — добавить к ним `_` prefix и убрать, когда используются в следующих задачах).

- [ ] **Шаг 6: Commit**

```bash
git add src/pages/Export.tsx
git commit -m "feat(export): imports + BuildOpts.cover + base64/scale utils"
```

---

### Task 2: Cover fetch в `onDownload`

**Files:**
- Modify: `src/pages/Export.tsx` — функция `onDownload` (~строка 718)

- [ ] **Шаг 1: Добавить fetch перед созданием `opts`**

Найти в `onDownload`:
```ts
    const bookWithAuthor = { ...book, author: authorName.trim() || book.author };
    const opts: BuildOpts = { includeChapterTitles, includeTitlePage, language, includeNotes, notes, paragraphStyle };
```

Заменить на:
```ts
    const bookWithAuthor = { ...book, author: authorName.trim() || book.author };
    let coverData: BuildOpts['cover'];
    if (isImageUrl(bookWithAuthor.cover)) {
      try {
        const resp = await fetch(bookWithAuthor.cover);
        if (resp.ok) {
          const mime = resp.headers.get('content-type') ?? 'image/jpeg';
          const ext = mime.split('/')[1]?.split(';')[0] ?? 'jpg';
          coverData = { data: await resp.arrayBuffer(), mime, ext };
        }
      } catch { /* no cover */ }
    }
    const opts: BuildOpts = { includeChapterTitles, includeTitlePage, language, includeNotes, notes, paragraphStyle, cover: coverData };
```

- [ ] **Шаг 2: Typecheck**

```bash
npm run typecheck
```

Ожидание: 0 ошибок.

- [ ] **Шаг 3: Commit**

```bash
git add src/pages/Export.tsx
git commit -m "feat(export): fetch cover once in onDownload, pass via BuildOpts"
```

---

### Task 3: HTML format

**Files:**
- Modify: `src/pages/Export.tsx` — `getHtmlStyle` (~строка 152) и `buildHtmlDoc` (~строка 178)

- [ ] **Шаг 1: Добавить CSS в `getHtmlStyle`**

Найти в конце возвращаемой строки CSS (перед закрывающим обратным тиком):
```ts
  .note-item{margin:0 0 0.4em;font-size:14px;color:#4a443f;text-indent:0}
`;
```

Заменить на:
```ts
  .note-item{margin:0 0 0.4em;font-size:14px;color:#4a443f;text-indent:0}
  .cover-img{display:block;max-width:400px;margin:0 auto 2.5em;border-radius:6px}
`;
```

- [ ] **Шаг 2: Добавить `<img>` в `buildHtmlDoc`**

Найти:
```ts
<h1 class="book-title">${escapeHtml(book.title)}</h1>
${meta ? `<div class="book-meta">${meta}</div>` : ''}
${body}
```

Заменить на:
```ts
<h1 class="book-title">${escapeHtml(book.title)}</h1>
${meta ? `<div class="book-meta">${meta}</div>` : ''}
${isImageUrl(book.cover) ? `<img class="cover-img" src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}">` : ''}
${body}
```

- [ ] **Шаг 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Шаг 4: Commit**

```bash
git add src/pages/Export.tsx
git commit -m "feat(export): обложка в HTML — img после заголовка"
```

---

### Task 4: EPUB format

**Files:**
- Modify: `src/pages/Export.tsx` — `buildEpubBlob` (~строка 514–620)

- [ ] **Шаг 1: Добавить переменные обложки в начало функции**

Найти первую строку `buildEpubBlob` после открывающей скобки:
```ts
async function buildEpubBlob(book: Book, chapters: Chapter[], opts: BuildOpts): Promise<Blob> {
  const uuid = crypto.randomUUID?.() ?? `book-${Date.now()}`;
```

Добавить после этой строки (после объявления `uuid`):
```ts
  const hasCover = !!opts.cover;
  const coverMime = opts.cover?.mime ?? 'image/jpeg';
  const coverExt = opts.cover?.ext ?? 'jpg';
```

- [ ] **Шаг 2: Добавить cover items в `manifestParts`**

Найти:
```ts
  const manifestParts = [
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
```

Заменить на:
```ts
  const manifestParts = [
    ...(hasCover ? [
      `<item id="cover-image" href="images/cover.${coverExt}" media-type="${coverMime}" properties="cover-image"/>`,
      `<item id="cover-xhtml" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
    ] : []),
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
```

- [ ] **Шаг 3: Добавить cover item в `spineParts`**

Найти:
```ts
  const spineParts = [
    ...(opts.includeTitlePage ? [`<itemref idref="title"/>`] : []),
```

Заменить на:
```ts
  const spineParts = [
    ...(hasCover ? [`<itemref idref="cover-xhtml"/>`] : []),
    ...(opts.includeTitlePage ? [`<itemref idref="title"/>`] : []),
```

- [ ] **Шаг 4: Добавить cover в nav/ncx (перед существующим `if (opts.includeTitlePage)`)**

Найти:
```ts
  if (opts.includeTitlePage) {
    navLi.push(`<li><a href="title.xhtml">${escapeHtml(book.title)}</a></li>`);
```

Добавить ПЕРЕД этим блоком:
```ts
  if (hasCover) {
    navLi.push(`<li><a href="cover.xhtml">Обложка</a></li>`);
    ncxPts.push(`<navPoint id="cover-xhtml" playOrder="${po++}"><navLabel><text>Обложка</text></navLabel><content src="cover.xhtml"/></navPoint>`);
  }
```

- [ ] **Шаг 5: Добавить `<meta name="cover">` в OPF metadata**

Найти в строке OPF:
```ts
  <meta property="dcterms:modified">${today}T00:00:00Z</meta>
</metadata>
```

Заменить на:
```ts
  <meta property="dcterms:modified">${today}T00:00:00Z</meta>
  ${hasCover ? `<meta name="cover" content="cover-image"/>` : ''}
</metadata>
```

- [ ] **Шаг 6: Добавить файлы cover в ZIP**

Найти (в конце функции, после `zip.file('OEBPS/styles.css', ...)`):
```ts
  if (opts.includeTitlePage) zip.file('OEBPS/title.xhtml', titleXhtml(book, lang));
```

Добавить ПЕРЕД этой строкой:
```ts
  if (hasCover && opts.cover) {
    zip.file(`OEBPS/images/cover.${coverExt}`, opts.cover.data);
    zip.file('OEBPS/cover.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"/><title>Обложка</title>
<style>body{margin:0;padding:0}img{display:block;width:100%;height:100vh;object-fit:contain}</style>
</head>
<body><img src="images/cover.${coverExt}" alt="Обложка"/></body>
</html>`);
  }
```

- [ ] **Шаг 7: Typecheck**

```bash
npm run typecheck
```

Ожидание: 0 ошибок.

- [ ] **Шаг 8: Commit**

```bash
git add src/pages/Export.tsx
git commit -m "feat(export): обложка в EPUB — cover.xhtml + manifest/spine/nav"
```

---

### Task 5: FB2 format

**Files:**
- Modify: `src/pages/Export.tsx` — `buildFb2Doc` (~строка 422–458)

- [ ] **Шаг 1: Добавить `<coverpage>` в `<title-info>`**

Найти:
```ts
    <date value="${today}">${today}</date>
  </title-info>
```

Заменить на:
```ts
    <date value="${today}">${today}</date>
    ${opts.cover ? `<coverpage><image l:href="#cover-img"/></coverpage>` : ''}
  </title-info>
```

- [ ] **Шаг 2: Добавить `<binary>` перед `</FictionBook>`**

Найти:
```ts
</FictionBook>`;
```

Заменить на:
```ts
${opts.cover ? `<binary id="cover-img" content-type="${opts.cover.mime}">
${arrayBufferToBase64(opts.cover.data)}
</binary>` : ''}
</FictionBook>`;
```

- [ ] **Шаг 3: Typecheck**

```bash
npm run typecheck
```

Ожидание: 0 ошибок.

- [ ] **Шаг 4: Commit**

```bash
git add src/pages/Export.tsx
git commit -m "feat(export): обложка в FB2 — coverpage + binary base64"
```

---

### Task 6: DOCX format

**Files:**
- Modify: `src/pages/Export.tsx` — `buildDocxBlob` (~строка 342–377)

Ограничение: `docx@9` не поддерживает webp. Для webp обложка в DOCX пропускается.

- [ ] **Шаг 1: Добавить cover page перед существующим контентом**

Найти в начале `buildDocxBlob`:
```ts
async function buildDocxBlob(book: Book, chapters: Chapter[], opts: BuildOpts): Promise<Blob> {
  const children: Paragraph[] = [];

  if (opts.includeTitlePage) {
```

Заменить на:
```ts
async function buildDocxBlob(book: Book, chapters: Chapter[], opts: BuildOpts): Promise<Blob> {
  const children: Paragraph[] = [];

  if (opts.cover && opts.cover.ext !== 'webp') {
    let coverW = 400, coverH = 600;
    try {
      const coverBlob = new Blob([opts.cover.data], { type: opts.cover.mime });
      const bmp = await createImageBitmap(coverBlob);
      ({ width: coverW, height: coverH } = scaleToFit(bmp.width, bmp.height, 500, 750));
      bmp.close();
    } catch { /* fallback 400×600 */ }
    const docxImgType = opts.cover.ext === 'png' ? 'png' : 'jpg';
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: opts.cover.data, transformation: { width: coverW, height: coverH }, type: docxImgType })],
        spacing: { before: 720, after: 720 },
      }),
      new Paragraph({ children: [new PageBreak()] }),
    );
  }

  if (opts.includeTitlePage) {
```

- [ ] **Шаг 2: Typecheck**

```bash
npm run typecheck
```

Ожидание: 0 ошибок. Если `ImageRun` жалуется на `type` — проверить что `docx` импортирован с `ImageRun` (Task 1).

- [ ] **Шаг 3: Lint**

```bash
npm run lint
```

Ожидание: 0 ошибок.

- [ ] **Шаг 4: Commit**

```bash
git add src/pages/Export.tsx
git commit -m "feat(export): обложка в DOCX — ImageRun на отдельной странице"
```

---

### Task 7: Ручное QA + push

**Files:** только проверка, код не меняется

- [ ] **Шаг 1: Dev-сервер**

```bash
npm run dev
```

Открыть в браузере: `http://127.0.0.1:5273/`

- [ ] **Шаг 2: Войти и открыть книгу с загруженной обложкой-изображением**

Залогиниться как `e2e@avtorskaya-studiya.vercel.app`. Открыть любую книгу, у которой обложка — это URL (не цвет). Перейти на `/books/{id}/export`.

- [ ] **Шаг 3: Проверить HTML**

Выбрать HTML → Скачать. Открыть файл в браузере.
Ожидание: изображение обложки отображается между заголовком книги и первой главой.

- [ ] **Шаг 4: Проверить EPUB**

Выбрать EPUB → Скачать. Открыть в Calibre / браузере.
Ожидание: первая страница — обложка, затем (если включено) титульный лист, затем главы. Обложка есть в ToC.

- [ ] **Шаг 5: Проверить FB2**

Выбрать FB2 → Скачать. Открыть в FBReader или проверить текст файла.
Ожидание: в начале XML есть `<coverpage>`, в конце — `<binary id="cover-img" ...>` с base64.

- [ ] **Шаг 6: Проверить DOCX**

Выбрать DOCX → Скачать. Открыть в Word / LibreOffice.
Ожидание: первая страница — изображение обложки. Вторая — титульный лист (если включён).

- [ ] **Шаг 7: Проверить книгу без обложки (только цвет)**

Открыть книгу, у которой обложка — цвет (#hex). Скачать любой формат.
Ожидание: экспорт без обложки, без ошибок.

- [ ] **Шаг 8: Добавить позиционирование обложки в roadmap**

Открыть `docs/roadmap.md`. В секцию Backlog добавить:

```markdown
- **Позиционирование обложки** — drag/crop объекта (object-position) при загрузке изображения, чтобы кадрировать фото под обложку. (`CoverPicker.tsx`)
```

- [ ] **Шаг 9: Push**

```bash
git push
```

Ожидание: GitHub Actions запускает деплой на VPS и Vercel.
