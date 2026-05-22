# Спецификация: многострочная лента хронологии

**Дата:** 2026-05-22  
**Маршрут:** `/books/:id/timeline` → режим «Лента»  
**Файл:** `src/pages/Timeline.tsx` — только компонент `TimelineLane`

---

## Контекст

Горизонтальная лента (`TimelineLane`) уже реализована. При 20+ событиях она уходит вправо за экран — только `overflow-x: auto`. Задача — убрать горизонтальный скролл, автоматически переносить события на следующую строку.

---

## Решение: адаптивная многострочная лента

### Подсчёт строк

```ts
const NODE_W = 168; // ширина узла в px (константа существует)
// eventsPerRow пересчитывается при ресайзе контейнера:
const eventsPerRow = Math.max(3, Math.floor(containerWidth / NODE_W));
// строки — только визуальная группировка плоского массива:
const rows = chunk(events, eventsPerRow); // [[ev0..ev5], [ev6..ev11], ...]
```

Строки заполняются последовательно: строка 2 начинается только после заполнения строки 1. Это прямое следствие `chunk` по `eventsPerRow`.

### ResizeObserver

```ts
const containerRef = useRef<HTMLDivElement>(null);
const [containerWidth, setContainerWidth] = useState(0);

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const ro = new ResizeObserver(([entry]) => {
    setContainerWidth(entry.contentRect.width);
  });
  ro.observe(el);
  return () => ro.disconnect();
}, []);
```

`containerRef` вешается на внешний `div` лены. Начальное значение `0` означает «ещё не измерено» — лента не рендерится до первого измерения (показывает спиннер или `null`).

### DnD: rectSortingStrategy

Заменяем `horizontalListSortingStrategy` → `rectSortingStrategy`. Один `DndContext` + один `SortableContext` на весь плоский массив событий. dnd-kit определяет collision по bounding box, поэтому drag между строками работает без дополнительного кода.

`onDragEnd` и `reorderTimelineEvents` не меняются — они работают с плоским массивом по позиции.

### Чередование карточек выше/ниже оси

Карточки чередуются по **глобальному** индексу (`event.position % 2`), а не по позиции внутри строки. Это гарантирует: на стыке строки N и строки N+1 чередование продолжается без разрывов.

---

## Структура рендеринга

```
<div ref={containerRef} style={{overflowX:'hidden', overflowY:'auto'}}>
  {rows.map((rowEvents, rowIndex) => (
    <div key={rowIndex}>               {/* строка */}
      <RowHeader index={rowIndex} />   {/* «строка N» + пунктирный разделитель */}
      <div style={{position:'relative', height: LANE_NODE_H}}>
        <AxisLine />
        {rowEvents.map(ev => (
          <SortableNode key={ev.id} ... />  {/* без изменений */}
        ))}
        <AddButton />                  {/* только в последней строке */}
      </div>
      {rowIndex < rows.length - 1 && <RowContinuation />}  {/* «↓ строка N+1» */}
    </div>
  ))}
</div>
```

### Новые субкомпоненты (только внутри TimelineLane)

| Компонент | Что делает |
|---|---|
| `RowHeader` | Метка `строка N` + пунктирная линия-разделитель справа |
| `RowContinuation` | Пунктирная линия + `↓ строка N+1` справа — показывает, что лента продолжается |

Оба — простые `div`-компоненты без состояния, ~5 строк каждый.

### AddButton

Кнопка «+» рендерится один раз — в конце **последней** строки, как в текущей реализации. Позиция по оси Y: `LANE_AXIS_Y - 17` (совпадает с текущим кодом).

---

## Визуальный дизайн

Полностью соответствует дизайн-коду проекта:

- Все цвета — через CSS-переменные: `--bg`, `--surface`, `--surface-2`, `--border-soft`, `--ink`, `--ink-4`, `--ink-3`
- `TYPE_COLORS` — без изменений: `--accent` / `--info` / `--ok` / `--ink-3`
- Шрифты: `--font-ui`, `--font-mono` — как в текущих карточках
- Радиусы: `--r-2` (8px) на карточках
- Метка строки: 10px `--font-mono`, цвет `--ink-4`
- Разделитель строк: `repeating-linear-gradient` с `--border-soft` — пунктир
- Отступ между строками: 8px (row-cont) + 16px (row-header) = ~32px суммарно

---

## Что не меняется

| Компонент / функция | Статус |
|---|---|
| `SortableNode` | Без изменений |
| `EventCard` | Без изменений |
| `EventDetailPanel` | Без изменений |
| `onDragEnd`, `reorderTimelineEvents` | Без изменений |
| Фильтры, sidebar | Без изменений |
| `ConfirmDialog` | Без изменений |
| Режим «Список» | Без изменений |
| Логика мобильного (isMobile) | Без изменений |

---

## Что меняется в `TimelineLane`

1. Добавить `containerRef` + `ResizeObserver` → `containerWidth` state
2. Вычислять `eventsPerRow` и `rows` из `containerWidth`
3. Заменить `horizontalListSortingStrategy` → `rectSortingStrategy`
4. Заменить один `div` со всеми узлами → `rows.map(...)` с `RowHeader` и `RowContinuation`
5. Изменить `overflow` контейнера: `overflowX: 'hidden'`, `overflowY: 'auto'`
6. Убрать `minWidth: 'max-content'` с внутреннего контейнера

---

## Граничные случаи

| Ситуация | Поведение |
|---|---|
| `containerWidth === 0` (до первого ResizeObserver) | Не рендерить узлы, показывать пустой контейнер |
| `eventsPerRow >= events.length` | Одна строка — выглядит как текущая лента |
| Фильтр активен (DnD отключён) | `useSortable({ disabled: true })` работает как раньше, строки всё равно рендерятся |
| 0 событий в режиме lane | `emptyState` — без изменений (обрабатывается до `TimelineLane`) |
| Очень широкий экран (2560px+) | `eventsPerRow` растёт без ограничений — одна длинная строка (задумано) |
