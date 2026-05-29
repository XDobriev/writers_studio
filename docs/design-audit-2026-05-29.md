# Design System Audit — 2026-05-29

## Резюме

«Авторская студия» обладает зрелой и продуманной дизайн-системой: теплохромная палитра oklch, строгое разделение трёх шрифтовых юрисдикций, плоская система глубины без теней — всё это реализовано последовательно и с пониманием продукта. Главные риски не в токенах, а в точках их нарушения: серифный шрифт протекает в sidebar (`.sb-book-title`), bubble-меню использует `backdrop-filter` (нарушение ban на glassmorphism как дефолт), в `Dashboard.tsx` три stat-карточки с серифным значением 32px нарушают правило «serif только на бумаге». Системных проблем доступности нет, но инструментарий пока работает в режиме «keyboard support, not keyboard-first»: отсутствует `@media (prefers-reduced-motion)`, несколько модальных окон не захватывают фокус полностью, а `.rp-tab` — обычные `<button>` без `type="button"`. P0-блокеров нет; P1-проблем 4; P2/P3 — суммарно 13.

---

## Critique — Эвристическая оценка UX

### Таблица оценок

| # | Эвристика | Балл | Ключевая проблема |
|---|-----------|------|-------------------|
| 1 | Видимость состояния системы | 3 | Save-статус хорош; нет скелетонов при загрузке данных — только «Загрузка…» текст |
| 2 | Соответствие реальному миру | 4 | Терминология («Черновик», «В работе», «Готово») органична писательской культуре |
| 3 | Пользовательский контроль и свобода | 3 | Undo/redo в редакторе есть; нет отмены удаления главы (только confirm-диалог) |
| 4 | Согласованность и стандарты | 2 | «Редактировать книгу» — разный заголовок и разные модальные стили в `Home.tsx` vs `Dashboard.tsx`; кнопка выхода в Home — icon-only без `.btn`, в Sidebar — через дропдаун |
| 5 | Предотвращение ошибок | 3 | Confirm перед удалением главы с текстом — хорошо; нет предупреждения при уходе со страницы с несохранёнными изменениями |
| 6 | Узнавание вместо припоминания | 3 | Иконки без подписей в RailNav (title-атрибут, но нет label); ModeSegment — 4 иконки без текста на мобиле |
| 7 | Гибкость и эффективность использования | 3 | Хорошие горячие клавиши (Ctrl+S, Ctrl+Shift+[/], Ctrl+Shift+F/N); нет глобального поиска по главам/персонажам |
| 8 | Эстетический и минималистичный дизайн | 3 | Редактор и sidebar чисты; Dashboard stat-карточки с serif-значениями 32px — конфликт с принципом «serif только на бумаге» |
| 9 | Восстановление после ошибок | 2 | Ошибки сохранения главы — метка в StatusBar «Ошибка сохранения»; нет retry-действия; форм-ошибки в Auth подробны, но без inline-подсветки поля |
| 10 | Помощь и документация | 1 | Нет встроенной справки; подсказки только через `title`-атрибуты; настройки содержат список горячих клавиш — хорошо, но этого недостаточно |
| **Итого** | | **27/40** | **Acceptable (нужны улучшения)** |

### Детальные нарушения по эвристикам

#### Э4 — Согласованность

**[P2] Два разных модальных паттерна «Редактировать книгу»**
- `Home.tsx:422` — `background: var(--bg-deep)`, `borderRadius: 14`, `padding: 24px 28px`
- `Dashboard.tsx:524` — `background: var(--surface)`, `borderRadius: 16`, `padding: 28px 32px`
- Один и тот же сценарий редактирования книги — два разных визуальных решения. Пользователь может усомниться, что это одна функция.

**[P2] Выход из аккаунта — два несвязанных паттерна**
- `Home.tsx:273` — icon-only кнопка без `.btn`, с `onMouseEnter`/`onMouseLeave` JS-хуками для hover
- `Chrome.tsx:117` — пункт дропдауна `.sb-dropdown-item--danger`
- Одно действие, два UI-языка; нет единого компонента `UserMenu`.

