// Геометрия карты мира, общая для холста (WorldMap) и PNG-экспорта (mapExport):
// иначе картинка расходится с тем, что автор видит на экране.

/** Подпись пина длиннее этого — обрезается многоточием. */
export const PIN_LABEL_MAX = 16;

// Знак изгиба реки — стабилен по id связи, не зависит от порядка клика при создании.
export function riverBowSign(id: string): 1 | -1 {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1) ? 1 : -1;
}

export interface ConnectionGeometry {
  /** SVG path `d`. */
  d: string;
  /** Середина линии (для реки — точка на кривой при t = 0.5). */
  midX: number;
  midY: number;
}

/** Путь связи в координатах холста. Реки — лёгкий изгиб через квадратичную Безье. */
export function connectionGeometry(
  conn: { id: string; style: string },
  x1: number, y1: number, x2: number, y2: number,
): ConnectionGeometry {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const bow = conn.style === 'river' ? Math.min(dist * 0.22, 60) * riverBowSign(conn.id) : 0;
  if (!bow) {
    return { d: `M${x1},${y1} L${x2},${y2}`, midX: (x1 + x2) / 2, midY: (y1 + y2) / 2 };
  }
  const cx = (x1 + x2) / 2 - (dy / dist) * bow;
  const cy = (y1 + y2) / 2 + (dx / dist) * bow;
  return {
    d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`,
    midX: (x1 + 2 * cx + x2) / 4,
    midY: (y1 + 2 * cy + y2) / 4,
  };
}

export function pinLabel(name: string): string {
  return name.length > PIN_LABEL_MAX ? name.slice(0, PIN_LABEL_MAX - 1) + '…' : name;
}
