import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useWindowWidth } from '../lib/useWindowWidth';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Sidebar, WithMode } from '../components/Chrome';
import { useAuth } from '../lib/auth';
import {
  createCharacter,
  deleteCharacter,
  initialsFromName,
  ROLE_LABELS,
  updateCharacter,
  type Character,
  type CharacterPatch,
  type CharacterRole,
} from '../lib/characters';
import {
  createRelation,
  deleteRelation,
  updateRelationLabel,
  type CharacterRelation,
} from '../lib/character_relations';
import { QUERY_KEYS, useBook, useCharacters, useRelations } from '../lib/queries';
import { ConfirmDialog } from '../components/ConfirmDialog';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type RoleFilter = 'all' | CharacterRole;

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'все' },
  { value: 'protagonist', label: 'главные' },
  { value: 'secondary', label: 'второстеп.' },
  { value: 'minor', label: 'эпиз.' },
];

export default function Characters() {
  const { id: bookId } = useParams<{ id: string }>();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: book } = useBook(bookId);
  const { data: characters, error: charsQueryError } = useCharacters(bookId);
  const { data: relations, error: relsQueryError } = useRelations(bookId);
  const [mutationError, setError] = useState<string | null>(null);
  const error = charsQueryError?.message ?? relsQueryError?.message ?? mutationError;
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activeId = search.get('character');
  const isMobile = useWindowWidth() < 768;

  const filtered = useMemo(() => {
    if (!characters) return [];
    const q = query.trim().toLowerCase();
    return characters.filter((c) => {
      if (roleFilter !== 'all' && c.role !== roleFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [characters, roleFilter, query]);

  useEffect(() => {
    if (isMobile) return;
    if (!characters || characters.length === 0) return;
    const exists = activeId && characters.some((c) => c.id === activeId);
    if (!exists) {
      const first = filtered[0] ?? characters[0];
      const next = new URLSearchParams(search);
      next.set('character', first.id);
      setSearch(next, { replace: true });
    }
  }, [isMobile, characters, filtered, activeId, search, setSearch]);

  const active = useMemo(
    () => (characters && activeId ? characters.find((c) => c.id === activeId) ?? null : null),
    [characters, activeId],
  );

  const selectCharacter = useCallback((id: string) => {
    const next = new URLSearchParams(search);
    next.set('character', id);
    setSearch(next, { replace: false });
  }, [search, setSearch]);

  const clearCharacter = useCallback(() => {
    const next = new URLSearchParams(search);
    next.delete('character');
    setSearch(next, { replace: false });
  }, [search, setSearch]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<CharacterPatch | null>(null);
  const targetIdRef = useRef<string | null>(null);

  const flush = useCallback(async () => {
    const patch = pendingPatch.current;
    const id = targetIdRef.current;
    pendingPatch.current = null;
    if (!patch || !id || !bookId) return;
    setSaveState('saving');
    try {
      const updated = await updateCharacter(id, patch);
      queryClient.setQueryData<Character[]>(QUERY_KEYS.characters(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? updated : c)) : prev
      );
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      setError((e as Error).message);
    }
  }, [bookId, queryClient]);

  const scheduleSave = useCallback((id: string, patch: CharacterPatch) => {
    targetIdRef.current = id;
    pendingPatch.current = { ...(pendingPatch.current ?? {}), ...patch };
    if (bookId) {
      queryClient.setQueryData<Character[]>(QUERY_KEYS.characters(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? { ...c, ...patch } as Character : c)) : prev
      );
    }
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flush(); }, 700);
  }, [flush, bookId, queryClient]);

  const lastActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newId = active?.id ?? null;
    if (lastActiveIdRef.current && lastActiveIdRef.current !== newId) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void flush();
    }
    lastActiveIdRef.current = newId;
  }, [active, flush]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void flush();
  }, [flush]);

  const onCreate = useCallback(async () => {
    if (!bookId || !user) return;
    const position = characters?.length ?? 0;
    try {
      const created = await createCharacter(bookId, user.id, {
        name: '',
        role: 'protagonist',
        position,
      });
      queryClient.setQueryData<Character[]>(QUERY_KEYS.characters(bookId), (prev) => [...(prev ?? []), created]);
      const next = new URLSearchParams(search);
      next.set('character', created.id);
      setSearch(next, { replace: false });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, user, characters, queryClient, search, setSearch]);

  const onDelete = useCallback(() => {
    if (!active) return;
    setConfirmDelete(true);
  }, [active]);

  const onDeleteConfirmed = useCallback(async () => {
    if (!active || !characters || !bookId) return;
    setConfirmDelete(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingPatch.current = null;
    targetIdRef.current = null;
    try {
      await deleteCharacter(active.id);
      const remaining = characters.filter((c) => c.id !== active.id);
      queryClient.setQueryData<Character[]>(QUERY_KEYS.characters(bookId), remaining);
      queryClient.setQueryData<CharacterRelation[]>(QUERY_KEYS.relations(bookId), (prev) =>
        prev ? prev.filter((r) => r.from_character_id !== active.id && r.to_character_id !== active.id) : prev
      );
      const next = new URLSearchParams(search);
      if (remaining.length > 0) {
        next.set('character', remaining[0].id);
      } else {
        next.delete('character');
      }
      setSearch(next, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [active, characters, bookId, queryClient, search, setSearch]);

  const onCreateRelation = useCallback(async (toId: string, label: string) => {
    if (!bookId || !user || !active) return;
    try {
      const created = await createRelation(bookId, user.id, active.id, toId, label);
      queryClient.setQueryData<CharacterRelation[]>(QUERY_KEYS.relations(bookId), (prev) => [...(prev ?? []), created]);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, user, active, queryClient]);

  const onDeleteRelation = useCallback(async (relationId: string) => {
    if (!bookId) return;
    try {
      await deleteRelation(relationId);
      queryClient.setQueryData<CharacterRelation[]>(QUERY_KEYS.relations(bookId), (prev) =>
        prev ? prev.filter((r) => r.id !== relationId) : prev
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, queryClient]);

  const onRelationLabelChange = useCallback(async (relationId: string, label: string) => {
    if (!bookId) return;
    try {
      const updated = await updateRelationLabel(relationId, label);
      queryClient.setQueryData<CharacterRelation[]>(QUERY_KEYS.relations(bookId), (prev) =>
        prev ? prev.map((r) => (r.id === relationId ? updated : r)) : prev
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, queryClient]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <span style={{ font: '500 14px var(--font-ui)', color: 'var(--danger)' }}>Ошибка загрузки</span>
        <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>{error}</span>
      </div>
    );
  }

  if (!book || !characters || !relations) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="page-spinner" />
      </div>
    );
  }

  const saveLabel: Record<SaveState, string> = {
    idle: '',
    saving: 'Сохранение…',
    saved: 'Сохранено',
    error: 'Ошибка сохранения',
  };

  const showSidebar = !isMobile || !activeId;
  const showMain = !isMobile || Boolean(activeId);

  return (
    <WithMode active="characters" bookId={bookId}>
      <div className="as as-app as-app--no-right" style={{ height: '100%', gridTemplateColumns: isMobile ? '1fr' : undefined }}>
        {showSidebar && <Sidebar book={book} subtitle={`персонажи · ${characters.length}`}>
          <div style={{ padding: '12px 14px 6px' }}>
            <div style={{ height: 32, padding: '0 10px', border: '1px solid var(--border-soft)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 12 }}>
              <Icon name="search" size={13} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 12 }}
              />
            </div>
          </div>
          <div style={{ padding: '10px 14px 6px', display: 'flex', gap: 4 }}>
            {ROLE_FILTERS.map((f) => (
              <button
                key={f.value}
                className="sb-tab"
                onClick={() => setRoleFilter(f.value)}
                style={roleFilter === f.value ? { background: 'var(--surface)', color: 'var(--ink)' } : {}}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px 8px' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '24px 14px', font: '400 12px var(--font-ui)', color: 'var(--ink-3)', textAlign: 'center' }}>
                {characters.length === 0 ? 'Картотека пуста' : 'Ничего не найдено'}
              </div>
            )}
            {filtered.map((c) => {
              const on = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => selectCharacter(c.id)}
                  className={'sb-item' + (on ? ' sb-item--on' : '')}
                  style={{ height: 'auto', padding: '8px 10px', width: '100%', textAlign: 'left', gridTemplateColumns: '34px 1fr auto' }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 999, background: on ? 'var(--accent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 10px var(--font-ui)', color: on ? 'oklch(0.98 0 0)' : 'var(--ink)' }}>{initialsFromName(c.name || 'Без имени')}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="sb-item-title">{c.name || 'Без имени'}</div>
                    <div style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.04em' }}>{ROLE_LABELS[c.role]}</div>
                  </div>
                  <span />
                </button>
              );
            })}
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-soft)' }}>
            <button onClick={onCreate} className="btn" style={{ width: '100%', justifyContent: 'center' }}><Icon name="plus" size={13} /> Новый персонаж</button>
          </div>
        </Sidebar>}

        {showMain && <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isMobile && (
                <button className="tb-btn" onClick={clearCharacter} title="К списку персонажей">
                  <Icon name="arrows" size={16} />
                </button>
              )}
              <span style={{ font: '500 13px var(--font-ui)' }}>Картотека персонажей</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ font: '400 12px var(--font-ui)', color: saveState === 'error' ? 'var(--danger)' : 'var(--ink-3)' }}>{saveLabel[saveState]}</span>
            </div>
          </div>

          {active ? (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '32px 48px' }}>
              <HeroBlock character={active} onChange={(patch) => scheduleSave(active.id, patch)} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <FieldCard
                  label="Внешность"
                  value={active.appearance}
                  onChange={(v) => scheduleSave(active.id, { appearance: v })}
                />
                <FieldCard
                  label="Характер"
                  value={active.personality}
                  onChange={(v) => scheduleSave(active.id, { personality: v })}
                />
                <FieldCard
                  label="Предыстория"
                  value={active.backstory}
                  onChange={(v) => scheduleSave(active.id, { backstory: v })}
                />
                <FieldCard
                  label="Авторские заметки"
                  value={active.notes}
                  onChange={(v) => scheduleSave(active.id, { notes: v })}
                  warn
                />
              </div>

              <RelationsBlock
                activeId={active.id}
                characters={characters}
                relations={relations}
                onCreate={onCreateRelation}
                onDelete={onDeleteRelation}
                onLabelChange={onRelationLabelChange}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingBottom: 8 }}>
                <button onClick={onDelete} className="btn btn--ghost" style={{ color: 'var(--danger)' }}>Удалить персонажа</button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--ink-3)' }}>
              <div style={{ font: '500 14px var(--font-ui)' }}>В картотеке ещё нет персонажей</div>
              <button onClick={onCreate} className="btn"><Icon name="plus" size={13} /> Создать</button>
            </div>
          )}
        </main>}
      </div>

      {confirmDelete && active && (
        <ConfirmDialog
          message={`Удалить «${active.name || 'Без имени'}»? Это действие нельзя отменить.`}
          onConfirm={onDeleteConfirmed}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </WithMode>
  );
}

