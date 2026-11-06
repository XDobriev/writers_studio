import type { Character } from './characters';
import type { CharacterRelationship } from './relationships';

type Point = { x: number; y: number };

export function getRelationshipLayout(characters: Character[]) {
  const count = Math.max(0, characters.length - 1);
  const radiusX = Math.max(350, count * 34);
  const radiusY = Math.max(230, count * 24);
  const width = radiusX * 2 + 360;
  const height = radiusY * 2 + 240;
  const center = { x: count === 1 ? width * 0.34 : width / 2, y: height / 2 - 10 };
  const phase = count === 1 ? 0 : count === 2 ? Math.PI : -Math.PI / 2 + (count % 2 === 0 ? Math.PI / count : 0);
  const points = new Map(characters.map((c, i) => {
    const angle = phase + (i - 1) / Math.max(1, count) * Math.PI * 2;
    return [c.id, i === 0 ? center : { x: center.x + Math.cos(angle) * radiusX, y: center.y + Math.sin(angle) * radiusY }];
  }));
  return { width, height, center, points };
}

export function getRelationshipEdge(a: Point, b: Point, central: boolean, center: Point) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (central) {
    const other = Math.hypot(a.x - center.x, a.y - center.y) > Math.hypot(b.x - center.x, b.y - center.y) ? a : b;
    const dx = other.x - center.x; const dy = other.y - center.y;
    const length = Math.hypot(dx, dy) || 1;
    const bend = dx < 0 ? -56 : 56;
    const control = { x: mid.x - dy / length * bend, y: mid.y + dx / length * bend };
    return { path: `M ${a.x} ${a.y} Q ${control.x} ${control.y} ${b.x} ${b.y}`,
      label: { x: (mid.x + control.x) / 2, y: (mid.y + control.y) / 2 } };
  }
  const dx = b.x - a.x; const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const distance = Math.hypot(mid.x - center.x, mid.y - center.y);
  const direction = distance > 0.001 ? { x: (mid.x - center.x) / distance, y: (mid.y - center.y) / distance } : { x: -dy / length, y: dx / length };
  const radius = Math.min(Math.hypot(a.x - center.x, a.y - center.y), Math.hypot(b.x - center.x, b.y - center.y));
  const offset = (Math.max(distance, Math.min(radius * 0.9, 220), 110) - distance) * 2;
  const control = { x: mid.x + direction.x * offset, y: mid.y + direction.y * offset };
  return { path: `M ${a.x} ${a.y} Q ${control.x} ${control.y} ${b.x} ${b.y}`,
    label: { x: (mid.x + control.x) / 2, y: (mid.y + control.y) / 2 } };
}

export function getRelationshipGraph(activeId: string, characters: Character[], relationships: CharacterRelationship[]) {
  const ids = new Set([activeId]);
  for (const rel of relationships) {
    if (rel.char_a_id === activeId) ids.add(rel.char_b_id);
    if (rel.char_b_id === activeId) ids.add(rel.char_a_id);
  }
  const visible = characters.filter((c) => ids.has(c.id)).sort((a, b) =>
    Number(b.id === activeId) - Number(a.id === activeId) || a.position - b.position || a.id.localeCompare(b.id));
  const visibleIds = new Set(visible.map((c) => c.id));
  return {
    characters: visible,
    relationships: relationships.filter((r) => visibleIds.has(r.char_a_id) && visibleIds.has(r.char_b_id)),
  };
}
