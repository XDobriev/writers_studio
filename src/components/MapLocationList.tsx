import type { KeyboardEvent } from 'react';
import { TYPE_GLYPHS, type Location } from '../lib/locations';
import type { MapMode } from '../pages/Map';

const STEP = 0.01;
const STEP_BIG = 0.05;

interface MapLocationListProps {
  locations: Location[];
  mode: MapMode;
  selectedId: string | null;
  connectFrom: string | null;
  pendingPlaceId: string | null;
  onActivate: (id: string) => void;
  onTogglePlace: (id: string) => void;
  onPlaceCenter: (id: string) => void;
  onAdd: () => void;
  onMove: (id: string, dx: number, dy: number) => void;
}

// Клавиатурный путь к карте: холст управляется указателем, поэтому все локации
// продублированы списком — выбрать, править (тот же попап), сдвинуть стрелками,
// разместить, добавить. Только UI: состояние и мутации — в WorldMap.
export function MapLocationList({
  locations, mode, selectedId, connectFrom, pendingPlaceId,
  onActivate, onTogglePlace, onPlaceCenter, onAdd, onMove,
}: MapLocationListProps) {
  const mapped = locations.filter((l) => l.x != null && l.y != null);
  const unmapped = locations.filter((l) => l.x == null || l.y == null);
  const isActive = mode === 'place' || mode === 'connect';

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (mode !== 'place') return;
    const step = e.shiftKey ? STEP_BIG : STEP;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    onMove(id, d[0], d[1]);
  };

  return (
    <aside className="map-loclist" aria-label="Список локаций">
      <div className="map-loclist__head">
        <span>Локации · {locations.length}</span>
        <button
          type="button"
          className="map-loclist__add"
          aria-label="Добавить локацию в центре карты"
          title="Добавить локацию в центре карты"
          onClick={onAdd}
        >+</button>
      </div>
      <div className="map-loclist__body">
        {locations.length === 0 && <p className="map-loclist__empty">Локаций пока нет</p>}
        {mapped.length > 0 && (
          <ul className="map-loclist__list" aria-label="На карте">
            {mapped.map((loc) => (
              <li key={loc.id}>
                <button
                  type="button"
                  className={'map-loclist__item' + (selectedId === loc.id || connectFrom === loc.id ? ' map-loclist__item--on' : '')}
                  data-loc-list-id={loc.id}
                  aria-pressed={selectedId === loc.id || connectFrom === loc.id}
                  aria-describedby={mode === 'place' ? 'map-loclist-hint' : undefined}
                  disabled={!isActive}
                  title={isActive ? undefined : 'Переключитесь в режим «Место» или «Связь»'}
                  onClick={() => onActivate(loc.id)}
                  onKeyDown={(e) => handleKeyDown(e, loc.id)}
                >
                  <span className="map-loclist__glyph" aria-hidden="true">{TYPE_GLYPHS[loc.type]}</span>
                  <span className="map-loclist__name">{loc.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {unmapped.length > 0 && (
          <>
            <div className="map-loclist__sub">Не размещены · {unmapped.length}</div>
            <ul className="map-loclist__list" aria-label="Не размещены">
              {unmapped.map((loc) => (
                <li key={loc.id} className={'map-loclist__row' + (pendingPlaceId === loc.id ? ' map-loclist__row--on' : '')}>
                  <span className="map-loclist__glyph" aria-hidden="true">{TYPE_GLYPHS[loc.type]}</span>
                  <span className="map-loclist__name">{loc.name}</span>
                  <button
                    type="button"
                    className="map-loclist__act"
                    title="Разместить на карте кликом"
                    aria-label={`Разместить на карте кликом: ${loc.name}`}
                    aria-pressed={pendingPlaceId === loc.id}
                    onClick={() => onTogglePlace(loc.id)}
                  >+</button>
                  <button
                    type="button"
                    className="map-loclist__act"
                    title="Разместить в центре карты"
                    aria-label={`Разместить в центре карты: ${loc.name}`}
                    onClick={() => onPlaceCenter(loc.id)}
                  >◎</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {mode === 'place' && mapped.length > 0 && (
        <p id="map-loclist-hint" className="map-loclist__hint">Enter — править · стрелки — сдвинуть, Shift — крупнее</p>
      )}
    </aside>
  );
}
