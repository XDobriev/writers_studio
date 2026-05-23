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

| Режим | Действие на холсте | Действие на пине |
|---|---|---|
| `place` | Клик → создать локацию | Клик → popup редактирования |
| `connect` | Клик → сброс источника | Клик 1 → источник, Клик 2 → создать связь |
| `pan` | Drag → pan | Drag → переместить пин |

## Связи (CONNECTION_STYLES)

`road` — дорога (gold dash) · `river` — река (teal solid) · `path` — тропа (gray dot) · `border` — граница (dark dash)

## Мобиль (< 768px)

- Тулбар: только иконки.
- Popup → bottom sheet при тапе на пин.
- Панель «Не размещены» → floating badge → bottom sheet.
- Zoom: pinch-to-zoom (два пальца).

## Storage

Бакет `map-backgrounds` (public read). Путь: `{user_id}/{book_id}/background`.
