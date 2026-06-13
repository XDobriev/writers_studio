# Дизайн: штампы на карте мира

**Дата:** 2026-06-13  
**Статус:** готов к реализации

## Что строим

Инструмент размещения terrain-штампов поверх шаблона карты. Цель — закрыть разрыв между лендингом (горы, леса, реки на карте) и реальным приложением (только пины).

## Что не входит в скоуп

- Freehand-рисование (кисть, карандаш)
- Безье-пути для штампов (не нужно — реки идут через связи)
- Изменение пинов (остаются без изменений)
- Береговая линия как тип связи (отложено)
- Слои/z-order штампов

---

## Данные

### Новая таблица `map_stamps`

```sql
CREATE TABLE public.map_stamps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id    uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id),
  type       text NOT NULL, -- см. StampType ниже
  x          float8 NOT NULL, -- 0..1 нормализованные координаты
  y          float8 NOT NULL,
  size       float8 NOT NULL DEFAULT 1.0, -- 0.5..3.0
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.map_stamps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON public.map_stamps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.map_stamps (book_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.map_stamps TO anon, authenticated;
```

### Тип StampType (10 значений)

`'mountain' | 'hills' | 'forest' | 'tree' | 'lake' | 'desert' | 'snow' | 'swamp' | 'ruins' | 'cave'`

### Изменение connections

Добавить `'river'` к существующим стилям связи (`road | river | path | border`).  
Хранится в `location_connections.style` — никакой миграции схемы не нужно, просто новое значение.

---

## Архитектура

### Новые файлы

**`src/lib/mapStamps.ts`**
- `StampType` union
- `MapStamp` интерфейс `{ id, book_id, user_id, type, x, y, size, created_at }`
- `StampPatch` = `Partial<Pick<MapStamp, 'type' | 'x' | 'y' | 'size'>>`
- `STAMP_LABELS: Record<StampType, string>` — русские названия для пикера
- `STAMP_SVG: Record<StampType, string>` — SVG path/shape строки для рендера
- `createStamp(bookId, userId, type, x, y): Promise<MapStamp>`
- `updateStamp(id, patch): Promise<MapStamp>`
- `deleteStamp(id): Promise<void>`

**`src/components/MapStampsLayer.tsx`**
- Props: `stamps: MapStamp[]`, `selectedId: string | null`, `viewBox: { scale, offsetX, offsetY }`, `onSelect(id): void`, `onMove(id, x, y): void`
- Рендерит SVG `<g>` со всеми штампами
- Каждый штамп — `<g transform="translate(px,py) scale(size)" data-stamp-id={id}>`
- Клик на штамп → `onSelect(id)`, drag → `onMove(id, newX, newY)`
- Выбранный штамп получает ring-обводку (accent цвет, opacity 0.8)

**`src/components/StampPopup.tsx`**
- Props: `stamp: MapStamp`, `onUpdate(patch): void`, `onDelete(): void`, `onClose(): void`
- `position: absolute` поверх canvas, координаты вычисляются из stamp.x/y → пиксели
- Секции: тип (grid 5×2 иконок с подписями), размер (range input 0.5–3.0 шаг 0.1), кнопка «Удалить» (danger)
- Escape → onClose
- Клик за пределами → onClose (backdrop)

### Изменяемые файлы

**`src/pages/Map.tsx`**
- `MapMode` расширяется: `'place' | 'connect' | 'pan' | 'stamp'`
- В сайдбаре новая кнопка «🖌 Рельеф» (mode = 'stamp')
- В режиме stamp: пикер типа штампа в сайдбаре (selectedStampType)
- Подключение `useStamps(bookId)` и обработчиков create/update/delete
- Передача props в `<WorldMap>`

**`src/components/WorldMap.tsx`**
- Новые props: `stamps: MapStamp[]`, `selectedStampType: StampType`, `onCreateStamp(x,y): void`, `onUpdateStamp(id, patch): void`, `onDeleteStamp(id): void`
- В режиме `'stamp'`, клик на пустое место → `onCreateStamp(normX, normY)`
- `<MapStampsLayer>` вставляется в SVG после фона, **до** пинов и связей
- Локальный `stampSelectedId` state + `stampPopupPos` для StampPopup

**`src/lib/queries.ts`**
- `QUERY_KEYS.stamps(bookId)` — новый ключ
- `useStamps(bookId)` — `useQuery` с `supabase.from('map_stamps').select('*').eq('book_id', bookId).order('created_at')`

**`src/lib/mapExport.ts`**
- `buildStampsSvg(stamps: MapStamp[], template: MapTemplateId): string` — SVG строка всех штампов (конкретные цвета, без CSS vars)
- Вставляется в `buildSvgString()` между bg и пинами
- `generateMapPngBuffer` получает `stamps` третьим аргументом

**`src/lib/connections.ts`** (или где хранится тип стиля)
- Добавить `'river'` к union стилей + в CONN_STROKES: `river: { stroke: '#4a9abf', width: 2.5, dash: '' }`
- Добавить в UI-лейблы (`CONN_LABELS`) строку «Река»

---

## User flow (режим «Рельеф»)

1. Пользователь нажимает «🖌 Рельеф» в сайдбаре
2. В сайдбаре появляется пикер типа (10 кнопок с SVG-иконками)
3. Выбирает тип (например «горы»)
4. Кликает на карту → штамп появляется в этой точке, размер 1.0
5. Drag поставленного штампа → перемещение (optimistic update)
6. Клик по существующему штампу → StampPopup над ним:
   - Смена типа (grid иконок)
   - Слайдер размера (0.5× .. 3×)
   - «Удалить»
7. Escape или клик мимо → закрыть попап

---

## Рендер штампов

Каждый `StampType` имеет SVG-определение в `STAMP_SVG`. Рендер:

```svg
<g transform="translate({x * viewW}, {y * viewH}) scale({size * BASE_SCALE})">
  <!-- SVG пути штампа, центрированные на 0,0 -->
</g>
```

`BASE_SCALE` подбирается так, чтобы размер 1.0 давал штамп ~60×50px при 1600×900 canvas.

Цвета штампов адаптируются под шаблон: `parchment`/`sea`/`dark` — тёплые земляные тона; `paper` — немного темнее для контраста со светлым фоном.

---

## Экспорт PNG

`generateMapPngBuffer` расширяется:

```ts
export async function generateMapPngBuffer(
  book: Book,
  locations: Location[],
  connections: LocationConnection[],
  stamps: MapStamp[], // новый параметр
): Promise<ArrayBuffer>
```

`buildStampsSvg()` генерирует конкретные SVG-пути (без CSS vars) для off-screen рендера. Слои в SVG: фон → штампы → связи → пины.

---

## Изменения в CLAUDE.md и документации

- `MapStampsLayer.tsx` и `StampPopup.tsx` → в реестр компонентов `## Архитектура`
- `mapStamps.ts` → в раздел lib/
- `docs/features/maps.md` → раздел «Штампы»
