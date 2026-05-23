# §17 — Графическая карта мира: дизайн-спек

**Дата:** 2026-05-23  
**Статус:** Утверждён, готов к реализации  
**Маршрут:** `/books/:id/map`

---

## 1. Цель

Переосмыслить раздел «Карта» как полноценный картографический инструмент для фэнтези-автора. Текущая реализация показывает локации списком и не раскрывает идею. После §17 автор может:

- Визуально строить карту мира: размещать локации на холсте drag & drop
- Рисовать связи между локациями (дороги, реки, тропы, границы)
- Загружать собственное изображение карты как фон
- Редактировать детали локации прямо на холсте, не покидая карту
- Работать на мобильном устройстве без потери функциональности

---

## 2. Принятые решения

| Вопрос | Решение | Обоснование |
|---|---|---|
| Layout | Canvas-first, тулбар сверху | Максимум места для карты |
| Создание связей | Режим «Связь» в тулбаре (клик→клик) | Нет конфликта с drag пинов |
| Реализация | Расширить SVG + React (без новых зависимостей) | Достаточно для 10-100 локаций, единый стиль |
| Popup на desktop | Floating inline над холстом | Прямое редактирование без переключения режима |
| Popup на mobile | Bottom sheet | Не перекрывает карту полностью |
| Textarea | Auto-resize + max-height 160px, потом скролл | Адаптируется под длину лора |
| Select стрелка | `appearance:none` + SVG chevron из `select.input` | Соответствует дизайн-системе |
| Scrollbar | `.as ::-webkit-scrollbar` (стандарт проекта) | Консистентность |

---

## 3. Схема БД

### 3.1. Миграция `0015_map_connections.sql`

```sql
-- Фоновое изображение карты (одно на книгу)
alter table public.books
  add column if not exists map_bg_url text;

-- Связи между локациями
create table if not exists public.location_connections (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references public.books(id)     on delete cascade,
  user_id    uuid not null references auth.users(id)       on delete cascade,
  from_id    uuid not null references public.locations(id) on delete cascade,
  to_id      uuid not null references public.locations(id) on delete cascade,
  label      text not null default '',
  style      text not null default 'road'
             check (style in ('road', 'river', 'path', 'border')),
  created_at timestamptz not null default now()
);

create index if not exists lconn_book_idx on public.location_connections(book_id);

alter table public.location_connections enable row level security;

create policy "lconn select own" on public.location_connections
  for select using (auth.uid() = user_id);
create policy "lconn insert own" on public.location_connections
  for insert with check (auth.uid() = user_id);
create policy "lconn update own" on public.location_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "lconn delete own" on public.location_connections
  for delete using (auth.uid() = user_id);
```

### 3.2. Supabase Storage

Бакет **`map-backgrounds`** (публичный read, пользовательский write).  
Путь объекта: `{user_id}/{book_id}/background`  
При замене фона — перезаписывать тот же путь (upsert).

Создать бакет через `mcp__supabase__execute_sql` или UI перед реализацией.

### 3.3. Визуальный стиль связей

| `style` | Цвет | Stroke | Dash |
|---|---|---|---|
| `road` | `--accent-2` (gold) | 2px | `6 4` |
| `river` | `oklch(0.65 0.10 200)` (teal) | 2.5px | `0` (solid) |
| `path` | `var(--ink-4)` | 1.5px | `4 5` |
| `border` | `var(--ink-3)` | 2px | `8 3` |

---

## 4. Файлы: что меняется

| Файл | Изменение |
|---|---|
| `src/lib/connections.ts` | **Новый.** CRUD для `location_connections` |
| `src/lib/queries.ts` | Добавить `useConnections(bookId)` |
| `src/components/WorldMap.tsx` | **Полная переработка** (см. §5) |
| `src/pages/Map.tsx` | Обновить тулбар, убрать toggle Карта/Список, передать connections в WorldMap |
| `supabase/migrations/0015_map_connections.sql` | Новая миграция |
| `docs/features/maps.md` | Обновить после реализации |

---

## 5. Компонент `WorldMap.tsx` — детальный дизайн

### 5.1. Состояние

```ts
type MapMode = 'place' | 'connect' | 'pan';

// Добавить к существующему:
const [mode, setMode] = useState<MapMode>('place');
const [connectFrom, setConnectFrom] = useState<string | null>(null); // id первой локации в режиме connect
// bgUrl приходит через props из book.map_bg_url — локальный state не нужен
```

### 5.2. Props

```ts
interface WorldMapProps {
  locations: Location[];
  connections: LocationConnection[];
  bgUrl: string | null;
  onUpdate: (id: string, patch: LocationPatch) => void;
  onCreate: (x: number, y: number) => void;
  onCreateConnection: (fromId: string, toId: string) => void;
  onDeleteConnection: (id: string) => void;
  onUpdateConnection: (id: string, patch: { label?: string; style?: string }) => void;
  onBgUpload: (file: File) => void;
}
```

### 5.3. Режимы (тулбар)

```
[📍 Место] [↔ Связь] [✋ Перемещение]    [🖼 Загрузить фон]  [N локаций]
```

- **Место** (default): клик на пустой холст → `onCreate(x, y)`. Клик на пин → открыть popup.
- **Связь**: клик на пин A → `connectFrom = A.id` (подсветка gold). Клик на пин B → `onCreateConnection(A, B)`, сброс. Клик на пустое → сброс. `Esc` → сброс.
- **Перемещение**: drag по холсту = pan, drag пина = переместить. Нет создания/выбора.

На **mobile** (`isMobile`): тулбар показывает только иконки (`📍 ↔ ✋ 🖼`), без текста.

### 5.4. Popup редактирования (desktop)

