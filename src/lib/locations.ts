import { createRepository } from './repository';
import type { Tables } from './database.types';

export type LocationType = 'city' | 'village' | 'forest' | 'sea' | 'castle' | 'other';

// Выведено из БД (Tables<'locations'>); type сужен до union.
export type Location = Omit<Tables<'locations'>, 'type'> & { type: LocationType };

export type LocationPatch = Partial<
  Pick<Location, 'name' | 'type' | 'role' | 'description' | 'x' | 'y' | 'size' | 'position'>
>;

const repo = createRepository<Location>(
  'locations',
  { name: 'Новая локация', type: 'city', position: 0 },
  [{ column: 'position', ascending: true }, { column: 'created_at', ascending: true }],
);

export function listLocations(bookId: string): Promise<Location[]> {
  return repo.list(bookId);
}

export function createLocation(
  bookId: string,
  userId: string,
  patch: { name?: string; type?: LocationType; position?: number; x?: number; y?: number } = {},
): Promise<Location> {
  return repo.create(bookId, userId, patch);
}

export function updateLocation(id: string, patch: LocationPatch): Promise<Location> {
  return repo.update(id, patch);
}

export function deleteLocation(id: string): Promise<void> {
  return repo.delete(id);
}

export const TYPE_LABELS: Record<LocationType, string> = {
  city: 'Город',
  village: 'Поселение',
  forest: 'Лес',
  sea: 'Море',
  castle: 'Замок',
  other: 'Другое',
};

export const TYPE_GLYPHS: Record<LocationType, string> = {
  city: '◆',
  village: '●',
  forest: '※',
  sea: '~',
  castle: '♛',
  other: '▲',
};
