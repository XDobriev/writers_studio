import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { useWindowWidth } from '../lib/useWindowWidth';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Sidebar, WithMode } from '../components/Chrome';
import { useAuth } from '../lib/auth';
import {
  initialsFromName,
  ROLE_LABELS,
  updateCharacter,
  uploadCharacterAvatar,
  type Character,
  type CharacterPatch,
  type CharacterRole,
} from '../lib/characters';
import type { CharacterRelationship } from '../lib/character_relationships';
import { QUERY_KEYS, useBook, useCharacters, useRelationships, useChapterCharacters } from '../lib/queries';
import { syncCharacterAcrossAllChapters, findNameVariantsInText } from '../lib/crossrefs';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useDebouncedSave } from '../lib/useDebouncedSave';
import { useCharacterNavigation } from '../lib/useCharacterNavigation';
import { useCharacterMutations } from '../lib/useCharacterMutations';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type RoleFilter = 'all' | CharacterRole;
type DetailTab = 'info' | 'chapters';

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'все' },
  { value: 'protagonist', label: 'главные' },
  { value: 'secondary', label: 'второстеп.' },
  { value: 'minor', label: 'эпиз.' },
];

const ROLE_COLOR: Record<CharacterRole, string> = {
  protagonist: 'var(--accent)',
  secondary: 'var(--info)',
  minor: 'var(--ink-4)',
};

const ROLE_PORTRAIT_BG: Record<CharacterRole, string> = {
  protagonist: 'linear-gradient(160deg, oklch(0.38 0.12 30), oklch(0.22 0.07 30))',
  secondary: 'linear-gradient(160deg, oklch(0.34 0.035 60), oklch(0.22 0.02 55))',
  minor: 'linear-gradient(160deg, oklch(0.30 0.03 80), oklch(0.20 0.02 80))',
};