**[P2] `Dashboard.tsx:527` — заголовок модального окна «Редактировать книгу» использует `font-ui` (16px sans), а `Home.tsx:426` — `font-serif` (20px)**
- Serif-заголовок в Home, sans в Dashboard — нарушение типографической согласованности.

#### Э9 — Восстановление после ошибок

**[P2] Ошибка сохранения главы не имеет actionable-выхода**
- `EditorHybrid.tsx:62-66` + `StatusBar.tsx:35` — при `saveState === 'error'` показывает «Ошибка сохранения», но нет кнопки «Повторить» рядом.

**[P2] Форм-ошибки в Auth — блок внизу формы, поле не подсвечивается**
- `Auth.tsx:406` — красный блок под кнопкой, но поле `input` не получает класс `.input--err` при ошибке email/пароля.

#### Э10 — Помощь

**[P3] Нет onboarding-тултипов для ключевых функций**
- Welcome-диалог (`Home.tsx:546`) — перечисляет функции, но не объясняет режимы редактора (studio/left/right/page), горячие клавиши.

---

## Audit — Технические проверки

### Таблица оценок

| # | Измерение | Балл | Ключевая находка |
|---|-----------|------|------------------|
| 1 | Accessibility | 2 | Отсутствие `prefers-reduced-motion`; неполный focus-trap в ряде модалов |
| 2 | Performance | 3 | Lazy loading страниц; React Query с персистентностью; нет will-change на анимациях |
| 3 | Responsive | 3 | Breakpoint 768px обрабатывается последовательно; `.tb-btn` получает min 44px на мобиле |
| 4 | Theming | 3 | Основная система токенов работает; несколько хардкодных hex-цветов |
| 5 | Anti-Patterns | 3 | Одно нарушение (bubble-меню с glassmorphism); один нарушенный ban (serif в sidebar); stat-карты Dashboard — граница hero-метрик |
| **Итого** | | **14/20** | **Good (адресуй слабые места)** |

---

### Accessibility

**[P1] Отсутствует `@media (prefers-reduced-motion)`**
- `design-system.css:107-110`, `design-system.css:303-306` — `@keyframes bubble-in`, `toast-in`, `slide-down`, `spin` объявлены без обёртки `prefers-reduced-motion: no-preference`.
- WCAG 2.3.3 (AAA) и 2.1 SC 2.3.3. Пользователи с вестибулярными нарушениями получают анимации без возможности их отключить.
- Проектная дизайн-система явно обязывает: «Wrap all `@keyframes` usage in `@media (not prefers-reduced-motion)`» (docs/design.md §8).

**[P1] Неполный focus-trap в модальных окнах `Home.tsx` и `Dashboard.tsx`**
- `Home.tsx:554` — `editBook`-модальное окно, `showUpgrade`, `showCreate` — нет `role="dialog"`, нет `aria-modal`, нет управления фокусом при открытии/закрытии.
- `Dashboard.tsx:519` — `editOpen`-модальное — нет `role="dialog"`, `aria-modal`.
- `SettingsModal.tsx:103` — реализован правильно: `role="dialog" aria-modal="true" aria-label="Настройки"` + Tab-trap.
- Непоследовательность: один модал правильный, три — нет. WCAG 4.1.2.

**[P2] `.rp-tab` — `<button>` без `type="button"`**
- `RightPanel.tsx:95, 102` — кнопки вкладок «Заметки» и «Версии» не имеют `type="button"`. Внутри формы (если форма добавится) они вызовут submit.

**[P2] Иконочные кнопки в `RailNav` имеют только `title`, без `aria-label`**
- `Chrome.tsx:471-480` — ссылки навигации имеют `title={label}`, но не `aria-label`. `title` не читается screen-reader'ами при навигации по Tab.

**[P2] Модальное окно удаления книги (`ConfirmDialog.tsx`) — нет `role="alertdialog"` и нет фокуса на кнопку при открытии**
- Деструктивные диалоги по ARIA-практике должны иметь `role="alertdialog"` и фокус сразу на «безопасную» кнопку (Отмена).

