import { describe, it, expect } from 'vitest';
import { getRelationshipGraph, getRelationshipEdge, getRelationshipLayout } from './relationshipGraph';
import type { Character } from './characters';
import type { CharacterRelationship } from './relationships';

describe('getRelationshipGraph', () => {
  it.each([1, 2, 4, 8, 24])('композиция для %i персонажей оставляет место для портретов и подписей', (count) => {
    const characters = Array.from({ length: count }, (_, i) => ({ id: String(i) } as Character));
    const layout = getRelationshipLayout(characters);
    expect(layout.points.size).toBe(count);
    expect(layout.points.get('0')).toEqual(layout.center);
    for (const point of layout.points.values()) {
      expect(point.x).toBeGreaterThanOrEqual(110);
      expect(point.x).toBeLessThanOrEqual(layout.width - 110);
      expect(point.y).toBeGreaterThanOrEqual(90);
      expect(point.y).toBeLessThanOrEqual(layout.height - 120);
    }
    const points = [...layout.points.values()];
    for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) {
      expect(Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y)).toBeGreaterThan(125);
    }
  });
  it('взаимное ребро противоположных соседей и его подпись обходят центрального героя', () => {
    const geometry = getRelationshipEdge({ x: 280, y: 90 }, { x: 280, y: 470 }, false, { x: 280, y: 280 });
    expect(geometry.label.x).not.toBe(280);
    expect(geometry.path).toContain('Q');
  });
  it('подписи взаимных связей не перекрывают центр и не выходят за окружение', () => {
    const center = { x: 280, y: 280 };
    const points = Array.from({ length: 8 }, (_, i) => ({ x: 280 + 190 * Math.cos(i * Math.PI / 4), y: 280 + 190 * Math.sin(i * Math.PI / 4) }));
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const { label } = getRelationshipEdge(points[i], points[j], false, center);
      expect(Math.hypot(label.x - center.x, label.y - center.y)).toBeGreaterThanOrEqual(109);
      expect(Math.hypot(label.x - center.x, label.y - center.y)).toBeLessThanOrEqual(191);
    }
  });
  it('показывает соседей и треугольники, но не раскрывает друзей друзей', () => {
    const characters = ['a', 'b', 'c', 'd'].map((id, position) => ({ id, position, created_at: '' } as Character));
    const relationships = [['a', 'b'], ['a', 'c'], ['b', 'c'], ['c', 'd']].map(([char_a_id, char_b_id]) => ({ id: char_a_id + char_b_id, char_a_id, char_b_id } as CharacterRelationship));
    const graph = getRelationshipGraph('a', characters, relationships);
    expect(graph.characters.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(graph.relationships.map((r) => r.id)).toEqual(['ab', 'ac', 'bc']);
  });

  it('расположение не зависит от порядка отношений или загрузки персонажей', () => {
    const characters = [{ id: 'a', position: 0 }, { id: 'b', position: 1 }, { id: 'c', position: 2 }] as Character[];
    const relationships = [{ char_a_id: 'a', char_b_id: 'c' }, { char_a_id: 'a', char_b_id: 'b' }] as CharacterRelationship[];
    expect(getRelationshipGraph('a', [...characters].reverse(), relationships).characters.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});
