import { createRepository } from './repository';

export type StampType =
  | 'mountain' | 'hills' | 'forest' | 'tree' | 'lake'
  | 'desert' | 'snow' | 'swamp' | 'ruins' | 'cave';

export interface MapStamp {
  id: string;
  book_id: string;
  user_id: string;
  type: StampType;
  x: number;
  y: number;
  size: number;
  created_at: string;
}

export type StampPatch = Partial<Pick<MapStamp, 'type' | 'x' | 'y' | 'size'>>;

export const STAMP_TYPES: readonly StampType[] = [
  'mountain', 'hills', 'forest', 'tree', 'lake',
  'desert', 'snow', 'swamp', 'ruins', 'cave',
];

export const STAMP_LABELS: Record<StampType, string> = {
  mountain: 'Горы',
  hills:    'Холмы',
  forest:   'Лес',
  tree:     'Дерево',
  lake:     'Озеро',
  desert:   'Пустыня',
  snow:     'Снег',
  swamp:    'Болото',
  ruins:    'Руины',
  cave:     'Пещера',
};

// Raw SVG fragments for a 40×32 coordinate space.
// Rendered with an outer translate(-20,-16) to center at origin.
// Used for both React rendering (MapStampsLayer) and PNG export (mapExport).
export const STAMP_SVG: Record<StampType, string> = {
  mountain: `<polygon points="20,4 6,28 34,28" fill="#8a7060" stroke="#5a3f28" stroke-width="1.5"/><polygon points="28,10 19,28 37,28" fill="#a08070" stroke="#5a3f28" stroke-width="1"/><polygon points="20,4 16,12 24,12" fill="white" opacity="0.5"/>`,
  hills:    `<polygon points="20,8 8,28 32,28" fill="#5a7840" stroke="#3a5020" stroke-width="1"/><polygon points="28,14 20,28 36,28" fill="#6a8850" stroke="#3a5020" stroke-width="1"/>`,
  forest:   `<polygon points="19,3 4,22 34,22" fill="#2d5a27" stroke="#1a3a15" stroke-width="1.2"/><polygon points="19,10 7,25 31,25" fill="#3a6e30" stroke="#1a3a15" stroke-width="1.2"/><rect x="16" y="22" width="6" height="8" fill="#5a3f28"/>`,
  tree:     `<circle cx="20" cy="10" r="8" fill="#2d5a27" stroke="#1a3a15" stroke-width="1"/><rect x="18" y="17" width="4" height="10" fill="#5a3f28"/>`,
  lake:     `<ellipse cx="20" cy="18" rx="16" ry="10" fill="#1a4a70" stroke="#2a6a9a" stroke-width="1.5"/><path d="M8 17 Q14 13 20 17 Q26 21 32 17" stroke="#4a9abf" stroke-width="1.2" fill="none" opacity="0.6"/>`,
  desert:   `<path d="M4 26 Q10 16 16 22 Q22 10 28 18 Q34 8 36 22 L36 28 L4 28Z" fill="#c8a850" stroke="#a08030" stroke-width="1"/><circle cx="28" cy="14" r="5" fill="#e8c860" opacity="0.7"/><line x1="28" y1="6" x2="28" y2="4" stroke="#e8c860" stroke-width="1.5"/><line x1="34" y1="10" x2="36" y2="9" stroke="#e8c860" stroke-width="1.5"/><line x1="22" y1="10" x2="20" y2="9" stroke="#e8c860" stroke-width="1.5"/>`,
  snow:     `<polygon points="20,4 7,28 33,28" fill="#c8d8e8" stroke="#90a8c0" stroke-width="1.5"/><polygon points="20,4 16,14 24,14" fill="white" opacity="0.9"/><polygon points="26,12 18,28 34,28" fill="#d8e8f0" stroke="#90a8c0" stroke-width="1"/>`,
  swamp:    `<path d="M4 28 Q10 18 16 22 Q22 14 28 20 Q32 16 36 22 L36 28 L4 28Z" fill="#3a5a30" opacity="0.7"/><circle cx="12" cy="22" r="3" fill="#2a4a20" opacity="0.6"/><circle cx="22" cy="20" r="2.5" fill="#2a4a20" opacity="0.6"/><circle cx="30" cy="22" r="2" fill="#2a4a20" opacity="0.6"/>`,
  ruins:    `<rect x="6" y="12" width="7" height="16" fill="#6a5a48" stroke="#4a3a2a" stroke-width="1"/><rect x="25" y="16" width="7" height="12" fill="#6a5a48" stroke="#4a3a2a" stroke-width="1"/><line x1="13" y1="28" x2="25" y2="28" stroke="#4a3a2a" stroke-width="1.5"/>`,
  cave:     `<path d="M8 28 Q10 20 20 18 Q30 16 32 28Z" fill="#3a3030" stroke="#2a2020" stroke-width="1"/><circle cx="20" cy="18" r="3" fill="#1a1010"/><path d="M14 22 Q17 19 20 22" stroke="#5a5050" stroke-width="1" fill="none"/>`,
};

// Multiplier applied to stamp.size when placing in SVG coordinate space.
// At size=1.0 this makes the 40×32 stamp render as ≈60×48 SVG units.
export const STAMP_BASE_SCALE = 1.5;

const repo = createRepository<MapStamp>(
  'map_stamps',
  { size: 1.0 },
  [{ column: 'created_at', ascending: true }],
);

export function listStamps(bookId: string): Promise<MapStamp[]> {
  return repo.list(bookId);
}

export function createStamp(
  bookId: string,
  userId: string,
  type: StampType,
  x: number,
  y: number,
): Promise<MapStamp> {
  return repo.create(bookId, userId, { type, x, y });
}

export function updateStamp(id: string, patch: StampPatch): Promise<MapStamp> {
  return repo.update(id, patch);
}

export function deleteStamp(id: string): Promise<void> {
  return repo.delete(id);
}