**[P3] Кнопка «Удалить главу» в StatusMenu (Chrome.tsx:342) — нет `aria-label`, текст «Удалить главу» есть, но это не кнопка с явным role**

**[P3] `<select>` в `RightPanel.tsx:139` не имеет связанного `<label>`**
- Выбор типа заметки (Идея/Вопрос/TODO/Важно) — нет `<label htmlFor=...>`.

---

### Responsive

**[P2] Модальные окна `Home.tsx` не имеют мобильной адаптации**
- `Home.tsx:418, 500, 606` — `width: 460/480px` без `maxWidth: 'calc(100vw - 32px)'` на части из них. Сравни: `showUpgrade` (строка 506) правильно: `maxWidth: 'calc(100vw - 32px)'`; но `editBook` (строка 423) — `width: 460` без `maxWidth`.

**[P3] `.as-app` grid — `grid-template-columns: 260px 1fr 320px` без media-query**
- `design-system.css:142-143` — колонки заданы фиксированно. На viewport < 900px sidebar 260px + правая панель 320px оставляют редактору менее 320px. На практике это решается через JavaScript (`isMobile`), но CSS не защищает самостоятельно.

---

### CSS / Токены

**[P1] Нарушение «Serif Jurisdiction Rule» — `.sb-book-title` использует `var(--font-serif)` в sidebar**
- `design-system.css:163-165` — `.sb-book-title { font-family: var(--font-serif) }`.
- Дизайн-система явно запрещает: «Source Serif 4 lives on the paper surface and nowhere else. It is forbidden in toolbar buttons, sidebar section headers, status bars, or panel labels.»
- Заголовок книги в sidebar — часть chrome, а не рукописи. Должен быть `var(--font-ui)`.

**[P2] Stat-карточки `Dashboard.tsx:317` — серифное значение 32px нарушает «Serif Jurisdiction Rule»**
- `font: '600 32px var(--font-serif)'` используется для числовых значений дэшборда («слов написано», «глав» и т.д.).
- По системе числа = IBM Plex Mono («The Mono Counter Rule»). Serif — только на бумаге.
- Дополнительно: карточки 5 штук с одинаковой структурой тяготеют к hero-metric template (Absolute Ban).

**[P2] Два hardcoded hex-цвета в `design-system.css`**
- Строка 326: `color: #fff` (в `.bubble-btn--on`) — должен быть `oklch(0.98 0 0)` согласно кнопочной системе
- Строка 340: `border: 2px solid #fff` — то же нарушение Warm Neutral Doctrine

**[P2] `VersionModal.tsx:228` — декоративная `border-left: 3px solid` — нарушение Absolute Ban**
- `borderLeft: '3px solid oklch(0.55 0.2 25)'` на карточке diff — цветная полоска слева на карточке.
- Дизайн-система: «Don't use `border-left` as a coloured accent stripe on cards or list items.»
- Единственное разрешённое исключение — Margin Note категориальный индикатор (`.mn::before`).

**[P2] `Home.tsx:47-50` — обложки книг используют `linear-gradient` c хардкодным шестнадцатеричным цветом и смешением с `oklch`**
- `linear-gradient(160deg, ${c}, oklch(0.20 0.02 50))` — смешение color space HEX + oklch без явного указания `in oklch`.

**[P3] `spell-popup` в `design-system.css:429-448` — использует нетипизированные цвета не из системы**
- `oklch(0.18 0.01 270)` (синеватый), `oklch(0.30 0.01 270)`, `oklch(0.90 0.01 270)` — hue 270 (фиолетовый), не соответствует палитре oak (hue 50) и ink (hue 70-80). Этот компонент визуально выпадает из системы.

**[P3] Инлайновые стили в `Chrome.tsx:93, 209, 227, 234, 242, 288-296`**
- Кнопки шаринга книги (`handleShare`, `handleCopy`, `handleDisable`) полностью стилизованы инлайново с повторяющимися паттернами: `font: '500 11px var(--font-ui)', background: 'var(--bg-deep)', border: '1px solid var(--border-soft)', borderRadius: 5`.
- По правилу CLAUDE.md: 3+ повторения → CSS-класс. Здесь 3 кнопки с почти идентичными стилями — нужен общий класс.

