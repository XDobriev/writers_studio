# §40 Быстрые действия на дашборде — Design Spec

**Дата:** 2026-06-02  
**Статус:** Approved

---

## Цель

Добавить 4 карточки быстрых действий на дашборд книги. Каждая карточка создаёт новую сущность — это не навигация ради навигации, а создание контента в один клик прямо с дашборда.

## Расположение

Между сеткой стат-карточек и прогресс-баром цели. Секция предваряется лейблом «Быстрые действия» (mono uppercase, `var(--ink-4)`).

## Карточки

| Заголовок | Иконка | Подпись | Маршрут |
|---|---|---|---|
| Новая глава | `tree` | Структура → | `/books/:id/outline?create=true` |
| Новый персонаж | `char` | Картотека → | `/books/:id/characters?create=true` |
| Новая заметка | `note` | Заметки → | `/books/:id/notes?create=true` |
| Новое событие | `clock` | Хронология → | `/books/:id/timeline?create=true` |

## Визуальный дизайн

Карточки имеют тот же DNA, что и стат-карточки:

```
background: var(--surface)
border: 1px solid var(--border-soft)
border-radius: 12px
padding: 16px
```

Содержимое карточки (flex column, gap 10px):
1. Иконка-кружок: 32×32px, `oklch(0.63 0.16 30 / 0.13)` фон, `border-radius: 8px`, иконка 15×15px цвета `var(--accent)`, `stroke-width: 1.75`
2. Заголовок: `font: 500 12.5px var(--font-ui)`, `var(--ink)`
3. Подпись-назначение: `font: 400 10.5px var(--font-mono)`, `letter-spacing: 0.06em`, `var(--ink-4)`, `margin-top: auto`

Hover-состояние: `background → var(--surface-2)`, `border-color → var(--border)`, переход `0.12s`.

## Сетка

```
grid-template-columns: repeat(4, 1fr)   // desktop
grid-template-columns: repeat(2, 1fr)   // mobile < 768px (isMobile)
gap: 12px
```

## Поведение при клике

Каждая карточка — `<Link to={navTo('/outline?create=true')}>` (React Router). Целевая страница читает `?create=true` из `useSearchParams()` и при монтировании открывает форму создания, затем очищает параметр из URL (`replace: true`).

## Изменения в существующих страницах

Каждая из 4 страниц должна добавить хук:

```tsx
const [searchParams, setSearchParams] = useSearchParams();

useEffect(() => {
  if (searchParams.get('create') === 'true') {
    openCreateForm();          // существующий обработчик
    setSearchParams({}, { replace: true });
  }
}, []);
```

Если форма создания уже открывается через кнопку «+ Добавить» на странице — это тот же обработчик. Никакой новой логики создания не нужно.

## Страницы-получатели

- **`/outline`** (`Outline.tsx`) — открыть модалку «Новая глава»
- **`/characters`** (`Characters.tsx`) — открыть модалку/форму «Новый персонаж»
- **`/notes`** (`Notes.tsx`) — открыть модалку «Новая заметка»
- **`/timeline`** (`Timeline.tsx`) — открыть модалку «Новое событие»

Точные названия компонентов и обработчиков уточняются при реализации по файлам.

## Не входит в scope

- Анимация появления карточек
- Аналитика кликов
- Онбординг-подсказки
- Изменение карточек в зависимости от состояния книги (нет глав → выделить «Новая глава»)
