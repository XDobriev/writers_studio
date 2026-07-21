import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ChangeEvent } from 'react';
import { createLocation, updateLocation, deleteLocation, type Location, type LocationPatch } from './locations';
import { createConnection, updateConnection, deleteConnection, type LocationConnection, type ConnectionPatch } from './connections';
import { createStamp, updateStamp, deleteStamp, type MapStamp, type StampPatch, type StampType } from './mapStamps';
import { updateBook } from './books';
import { supabase, ensureAuthReady } from './supabase';
import { QUERY_KEYS } from './queries';
import { optimizeImage, MAP_BG_OPTS } from './imageOptimize';

interface UseMapMutationsOptions {
  bookId: string | undefined;
  userId: string | undefined;
  locations: Location[] | undefined;
  selectedStampType: StampType;
  setError: (msg: string) => void;
}

// Двойной тап по одной точке холста не должен создавать две наложенные сущности.
// Игнорируем create, если предыдущий был <400мс назад и почти в той же точке.
const DUP_TAP_MS = 400;
const DUP_TAP_DIST = 0.015; // доля холста (0..1)
type TapMark = { t: number; x: number; y: number } | null;
function isDuplicateTap(prev: TapMark, x: number, y: number, now: number): boolean {
  return !!prev && now - prev.t < DUP_TAP_MS && Math.abs(x - prev.x) < DUP_TAP_DIST && Math.abs(y - prev.y) < DUP_TAP_DIST;
}

