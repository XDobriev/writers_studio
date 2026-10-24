// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MapLocationList } from './MapLocationList';
import type { Location } from '../lib/locations';
import type { MapMode } from '../pages/Map';

const loc = (id: string, name: string, x: number | null, y: number | null) =>
  ({ id, name, x, y, type: 'city' }) as unknown as Location;

const handlers = () => ({
  onActivate: vi.fn(), onTogglePlace: vi.fn(), onPlaceCenter: vi.fn(), onAdd: vi.fn(), onMove: vi.fn(),
});

let root: Root | null = null;
function mount(mode: MapMode, h = handlers()) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root!.render(createElement(MapLocationList, {
    locations: [loc('a', 'Север', 0.5, 0.5), loc('b', 'Юг', null, null)],
    mode, selectedId: null, connectFrom: null, pendingPlaceId: null, ...h,
  })));
  return { el, h };
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

const key = (el: Element, k: string, shiftKey = false) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true })); });

describe('MapLocationList', () => {
  it('Enter/клик по размещённой локации выбирает её', () => {
    const { el, h } = mount('place');
    act(() => { el.querySelector<HTMLButtonElement>('[data-loc-list-id="a"]')!.click(); });
    expect(h.onActivate).toHaveBeenCalledWith('a');
  });

  it('стрелки двигают локацию на 1%, Shift — на 5%', () => {
    const { el, h } = mount('place');
    const btn = el.querySelector('[data-loc-list-id="a"]')!;
    key(btn, 'ArrowRight');
    key(btn, 'ArrowUp', true);
    expect(h.onMove).toHaveBeenNthCalledWith(1, 'a', 0.01, 0);
    expect(h.onMove).toHaveBeenNthCalledWith(2, 'a', 0, -0.05);
  });

  it('вне режимов «Место»/«Связь» пункты недоступны, стрелки не двигают', () => {
    const { el, h } = mount('pan');
    const btn = el.querySelector<HTMLButtonElement>('[data-loc-list-id="a"]')!;
    expect(btn.disabled).toBe(true);
    key(btn, 'ArrowRight');
    expect(h.onMove).not.toHaveBeenCalled();
  });

  it('неразмещённая: разместить в центре; кнопка «Добавить» создаёт локацию', () => {
    const { el, h } = mount('place');
    act(() => { el.querySelector<HTMLButtonElement>('button[aria-label="Разместить в центре карты: Юг"]')!.click(); });
    expect(h.onPlaceCenter).toHaveBeenCalledWith('b');
    act(() => { el.querySelector<HTMLButtonElement>('button[aria-label="Добавить локацию в центре карты"]')!.click(); });
    expect(h.onAdd).toHaveBeenCalled();
  });
});
