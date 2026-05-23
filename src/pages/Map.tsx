import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useWindowWidth } from '../lib/useWindowWidth';
import { Navigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { WithMode } from '../components/Chrome';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { WorldMap } from '../components/WorldMap';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  createLocation,
  deleteLocation,
  updateLocation,
  type Location,
  type LocationPatch,
} from '../lib/locations';
import {
  createConnection,
  deleteConnection,
  updateConnection,
  type LocationConnection,
  type ConnectionPatch,
} from '../lib/connections';
import { updateBook } from '../lib/books';
import { QUERY_KEYS, useBook, useLocations, useConnections } from '../lib/queries';

export type MapMode = 'place' | 'connect' | 'pan';

export default function MapScreen() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useWindowWidth() < 768;

  const { data: book } = useBook(bookId);
  const { data: locations, error: locErr } = useLocations(bookId);
  const { data: connections, error: connErr } = useConnections(bookId);

  const [mutationError, setError] = useState<string | null>(null);
  const error = locErr?.message ?? connErr?.message ?? mutationError;

  const [mode, setMode] = useState<MapMode>('place');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Location handlers ────────────────────────────────────────────────────

  const onCreate = useCallback(async (x: number, y: number) => {
    if (!bookId || !user) return;
    const position = locations?.length ?? 0;
    try {
      const created = await createLocation(bookId, user.id, { position, x, y });
      queryClient.setQueryData<Location[]>(QUERY_KEYS.locations(bookId), prev => [...(prev ?? []), created]);
    } catch (e) { setError((e as Error).message); }
  }, [bookId, user, locations, queryClient]);

  const onUpdate = useCallback(async (id: string, patch: LocationPatch) => {
    if (!bookId) return;
    queryClient.setQueryData<Location[]>(QUERY_KEYS.locations(bookId), prev =>
      prev ? prev.map(l => l.id === id ? { ...l, ...patch } as Location : l) : prev
    );
    try {
      const updated = await updateLocation(id, patch);
      queryClient.setQueryData<Location[]>(QUERY_KEYS.locations(bookId), prev =>
        prev ? prev.map(l => l.id === id ? updated : l) : prev
      );
    } catch (e) {
      setError((e as Error).message);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.locations(bookId) });
    }
  }, [bookId, queryClient]);

  const onDelete = useCallback((id: string) => {
    setConfirmDeleteId(id);
  }, []);

  const onDeleteConfirmed = useCallback(async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (!bookId || !id) return;
    try {
      await deleteLocation(id);
      queryClient.setQueryData<Location[]>(QUERY_KEYS.locations(bookId), prev =>
        prev ? prev.filter(l => l.id !== id) : prev
      );
    } catch (e) { setError((e as Error).message); }
  }, [bookId, confirmDeleteId, queryClient]);

  // ── Connection handlers ──────────────────────────────────────────────────

  const onCreateConnection = useCallback(async (fromId: string, toId: string) => {
    if (!bookId || !user) return;
    try {
      const created = await createConnection(bookId, user.id, fromId, toId);
      queryClient.setQueryData<LocationConnection[]>(QUERY_KEYS.connections(bookId), prev =>
        [...(prev ?? []), created]
      );
    } catch (e) { setError((e as Error).message); }
  }, [bookId, user, queryClient]);

  const onUpdateConnection = useCallback(async (id: string, patch: ConnectionPatch) => {
    if (!bookId) return;
    queryClient.setQueryData<LocationConnection[]>(QUERY_KEYS.connections(bookId), prev =>
      prev ? prev.map(c => c.id === id ? { ...c, ...patch } as LocationConnection : c) : prev
    );
    try {
      const updated = await updateConnection(id, patch);
      queryClient.setQueryData<LocationConnection[]>(QUERY_KEYS.connections(bookId), prev =>
        prev ? prev.map(c => c.id === id ? updated : c) : prev
      );
    } catch (e) {
      setError((e as Error).message);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.connections(bookId) });
    }
  }, [bookId, queryClient]);

  const onDeleteConnection = useCallback(async (id: string) => {
    if (!bookId) return;
    queryClient.setQueryData<LocationConnection[]>(QUERY_KEYS.connections(bookId), prev =>
      prev ? prev.filter(c => c.id !== id) : prev
    );
    try {
      await deleteConnection(id);
    } catch (e) {
      setError((e as Error).message);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.connections(bookId) });
    }
  }, [bookId, queryClient]);

  // ── Background image upload ──────────────────────────────────────────────

  const onFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bookId || !user) return;
    e.target.value = '';
    try {
      const path = `${user.id}/${bookId}/background`;
      const { error: uploadError } = await supabase.storage
        .from('map-backgrounds')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('map-backgrounds').getPublicUrl(path);
      const cacheBusted = `${publicUrl}?t=${Date.now()}`;
      await updateBook(bookId, { map_bg_url: cacheBusted });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.book(bookId) });
    } catch (e) { setError((e as Error).message); }
  }, [bookId, user, queryClient]);

  // ── Guards ───────────────────────────────────────────────────────────────

  if (!bookId) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <span style={{ font: '500 14px var(--font-ui)', color: 'var(--danger)' }}>Ошибка загрузки</span>
        <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>{error}</span>
      </div>
    );
  }

  if (!book || locations === undefined || connections === undefined) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="page-spinner" />
      </div>
    );
  }

  const modeButtons: { value: MapMode; icon: string; label: string }[] = [
    { value: 'place',   icon: '📍', label: 'Место' },
    { value: 'connect', icon: '↔',  label: 'Связь' },
    { value: 'pan',     icon: '✋', label: 'Перемещение' },
  ];

  return (
    <WithMode>
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

          {/* Toolbar */}
          <div className="tb" style={{ justifyContent: 'space-between', gap: 8 }}>
            <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink-2)', flexShrink: 0 }}>
              {!isMobile && `Карта · `}{book.title}
            </span>

            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 6, padding: 2, gap: 1 }}>
              {modeButtons.map(m => (
                <button
                  key={m.value}
                  className={'btn btn--ghost' + (mode === m.value ? ' btn--active' : '')}
                  style={{ padding: isMobile ? '3px 10px' : '3px 12px', fontSize: 12, borderRadius: 4, gap: 5, display: 'flex', alignItems: 'center' }}
                  onClick={() => setMode(m.value)}
                >
                  <span>{m.icon}</span>
                  {!isMobile && <span>{m.label}</span>}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
              <button
                className="btn"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 12, gap: 4, display: 'flex', alignItems: 'center' }}
              >
                <span>🖼</span>
                {!isMobile && <span>Загрузить фон</span>}
              </button>
              {!isMobile && (
                <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)' }}>
                  {locations.length} лок.
                </span>
              )}
            </div>
          </div>

          {/* Canvas */}
          <WorldMap
            locations={locations}
            connections={connections}
            bgUrl={book.map_bg_url ?? null}
            mode={mode}
            onUpdate={onUpdate}
            onCreate={(x, y) => { void onCreate(x, y); }}
            onDelete={onDelete}
            onCreateConnection={onCreateConnection}
            onDeleteConnection={onDeleteConnection}
            onUpdateConnection={onUpdateConnection}
          />
        </main>
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          message="Удалить локацию? Действие нельзя отменить."
          onConfirm={onDeleteConfirmed}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </WithMode>
  );
}