export function useMapMutations({ bookId, userId, locations, selectedStampType, setError }: UseMapMutationsOptions) {
  const queryClient = useQueryClient();
  const lastLocTapRef = useRef<TapMark>(null);
  const lastStampTapRef = useRef<TapMark>(null);
  const creatingConnRef = useRef(false);

  // ── Location ─────────────────────────────────────────────────────────────

  const onCreate = useCallback(async (x: number, y: number) => {
    if (!bookId || !userId) return;
    const now = Date.now();
    if (isDuplicateTap(lastLocTapRef.current, x, y, now)) return;
    lastLocTapRef.current = { t: now, x, y };
    try {
      const created = await createLocation(bookId, userId, { position: locations?.length ?? 0, x, y });
      queryClient.setQueryData<Location[]>(QUERY_KEYS.locations(bookId), (prev) => [...(prev ?? []), created]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
  }, [bookId, userId, locations, queryClient, setError]);

  const onUpdate = useCallback(async (id: string, patch: LocationPatch) => {
    if (!bookId) return;
    queryClient.setQueryData<Location[]>(QUERY_KEYS.locations(bookId), (prev) =>
      prev ? prev.map((l) => (l.id === id ? { ...l, ...patch } as Location : l)) : prev
    );
    try {
      const updated = await updateLocation(id, patch);
      queryClient.setQueryData<Location[]>(QUERY_KEYS.locations(bookId), (prev) =>
        prev ? prev.map((l) => (l.id === id ? updated : l)) : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.locations(bookId) });
    }
  }, [bookId, queryClient, setError]);

  const onDeleteConfirmed = useCallback(async (id: string) => {
    if (!bookId) return;
    try {
      await deleteLocation(id);
      queryClient.setQueryData<Location[]>(QUERY_KEYS.locations(bookId), (prev) =>
        prev ? prev.filter((l) => l.id !== id) : prev
      );
    } catch (e) { setError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
  }, [bookId, queryClient, setError]);

  // ── Stamp ─────────────────────────────────────────────────────────────────

  const onCreateStamp = useCallback(async (x: number, y: number) => {
    if (!bookId || !userId) return;
    const now = Date.now();
    if (isDuplicateTap(lastStampTapRef.current, x, y, now)) return;
    lastStampTapRef.current = { t: now, x, y };
    try {
      const created = await createStamp(bookId, userId, selectedStampType, x, y);
      queryClient.setQueryData<MapStamp[]>(QUERY_KEYS.stamps(bookId), (prev) => [...(prev ?? []), created]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
  }, [bookId, userId, selectedStampType, queryClient, setError]);

  const onUpdateStamp = useCallback(async (id: string, patch: StampPatch) => {
    if (!bookId) return;
    queryClient.setQueryData<MapStamp[]>(QUERY_KEYS.stamps(bookId), (prev) =>
      prev ? prev.map((s) => (s.id === id ? { ...s, ...patch } as MapStamp : s)) : prev
    );
    try {
      const updated = await updateStamp(id, patch);
      queryClient.setQueryData<MapStamp[]>(QUERY_KEYS.stamps(bookId), (prev) =>
        prev ? prev.map((s) => (s.id === id ? updated : s)) : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stamps(bookId) });
    }
  }, [bookId, queryClient, setError]);

  const onDeleteStamp = useCallback(async (id: string) => {
    if (!bookId) return;
    queryClient.setQueryData<MapStamp[]>(QUERY_KEYS.stamps(bookId), (prev) =>
      prev ? prev.filter((s) => s.id !== id) : prev
    );
    try {
      await deleteStamp(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stamps(bookId) });
    }
  }, [bookId, queryClient, setError]);

  // ── Connection ────────────────────────────────────────────────────────────

  const onCreateConnection = useCallback(async (fromId: string, toId: string) => {
    if (!bookId || !userId || creatingConnRef.current) return;
    creatingConnRef.current = true;
    try {
      const created = await createConnection(bookId, userId, fromId, toId);
      queryClient.setQueryData<LocationConnection[]>(QUERY_KEYS.connections(bookId), (prev) => [...(prev ?? []), created]);
      return created;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      creatingConnRef.current = false;
    }
  }, [bookId, userId, queryClient, setError]);

  const onUpdateConnection = useCallback(async (id: string, patch: ConnectionPatch) => {
    if (!bookId) return;
    queryClient.setQueryData<LocationConnection[]>(QUERY_KEYS.connections(bookId), (prev) =>
      prev ? prev.map((c) => (c.id === id ? { ...c, ...patch } as LocationConnection : c)) : prev
    );
    try {
      const updated = await updateConnection(id, patch);
      queryClient.setQueryData<LocationConnection[]>(QUERY_KEYS.connections(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? updated : c)) : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.connections(bookId) });
    }
  }, [bookId, queryClient, setError]);

  const onDeleteConnection = useCallback(async (id: string) => {
    if (!bookId) return;
    queryClient.setQueryData<LocationConnection[]>(QUERY_KEYS.connections(bookId), (prev) =>
      prev ? prev.filter((c) => c.id !== id) : prev
    );
    try {
      await deleteConnection(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.connections(bookId) });
    }
  }, [bookId, queryClient, setError]);

  // ── Background / template ─────────────────────────────────────────────────

  const onFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bookId || !userId) return;
    e.target.value = '';
    try {
      await ensureAuthReady();
      const optimized = await optimizeImage(file, MAP_BG_OPTS);
      const path = `${userId}/${bookId}/background`;
      const { error: uploadError } = await supabase.storage
        .from('map-backgrounds')
        .upload(path, optimized, { upsert: true, contentType: optimized.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('map-backgrounds').getPublicUrl(path);
      await updateBook(bookId, { map_bg_url: `${publicUrl}?t=${Date.now()}` });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.book(bookId) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
  }, [bookId, userId, queryClient, setError]);

  const onTemplateChange = useCallback(async (templateId: string) => {
    if (!bookId) return;
    try {
      await updateBook(bookId, { map_template: templateId });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.book(bookId) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
  }, [bookId, queryClient, setError]);

  const onRemoveBg = useCallback(async () => {
    if (!bookId) return;
    try {
      await updateBook(bookId, { map_bg_url: null });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.book(bookId) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Неизвестная ошибка'); }
  }, [bookId, queryClient, setError]);

  return {
    onCreate, onUpdate, onDeleteConfirmed,
    onCreateStamp, onUpdateStamp, onDeleteStamp,
    onCreateConnection, onUpdateConnection, onDeleteConnection,
    onFileChange, onTemplateChange, onRemoveBg,
  };
}
