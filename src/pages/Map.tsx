import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useErrorState } from '../lib/useErrorState';
import { ErrorBanner } from '../components/ErrorBanner';
import { useResponsive } from '../lib/useResponsive';
import { Navigate, useParams } from 'react-router-dom';
import { WithMode, Sidebar } from '../components/Chrome';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MapStyleModal } from '../components/MapStyleModal';
import { WorldMap } from '../components/WorldMap';
import { useAuth } from '../lib/auth';
import { getMapTemplate } from '../lib/mapTemplates';
import { generateMapPngBuffer, triggerMapDownload } from '../lib/mapExport';
import { useBook, useLocations, useConnections, useStamps } from '../lib/queries';
import {
  STAMP_LABELS, STAMP_SVG, STAMP_TYPES,
  type StampType,
} from '../lib/mapStamps';
import { useMapMutations } from '../lib/useMapMutations';

export type MapMode = 'place' | 'connect' | 'pan' | 'stamp';

export default function MapScreen() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const { data: book } = useBook(bookId);
  const { data: locations, error: locErr } = useLocations(bookId);
  const { data: connections, error: connErr } = useConnections(bookId);
  const { data: stamps = [] } = useStamps(bookId);
  const [selectedStampType, setSelectedStampType] = useState<StampType>('mountain');

  const { error: mutationError, setError, clearError } = useErrorState();
  const [bgModalOpen, setBgModalOpen] = useState(false);
  const queryError = locErr?.message ?? connErr?.message ?? null;

  const [mode, setMode] = useState<MapMode>('place');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    onCreate, onUpdate, onDeleteConfirmed,
    onCreateStamp, onUpdateStamp, onDeleteStamp,
    onCreateConnection, onUpdateConnection, onDeleteConnection,
    onFileChange, onTemplateChange, onRemoveBg,
  } = useMapMutations({ bookId, userId: user?.id, locations, selectedStampType, setError });

  const onDelete = useCallback((id: string) => { setConfirmDeleteId(id); }, []);

  // ── Export PNG ───────────────────────────────────────────────────────────

  const [exportBusy, setExportBusy] = useState(false);

  const onExportPng = useCallback(async () => {
    if (!book || !locations || !connections) return;
    setExportBusy(true);
    clearError();
    try {
      const buffer = await generateMapPngBuffer(book, locations, connections, stamps);
      triggerMapDownload(buffer, book.title);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExportBusy(false);
    }
  }, [book, locations, connections, stamps, setError, clearError]);

  // ── Guards ───────────────────────────────────────────────────────────────

  if (!bookId) return <Navigate to="/books" replace />;

  if (queryError) {
    return (
      <div className="as page-fill--center" style={{ flexDirection: 'column', gap: 8 }}>
        <span style={{ font: '500 14px var(--font-ui)', color: 'var(--danger)' }}>Ошибка загрузки</span>
        <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>{queryError}</span>
        <a href={bookId ? `/books/${bookId}` : '/books'} style={{ color: 'var(--accent)', fontSize: 13, marginTop: 4 }}>← К книге</a>
      </div>
    );
  }

  if (!book || locations === undefined || connections === undefined) {
    return (
      <div className="as page-fill--center">
        <div className="page-spinner" />
      </div>
    );
  }

  const modeButtons: { value: MapMode; icon: string; label: string }[] = [
    { value: 'place',   icon: '📍', label: 'Место' },
    { value: 'connect', icon: '↔',  label: 'Связь' },
    { value: 'pan',     icon: '✋', label: 'Перемещение' },
    { value: 'stamp',   icon: '🖌',  label: 'Рельеф' },
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

          <AnimatePresence>
            {mode === 'stamp' && (
              <motion.div
                key="stamp-strip"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden', flexShrink: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 14px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-deep)', overflowX: 'auto', scrollbarWidth: 'none' }}>
                  <span style={{ font: '500 9px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginRight: 8, flexShrink: 0 }}>Тип</span>
                  {STAMP_TYPES.map(type => (
                    <button
                      key={type}
                      type="button"
                      className={'map-strip-btn' + (selectedStampType === type ? ' map-strip-btn--on' : '')}
                      onClick={() => setSelectedStampType(type)}
                      title={STAMP_LABELS[type]}
                      aria-pressed={selectedStampType === type}
                    >
                      <svg width="18" height="14" viewBox="0 0 40 32" style={{ flexShrink: 0 }}>
                        <g dangerouslySetInnerHTML={{ __html: STAMP_SVG[type] }} />
                      </svg>
                      <span style={{ font: '400 11px var(--font-ui)', color: selectedStampType === type ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                        {STAMP_LABELS[type]}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {mutationError && (
            <ErrorBanner message={mutationError} onDismiss={clearError} style={{ margin: '8px 16px 0', flexShrink: 0 }} />
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
              stamps={stamps}
              onCreateStamp={(x, y) => { void onCreateStamp(x, y); }}
              onUpdateStamp={onUpdateStamp}
              onDeleteStamp={(id) => { void onDeleteStamp(id); }}
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
      <MapStyleModal
        open={bgModalOpen}
        onClose={() => setBgModalOpen(false)}
        activeTemplateId={getMapTemplate(book.map_template)}
        hasCustomBg={!!book.map_bg_url}
        bgUrl={book.map_bg_url ?? null}
        onSelectTemplate={(id) => { void onTemplateChange(id); setBgModalOpen(false); }}
        onPickFile={() => { setBgModalOpen(false); fileInputRef.current?.click(); }}
        onRemoveBg={async () => { await onRemoveBg(); setBgModalOpen(false); }}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        message="Удалить локацию? Действие нельзя отменить."
        onConfirm={() => { if (confirmDeleteId) { void onDeleteConfirmed(confirmDeleteId); setConfirmDeleteId(null); } }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </WithMode>
    </motion.div>
  );
}
