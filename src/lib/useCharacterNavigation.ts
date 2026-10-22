import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Character } from './characters';

export type CharacterViewMode = 'grid' | 'detail';

export function useCharacterNavigation({
  isMobile,
  characters,
  filtered,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
}: {
  isMobile: boolean;
  characters: Character[] | undefined;
  filtered: Character[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => unknown;
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
    // Персонаж может быть на ещё не загруженной странице (список грузится по 50) —
    // сначала догружаем, подменяем первым только если его действительно нет.
    if (!exists && (hasNextPage || isFetchingNextPage)) {
      if (!isFetchingNextPage) void fetchNextPage?.();
      return;
    }
    if (!exists) {
      const first = filtered[0] ?? characters[0];
      const next = new URLSearchParams(search);
      next.set('character', first.id);
      setSearch(next, { replace: true });
    }
  }, [isMobile, viewMode, characters, filtered, activeId, search, setSearch, hasNextPage, isFetchingNextPage, fetchNextPage]);

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
