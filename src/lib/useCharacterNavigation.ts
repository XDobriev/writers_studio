import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Character } from './characters';

export type CharacterViewMode = 'grid' | 'detail';

export function useCharacterNavigation({
  isMobile,
  characters,
  filtered,
}: {
  isMobile: boolean;
  characters: Character[] | undefined;
  filtered: Character[];
}) {
  const [search, setSearch] = useSearchParams();
  const [viewMode, setViewMode] = useState<CharacterViewMode>('grid');
  const activeId = search.get('character');

  // Возврат в grid-режим когда activeId сброшен извне (например, клик по «Персонажи» в сайдбаре)
  useEffect(() => {
    if (!isMobile && viewMode === 'detail' && !activeId) {
      setViewMode('grid');
    }
  }, [isMobile, viewMode, activeId]);

  // Auto-select first character when entering detail mode without a valid selection
  useEffect(() => {
    if (isMobile) return;
    if (viewMode === 'grid') return;
    if (!characters || characters.length === 0) return;
    const exists = activeId && characters.some((c) => c.id === activeId);
    if (!exists) {
      const first = filtered[0] ?? characters[0];
      const next = new URLSearchParams(search);
      next.set('character', first.id);
      setSearch(next, { replace: true });
    }
  }, [isMobile, viewMode, characters, filtered, activeId, search, setSearch]);

  const selectCharacter = useCallback((id: string) => {
    const next = new URLSearchParams(search);
    next.set('character', id);
    setSearch(next, { replace: false });
    setViewMode('detail');
  }, [search, setSearch]);

  const goToGrid = useCallback(() => {
    setViewMode('grid');
  }, []);

  const clearCharacter = useCallback(() => {
    const next = new URLSearchParams(search);
    next.delete('character');
    setSearch(next, { replace: false });
    setViewMode('grid');
  }, [search, setSearch]);

  return { activeId, search, setSearch, viewMode, setViewMode, selectCharacter, goToGrid, clearCharacter };
}
