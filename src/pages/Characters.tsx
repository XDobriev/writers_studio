import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { WithMode } from '../components/Chrome';
import { useAuth } from '../lib/auth';
import { supabase, type Book } from '../lib/supabase';
import {
  createCharacter,
  deleteCharacter,
  initialsFromName,
  listCharacters,
  ROLE_LABELS,
  updateCharacter,
  type Character,
  type CharacterPatch,
  type CharacterRole,
} from '../lib/characters';

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

  const [book, setBook] = useState<Book | null>(null);
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');

  const activeId = search.get('character');

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      try {
        const [bookRes, list] = await Promise.all([
          supabase.from('books').select('*').eq('id', bookId).single(),
          listCharacters(bookId),
        ]);
        if (cancelled) return;
        if (bookRes.error) throw bookRes.error;
        setBook(bookRes.data as Book);
        setCharacters(list);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

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
    if (!characters || characters.length === 0) return;
    const exists = activeId && characters.some((c) => c.id === activeId);
    if (!exists) {
      const first = filtered[0] ?? characters[0];
      const next = new URLSearchParams(search);
      next.set('character', first.id);
      setSearch(next, { replace: true });
    }
  }, [characters, filtered, activeId, search, setSearch]);

  const active = useMemo(
    () => (characters && activeId ? characters.find((c) => c.id === activeId) ?? null : null),
    [characters, activeId],
  );

  const selectCharacter = useCallback((id: string) => {
    const next = new URLSearchParams(search);
    next.set('character', id);
    setSearch(next, { replace: false });
  }, [search, setSearch]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<CharacterPatch | null>(null);
  const targetIdRef = useRef<string | null>(null);

  const flush = useCallback(async () => {
    const patch = pendingPatch.current;
    const id = targetIdRef.current;
    pendingPatch.current = null;
    if (!patch || !id) return;
    setSaveState('saving');
    try {
      const updated = await updateCharacter(id, patch);
      setCharacters((prev) => prev ? prev.map((c) => (c.id === id ? updated : c)) : prev);
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      setError((e as Error).message);
    }
  }, []);

  const scheduleSave = useCallback((id: string, patch: CharacterPatch) => {
    targetIdRef.current = id;
    pendingPatch.current = { ...(pendingPatch.current ?? {}), ...patch };
    setCharacters((prev) => prev ? prev.map((c) => (c.id === id ? { ...c, ...patch } as Character : c)) : prev);
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flush(); }, 700);
  }, [flush]);

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
        name: 'Новый персонаж',
        role: 'minor',
        position,
      });
      setCharacters((prev) => [...(prev ?? []), created]);
      const next = new URLSearchParams(search);
      next.set('character', created.id);
      setSearch(next, { replace: false });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [bookId, user, characters, search, setSearch]);

  const onDelete = useCallback(async () => {
    if (!active || !characters) return;
    if (!window.confirm(`Удалить «${active.name}»? Это действие нельзя отменить.`)) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingPatch.current = null;
    targetIdRef.current = null;
    try {
      await deleteCharacter(active.id);
      const remaining = characters.filter((c) => c.id !== active.id);
      setCharacters(remaining);
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
  }, [active, characters, search, setSearch]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)' }}>Ошибка: {error}</div>
      </div>
    );
  }

  if (!book || !characters) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink-3)', padding: 32 }}>
        Загрузка…
      </div>
    );
  }

  const saveLabel: Record<SaveState, string> = {
    idle: '',
    saving: 'Сохранение…',
    saved: 'Сохранено',
    error: 'Ошибка сохранения',
  };

  return (
    <WithMode active="characters">
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <aside className="sb">
          <div className="sb-head">
            <div className="sb-book-title">{book.title}</div>
            <div className="sb-book-author">персонажи · {characters.length}</div>
          </div>
          <nav style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {([
              ['book', 'Манускрипт', `/books/${bookId}/editor`, false],
              ['char', 'Персонажи', `/books/${bookId}/characters`, true],
              ['map', 'Карта мира', `/books/${bookId}/map`, false],
              ['clock', 'Хронология', `/books/${bookId}/timeline`, false],
            ] as const).map(([n, l, to, on]) => (
              <Link key={l} to={to} className={'sb-item' + (on ? ' sb-item--on' : '')} style={{ textDecoration: 'none' }}>
                <span style={{ display: 'flex', justifyContent: 'center', color: on ? 'var(--ink)' : 'var(--ink-3)' }}><Icon name={n} size={15} /></span>
                <span className="sb-item-title">{l}</span>
                <span />
              </Link>
            ))}
          </nav>
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
                  style={{ height: 'auto', padding: '8px 10px', width: '100%', textAlign: 'left' }}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 999, background: on ? 'var(--accent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 11px var(--font-ui)', color: on ? 'oklch(0.98 0 0)' : 'var(--ink)', gridRow: '1 / 3', marginRight: 2 }}>{initialsFromName(c.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="sb-item-title">{c.name}</div>
                    <div style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.04em' }}>{ROLE_LABELS[c.role]}{c.age ? ` · ${c.age}` : ''}</div>
                  </div>
                  <span />
                </button>
              );
            })}
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-soft)' }}>
            <button onClick={onCreate} className="btn" style={{ width: '100%', justifyContent: 'center' }}><Icon name="plus" size={13} /> Новый персонаж</button>
          </div>
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <span style={{ font: '500 13px var(--font-ui)' }}>Картотека персонажей</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ font: '400 12px var(--font-ui)', color: saveState === 'error' ? 'var(--danger)' : 'var(--ink-3)' }}>{saveLabel[saveState]}</span>
            </div>
          </div>

          {active ? (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '32px 48px' }}>
              <HeroBlock character={active} onChange={(patch) => scheduleSave(active.id, patch)} onDelete={onDelete} />

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

              <PlaceholderCard label="Связи" hint="Связи с другими персонажами — в следующем заходе" />
              <PlaceholderCard label="Появляется в главах" hint="Привязка к главам — в следующем заходе" />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--ink-3)' }}>
              <div style={{ font: '500 14px var(--font-ui)' }}>В картотеке ещё нет персонажей</div>
              <button onClick={onCreate} className="btn"><Icon name="plus" size={13} /> Создать первого</button>
            </div>
          )}
        </main>
      </div>
    </WithMode>
  );
}