export default function Characters() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: book } = useBook(bookId);
  const { data: characters, error: charsQueryError } = useCharacters(bookId);
  const { data: relationships, error: relsQueryError } = useRelationships(bookId);
  const [mutationError, setError] = useState<string | null>(null);
  const error = charsQueryError?.message ?? relsQueryError?.message ?? mutationError ?? null;
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('info');
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

  const { activeId, search, setSearch, viewMode, setViewMode, selectCharacter, goToGrid, clearCharacter } = useCharacterNavigation({
    isMobile,
    characters,
    filtered,
  });

  const active = useMemo(
    () => (characters && activeId ? characters.find((c) => c.id === activeId) ?? null : null),
    [characters, activeId],
  );

  const { scheduleSave: debouncedSave, flush, cancel: cancelSave } = useDebouncedSave<CharacterPatch>(
    async (id, patch) => {
      if (!bookId) return;
      setSaveState('saving');
      try {
        const updated = await updateCharacter(id, patch);
        queryClient.setQueryData<Character[]>(QUERY_KEYS.characters(bookId), (prev) =>
          prev ? prev.map((c) => (c.id === id ? updated : c)) : prev
        );
        setSaveState('saved');
        if (patch.name !== undefined || patch.aliases !== undefined) {
          void syncCharacterAcrossAllChapters(updated, bookId)
            .then(() => { void queryClient.invalidateQueries({ queryKey: ['chapter-characters'] }); })
            .catch(() => { /* non-critical */ });
        }
      } catch (e) {
        setSaveState('error');
        setError((e as Error).message);
        throw e;
      }
    },
    700,
  );

  const scheduleSave = useCallback((id: string, patch: CharacterPatch) => {
    if (bookId) {
      queryClient.setQueryData<Character[]>(QUERY_KEYS.characters(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? { ...c, ...patch } as Character : c)) : prev
      );
    }
    setSaveState('saving');
    debouncedSave(id, patch);
  }, [debouncedSave, bookId, queryClient]);

  useEffect(() => { setDetailTab('info'); }, [activeId]);

  const lastActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newId = active?.id ?? null;
    if (lastActiveIdRef.current && lastActiveIdRef.current !== newId) {
      void flush();
    }
    lastActiveIdRef.current = newId;
  }, [active, flush]);

  const { onCreate, onDelete, onDeleteConfirmed, onCreateRelationship, onDeleteRelationship, onRelationshipLabelChange } = useCharacterMutations({
    bookId,
    userId: user?.id,
    characters,
    active,
    queryClient,
    search,
    setSearch,
    setViewMode,
    setConfirmDelete,
    setError,
    cancelSave,
  });

  if (!bookId) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <span style={{ font: '500 14px var(--font-ui)', color: 'var(--danger)' }}>Ошибка загрузки</span>
        <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>{error}</span>
      </div>
    );
  }

  if (!book || !characters || !relationships) {
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
  const showGrid = !isMobile && viewMode === 'grid';

  const activeIndex = active ? filtered.findIndex((c) => c.id === active.id) : -1;
  const prevChar = activeIndex > 0 ? (filtered[activeIndex - 1] ?? null) : null;
  const nextChar = activeIndex >= 0 && activeIndex < filtered.length - 1 ? (filtered[activeIndex + 1] ?? null) : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }} style={{ height: '100%' }}>
    <WithMode>
      <div className="as as-app" style={{ height: '100%', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr' }}>
        {showSidebar && <Sidebar book={book} subtitle={`персонажи · ${characters.length}`}><></></Sidebar>}

        {showMain && <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          {/* Тулбар */}
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isMobile && (
                <button className="tb-btn" onClick={clearCharacter} title="К списку персонажей">
                  <Icon name="arrows" size={16} />
                </button>
              )}
              {!isMobile && viewMode === 'detail' && (
                <button
                  className="tb-btn"
                  onClick={goToGrid}
                  style={{ color: 'var(--accent)', borderColor: 'color-mix(in oklch, var(--accent) 25%, transparent)', gap: 5 }}
                >
                  <Icon name="arrows" size={13} />
                  Сетка
                </button>
              )}
              <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)' }}>
                {!isMobile && viewMode === 'detail' && active ? (active.name || 'Без имени') : 'Картотека персонажей'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Grid: поиск + фильтры по роли */}
              {!isMobile && showGrid && (
                <>
                  <div style={{ height: 28, padding: '0 9px', border: '1px solid var(--border-soft)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink-3)' }}>
                    <Icon name="search" size={12} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Поиск"
                      style={{ width: 120, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 12 }}
                    />
                  </div>
                  <div className="tb-grp">
                    {ROLE_FILTERS.map((f) => (
                      <button
                        key={f.value}
                        className={'tb-btn' + (roleFilter === f.value ? ' tb-btn--on' : '')}
                        onClick={() => setRoleFilter(f.value)}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={onCreate} className="tb-btn" title="Новый персонаж">
                    <Icon name="plus" size={14} />
                  </button>
                </>
              )}

              {/* Detail: статус сохранения + стрелки навигации */}
              {!showGrid && (
                <span style={{ font: '400 12px var(--font-ui)', color: saveState === 'error' ? 'var(--danger)' : 'var(--ink-3)' }}>
                  {saveLabel[saveState]}
                </span>
              )}
              {!isMobile && !showGrid && (
                <div className="tb-grp">
                  <button
                    className="tb-btn"
                    onClick={() => prevChar && selectCharacter(prevChar.id)}
                    disabled={!prevChar}
                    title="Предыдущий персонаж"
                    style={!prevChar ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
                  >
                    <Icon name="arrows" size={13} />
                  </button>
                  <button
                    className="tb-btn"
                    onClick={() => nextChar && selectCharacter(nextChar.id)}
                    disabled={!nextChar}
                    title="Следующий персонаж"
                    style={!nextChar ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
                  >
                    <Icon name="chev" size={13} />
                  </button>
                </div>
              )}

              {/* Переключатель grid / detail — только десктоп */}
              {!isMobile && (
                <div className="tb-grp">
                  <button
                    className={'tb-btn' + (viewMode === 'grid' ? ' tb-btn--on' : '')}
                    onClick={goToGrid}
                    title="Картотека (сетка)"
                  >
                    <Icon name="grid" size={14} />
                  </button>
                  <button
                    className={'tb-btn' + (viewMode === 'detail' ? ' tb-btn--on' : '')}
                    onClick={() => { if (activeId) setViewMode('detail'); }}
                    disabled={!activeId}
                    title="Детальная карточка"
                    style={!activeId ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
                  >
                    <Icon name="char" size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Основное содержимое */}
          {!showGrid && active ? (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '32px 48px' }}>
              <HeroBlock character={active} bookId={bookId!} onChange={(patch) => scheduleSave(active.id, patch)} onError={setError} />

              {/* Вкладки */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-soft)', marginBottom: 28 }}>
                {(['info', 'chapters'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    style={{
                      padding: '8px 16px',
                      font: '500 12px var(--font-ui)',
                      color: detailTab === tab ? 'var(--ink)' : 'var(--ink-3)',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: detailTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                      cursor: 'pointer',
                      marginBottom: -1,
                    }}
                  >
                    {tab === 'info' ? 'Сведения' : 'Главы'}
                  </button>
                ))}
              </div>

              {detailTab === 'info' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                    <FieldCard
                      label="Внешность"
                      hint="Внешний вид, манера держаться, первое впечатление"
                      value={active.appearance}
                      onChange={(v) => scheduleSave(active.id, { appearance: v })}
                    />
                    <FieldCard
                      label="Характер"
                      hint="Черты личности, привычки, реакции на стресс"
                      value={active.personality}
                      onChange={(v) => scheduleSave(active.id, { personality: v })}
                    />
                    <FieldCard
                      label="Внутренний мир"
                      hint="Что думает и чувствует внутри — страхи, желания, скрытое"
                      value={active.interior_life}
                      onChange={(v) => scheduleSave(active.id, { interior_life: v })}
                    />
                    <FieldCard
                      label="Внешнее поведение"
                      hint="Как выглядит в глазах других — слова, поступки, маска"
                      value={active.exterior_life}
                      onChange={(v) => scheduleSave(active.id, { exterior_life: v })}
                    />
                    <div style={{ gridColumn: '1 / -1' }}>
                      <FieldCard
                        label="Разрыв"
                        hint="Где внутреннее расходится с внешним — источник конфликта"
                        value={active.gap}
                        onChange={(v) => scheduleSave(active.id, { gap: v })}
                      />
                    </div>
                    <FieldCard
                      label="Предыстория"
                      hint="События прошлого, сформировавшие персонажа"
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
                    relationships={relationships}
                    onCreate={onCreateRelationship}
                    onDelete={onDeleteRelationship}
                    onLabelChange={onRelationshipLabelChange}
                  />
                </>
              ) : (
                <ChaptersTab
                  characterId={active.id}
                  onNavigate={(chapterId) => navigate(`/books/${bookId}/editor?chapter=${chapterId}`)}
                />
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, paddingBottom: 32 }}>
                <button onClick={onDelete} className="btn btn--ghost" style={{ color: 'var(--danger)' }}>Удалить персонажа</button>
              </div>
            </div>
          ) : (
            <CharacterGrid
              characters={filtered}
              emptyAll={characters.length === 0}
              onSelect={selectCharacter}
              onCreate={onCreate}
            />
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
    </motion.div>
  );
}

// ─── Обзорная сетка персонажей ────────────────────────────────────────────

function CharacterGrid({
  characters,
  emptyAll,
  onSelect,
  onCreate,
}: {
  characters: Character[];
  emptyAll: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  if (emptyAll) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '48px 24px' }}>
        <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'var(--surface)', color: 'var(--ink-4)', border: '1px solid var(--border-soft)' }}>
          <Icon name="char" size={22} />
        </div>
        <div style={{ textAlign: 'center', maxWidth: 260 }}>
          <div style={{ font: '500 14px var(--font-ui)', color: 'var(--ink-2)', marginBottom: 6 }}>Картотека пуста</div>
          <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.6 }}>Добавляйте персонажей, описывайте их внешность, характер и связи между ними</div>
        </div>
        <button onClick={onCreate} className="btn btn--primary"><Icon name="plus" size={13} /> Создать персонажа</button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px 28px' }}>
      {characters.length === 0 ? (
        <div style={{ paddingTop: 40, font: '400 13px var(--font-ui)', color: 'var(--ink-3)', textAlign: 'center' }}>
          Ничего не найдено
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 14,
        }}>
          {characters.map((c) => <CharacterCard key={c.id} character={c} onSelect={onSelect} />)}
          <AddCard onCreate={onCreate} />
        </div>
      )}
    </div>
  );
}