---

### Absolute Bans (нарушения запретов)

| Нарушение | Файл:строка | Severity |
|-----------|-------------|----------|
| Glassmorphism как дефолт: `bubble-menu` использует `backdrop-filter: blur(20px) saturate(1.4)` | `design-system.css:311` | P2 |
| `border-left` как декоративная полоска (VersionModal diff-карточка) | `VersionModal.tsx:228` | P2 |
| Serif в Chrome — `.sb-book-title` | `design-system.css:163` | P1 |
| Stat-карточки Dashboard близки к hero-metric template (5 одинаковых карточек с крупным serif-значением) | `Dashboard.tsx:313-320` | P2 |

**Вердикт Anti-Patterns:** Не AI-slop. Система самобытная, узнаваемо «атмосферная», не generic. Нарушений абсолютных банов — 4, все точечные и поправимые.

---

## Соответствие дизайн-системы себе

### Расхождения между `docs/design.md` и реальным кодом

| Правило из design.md | Реализация | Файл:строка |
|---------------------|-----------|-------------|
| «Source Serif 4 forbidden in sidebar» | `.sb-book-title { font-family: var(--font-serif) }` | `design-system.css:164` |
| «Mono Counter Rule — все числа в IBM Plex Mono» | Stat-карточки Dashboard: `font: '600 32px var(--font-serif)'` | `Dashboard.tsx:317` |
| «Shadowless Default Rule — box-shadow только для floating элементов» | `note-card:hover` добавляет `box-shadow: 0 2px 8px oklch(...)` | `design-system.css:710-711` |
| «Reduced motion rule — all `@keyframes` в `prefers-reduced-motion`» | Все @keyframes объявлены глобально без обёртки | `design-system.css:107-116`, `303-316` |
| «Don't `border-left` stripe on cards» | Diff-карточки VersionModal используют `borderLeft` | `VersionModal.tsx:228` |
| «Don't use pure achromatic (#fff, oklch(0.5 0 0))» | `.bubble-btn--on { color: #fff }`, `border: 2px solid #fff` | `design-system.css:326, 340` |
| «`spell-popup` hue 270» — нейтралы должны быть hue 50-85 | Spell popup использует hue 270 (cold violet) | `design-system.css:429-450` |
| Button height 30px spec | `.btn { height: 30px }` — соответствует | ✓ |
| Input height 38px spec | `.input { height: 38px }` — соответствует | ✓ |
| Chip height 22px spec | `.chip { height: 22px }` — соответствует | ✓ |
| Toolbar button 28px height | `.tb-btn { height: 28px }` — соответствует | ✓ |
| Скроллбар `.sheet-wrap` custom webkit 5px | Реализован точно по спецификации | ✓ |
| Скроллбар `.tb` — hidden | `scrollbar-width: none` + webkit — соответствует | ✓ |
| Скроллбар `.sb-body` — thin | `scrollbar-width: thin; scrollbar-color: var(--surface-3) transparent` — соответствует | ✓ |
| Bubble-menu shadow spec | `0 12px 32px oklch(0% 0 0 / 0.5), inset` — точно соответствует | ✓ |
| Motion timing `0.13s cubic-bezier(.22,.68,0,1.2)` для bubble-in | `animation: bubble-in 0.13s cubic-bezier(.22,.68,0,1.2)` — соответствует | ✓ |

**Вывод:** Из 16 проверенных правил 10 соответствуют полностью, 6 нарушены. Нарушения концентрируются в двух темах: шрифтовые юрисдикции (serif протекает в chrome) и motion/accessibility (prefers-reduced-motion отсутствует).

---

## Приоритизированный список рекомендаций

### P1 — Критические (исправить до публичного запуска)