function HeroBlock({ character, onChange, onDelete }: {
  character: Character;
  onChange: (patch: CharacterPatch) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(character.name);
  const [quote, setQuote] = useState(character.quote);
  const [ageInput, setAgeInput] = useState(character.age?.toString() ?? '');

  useEffect(() => { setName(character.name); }, [character.id, character.name]);
  useEffect(() => { setQuote(character.quote); }, [character.id, character.quote]);
  useEffect(() => { setAgeInput(character.age?.toString() ?? ''); }, [character.id, character.age]);

  const onNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setName(v);
    onChange({ name: v.trim() === '' ? 'Без имени' : v });
  };
  const onQuoteChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setQuote(v);
    onChange({ quote: v });
  };
  const onAgeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^\d]/g, '');
    setAgeInput(v);
    onChange({ age: v === '' ? null : Number(v) });
  };
  const onRoleChange = (role: CharacterRole) => {
    onChange({ role });
  };

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 36 }}>
      <div style={{ width: 160, height: 200, borderRadius: 8, background: 'linear-gradient(160deg, oklch(0.45 0.04 50), oklch(0.25 0.02 50))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 18, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, oklch(0.40 0.04 50) 0 6px, oklch(0.36 0.04 50) 6px 12px)', opacity: 0.4 }} />
        <div style={{ position: 'relative', font: '600 56px var(--font-serif)', color: 'oklch(0.95 0.01 80 / 0.9)', letterSpacing: '-0.02em' }}>
          {initialsFromName(name)}
        </div>
        <div style={{ position: 'absolute', top: 8, left: 8, right: 8, font: '400 9px var(--font-mono)', color: 'oklch(0.95 0.01 80 / 0.5)', letterSpacing: '0.14em' }}>ПОРТРЕТ — НЕТ</div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
            <input
              value={ageInput}
              onChange={onAgeChange}
              placeholder="—"
              style={{ width: 48, height: 24, border: '1px solid var(--border-soft)', borderRadius: 4, background: 'var(--surface)', color: 'var(--ink)', font: '500 12px var(--font-ui)', padding: '0 8px', outline: 'none', textAlign: 'center' }}
            />
            <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.06em' }}>лет</span>
          </div>
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

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onDelete} className="btn btn--ghost" style={{ color: 'var(--danger)' }}>Удалить</button>
        </div>
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
    <div style={{ background: warn ? 'oklch(0.70 0.16 25 / 0.08)' : 'var(--surface)', border: `1px solid ${warn ? 'oklch(0.70 0.16 25 / 0.4)' : 'var(--border-soft)'}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {warn && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--danger)' }} />}
        <span style={{ font: '500 10.5px var(--font-mono)', color: warn ? 'var(--danger)' : 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</span>
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

function PlaceholderCard({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px dashed var(--border-soft)', borderRadius: 12, padding: '18px 22px', marginBottom: 16, opacity: 0.7 }}>
      <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)' }}>{hint}</div>
    </div>
  );
}
