import { useMemo } from 'react';
import type { Character, CharacterRole } from './characters';

export type RoleFilter = 'all' | CharacterRole;

export function useCharacterFilter(
  characters: Character[] | undefined,
  roleFilter: RoleFilter,
  query: string,
): Character[] {
  return useMemo(() => {
    if (!characters) return [];
    const q = query.trim().toLowerCase();
    return characters.filter((c) => {
      if (roleFilter !== 'all' && c.role !== roleFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.aliases?.some(a => a.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [characters, roleFilter, query]);
}