function CharacterCard({ character: c, onSelect }: { character: Character; onSelect: (id: string) => void }) {
  return (
    <button
      onClick={() => onSelect(c.id)}
      data-testid="character-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-soft)',
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        textAlign: 'left',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-soft)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
    >
      {/* Портретная область */}
      <div style={{
        height: 110,
        background: ROLE_PORTRAIT_BG[c.role],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {c.avatar_url ? (
          <img
            src={c.avatar_url}
            alt={c.name}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{
            font: '600 34px var(--font-serif)',
            color: 'oklch(0.95 0.01 80 / 0.72)',
            letterSpacing: '-0.02em',
            userSelect: 'none',
          }}>
            {initialsFromName(c.name || 'Без имени')}
          </span>
        )}
      </div>
      {/* Тело карточки */}
      <div style={{ padding: '10px 12px 11px' }}>
        <div style={{
          font: '500 13px var(--font-ui)',
          color: 'var(--ink)',
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {c.name || 'Без имени'}
        </div>
        <div style={{
          font: '500 10px var(--font-mono)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: ROLE_COLOR[c.role],
        }}>
          {ROLE_LABELS[c.role]}
        </div>
      </div>
    </button>
  );
}

function AddCard({ onCreate }: { onCreate: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onCreate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'transparent',
        border: `1px dashed ${hovered ? 'var(--border)' : 'var(--border-soft)'}`,
        borderRadius: 10,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        alignSelf: 'stretch',
        minHeight: 120,
        color: hovered ? 'var(--ink-3)' : 'var(--ink-4)',
        font: '400 12px var(--font-ui)',
        transition: 'border-color 0.15s, color 0.15s',
        width: '100%',
      }}
    >
      <Icon name="plus" size={15} />
      Добавить
    </button>
  );
}