Появляется рядом с выбранным пином. Позиционирование: `left = clamp(pinX + 20, 0, containerW - 250)`, `top = clamp(pinY - 60, 8, containerH - 300)`.

Поля (все с debounce 500ms → `onUpdate`):
1. **Название** — `<input>` / font-serif 14px bold
2. **Тип** — `<select class="type-select">` с `appearance:none` + SVG chevron
3. **Роль** — `<input>` / font-mono 11px, underline style
4. **Описание** — `<textarea>` auto-resize: `height=auto → scrollHeight`, max-height 160px

Footer: «Снять с карты» | «Удалить»

Закрытие: `×`, клик на холст, `Esc`.

### 5.5. Bottom sheet (mobile)

Срабатывает вместо popup при `isMobile`. Карта уменьшается до ~160px высоты, шторка выдвигается снизу. Те же поля что в popup. Handle сверху (свайп вниз = закрыть через `onPointerDown` на handle).

### 5.6. Связи на холсте

SVG `<line>` между центрами пинов. Рендеринг: сначала все `<line>`, потом все пины (чтобы пины были поверх линий).

Клик на линию: поверх каждой видимой `<line>` рендерить невидимую `<line>` с `stroke-width="16" stroke="transparent" pointer-events="stroke"` — расширенная зона клика. По клику — выбор связи → mini-popup с полем `label`, select `style`, кнопкой удаления.

### 5.7. Фоновое изображение

```svg
<image href={bgUrl} x="0" y="0" width={CW} height={CH}
       preserveAspectRatio="xMidYMid slice" opacity="0.85" />
```

Рендерится как первый дочерний элемент SVG (под сеткой и пинами). Если `bgUrl` null — показывается dot-grid.

Кнопка «🖼 Загрузить фон»:
- `<input type="file" accept="image/*">` hidden, тригерится кнопкой
- Файл → `supabase.storage.from('map-backgrounds').upload(path, file, { upsert: true })`
- После upload → `getPublicUrl` → `onBgUpload(url)` → `updateBook(bookId, { map_bg_url: url })`

### 5.8. Панель «Не размещены»

**Desktop**: сайдбар 172px справа (существующий `unmapped`-блок без изменений).  
**Mobile**: floating badge `«N не размещены»` в правом верхнем углу холста. Tap → bottom sheet со списком и кнопками «Разместить» (переключает режим: `pendingPlaceId`).

### 5.9. Hint-бар

Фиксированный снизу холста (pointer-events: none). Текст зависит от режима:

| Режим | Текст |
|---|---|
| `place` (нет pendingPlace) | `Кликните на карту чтобы добавить локацию` |
| `place` (есть pendingPlace) | `Кликните на карту чтобы разместить · Esc отмена` |
| `connect` (нет A) | `Режим «Связь» — кликните первую локацию` |
| `connect` (есть A) | `«{A.name}» → кликните вторую локацию · Esc отмена` |
| `pan` | `Перетащите карту · колесо мыши — zoom` |

---

## 6. `src/lib/connections.ts` (новый файл)

```ts
export interface LocationConnection {
  id: string;
  book_id: string;
  user_id: string;
  from_id: string;
  to_id: string;
  label: string;
  style: 'road' | 'river' | 'path' | 'border';
  created_at: string;
}

export type ConnectionPatch = Partial<Pick<LocationConnection, 'label' | 'style'>>;

export const CONNECTION_STYLES = {
  road:   { label: 'Дорога',   stroke: 'var(--accent-2)', width: 2,   dash: '6 4' },
  river:  { label: 'Река',     stroke: 'oklch(0.65 0.10 200)', width: 2.5, dash: '0' },
  path:   { label: 'Тропа',    stroke: 'var(--ink-4)',    width: 1.5, dash: '4 5' },
  border: { label: 'Граница',  stroke: 'var(--ink-3)',    width: 2,   dash: '8 3' },
};

// listConnections, createConnection, updateConnection, deleteConnection
// — аналог locations.ts
```

---

## 7. Адаптив (breakpoint 768px)

| Элемент | Desktop | Mobile |
|---|---|---|
| Sidebar | Убран полностью (фильтр по типу актуален только для списка) | — |
| Тулбар режимов | Иконка + текст | Только иконка |
| Кнопка фона | `🖼 Загрузить фон` | `🖼` (icon only) |
| Popup при клике | Floating над холстом | Bottom sheet |
| Панель «Не размещены» | Сайдбар 172px справа | Floating badge + bottom sheet |
| Touch zoom | Колесо мыши | Pinch-to-zoom (два пальца) |
| Добавить локацию | Клик на холст (режим «Место») | Tap на холст |

### Pinch-to-zoom (мобиль)

Обрабатывать `onTouchStart` / `onTouchMove` с двумя точками касания:  
`scale = initialScale * (currentDist / startDist)`, зажать в `[SCALE_MIN, SCALE_MAX]`.

---

## 8. Что НЕ входит в §17

- Кастомные иконки для пинов (загрузка изображения на пин)
- Слои карты (regions, areas)
- Экспорт карты как PNG/SVG
- Совместное редактирование карты в реальном времени

---

## 9. Страница «Список» (Map.tsx)

Toggle «Карта / Список» убирается. Компонент `LocationCard` и сетка карточек удаляются из `Map.tsx`. Единственный view — карта.

На экранах < 480px (очень маленький телефон) карта работает в том же режиме что и на обычном мобиле: bottom sheet, мобильный тулбар. Отдельного режима «список» нет.

---

## 10. Файл `docs/features/maps.md`

Обновить после завершения §17: добавить описание режимов, схему `location_connections`, Storage-бакет.