**P1-1. Обернуть все `@keyframes` в `prefers-reduced-motion`**
- Что: добавить `@media (prefers-reduced-motion: no-preference) { ... }` вокруг `bubble-in`, `toast-in`, `slide-down`, `spin`, `blink`.
- Где: `design-system.css:107-116`, `303-316`; `Landing.tsx:33` (локальный `@keyframes blink`).
- Почему: нарушение WCAG 2.3.3; явно задокументировано в design.md §8. Пользователи с вестибулярными нарушениями.

**P1-2. Исправить нарушение Serif Jurisdiction Rule в `.sb-book-title`**
- Что: заменить `font-family: var(--font-serif)` на `var(--font-ui)` в `.sb-book-title`, скорректировать размер (16px → 14px) и при необходимости вес (500 → 500 sans нормально).
- Где: `design-system.css:163-168`.
- Почему: нарушает ключевое правило «serif только на бумаге»; разрушает смысловой контраст между studio и manuscript.

**P1-3. Добавить `role="dialog"` + `aria-modal="true"` + focus-management к модальным окнам в `Home.tsx` и `Dashboard.tsx`**
- Что: по образцу `SettingsModal.tsx:103-117` — добавить `role="dialog" aria-modal="true"`, при открытии фокусировать первый интерактивный элемент, при закрытии возвращать фокус на trigger-кнопку.
- Где: `Home.tsx:418` (editBook), `Home.tsx:500` (showUpgrade), `Home.tsx:606` (showCreate), `Dashboard.tsx:519` (editOpen).
- Почему: WCAG 4.1.2; screen-reader пользователи не понимают, что открылся модал.

**P1-4. Исправить числовые значения stat-карточек Dashboard на `var(--font-mono)`**
- Что: заменить `font: '600 32px var(--font-serif)'` на `font: '600 32px var(--font-mono)'` (или `var(--font-ui)`).
- Где: `Dashboard.tsx:317`.
- Почему: «Mono Counter Rule» — числа = mono. Кроме того, serif-значения создают visual leakage из manuscript в dashboard.

---

### P2 — Важные (исправить в ближайшем спринте)

**P2-1. Устранить дублирование паттерна «Редактировать книгу»**
- Что: унифицировать два модала (Home и Dashboard) в единый компонент `BookEditModal`. Выбрать один set стилей: `var(--bg-deep)` + borderRadius 14 (вариант Home — ближе к системе, т.к. bg-deep корректен для модалов).
- Где: `Home.tsx:416-497` и `Dashboard.tsx:518-583`.

**P2-2. Заменить `border-left` в VersionModal**
- Что: убрать `borderLeft: '3px solid oklch(0.55 0.2 25)'`, заменить на разность фона (например `background: oklch(0.65 0.18 25 / 0.10)` без полоски) или точечный бейдж.
- Где: `VersionModal.tsx:228`.

**P2-3. Исправить hardcoded `#fff` в bubble-menu на системный токен**
- Что: `.bubble-btn--on { color: #fff }` → `color: oklch(0.98 0 0)`; `border: 2px solid #fff` → `border: 2px solid oklch(0.98 0 0)`.
- Где: `design-system.css:326, 340`.

**P2-4. Добавить `aria-label` к навигационным ссылкам в `RailNav`**
- Что: к каждой `<Link>` в RailNav добавить `aria-label={label}` вместо/вместе с `title`.
- Где: `Chrome.tsx:471-480`.

**P2-5. Перевести `.rp-tab` кнопки на `type="button"`**
- Что: добавить `type="button"` к кнопкам «Заметки» и «Версии» в `RightPanel`.
- Где: `RightPanel.tsx:94, 101`.

**P2-6. Адаптировать `editBook`-модал в `Home.tsx` для мобильных**
- Что: добавить `maxWidth: 'calc(100vw - 32px)'` к контейнеру `editBook`-модала.
- Где: `Home.tsx:423`.

**P2-7. Перенести повторяющиеся инлайн-стили share-кнопок в CSS-класс**
- Что: создать класс `.sb-share-btn` с общими свойствами трёх кнопок шаринга.
- Где: `Chrome.tsx:226-244`.