// ─── Блок героя (детальная карточка) ──────────────────────────────────────

function HeroBlock({ character, bookId, onChange, onError }: {
  character: Character;
  bookId: string;
  onChange: (patch: CharacterPatch) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(character.name);
  const [quote, setQuote] = useState(character.quote);
  const [aliases, setAliases] = useState<string[]>(character.aliases ?? []);
  const [aliasInput, setAliasInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [editingQuote, setEditingQuote] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const quoteRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aliasTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAliasesRef = useRef<string[]>(character.aliases ?? []);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  latestAliasesRef.current = aliases;

  useEffect(() => { setName(character.name); }, [character.id, character.name]);
  useEffect(() => { setQuote(character.quote); }, [character.id, character.quote]);
  useEffect(() => { setAliases(character.aliases ?? []); setAliasInput(''); setSuggestions(null); }, [character.id, character.aliases]);
  useEffect(() => {
    if (editingQuote && quoteRef.current) {
      autoResize(quoteRef.current);
      quoteRef.current.focus();
    }
  }, [editingQuote]);

  const loadSuggestions = async () => {
    if (!name || name.length < 2) return;
    setSuggestionsLoading(true);
    try {
      const found = await findNameVariantsInText(name, bookId, aliases);
      setSuggestions(found);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const onNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setName(v);
    onChange({ name: v });
    setSuggestions(null);
  };
  const onQuoteChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setQuote(v);
    onChange({ quote: v });
    autoResize(e.target);
  };
  const onRoleChange = (role: CharacterRole) => onChange({ role });

  const addAlias = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed || aliases.includes(trimmed)) { setAliasInput(''); return; }
    const next = [...aliases, trimmed];
    setAliases(next);
    onChange({ aliases: next });
    setAliasInput('');
  };

  const removeAlias = (alias: string) => {
    const next = latestAliasesRef.current.filter((a) => a !== alias);
    latestAliasesRef.current = next;
    setAliases(next);
    if (aliasTimerRef.current) clearTimeout(aliasTimerRef.current);
    aliasTimerRef.current = setTimeout(() => onChange({ aliases: latestAliasesRef.current }), 300);
  };

  const onAliasKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addAlias(aliasInput); }
    else if (e.key === 'Backspace' && aliasInput === '' && aliases.length > 0) removeAlias(aliases[aliases.length - 1]);
  };

  const onAliasChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(',')) {
      const parts = val.split(',');
      // Аккумулируем локально, не вызывая addAlias повторно через stale closure
      let current = aliases;
      parts.slice(0, -1).forEach((p) => {
        const trimmed = p.trim();
        if (trimmed && !current.includes(trimmed)) current = [...current, trimmed];
      });
      if (current !== aliases) { setAliases(current); onChange({ aliases: current }); }
      setAliasInput(parts[parts.length - 1]);
    } else {
      setAliasInput(val);
    }
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 2 * 1024 * 1024) { onError('Файл слишком большой. Максимум 2 МБ.'); return; }
    setAvatarUploading(true);
    try {
      const url = await uploadCharacterAvatar(character.id, character.user_id, file);
      onChange({ avatar_url: url });
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', marginBottom: 36 }}>
      <div
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={() => setAvatarHovered(true)}
        onMouseLeave={() => setAvatarHovered(false)}
        title={character.avatar_url ? 'Сменить портрет' : 'Загрузить портрет'}
        style={{ width: 160, height: 200, borderRadius: 8, background: 'linear-gradient(160deg, oklch(0.45 0.04 50), oklch(0.25 0.02 50))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 18, position: 'relative', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}
      >
        {!character.avatar_url && (
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, oklch(0.40 0.04 50) 0 6px, oklch(0.36 0.04 50) 6px 12px)', opacity: 0.4 }} />
        )}
        {character.avatar_url && (
          <img src={character.avatar_url} alt={name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {!character.avatar_url && (
          <div style={{ position: 'relative', font: '600 56px var(--font-serif)', color: 'oklch(0.95 0.01 80 / 0.9)', letterSpacing: '-0.02em' }}>
            {initialsFromName(name)}
          </div>
        )}
        {(avatarHovered || avatarUploading) && (
          <div style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, color: 'white' }}>
            {avatarUploading
              ? <span style={{ font: '400 11px var(--font-ui)' }}>Загрузка…</span>
              : <><Icon name="camera" size={20} /><span style={{ font: '400 10px var(--font-ui)', letterSpacing: '0.04em' }}>{character.avatar_url ? 'Сменить' : 'Загрузить'}</span></>
            }
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => { void onFileChange(e); }} />
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

        {/* Другие имена */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <span style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Другие имена
            </span>
            <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)' }}>
              — система найдёт упоминания в главах автоматически
            </span>
            <button
              type="button"
              onClick={() => { void loadSuggestions(); }}
              disabled={suggestionsLoading || name.length < 2}
              style={{ marginLeft: 'auto', font: '400 11px var(--font-ui)', color: 'var(--accent)', background: 'transparent', border: 'none', cursor: name.length < 2 ? 'default' : 'pointer', opacity: name.length < 2 ? 0.4 : 1, padding: 0, flexShrink: 0 }}
            >
              {suggestionsLoading ? 'поиск…' : 'найти в тексте'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {aliases.map((alias) => (
              <span
                key={alias}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 999, font: '400 12px var(--font-ui)', color: 'var(--ink-2)' }}
              >
                {alias}
                <button
                  type="button"
                  onClick={() => removeAlias(alias)}
                  style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', padding: '0 2px', fontSize: 14, lineHeight: 1 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-4)'; }}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={aliasInput}
              onChange={onAliasChange}
              onKeyDown={onAliasKeyDown}
              onBlur={() => { if (aliasInput.trim()) addAlias(aliasInput); }}
              placeholder={aliases.length === 0 ? 'Ваня, Иваныч, Дядя Ваня…' : '+ имя'}
              style={{ flex: '1 1 120px', minWidth: 80, background: 'transparent', border: 'none', outline: 'none', font: '400 12px var(--font-ui)', color: 'var(--ink)', padding: '2px 0' }}
            />
          </div>
          {suggestions !== null && (
            <div style={{ marginTop: 8, borderTop: '1px solid var(--border-soft)', paddingTop: 8 }}>
              {suggestions.length === 0 ? (
                <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)' }}>Вариантов не найдено</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                  <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)', marginRight: 2 }}>В тексте:</span>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        addAlias(s);
                        setSuggestions((prev) => prev ? prev.filter((x) => x !== s) : null);
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 9px', background: 'color-mix(in oklch, var(--accent) 10%, transparent)', border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)', borderRadius: 999, font: '400 11px var(--font-ui)', color: 'var(--accent)', cursor: 'pointer' }}
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {editingQuote ? (
          <textarea
            ref={quoteRef}
            value={quote}
            onChange={onQuoteChange}
            onBlur={() => setEditingQuote(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditingQuote(false); }}
            placeholder="Цитата или девиз персонажа"
            rows={1}
            style={{ width: '100%', maxWidth: 560, font: '400 15px/1.65 var(--font-serif)', color: 'var(--ink-2)', fontStyle: 'italic', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-soft)', outline: 'none', resize: 'none', overflow: 'hidden', padding: '0 0 6px 0', display: 'block' }}
          />
        ) : (
          <div
            onClick={() => setEditingQuote(true)}
            title="Нажмите, чтобы редактировать"
            style={{ width: '100%', maxWidth: 560, font: '400 15px/1.65 var(--font-serif)', color: quote ? 'var(--ink-2)' : 'var(--ink-4)', fontStyle: 'italic', borderBottom: '1px solid var(--border-soft)', padding: '0 0 6px 0', cursor: 'text', whiteSpace: 'pre-wrap', minHeight: '1.65em' }}
          >
            {quote || 'Цитата или девиз персонажа'}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Карточка поля ────────────────────────────────────────────────────────

function FieldCard({ label, value, onChange, warn, hint }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  warn?: boolean;
  hint?: string;
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: hint && !local ? 4 : 10 }}>
        {warn && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />}
        <span style={{ font: '500 10.5px var(--font-mono)', color: warn ? 'var(--accent)' : 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      {hint && !local && (
        <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)', marginBottom: 8, lineHeight: 1.45 }}>{hint}</div>
      )}
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

// ─── Блок связей ──────────────────────────────────────────────────────────

const RELATION_PRESETS = ['Друг', 'Враг', 'Родственник'] as const;

function RelationsBlock({ activeId, characters, relationships, onCreate, onDelete, onLabelChange, panel }: {
  activeId: string;
  characters: Character[];
  relationships: CharacterRelationship[];
  onCreate: (toId: string, labelMine: string, labelTheirs: string) => void;
  onDelete: (id: string) => void;
  onLabelChange: (id: string, labelMine: string, labelTheirs: string) => void;
  panel?: boolean;
}) {
  const myRels = relationships.filter((r) => r.char_a_id === activeId || r.char_b_id === activeId);
  const partnerIds = new Set(myRels.map((r) => r.char_a_id === activeId ? r.char_b_id : r.char_a_id));
  const candidates = characters.filter((c) => c.id !== activeId && !partnerIds.has(c.id));

  const [adding, setAdding] = useState(false);
  const [toId, setToId] = useState('');
  const [labelMine, setLabelMine] = useState('');
  const [labelTheirs, setLabelTheirs] = useState('');

  useEffect(() => {
    setAdding(false);
    setToId('');
    setLabelMine('');
    setLabelTheirs('');
  }, [activeId]);

  const startAdd = () => {
    if (candidates.length === 0) return;
    setAdding(true);
    setToId(candidates[0].id);
    setLabelMine('');
    setLabelTheirs('');
  };

  const applyPreset = (preset: string) => {
    setLabelMine(preset);
    setLabelTheirs('');
  };

  const submit = () => {
    if (!toId) return;
    onCreate(toId, labelMine, labelTheirs);
    setAdding(false);
    setToId('');
    setLabelMine('');
    setLabelTheirs('');
  };

  const wrapStyle = panel
    ? { padding: 0 }
    : { background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '18px 22px', marginBottom: 16 };

  return (
    <div style={wrapStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Связи</span>
        {!adding && (
          <button onClick={startAdd} disabled={candidates.length === 0} className="btn btn--ghost" style={{ fontSize: 12 }}>
            <Icon name="plus" size={12} /> Добавить связь
          </button>
        )}
      </div>

      {adding && (
        <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="input"
            style={{ height: 32, alignSelf: 'flex-start', minWidth: 200 }}
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name || 'Без имени'}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 6 }}>
            {RELATION_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className="chip"
                style={{ cursor: 'pointer', border: 'none', fontSize: 11 }}
              >
                {p}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Как вы видите их</div>
              <input
                value={labelMine}
                onChange={(e) => setLabelMine(e.target.value)}
                placeholder="наставник, спутник, сестра…"
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
                autoFocus
                className="input"
                style={{ width: '100%', height: 32 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Как они видят вас <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(если отличается)</span></div>
              <input
                value={labelTheirs}
                onChange={(e) => setLabelTheirs(e.target.value)}
                placeholder="ученик, хозяин…"
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
                className="input"
                style={{ width: '100%', height: 32 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={submit} className="btn btn--primary" style={{ fontSize: 12 }}>Добавить</button>
            <button onClick={() => setAdding(false)} className="btn btn--ghost" style={{ fontSize: 12 }}>Отмена</button>
          </div>
        </div>
      )}

      {myRels.length === 0 && !adding ? (
        <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)' }}>
          {candidates.length === 0 ? 'Нет других персонажей для связи.' : 'Связей пока нет.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {myRels.map((rel) => {
            const iAmA = rel.char_a_id === activeId;
            const partnerId = iAmA ? rel.char_b_id : rel.char_a_id;
            const partner = characters.find((c) => c.id === partnerId);
            if (!partner) return null;
            const lMine = iAmA ? rel.label_a : rel.label_b;
            const lTheirs = iAmA ? rel.label_b : rel.label_a;
            return (
              <RelationRow
                key={rel.id}
                relId={rel.id}
                partner={partner}
                labelMine={lMine}
                labelTheirs={lTheirs}
                onDelete={() => onDelete(rel.id)}
                onLabelChange={(mine, theirs) => onLabelChange(rel.id, mine, theirs)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Строка связи ─────────────────────────────────────────────────────────

function RelationRow({ relId, partner, labelMine, labelTheirs, onDelete, onLabelChange }: {
  relId: string;
  partner: Character;
  labelMine: string;
  labelTheirs: string;
  onDelete: () => void;
  onLabelChange: (mine: string, theirs: string) => void;
}) {
  const [mine, setMine] = useState(labelMine);
  const [theirs, setTheirs] = useState(labelTheirs);
  const mineRef = useRef(labelMine);
  const theirsRef = useRef(labelTheirs);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (labelMine !== mineRef.current) { setMine(labelMine); mineRef.current = labelMine; }
    if (labelTheirs !== theirsRef.current) { setTheirs(labelTheirs); theirsRef.current = labelTheirs; }
  }, [relId, labelMine, labelTheirs]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const schedule = (m: string, t: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onLabelChange(m, t), 700);
  };

  const onMineChange = (e: ChangeEvent<HTMLInputElement>) => { setMine(e.target.value); schedule(e.target.value, theirs); };
  const onTheirsChange = (e: ChangeEvent<HTMLInputElement>) => { setTheirs(e.target.value); schedule(mine, e.target.value); };

  const symmetric = !theirs || theirs === mine;

  return (
    <div style={{ padding: '10px 12px', border: '1px solid var(--border-soft)', borderRadius: 8, display: 'flex', gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 12px var(--font-ui)', color: 'var(--ink-2)', flexShrink: 0, overflow: 'hidden' }}>
        {partner.avatar_url
          ? <img src={partner.avatar_url} alt={partner.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initialsFromName(partner.name || 'Без имени')}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '500 13px var(--font-ui)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>{partner.name || 'Без имени'}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ font: '500 9.5px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>Вы видите их</div>
            <input
              value={mine}
              onChange={onMineChange}
              placeholder="кем приходятся"
              style={{ width: '100%', font: '400 12px var(--font-ui)', color: 'var(--ink-2)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-soft)', outline: 'none', padding: '2px 0' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '500 9.5px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>Они видят вас</div>
            <input
              value={theirs}
              onChange={onTheirsChange}
              placeholder={symmetric ? '(взаимная)' : 'кем вы им приходитесь'}
              style={{ width: '100%', font: '400 12px var(--font-ui)', color: symmetric ? 'var(--ink-4)' : 'var(--ink-2)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-soft)', outline: 'none', padding: '2px 0' }}
            />
          </div>
        </div>
      </div>
      <button
        onClick={onDelete}
        title="Удалить связь"
        style={{ background: 'transparent', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', padding: '2px 6px', display: 'flex', alignItems: 'flex-start', borderRadius: 4, font: '400 16px var(--font-ui)', lineHeight: 1, flexShrink: 0 }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-4)'; }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Вкладка «Главы» ─────────────────────────────────────────────────────────

function ChaptersTab({ characterId, onNavigate }: {
  characterId: string;
  onNavigate: (chapterId: string) => void;
}) {
  const { data: rows, isLoading } = useChapterCharacters(characterId);

  if (isLoading) {
    return <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)' }}>Загрузка…</div>;
  }

  if (!rows || rows.length === 0) {
    return (
      <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', padding: '16px 0' }}>
        Персонаж ещё не упомянут ни в одной главе
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((cc) => (
        <button
          key={cc.id}
          type="button"
          onClick={() => onNavigate(cc.chapter_id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: 8,
            cursor: 'pointer',
            textAlign: 'left',
            font: '400 13px var(--font-ui)',
            color: 'var(--ink)',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-soft)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
        >
          <span>{cc.chapters?.title || 'Без названия'}</span>
          {cc.auto_detected && (
            <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-3)' }}>(авто)</span>
          )}
        </button>
      ))}
    </div>
  );

}