function HeroBlock({ character, onChange }: {
  character: Character;
  onChange: (patch: CharacterPatch) => void;
}) {
  const [name, setName] = useState(character.name);
  const [quote, setQuote] = useState(character.quote);

  useEffect(() => { setName(character.name); }, [character.id, character.name]);
  useEffect(() => { setQuote(character.quote); }, [character.id, character.quote]);

  const onNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setName(v);
    onChange({ name: v });
  };
  const onQuoteChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setQuote(v);
    onChange({ quote: v });
  };
  const onRoleChange = (role: CharacterRole) => onChange({ role });

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 36 }}>
      <div style={{ width: 160, height: 200, borderRadius: 8, background: 'linear-gradient(160deg, oklch(0.45 0.04 50), oklch(0.25 0.02 50))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 18, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, oklch(0.40 0.04 50) 0 6px, oklch(0.36 0.04 50) 6px 12px)', opacity: 0.4 }} />
        <div style={{ position: 'relative', font: '600 56px var(--font-serif)', color: 'oklch(0.95 0.01 80 / 0.9)', letterSpacing: '-0.02em' }}>
          {initialsFromName(name)}
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10, color: 'oklch(0.95 0.01 80 / 0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <Icon name="camera" size={16} />
          <span style={{ font: '400 8px var(--font-ui)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>без портрета</span>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {(['protagonist', 'secondary', 'minor'] as const).map((r) => (
            <button
              key={r}
              onClick={() => onRoleChange(r)}
              className={'chip' + (character.role === r ? ' chip--accent' : '')}
              style={{ cursor: 'pointer', border: 'none' }}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>

        <input
          value={name}
          onChange={onNameChange}
          placeholder="Имя персонажа"
          style={{ width: '100%', font: '600 44px var(--font-serif)', letterSpacing: '-0.018em', marginBottom: 6, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', padding: '4px 0' }}
        />

        <textarea
          value={quote}
          onChange={onQuoteChange}
          placeholder="Цитата или девиз персонажа"
          rows={2}
          style={{ width: '100%', maxWidth: 560, font: '400 15px/1.65 var(--font-serif)', color: 'var(--ink-2)', fontStyle: 'italic', background: 'transparent', border: 'none', outline: 'none', resize: 'vertical', padding: 0 }}
        />

      </div>
    </div>
  );
}

function FieldCard({ label, value, onChange, warn }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  warn?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const initialRef = useRef(value);
  useEffect(() => {
    if (value !== initialRef.current) {
      setLocal(value);
      initialRef.current = value;
    }
  }, [value]);

  return (
    <div style={{ background: warn ? 'color-mix(in oklch, var(--accent) 8%, transparent)' : 'var(--surface)', border: `1px solid ${warn ? 'color-mix(in oklch, var(--accent) 40%, transparent)' : 'var(--border-soft)'}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {warn && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />}
        <span style={{ font: '500 10.5px var(--font-mono)', color: warn ? 'var(--accent)' : 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <textarea
        value={local}
        onChange={(e) => { setLocal(e.target.value); onChange(e.target.value); }}
        rows={5}
        placeholder="—"
        style={{ width: '100%', font: '400 13.5px/1.65 var(--font-serif)', color: 'var(--ink)', background: 'transparent', border: 'none', outline: 'none', resize: 'vertical', padding: 0, minHeight: 80 }}
      />
    </div>
  );
}

function RelationsBlock({ activeId, characters, relations, onCreate, onDelete, onLabelChange }: {
  activeId: string;
  characters: Character[];
  relations: CharacterRelation[];
  onCreate: (toId: string, label: string) => void;
  onDelete: (relationId: string) => void;
  onLabelChange: (relationId: string, label: string) => void;
}) {
  const mine = relations.filter((r) => r.from_character_id === activeId);
  const occupied = new Set(mine.map((r) => r.to_character_id));
  const candidates = characters.filter((c) => c.id !== activeId && !occupied.has(c.id));

  const [adding, setAdding] = useState(false);
  const [toId, setToId] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    setAdding(false);
    setToId('');
    setLabel('');
  }, [activeId]);

  const startAdd = () => {
    if (candidates.length === 0) return;
    setAdding(true);
    setToId(candidates[0].id);
    setLabel('');
  };

  const submit = () => {
    if (!toId) return;
    onCreate(toId, label);
    setAdding(false);
    setToId('');
    setLabel('');
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '18px 22px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Связи</span>
        {!adding && (
          <button onClick={startAdd} disabled={candidates.length === 0} className="btn btn--ghost" style={{ fontSize: 12 }}>
            <Icon name="plus" size={12} /> Добавить связь
          </button>
        )}
      </div>

      {adding && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            style={{ flex: '0 0 200px', height: 32, padding: '0 8px', border: '1px solid var(--border-soft)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name || 'Без имени'}</option>
            ))}
          </select>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Кто кому? (наставник, спутник, сестра…)"
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
            autoFocus
            style={{ flex: 1, height: 32, padding: '0 10px', border: '1px solid var(--border-soft)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, outline: 'none' }}
          />
          <button onClick={submit} className="btn btn--primary" style={{ fontSize: 12 }}>Добавить</button>
          <button onClick={() => setAdding(false)} className="btn btn--ghost" style={{ fontSize: 12 }}>Отмена</button>
        </div>
      )}

      {mine.length === 0 && !adding ? (
        <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)' }}>
          {candidates.length === 0 ? 'Нет других персонажей для связи.' : 'Связей пока нет.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {mine.map((rel) => {
            const partner = characters.find((c) => c.id === rel.to_character_id);
            if (!partner) return null;
            return (
              <RelationRow
                key={rel.id}
                relation={rel}
                partner={partner}
                onDelete={() => onDelete(rel.id)}
                onLabelChange={(v) => onLabelChange(rel.id, v)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function RelationRow({ relation, partner, onDelete, onLabelChange }: {
  relation: CharacterRelation;
  partner: Character;
  onDelete: () => void;
  onLabelChange: (label: string) => void;
}) {
  const [label, setLabel] = useState(relation.label);
  const initialRef = useRef(relation.label);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (relation.label !== initialRef.current) {
      setLabel(relation.label);
      initialRef.current = relation.label;
    }
  }, [relation.label]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLabel(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { onLabelChange(v); }, 700);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 12px var(--font-ui)', color: 'var(--ink-2)', flexShrink: 0 }}>{initialsFromName(partner.name || 'Без имени')}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ font: '500 13px var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.name || 'Без имени'}</div>
        <input
          value={label}
          onChange={onChange}
          placeholder="кем приходится"
          style={{ width: '100%', font: '400 11.5px var(--font-ui)', color: 'var(--ink-3)', background: 'transparent', border: 'none', outline: 'none', padding: '2px 0' }}
        />
      </div>
      <button
        onClick={onDelete}
        title="Удалить связь"
        style={{ background: 'transparent', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', padding: '2px 6px', display: 'flex', alignItems: 'center', borderRadius: 4, font: '400 16px var(--font-ui)', lineHeight: 1 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-4)'; }}
      >
        ×
      </button>
    </div>
  );
}

