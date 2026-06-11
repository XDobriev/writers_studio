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
import { MAP_TEMPLATES, getMapTemplate } from '../lib/mapTemplates';
import { generateMapPngBuffer, triggerMapDownload } from '../lib/mapExport';
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

  // ── Template change ──────────────────────────────────────────────────────

  const onTemplateChange = useCallback(async (templateId: string) => {
    if (!bookId) return;
    try {
      await updateBook(bookId, { map_template: templateId });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.book(bookId) });
    } catch (e) { setError((e as Error).message); }
  }, [bookId, queryClient, setError]);

  // ── Export PNG ───────────────────────────────────────────────────────────

  const [exportBusy, setExportBusy] = useState(false);

  const onExportPng = useCallback(async () => {
    if (!book || !locations || !connections) return;
    setExportBusy(true);
    clearError();
    try {
      const buffer = await generateMapPngBuffer(book, locations, connections);
      triggerMapDownload(buffer, book.title);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExportBusy(false);
    }
  }, [book, locations, connections, setError, clearError]);

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
                  aria-pressed={mode === m.value}
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

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                className="btn btn--ghost"
                onClick={() => setBgModalOpen(true)}
                aria-label="Стиль карты"
                style={{ fontSize: 12, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
              >
                <span>🖼</span>
                {!isMobile && <span>Фон</span>}
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => { void onExportPng(); }}
                disabled={exportBusy}
                aria-label="Скачать PNG"
                style={{ fontSize: 12, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
              >
                {exportBusy ? <span className="btn-spinner" /> : <span>↓</span>}
                {!isMobile && <span>{exportBusy ? 'Генерация…' : 'PNG'}</span>}
              </button>
            </div>
          </div>

          {mutationError && (
            <div style={{ margin: '8px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 14px', borderRadius: 8, background: 'oklch(0.65 0.18 25 / 0.10)', border: '1px solid oklch(0.65 0.18 25 / 0.25)', color: 'var(--danger)', fontSize: 13, flexShrink: 0 }}>
              <span>{mutationError}</span>
              <button onClick={clearError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }} title="Закрыть" aria-label="Закрыть">×</button>
            </div>
          )}
          {/* Canvas */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <WorldMap
              locations={locations}
              connections={connections}
              bgUrl={book.map_bg_url ?? null}
              template={book.map_template}
              mode={mode}
              onUpdate={onUpdate}
              onCreate={(x, y) => { void onCreate(x, y); }}
              onDelete={onDelete}
              onCreateConnection={onCreateConnection}
              onDeleteConnection={onDeleteConnection}
              onUpdateConnection={onUpdateConnection}
            />

            {!book.map_bg_url && locations.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto', zIndex: 5 }} onClick={() => { void onCreate(800, 450); }}>
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
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ fontSize: 28, marginBottom: 12, lineHeight: 1 }}>🗺</div>
                  <div style={{ font: '500 15px var(--font-serif)', color: 'var(--ink)', marginBottom: 8 }}>
                    Карта мира ждёт
                  </div>
                  <p style={{ font: '400 12px/1.7 var(--font-ui)', color: 'var(--ink-3)', margin: '0 0 20px' }}>
                    Выберите стиль карты и расставьте локации пинами. Или загрузите свой фон из <strong style={{ color: 'var(--ink-2)' }}>Inkarnate</strong>.
                  </p>
                  <button
                    className="btn"
                    style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: 6, marginBottom: 10 }}
                    onClick={() => setBgModalOpen(true)}
                  >
                    <span>🖼</span> Выбрать стиль карты
                  </button>
                  <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)', lineHeight: 1.6 }}>
                    или кликните в любую точку, чтобы сразу добавить локацию
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Background / Template modal */}
      {bgModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setBgModalOpen(false)}
        >
          <div
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px', width: 360, boxShadow: '0 8px 40px oklch(0 0 0 / 0.6)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ font: '500 14px var(--font-ui)', color: 'var(--ink)' }}>Стиль карты</span>
              <button onClick={() => setBgModalOpen(false)} aria-label="Закрыть" title="Закрыть" style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', font: '20px var(--font-ui)', lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>

            {/* Template picker */}
            <div style={{ font: '500 9.5px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Шаблон</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {MAP_TEMPLATES.map(t => {
                const active = getMapTemplate(book.map_template) === t.id && !book.map_bg_url;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      void onTemplateChange(t.id);
                      setBgModalOpen(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                      borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      border: active ? '1.5px solid var(--accent)' : '1px solid var(--border-soft)',
                      background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                    }}
                  >
                    <span style={{
                      width: 32, height: 20, borderRadius: 4, flexShrink: 0,
                      background: t.swatchBg,
                      border: `1px solid ${t.swatchBorder}`,
                      display: 'inline-block',
                    }} />
                    <div>
                      <div style={{ font: '500 12px var(--font-ui)', color: active ? 'var(--ink)' : 'var(--ink-2)' }}>{t.label}</div>
                      <div style={{ font: '400 10px var(--font-ui)', color: 'var(--ink-4)', marginTop: 1 }}>{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom background */}
            <div style={{ font: '500 9.5px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Свой фон</div>
            {book.map_bg_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img
                  src={book.map_bg_url}
                  alt="Фон карты"
                  style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border-soft)', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-2)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Загружено
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn--ghost"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => { setBgModalOpen(false); fileInputRef.current?.click(); }}
                    >
                      Заменить
                    </button>
                    <button
                      className="btn btn--ghost"
                      style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger)' }}
                      onClick={async () => {
                        if (!bookId) return;
                        try {
                          await updateBook(bookId, { map_bg_url: null });
                          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.book(bookId) });
                          setBgModalOpen(false);
                        } catch (e) { setError((e as Error).message); }
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 10px' }}>
                  Нарисуйте карту в <strong style={{ color: 'var(--ink-2)' }}>Inkarnate</strong> или другом редакторе и загрузите как фон поверх шаблона.
                </p>
                <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-4)', marginBottom: 12 }}>
                  JPG / PNG / WebP · до 5 МБ · рекомендуется 1600×900 px
                </div>
                <button
                  className="btn"
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: 6 }}
                  onClick={() => { setBgModalOpen(false); fileInputRef.current?.click(); }}
                >
                  <span>🖼</span> Выбрать файл
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        message="Удалить локацию? Действие нельзя отменить."
        onConfirm={onDeleteConfirmed}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </WithMode>
    </motion.div>
  );
}