**P2-8. Добавить кнопку «Повторить» при ошибке сохранения**
- Что: в `StatusBar.tsx` при `statusLabel` содержащем «Ошибка» — показать кнопку-ссылку «Повторить» рядом с сообщением.
- Где: `StatusBar.tsx:35`; логика retry в `EditorHybrid.tsx` уже есть через `onSave`.

---

### P3 — Улучшения (при наличии времени)

**P3-1. Перекрасить `spell-popup` в системную палитру**
- Что: заменить hue 270 на oak-нейтралы (hue 50). `oklch(0.18 0.01 270)` → `var(--bg-deep)`, `oklch(0.90 0.01 270)` → `var(--ink)`, `oklch(0.30 0.01 270)` → `var(--surface-2)`.
- Где: `design-system.css:429-450`.

**P3-2. Добавить `<label>` к select в форме заметки**
- Что: добавить `<label className="label" htmlFor="note-kind">Тип заметки</label>` и `id="note-kind"` к select.
- Где: `RightPanel.tsx:138-145`.

**P3-3. Заменить `box-shadow` при hover note-card на luminance-change**
- Что: убрать `box-shadow: 0 2px 8px ...` из `.note-card:hover`, оставить только `border-color: var(--border-strong)` — это соответствует «Shadowless Default Rule».
- Где: `design-system.css:707-711`.

**P3-4. Добавить `aria-label` к select `type="button"` кнопкам в форме заметки**
- Что: добавить `aria-label` к кнопкам редактирования/удаления заметки.
- Где: `RightPanel.tsx:221-232`.

**P3-5. Унифицировать кнопку выхода из аккаунта**
- Что: убрать icon-only кнопку выхода из `Home.tsx:273` (или добавить `aria-label="Выйти"`), унифицировать со стилем в Sidebar.
- Где: `Home.tsx:273-290`.

**P3-6. Добавить action-hint для ошибок Auth на уровне поля**
- Что: при ошибке `Invalid login credentials` — добавлять класс `.input--err` к полю email и password.
- Где: `Auth.tsx:117-119` + JSX полей.

---

## Сводная таблица

| ID | Severity | Категория | Описание |
|----|----------|-----------|----------|
| P1-1 | P1 | Accessibility / Motion | Отсутствует `prefers-reduced-motion` для всех `@keyframes` |
| P1-2 | P1 | Theming / Typography | Serif в `.sb-book-title` — нарушение Serif Jurisdiction Rule |
| P1-3 | P1 | Accessibility | Нет `role="dialog"` + focus-trap в модалах Home и Dashboard |
| P1-4 | P1 | Theming / Typography | Stat-карточки Dashboard: serif вместо mono для числовых значений |
| P2-1 | P2 | Consistency | Два разных паттерна «Редактировать книгу» |
| P2-2 | P2 | Anti-Pattern / Theming | `border-left` stripe в VersionModal — Absolute Ban |
| P2-3 | P2 | Theming | Hardcoded `#fff` в bubble-menu |
| P2-4 | P2 | Accessibility | Нет `aria-label` у ссылок RailNav |
| P2-5 | P2 | Accessibility | `.rp-tab` без `type="button"` |
| P2-6 | P2 | Responsive | `editBook`-модал без mobile maxWidth |
| P2-7 | P2 | Consistency / CSS | Дублирующиеся инлайн-стили share-кнопок |
| P2-8 | P2 | Error Recovery | Нет retry при ошибке сохранения |
| P3-1 | P3 | Theming | `spell-popup` — системно-чуждые цвета |
| P3-2 | P3 | Accessibility | `<select>` без `<label>` в форме заметки |
| P3-3 | P3 | Anti-Pattern | `box-shadow` при hover на note-card |
| P3-4 | P3 | Accessibility | Кнопки редактирования/удаления заметок без `aria-label` |
| P3-5 | P3 | Consistency | Две несвязанных версии «Выйти» |
| P3-6 | P3 | Error Recovery | Ошибка Auth — нет inline-подсветки поля |
