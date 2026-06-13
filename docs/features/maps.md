# Feature: Карта мира

**Маршрут:** `/books/:id/map`

## Компоненты

- `src/pages/Map.tsx` — тулбар с режимами, handlers для локаций/связей/bg-upload.
- `src/components/WorldMap.tsx` — SVG-холст: zoom/pan, пины, связи, popup, mobile bottom sheet.

## БД

- Таблица `locations`: `type`, `name`, `role`, `description`, `x` (float 0–1), `y` (float 0–1).
- Таблица `location_connections`: `from_id`, `to_id`, `label`, `style` (road/river/path/border).
- Поле `books.map_bg_url` — публичный URL фона из Storage бакета `map-backgrounds`.
- Миграции: `0007_locations.sql`, `0015_map_connections.sql`.

## Режимы карты (MapMode)

| Режим | Действие на холсте | Действие на пине/штампе |
|---|---|---|
| `place` | Клик → создать локацию | Клик → popup редактирования |
| `connect` | Клик → сброс источника | Клик 1 → источник, Клик 2 → создать связь |
| `pan` | Drag → pan | Drag → переместить пин |
| `stamp` | Клик → поставить штамп | Клик → StampPopup; Drag → переместить штамп |

## Связи (CONNECTION_STYLES)

`road` — дорога (gold dash) · `river` — река (teal solid) · `path` — тропа (gray dot) · `border` — граница (dark dash)

## Мобиль (< 768px)

- Тулбар: только иконки.
- Popup → bottom sheet при тапе на пин.
- Панель «Не размещены» → floating badge → bottom sheet.
- Zoom: pinch-to-zoom (два пальца).

## Штампы рельефа (map_stamps)

Добавлено в `0035_map_stamps.sql`. Компоненты: `src/lib/mapStamps.ts`, `src/components/MapStampsLayer.tsx`, `src/components/StampPopup.tsx`.

**Таблица `map_stamps`:** `id`, `book_id`, `user_id`, `type` (text), `x`/`y` (float 0–1), `size` (float, default 1.0).

**10 типов:** `mountain`, `hills`, `forest`, `tree`, `lake`, `desert`, `snow`, `swamp`, `ruins`, `cave`.

- `STAMP_BASE_SCALE = 1.5` — базовый масштаб SVG-иконок (40×32 viewBox).
- `useStamps(bookId)` — React Query хук (QUERY_KEYS.stamps).
- Экспорт PNG (`mapExport.ts`) включает штампы между фоном и связями.

## Storage

Бакет `map-backgrounds` (public read). Путь: `{user_id}/{book_id}/background`.
