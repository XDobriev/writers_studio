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
| HTML   | —           | Готовая страница со стилями |
| Markdown | —         | Заголовки, выделения |
| TXT    | —           | Чистый текст |

## Опции

- Язык (ru-RU / en-US / uk-UA) — попадает в метаданные всех форматов
- Титульная страница и оглавление — для EPUB/FB2/DOCX
- Заголовки глав внутри документа
- Только готовые главы (по статусу `done`)
- Оценка размера файла в футере
- **Стиль абзацев** (для EPUB/DOCX/HTML): «Красная строка» (indent) и «Интервал» (spacing). В indent-режиме первый абзац каждой главы без отступа (`p:first-of-type`) — типографическое правило.

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
