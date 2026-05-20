import { supabase } from './supabase';

export type LocationType = 'city' | 'village' | 'forest' | 'sea' | 'castle' | 'other';

export interface Location {
  id: string;
  book_id: string;
  user_id: string;
  name: string;
  type: LocationType;
  role: string;
  description: string;
  x: number | null;
  y: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export type LocationPatch = Partial<
  Pick<Location, 'name' | 'type' | 'role' | 'description' | 'x' | 'y' | 'position'>
>;

export async function listLocations(bookId: string): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('book_id', bookId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Location[];
}

export async function createLocation(
  bookId: string,
  userId: string,
  patch: { name?: string; type?: LocationType; position?: number; x?: number; y?: number } = {},
): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .insert({
      book_id: bookId,
      user_id: userId,
      name: patch.name ?? 'Новая локация',
      type: patch.type ?? 'city',
      position: patch.position ?? 0,
      ...(patch.x != null && { x: patch.x }),
      ...(patch.y != null && { y: patch.y }),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Location;
}

export async function updateLocation(id: string, patch: LocationPatch): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as Location;
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) throw error;
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
