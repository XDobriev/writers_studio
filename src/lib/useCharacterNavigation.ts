import { useCallback, useEffect, useRef, useState } from 'react';
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
  const activeId = search.get('character');
  const [viewMode, setViewMode] = useState<CharacterViewMode>(() => activeId ? 'detail' : 'grid');
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  // Возврат в grid-режим когда activeId сброшен извне (например, клик по «Персонажи» в сайдбаре).
  // viewMode читается через ref, чтобы не попадать в deps и не вызывать сброс
  // в промежуточном состоянии viewMode='detail'/activeId=null.
  useEffect(() => {
    if (!isMobile && viewModeRef.current === 'detail' && !activeId) {
      setViewMode('grid');
    }
  }, [isMobile, activeId]);

  // Auto-select first character when in detail mode with a stale/deleted activeId
  useEffect(() => {
    if (isMobile) return;
    if (viewMode === 'grid') return;
    if (!characters || characters.length === 0) return;
    // Guard: activeId=null is a transient state between setViewMode and URL update — skip
    if (!activeId) return;
    const exists = characters.some((c) => c.id === activeId);
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
