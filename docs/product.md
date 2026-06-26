# Product

## Register

product

## Users

Two overlapping segments who share one essential trait: they take writing seriously.

**Hobbyist authors** — writing for themselves, fan fiction, personal novels. Care about the pleasure of the process; the interface must not feel like work. They open the app to write, not to configure software.

**Serious and professional authors** — working on commercial manuscripts, planning publications. Care about control, reliability, structural overview, and professional-grade tools. They bring high expectations from their craft.

Both segments sit in the same chair: a writer who wants to disappear into their work, not wrestle with software.

## Product Purpose

An immersive writing environment for long-form prose. Writers organise their books by chapters, track characters, build timelines and world maps, and write in a focused, paper-centred editing space. Export to EPUB, FB2, DOCX when the manuscript is ready.

Success: the writer opens the app, opens their chapter, and the interface ceases to exist. They are inside the work.

## Brand Personality

Literary · Precise · Immersive

Literary — the aesthetic vocabulary comes from books and manuscripts, not from SaaS dashboards. The warm dark palette, the serif typeface on paper, the chapter numbering in mono: these signal "you are in a writing studio", not "you are in a productivity tool".

Precise — the interface is tight and controlled. Nothing decorative, nothing vague. Every affordance earns its pixel. The structure panel, toolbar, and status bar are subordinate to the text; they appear when needed and recede when not.

Immersive — the editor is the centre of gravity. Distraction-free modes, a paper surface that evokes physical writing, warm ambient light. The interface should feel like settling into a good chair with good light.

## Anti-references

**Notion / Obsidian** — too block-based, too generic. Wiki-brain tools without literary focus or tonal character. The "page" metaphor is wrong for manuscript work.

**Google Docs / Word** — office editors. Corporate, toneless, built for document management not creative authorship. The aesthetic communicates bureaucracy.

**Scrivener** — functionally overloaded, visually outdated. A 2000s desktop UI with no design intent. The cork board is nostalgic at best, dated at worst.

**Medium / Substack** — blog-platform orientation. "Content" instead of "manuscript". Public-by-default is the wrong mental model for a writer working on a book.

## Design Principles

**The interface earns invisibility.** Chrome, panels, and tools exist only to serve the manuscript. In writing mode, the writer should feel only the text. Every design decision is evaluated by whether it disappears when not needed.

**The manuscript is the hero.** The paper surface with its warm cream and serif typeface is the centre of gravity. All interface decisions — the dark shell, the narrow toolbar, the quiet sidebar — exist to frame the paper, not compete with it.

**Literary precision, not software sheen.** The aesthetic language comes from physical writing culture: warm lamp light, aged paper, monospaced counters. Not from SaaS gradients, card grids, or dashboard charts.

**Depth without friction.** Both a first-time novelist and a seasoned author must find the tool approachable on day one, and discover its depth over months. Features reveal themselves through use, not through configuration menus.

**Confidence over caution.** This is a professional-grade writing environment. The interface should convey that — through decisive type choices, considered contrast, unhurried spacing. It does not explain itself; it trusts the writer.

## Accessibility & Inclusion

WCAG AA as the baseline: contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI components. Keyboard navigation on all interactive elements with visible focus rings (`:focus-visible`). Respect `prefers-reduced-motion`. Both the dark (default) and light themes must hold AA contrast independently.

## Монетизация

### Правовая схема

**Самозанятый (НПД)** — оптимальный статус для старта:
- Налог: **4%** с доходов от физлиц, **6%** от юрлиц. Первые месяцы — 3%/4% (налоговый вычет 10 000 ₽).
- Лимит: **2,4 млн ₽/год** (~600 подписчиков по 399 ₽/мес). После — переход на ИП (УСН 6%).
- Нет минимального налога: нет дохода → нет налога. Нет обязательных взносов (в отличие от ИП).
- Онлайн-касса не нужна — чек выдаётся через «Мой налог».

### Тарифы

| Тариф | Месяц | Год | Что включено |
|---|---|---|---|
| **Free** | 0 ₽ | — | 1 книга · 3 персонажа · 10 событий хронологии · экспорт TXT/HTML |
| **Про** | 399 ₽ | 3 490 ₽ (~291 ₽/мес) | Безлимит книг/персонажей/хронологии · экспорт EPUB/FB2/DOCX · версии без лимита |
| **Lifetime** | — | — | Всё из Про навсегда · 4 990 ₽ разово (первые 50 мест → потом 6 990 ₽) |

**Точки конверсии Free → Про:**
- Добавляет 4-го персонажа (лимит 3)
- Хочет экспортировать EPUB / FB2 / DOCX
- Начинает вторую книгу
- Добавляет 11-е событие в хронологию

### Расходы и безубыточность

| Статья | Сумма/мес | Примечание |
|---|---|---|
| Claude Code (Max) | ~$100 / ~9 200 ₽ | Инструмент разработки, не API в продукте |
| Supabase Pro ($25) | ~2 300 ₽ | До перехода на self-hosted (§9) |
| Сервер (VPS) | 1 200 ₽ | Timeweb, Ubuntu 24.04 |
| Домен | ~125 ₽ | avtorstudio.com |
| **Итого** | **~12 825 ₽/мес** | После self-hosted Supabase: −2 300 ₽ |

Безубыточность при 399 ₽/мес (с учётом комиссии Robokassa 3,9% и НПД 4%): **~35 платных подписчиков** (или ~13 после отказа от Supabase Cloud).

Альтернатива: **2 Lifetime-покупки** (4 990 ₽ × 2 = ~9 186 ₽ чистыми) закрывают ~1,8 месяца расходов.

### Эквайринг — Robokassa

- **СБП:** 3,9% — основной рекомендуемый способ (Robokassa не разделяет по методу для самозанятых).
- **Карты:** 3,9% — одинаково.
- Вывод: 1–3 рабочих дня.
- Подключение для самозанятых: да.
- Чеки: автоматически через РобоЧеки СМЗ (интеграция с «Мой налог»).
