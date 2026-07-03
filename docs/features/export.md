# Feature: Экспорт

**Маршрут:** `/books/:id/export`

## Точки входа

- Кнопка **Экспорт** в тулбаре `Dashboard.tsx`
- Ссылка **Экспорт** внизу `Sidebar` (Chrome.tsx) — доступна из любого раздела

## Компоненты

- `src/pages/Export.tsx` — UI + вся логика конвертации.

## Форматы

| Формат | Зависимость | Описание |
|--------|-------------|----------|
| EPUB   | jszip       | ZIP с XHTML + OPF + NCX, EPUB 3.0 |
| FB2    | —           | XML вручную, FictionBook 2.0 |
| DOCX   | docx        | DOMParser → Paragraph/TextRun |
| PDF    | —           | CSS @page, print-диалог браузера. Pro-only. |
| HTML   | —           | Готовая страница со стилями |
| Markdown | —         | Заголовки, выделения |
| TXT    | —           | Чистый текст |

## PDF — Печатный экспорт (Pro)

Экспорт в печатный PDF через нативный CSS Paged Media браузера. Открывает print-диалог в новой вкладке.

**Форматы страницы:**
- A5 (148×210 мм) — классическая книга для самиздата
- A4 (210×297 мм) — рукопись для редактора (двойной интерлиньяж)

**Шаблон:** Классический (Georgia serif, кремовый фон A5 / белый A4, нумерация страниц).

**Ограничения MVP:** Без CMYK, bleed, crop marks. Без заметок и карты мира. Без TOC с номерами страниц. Для POD-сервисов (Ridero) рекомендуем проверить требования типографии.

**Реализация:** `src/lib/exportPdf.ts` → `buildPrintHtml` + `openPrintPdf`.

## Опции

- Язык (ru-RU / en-US / uk-UA) — попадает в метаданные всех форматов
- Титульная страница и оглавление — для EPUB/FB2/DOCX
- Заголовки глав внутри документа
- Только готовые главы (по статусу `done`)
- Оценка размера файла в футере
- **Абзацы** (для EPUB/DOCX/HTML, не для FB2): три режима — «Книжный» (красная строка, без интервала), «Цифровой» (интервал, без отступа), «Смешанный» (красная строка + интервал). Первый абзац каждой главы всегда без отступа (`class="no-indent"`, не `p:first-of-type` — надёжнее для всех ридеров). FB2 игнорирует — стиль задаётся читалкой.

## Обложка книги

- Попадает в экспорт только загруженное изображение (`isImageUrl(book.cover)`), не цветовой свотч из `CoverPicker`. Скачивается через `fetch()` в `Export.tsx`; при ошибке (сеть/CORS/404) молча пропускается.
- **EPUB / FB2** — встраивается (включая WebP): отдельная страница «Обложка» + метаданные (EPUB), base64 в `<binary>` + `<coverpage>` (FB2).
- **DOCX** — встраивается. Обложки хранятся в Storage как **WebP** (`optimizeImage` + `COVER_OPTS`), а `docx`/`ImageRun` WebP не поддерживает → `buildDocxBlob` перекодирует WebP в PNG через canvas (`bitmapToPngBytes`). png/jpg передаются как есть.
- **HTML** — вставляется ссылкой `<img src="URL">` на удалённый файл, не вшивается в документ.
- **TXT / Markdown** — обложка не выводится.

## Конвертер HTML → DOCX

`parseHtmlToParagraphs(html)` → рекурсивный обход DOM через `DOMParser`:
- `<p>` → `Paragraph`
- `<h1>–<h6>` → `HeadingLevel.*`
- `<blockquote>` → `Paragraph` с `indent.left = 720`
- `<ul>/<ol>` → `bullet: { level: 0 }` / ручная нумерация
- `<strong>/<em>/<u>/<s>/<code>` → `TextRun` с флагами
- `<hr>` → центрированный `* * *`

## Конвертер HTML → FB2

`inlineToFb2 + blockToFb2` — рекурсивный строковый билдер:
- `<strong>` → `<strong>`, `<em>` → `<emphasis>`, `<blockquote>` → `<cite>`
- Главы → `<section>` с `<title>`

## EPUB структура

```
mimetype (STORE, без сжатия)
META-INF/container.xml
OEBPS/content.opf   ← manifest + spine
OEBPS/nav.xhtml     ← EPUB3 TOC
OEBPS/toc.ncx       ← NCX для совместимости
OEBPS/styles.css
OEBPS/title.xhtml   ← если includeTitlePage
OEBPS/ch001.xhtml   ← каждая глава отдельным файлом
```
