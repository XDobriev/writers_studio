import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useWindowWidth } from '../lib/useWindowWidth';
import { Navigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Sidebar, WithMode } from '../components/Chrome';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { WorldMap } from '../components/WorldMap';
import { useAuth } from '../lib/auth';
import {
  createLocation,
  deleteLocation,
  TYPE_GLYPHS,
  TYPE_LABELS,
  updateLocation,
  type Location,
  type LocationPatch,
  type LocationType,
} from '../lib/locations';
import { QUERY_KEYS, useBook, useLocations } from '../lib/queries';

type TypeFilter = 'all' | LocationType;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'все' },
  { value: 'city', label: 'города' },
  { value: 'village', label: 'поселения' },
  { value: 'forest', label: 'леса' },
  { value: 'sea', label: 'моря' },
  { value: 'castle', label: 'замки' },
  { value: 'other', label: 'другое' },
];

export default function MapScreen() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const { data: book } = useBook(bookId);
  const { data: locations, error: locationsQueryError } = useLocations(bookId);
  const [mutationError, setError] = useState<string | null>(null);
  const error = locationsQueryError?.message ?? mutationError;
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');

  const onCreate = useCallback(async (x?: number, y?: number) => {
    if (!bookId || !user) return;
    const position = locations?.length ?? 0;
    try {
      const created = await createLocation(bookId, user.id, { position, x, y });
      queryClient.setQueryData<Location[]>(QUERY_KEYS.locations(bookId), (prev) => [...(prev ?? []), created]);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, user, locations, queryClient]);

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
      queryClient.setQueryData<Location[]>(QUERY_KEYS.locations(bookId), (prev) =>
        prev ? prev.filter((l) => l.id !== id) : prev
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, confirmDeleteId, queryClient]);

  const filtered = useMemo(() => {
    if (!locations) return [];
    if (filter === 'all') return locations;
    return locations.filter((l) => l.type === filter);
  }, [locations, filter]);

  const isMobile = useWindowWidth() < 768;

  if (!bookId) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <span style={{ font: '500 14px var(--font-ui)', color: 'var(--danger)' }}>Ошибка загрузки</span>
        <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>{error}</span>
      </div>
    );
  }

  if (!book || locations === undefined) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="page-spinner" />
      </div>
    );
  }

  return (
    <WithMode active="map" bookId={bookId}>
      <div className="as as-app as-app--no-right" style={{ height: '100%', gridTemplateColumns: isMobile ? '1fr' : undefined }}>
        {!isMobile && <Sidebar book={book} subtitle={`карта мира · ${locations.length}`}>
          <div className="sb-section"><span className="sb-section-title">Тип локации</span></div>
          <div style={{ padding: '4px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                className={'sb-item' + (filter === f.value ? ' sb-item--on' : '')}
                onClick={() => setFilter(f.value)}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <span style={{ display: 'flex', justifyContent: 'center', font: '500 14px var(--font-serif)', color: 'var(--ink-2)' }}>
                  {f.value === 'all' ? '·' : TYPE_GLYPHS[f.value]}
                </span>
                <span className="sb-item-title">{f.label}</span>
                <span />
              </button>
            ))}
          </div>
        </Sidebar>}

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <span style={{ font: '500 13px var(--font-ui)' }}>Карта «{book.title}»</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 6, padding: 2, gap: 1 }}>
                <button
                  className={'btn btn--ghost' + (viewMode === 'map' ? ' btn--active' : '')}
                  style={{ padding: '3px 10px', fontSize: 12, borderRadius: 4 }}
                  onClick={() => setViewMode('map')}
                >
                  Карта
                </button>
                <button
                  className={'btn btn--ghost' + (viewMode === 'list' ? ' btn--active' : '')}
                  style={{ padding: '3px 10px', fontSize: 12, borderRadius: 4 }}
                  onClick={() => setViewMode('list')}
                >
                  Список
                </button>
              </div>
              {viewMode === 'list' && (
                <button onClick={() => onCreate()} className="btn"><Icon name="plus" size={14} /> Локация</button>
              )}
            </div>
          </div>
          {isMobile && (
            <div style={{ display: 'flex', gap: 4, padding: '6px 12px', borderBottom: '1px solid var(--border-soft)', overflowX: 'auto', flexShrink: 0 }}>
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  className={'sb-tab' + (filter === f.value ? ' sb-tab--on' : '')}
                  onClick={() => setFilter(f.value)}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  {f.value !== 'all' && <span style={{ font: '12px var(--font-serif)' }}>{TYPE_GLYPHS[f.value]}</span>}
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {viewMode === 'map' ? (
            <WorldMap
              locations={locations}
              onUpdate={onUpdate}
              onCreate={(x, y) => { void onCreate(x, y); }}
            />
          ) : (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '32px 48px' }}>
              {filtered.length === 0 ? (
                locations.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '48px 24px' }}>
                    <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'var(--surface)', color: 'var(--ink-4)', border: '1px solid var(--border-soft)' }}>
                      <Icon name="map" size={22} />
                    </div>
                    <div style={{ textAlign: 'center', maxWidth: 260 }}>
                      <div style={{ font: '500 14px var(--font-ui)', color: 'var(--ink-2)', marginBottom: 6 }}>На карте ещё нет локаций</div>
                      <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.6 }}>Создавайте места вашего мира — города, леса, замки и другие локации</div>
                    </div>
                    <button onClick={() => onCreate()} className="btn btn--primary"><Icon name="plus" size={13} /> Создать локацию</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--ink-3)', padding: '48px 0' }}>
                    <div style={{ font: '500 14px var(--font-ui)' }}>Нет локаций этого типа</div>
                  </div>
                )
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {filtered.map((loc) => (
                    <LocationCard
                      key={loc.id}
                      location={loc}
                      onUpdate={(patch) => onUpdate(loc.id, patch)}
                      onDelete={() => onDelete(loc.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
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

function LocationCard({ location, onUpdate, onDelete }: {
  location: Location;
  onUpdate: (patch: LocationPatch) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(location.name);
  const [role, setRole] = useState(location.role);
  const [description, setDescription] = useState(location.description);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<LocationPatch>({});

  useEffect(() => { setName(location.name); }, [location.id, location.name]);
  useEffect(() => { setRole(location.role); }, [location.id, location.role]);
  useEffect(() => { setDescription(location.description); }, [location.id, location.description]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const schedule = (patch: LocationPatch) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const p = pending.current;
      pending.current = {};
      onUpdate(p);
    }, 700);
  };

  const onNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setName(v);
    schedule({ name: v.trim() === '' ? 'Без названия' : v });
  };
  const onRoleChange = (e: ChangeEvent<HTMLInputElement>) => { setRole(e.target.value); schedule({ role: e.target.value }); };
  const onDescChange = (e: ChangeEvent<HTMLTextAreaElement>) => { setDescription(e.target.value); schedule({ description: e.target.value }); };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <select
          value={location.type}
          onChange={(e) => onUpdate({ type: e.target.value as LocationType })}
          style={{ height: 28, padding: '0 8px', border: '1px solid var(--border-soft)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 12, outline: 'none' }}
        >
          {(['city', 'village', 'forest', 'sea', 'castle', 'other'] as const).map((t) => (
            <option key={t} value={t}>{TYPE_GLYPHS[t]} {TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input
          value={name}
          onChange={onNameChange}
          placeholder="Название локации"
          style={{ flex: 1, font: '500 16px var(--font-serif)', color: 'var(--ink)', background: 'transparent', border: 'none', outline: 'none', padding: '4px 0' }}
        />
        <button
          onClick={onDelete}
          title="Удалить локацию"
          style={{ background: 'transparent', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', padding: '4px 8px', font: '400 16px var(--font-ui)', lineHeight: 1, borderRadius: 4 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-4)'; }}
        >
          ×
        </button>
      </div>
      <input
        value={role}
        onChange={onRoleChange}
        placeholder="Краткая роль в сюжете (например, столица ордена)"
        style={{ width: '100%', font: '400 12px var(--font-mono)', color: 'var(--ink-3)', background: 'transparent', border: 'none', outline: 'none', padding: '2px 0', marginBottom: 6, letterSpacing: '0.02em' }}
      />
      <textarea
        value={description}
        onChange={onDescChange}
        placeholder="Подробное описание"
        rows={3}
        style={{ width: '100%', font: '400 13px/1.55 var(--font-serif)', color: 'var(--ink-2)', background: 'transparent', border: 'none', outline: 'none', resize: 'vertical', padding: 0 }}
      />
    </div>
  );
}
