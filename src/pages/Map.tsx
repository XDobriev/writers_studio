import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useWindowWidth } from '../lib/useWindowWidth';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { WithMode, PLAN_LABEL } from '../components/Chrome';
import { LogoMark } from '../components/LogoMark';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SettingsModal } from '../components/SettingsModal';
import { useUserDisplay } from '../lib/useUserDisplay';
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

  const { displayName, initials, plan } = useUserDisplay();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mutationError, setError] = useState<string | null>(null);
  const [bgModalOpen, setBgModalOpen] = useState(false);
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
      {/* Hidden file input — единственный экземпляр */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onFileChange} />

      <div className="as as-app as-app--no-right" style={{ height: '100%', gridTemplateColumns: isMobile ? '1fr' : undefined }}>

        {/* Sidebar */}
        {!isMobile && (
          <aside className="sb">
            <div className="sb-head">
              <Link to="/books" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, textDecoration: 'none' }}>
                <LogoMark size={20} />
                <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>авторская студия</span>
              </Link>
              <div className="sb-book-title">{book.title}</div>
              <div className="sb-book-author">карта мира · {locations.length} лок.</div>
            </div>

            {bookId && (
              <div style={{ padding: '12px 14px 0' }}>
                <Link to={`/books/${bookId}`} className="sb-item" style={{ color: 'var(--ink-3)' }}>
                  <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--ink-3)' }}><Icon name="arrows" size={14} /></span>
                  <span className="sb-item-title" style={{ color: 'var(--ink-3)' }}>← К дэшборду</span>
                  <span />
                </Link>
              </div>
            )}
            <div style={{ flex: 1 }} />
            <div className="sb-foot">
              <div className="sb-avatar">{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sb-foot-name">{displayName || '—'}</div>
                <div className="sb-foot-meta">{PLAN_LABEL[plan] ?? plan}</div>
              </div>
              <button className="tb-btn" onClick={() => setSettingsOpen(true)} title="Настройки"><Icon name="settings" size={15} /></button>
            </div>
          </aside>
        )}

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

          {/* Toolbar */}
          <div className="tb" style={{ justifyContent: 'space-between', gap: 8 }}>
            {isMobile && (
              <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink-2)', flexShrink: 0 }}>
                {book.title}
              </span>
            )}

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

            <button
              className="btn btn--ghost"
              onClick={() => setBgModalOpen(true)}
              style={{ fontSize: 12, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
            >
              <span>🖼</span>
              {!isMobile && <span>Загрузить фон</span>}
            </button>
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

      {/* Background upload modal */}
      {bgModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setBgModalOpen(false)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px 28px', width: 340, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
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
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </WithMode>
  );
}
