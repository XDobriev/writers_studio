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
- **Приложения** (переключатели, все форматы, включая PDF/TXT/MD): «Действующие лица» — глоссарий персонажей отдельной главой в конце (имя, роль, псевдонимы, описание без предыстории и рабочих заметок); «Локации» — так же; «Примечания автора» — заметки, привязанные к главе, в конце этой главы; заметки без главы — разделом «Общие примечания автора» в конце книги.
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

## Качество форматов (аудит 2026-10-22)

- **Единая модель.** DOCX, FB2, MD и TXT строятся из одного обхода HTML главы (`exportModel.ts`: блоки + раны) — код-блоки, вложенные списки и несколько абзацев в пункте списка не теряются.
- **EPUB:** главы — валидный XHTML (`serializeXhtml`: `<br/>`, литерал U+00A0, без task-list `input`), архив DEFLATE (mimetype — первым и STORE), `dc:identifier` = `urn:uuid:<book.id>` (читалки обновляют книгу, а не дублируют), WebP-обложка → JPEG.
- **FB2:** порядок `title-info` по XSD, полный `document-info` (author/date/id/version), жанры книги → коды FB2 (запасной `prose_contemporary`), `<sequence>` для серии, стихи построчно, `sup/sub`.
- **DOCX:** без пустой страницы после оглавления (`pageBreakBefore`), метаданные документа, заголовки в тексте ниже заголовка главы.
- **PDF:** окно печати закрывается при ошибке, `lang` из выбранного языка. Имя файла — локальная дата.
- **Картинки глав в экспорте:** `loadChapterImages` (Export.tsx) скачивает их до сборки; DOCX/EPUB/FB2 — перекодирование не-JPEG/PNG в JPEG, файл в `OEBPS/images/ch-N` / `<binary id="chimg-N">` / `word/media`; HTML — data URI; Markdown — `![](url)`; PDF — по URL; TXT — без картинок. Блок `image` в `exportModel`.
- Тесты: `src/lib/export.test.ts` (каждая глава EPUB парсится как XHTML, порядок FB2, нет двух PageBreak подряд, pre/code не теряет текст).

## Импорт рукописи

Точка входа — Home («Импорт рукописи», пустое состояние) → `ImportManuscriptModal` → `useManuscriptImport`.
- **Форматы:** DOCX (mammoth, ленивый чанк), TXT (UTF-8/UTF-16/windows-1251), Markdown (свой парсер) — бесплатно; FB2 и EPUB — Pro (`PRO_IMPORT_FORMATS`). Лимит книг Free — как у «Новой книги». До 20 МБ.
- **Разбивка:** по заголовкам (h1/h2 DOCX/MD/EPUB, section FB2, файлы spine EPUB), по строкам «Глава N / Глава первая / ГЛАВА I / Часть / Пролог / Эпилог», или одной главой; способ переключается в предпросмотре.
- **Склейка в предпросмотре:** «↑ Склеить» приклеивает главу к предыдущей (её название остаётся подзаголовком `h2`), «Разъединить» отменяет. `joinChapters` в `importSplit.ts`, индексы склеек — в состоянии `useManuscriptImport`; смена способа разбивки их сбрасывает.
- **Очистка:** только то, что понимает редактор (DOMPurify; h1→h2, h4–6→h3), Word-мусор убирается.
- **Создание:** `createBook` + `createChaptersBulk` (один insert, пачками ≤ 3 МБ под лимит прокси `/sb/`); сбой вставки глав удаляет созданную книгу. Объём импорта пишется в `books.imported_words` — точка отсчёта тепловой карты и «написано сегодня».
- **Картинки:** парсеры (DOCX — mammoth `convertImage`, EPUB — файлы архива по `<img src>`, FB2 — `<binary>`) кладут в HTML метку `<img data-import-id>`, байты — в `ImportImages` (`importImages.ts`); `importSanitize` оставляет только помеченные картинки отдельным блоком. При создании книги `uploadImportedImages` (`chapterImages.ts`) заливает их в бакет `chapter-images` (`<user>/<book>/<uuid>`, WebP ≤ 1600 px, 4 параллельно, ≤ 150 шт.) и заменяет метки на public URL; не залилась — картинка убирается, импорт не падает. В TipTap — `@tiptap/extension-image` (блочный, без base64). TXT/MD картинок не содержат.
- Разрезать главу в предпросмотре нельзя.
