import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { useErrorState } from '../lib/useErrorState';
import { useResponsive } from '../lib/useResponsive';
import { Navigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { WithMode, Sidebar } from '../components/Chrome';
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
  const { isMobile } = useResponsive();

  const { data: book } = useBook(bookId);
  const { data: locations, error: locErr } = useLocations(bookId);
  const { data: connections, error: connErr } = useConnections(bookId);

  const { error: mutationError, setError, clearError } = useErrorState();
  const [bgModalOpen, setBgModalOpen] = useState(false);
  const queryError = locErr?.message ?? connErr?.message ?? null;

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
  }, [bookId, user, locations, queryClient, setError]);

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
  }, [bookId, queryClient, setError]);

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
  }, [bookId, confirmDeleteId, queryClient, setError]);

  // ── Connection handlers ──────────────────────────────────────────────────

  const onCreateConnection = useCallback(async (fromId: string, toId: string) => {
    if (!bookId || !user) return;
    try {
      const created = await createConnection(bookId, user.id, fromId, toId);
      queryClient.setQueryData<LocationConnection[]>(QUERY_KEYS.connections(bookId), prev =>
        [...(prev ?? []), created]
      );
    } catch (e) { setError((e as Error).message); }
  }, [bookId, user, queryClient, setError]);

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
  }, [bookId, queryClient, setError]);

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
  }, [bookId, queryClient, setError]);

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
  }, [bookId, user, queryClient, setError]);

  // ── Guards ───────────────────────────────────────────────────────────────

  if (!bookId) return <Navigate to="/books" replace />;

  if (queryError) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <span style={{ font: '500 14px var(--font-ui)', color: 'var(--danger)' }}>Ошибка загрузки</span>
        <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>{queryError}</span>
        <a href={bookId ? `/books/${bookId}` : '/books'} style={{ color: 'var(--accent)', fontSize: 13, marginTop: 4 }}>← К книге</a>
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }} style={{ height: '100dvh' }}>
    <WithMode>
      {/* Hidden file input — единственный экземпляр */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onFileChange} />

      <div className="as as-app as-app--no-right" style={{ height: '100%', gridTemplateColumns: isMobile ? '1fr' : undefined, gridTemplateRows: '1fr' }}>

        {/* Sidebar */}
        {!isMobile && (
          <Sidebar book={book} subtitle={`карта мира · ${locations.length} лок.`}>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Режим</div>
              {modeButtons.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={'sb-item' + (mode === m.value ? ' sb-item--on' : '')}
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                >
                  <span>{m.icon}</span>
                  <span className="sb-item-title">{m.label}</span>
                </button>
              ))}
            </div>
          </Sidebar>
        )}

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', height: '100%', minHeight: 0 }}>

          {/* Toolbar */}
          <div className="tb" style={{ justifyContent: 'space-between', gap: 8 }}>
            {isMobile ? (
              <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink-2)', flexShrink: 0 }}>
                {book.title}
              </span>
            ) : (
              <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)' }}>Карта мира</span>
            )}

            <button
              className="btn btn--ghost"
              onClick={() => setBgModalOpen(true)}
              style={{ fontSize: 12, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
            >
              <span>🖼</span>
              {!isMobile && <span>Загрузить фон</span>}
            </button>
          </div>

          {mutationError && (
            <div style={{ margin: '8px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 14px', borderRadius: 8, background: 'oklch(0.65 0.18 25 / 0.10)', border: '1px solid oklch(0.65 0.18 25 / 0.25)', color: 'var(--danger)', fontSize: 13, flexShrink: 0 }}>
              <span>{mutationError}</span>
              <button onClick={clearError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }} title="Закрыть">×</button>
            </div>
          )}
          {/* Canvas */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

            {!book.map_bg_url && locations.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 5 }}>
                <div
                  style={{
                    pointerEvents: 'auto',
                    background: 'oklch(0.14 0.015 45 / 0.9)',
                    border: '1px solid oklch(0.32 0.02 50)',
                    borderRadius: 16,
                    padding: isMobile ? '24px 20px' : '32px 40px',
                    width: isMobile ? 'calc(100% - 48px)' : undefined,
                    maxWidth: 380,
                    textAlign: 'center',
                    backdropFilter: 'blur(14px)',
                    boxShadow: '0 8px 40px oklch(0 0 0 / 0.55)',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 12, lineHeight: 1 }}>🗺</div>
                  <div style={{ font: '500 15px var(--font-serif)', color: 'var(--ink)', marginBottom: 8 }}>
                    Карта мира ждёт
                  </div>
                  <p style={{ font: '400 12px/1.7 var(--font-ui)', color: 'var(--ink-3)', margin: '0 0 20px' }}>
                    Нарисуйте карту в <strong style={{ color: 'var(--ink-2)' }}>Inkarnate</strong> или другом редакторе, загрузите как фон — и расставьте локации пинами.
                  </p>
                  <button
                    className="btn"
                    style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: 6, marginBottom: 10 }}
                    onClick={() => setBgModalOpen(true)}
                  >
                    <span>🖼</span> Загрузить фон
                  </button>
                  <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)', lineHeight: 1.6 }}>
                    или кликните в любую точку карты,<br />чтобы сразу добавить локацию без фона
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Background upload modal */}
      {bgModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setBgModalOpen(false)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px', width: 340, boxShadow: '0 8px 40px oklch(0 0 0 / 0.6)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ font: '500 14px var(--font-ui)', color: 'var(--ink)' }}>Фон карты</span>
              <button onClick={() => setBgModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', font: '20px var(--font-ui)', lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>

            <p style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.65, margin: '0 0 14px' }}>
              Нарисуйте карту в <strong style={{ color: 'var(--ink-2)' }}>Inkarnate</strong>, Dungeon Fog или любом другом редакторе и загрузите как фон. Затем расставьте локации пинами.
            </p>

            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, font: '400 11px var(--font-mono)', color: 'var(--ink-3)', lineHeight: 1.8 }}>
              JPG / PNG / WebP · до 5 МБ<br />
              рекомендуется <strong>1600 × 900 px</strong> (16:9)
            </div>

            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: 6 }}
              onClick={() => { setBgModalOpen(false); fileInputRef.current?.click(); }}
            >
              <span>🖼</span> Выбрать файл
            </button>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          message="Удалить локацию? Действие нельзя отменить."
          onConfirm={onDeleteConfirmed}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </WithMode>
    </motion.div>
  );
}
