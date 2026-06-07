# Обложка книги в экспорте

**Дата:** 2026-06-07  
**Форматы:** EPUB, FB2, DOCX, HTML  
**Файл реализации:** `src/pages/Export.tsx`

## Цель

Если у книги загружена обложка (URL-изображение), встраивать её в скачанный файл. Сплошной цвет (`#hex`) — не встраивается.

---

## Типы данных

### Расширение `BuildOpts`

```ts
interface BuildOpts {
  // ...existing fields unchanged...
  cover?: { data: ArrayBuffer; mime: string; ext: string };
}
```

### Утилиты (новые)

```ts
// Уже экспортируется из CoverPicker — импортировать в Export.tsx
import { isImageUrl } from '../components/CoverPicker';

// Чанковый base64 (не ломает стек на 5 МБ)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += chunkSize)
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  return btoa(binary);
}

// Масштабирование под DOCX content area
function scaleToFit(w: number, h: number, maxW: number, maxH: number) {
  const r = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * r), height: Math.round(h * r) };
}
```

---

## Получение обложки (`onDownload`)

Добавить перед созданием `opts`:

```ts
let coverData: BuildOpts['cover'];
if (isImageUrl(bookWithAuthor.cover)) {
  try {
    const resp = await fetch(bookWithAuthor.cover);
    if (resp.ok) {
      const mime = resp.headers.get('content-type') ?? 'image/jpeg';
      const ext = mime.split('/')[1]?.split(';')[0] ?? 'jpg';
      coverData = { data: await resp.arrayBuffer(), mime, ext };
    }
  } catch { /* продолжаем без обложки */ }
}
const opts: BuildOpts = { ..., cover: coverData };
```

Fetch выполняется один раз, до вызова любого билдера. Ошибка fetch — не фатальная, экспорт продолжается.

---

## HTML

`buildHtmlDoc` не получает ArrayBuffer — cover URL берётся напрямую из `book.cover`.

**CSS** (добавить в `getHtmlStyle`):
```css
.cover-img{display:block;max-width:400px;margin:0 auto 2.5em;border-radius:6px}
```

**HTML** (после `<div class="book-meta">` или сразу после `<h1>`):
```html
<img class="cover-img" src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)}">
```

Условие: `isImageUrl(book.cover)`.

---

## EPUB

`buildEpubBlob` получает `opts.cover`.

### Файлы в ZIP

| Путь | Содержимое |
|------|-----------|
| `OEBPS/images/cover.{ext}` | `opts.cover.data` (ArrayBuffer) |
| `OEBPS/cover.xhtml` | XHTML-страница с `<img src="images/cover.{ext}"/>` |

### OPF (content.opf)

Manifest (добавить первыми двумя строками):
```xml
<item id="cover-image" href="images/cover.{ext}" media-type="{mime}" properties="cover-image"/>
<item id="cover-xhtml" href="cover.xhtml" media-type="application/xhtml+xml"/>
```

Metadata (добавить):
```xml
<meta name="cover" content="cover-image"/>
```

### Spine

`<itemref idref="cover-xhtml"/>` — **первым** элементом spine (до `title.xhtml` и глав).

### cover.xhtml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8"/><title>Обложка</title>
<style>body{margin:0;padding:0}img{display:block;width:100%;height:100vh;object-fit:contain}</style>
</head>
<body><img src="images/cover.{ext}" alt="Обложка"/></body>
</html>
```

### NCX / nav

Добавить `cover.xhtml` в навигацию **первым** пунктом: `<a href="cover.xhtml">Обложка</a>`.

---

## FB2

`buildFb2Doc` получает `opts.cover`. Функция остаётся синхронной (base64 — синхронная операция).

### title-info

Добавить перед `</title-info>`:
```xml
<coverpage><image l:href="#cover-img"/></coverpage>
```

### binary

Добавить перед `</FictionBook>`:
```xml
<binary id="cover-img" content-type="{mime}">
{base64}
</binary>
```

---

## DOCX

`buildDocxBlob` получает `opts.cover`. Добавить `ImageRun` в import из `docx`.

### Определение размеров

```ts
let coverW = 400, coverH = 600; // fallback
try {
  const blob = new Blob([opts.cover.data], { type: opts.cover.mime });
  const bmp = await createImageBitmap(blob);
  ({ width: coverW, height: coverH } = scaleToFit(bmp.width, bmp.height, 500, 750));
  bmp.close();
} catch { /* use fallback */ }
```

### Вставка

```ts
children.splice(0, 0,
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({ data: opts.cover.data, transformation: { width: coverW, height: coverH } })],
    spacing: { before: 720, after: 720 },
  }),
  new Paragraph({ children: [new PageBreak()] }),
);
```

Вставляется самым первым — до титульного листа (если он есть) и до глав.

---

## Edge-cases

| Ситуация | Поведение |
|---|---|
| `book.cover` — цвет (`#hex`) | `isImageUrl` → false, `coverData = undefined`, экспорт без обложки |
| Fetch вернул не-2xx | `resp.ok === false` → `coverData = undefined` |
| Fetch выбросил исключение | `catch {}` → `coverData = undefined` |
| `createImageBitmap` недоступен / упал | fallback 400×600 |
| TXT, MD | обложка не встраивается (нет бинарного контейнера) |

---

## Изменяемые файлы

| Файл | Изменение |
|------|-----------|
| `src/pages/Export.tsx` | Основная реализация: import, утилиты, `BuildOpts`, `onDownload`, 4 билдера |

Новых файлов не создаётся.
