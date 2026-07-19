import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCharacterFilter, type RoleFilter } from '../lib/useCharacterFilter';
import { motion } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useErrorState } from '../lib/useErrorState';
import { useResponsive } from '../lib/useResponsive';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Sidebar, WithMode } from '../components/Chrome';
import { MobileSidebarDrawer } from '../components/MobileSidebarDrawer';
import { CharacterFieldCard } from '../components/CharacterFieldCard';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { useAuth } from '../lib/auth';
import { getPlanLimits } from '../lib/profiles';
import { useProfile } from '../lib/queries';
import {
  initialsFromName,
  ROLE_LABELS,
  ROLE_COLOR,
  ROLE_PORTRAIT_BG,
  type Character,
  type CharacterPatch,
} from '../lib/characters';
import { QUERY_KEYS, useBook, useCharacters, useRelationships, useCharacterSearch } from '../lib/queries';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useDebouncedSave } from '../lib/useDebouncedSave';
import { useCharacterNavigation } from '../lib/useCharacterNavigation';
import { useCreateOnMount } from '../lib/useCreateOnMount';
import { useCharacterMutations, charInfiniteUpdate } from '../lib/useCharacterMutations';
import { CharacterHeroBlock } from '../components/CharacterHeroBlock';
import { CharacterRelationsBlock } from '../components/CharacterRelationsBlock';
import { CharacterChaptersTab } from '../components/CharacterChaptersTab';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type DetailTab = 'info' | 'chapters';

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'все' },
  { value: 'protagonist', label: 'гл.' },
  { value: 'secondary', label: 'вт.' },
  { value: 'minor', label: 'эп.' },
];


export default function Characters() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: profile } = useProfile(user?.id);
  const limits = getPlanLimits(profile?.plan);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { data: book } = useBook(bookId);
  const { data: characters, error: charsQueryError, fetchNextPage, hasNextPage, isFetchingNextPage } = useCharacters(bookId);
  const { data: relationships, error: relsQueryError } = useRelationships(bookId);
  const { error: mutationError, setError, clearError } = useErrorState();
  useEffect(() => {
    if (!mutationError) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [mutationError, clearError]);
  const queryError = charsQueryError?.message ?? relsQueryError?.message ?? null;
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');
  const [charToDelete, setCharToDelete] = useState<Character | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('info');
  const { isMobile } = useResponsive();
  const [sbOpen, setSbOpen] = useState(false);

  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const isSearchActive = debouncedQuery.trim() !== '' || roleFilter !== 'all';
  const isTyping = query !== debouncedQuery;
  const { data: searchResults } = useCharacterSearch(bookId, debouncedQuery, roleFilter);
  const clientFiltered = useCharacterFilter(characters, roleFilter, query);
  const filtered = isSearchActive && !isTyping ? (searchResults ?? clientFiltered) : clientFiltered;

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
      setSaveState('saving');
      try {
        await onUpdate(id, patch);
        setSaveState('saved');
      } catch (e) {
        setSaveState('error');
        setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
        throw e;
      }
    },
    700,
  );

  const scheduleSave = useCallback((id: string, patch: CharacterPatch) => {
    if (bookId) {
      queryClient.setQueryData<InfiniteData<Character[]>>(QUERY_KEYS.characters(bookId), (prev) =>
        charInfiniteUpdate(prev, id, patch),
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

  const handleCreated = useCallback((id: string) => {
    const next = new URLSearchParams(search);
    next.delete('create'); // prevent stale ?create=true being reintroduced after async creation
    next.set('character', id);
    setSearch(next, { replace: false });
    setViewMode('detail');
  }, [search, setSearch, setViewMode]);

  const handleDeleted = useCallback((remaining: Character[], deletedId: string) => {
    setCharToDelete(null);
    if (deletedId !== activeId) return;
    const next = new URLSearchParams(search);
    if (remaining.length > 0) {
      next.set('character', remaining[0].id);
    } else {
      next.delete('character');
      setViewMode('grid');
    }
    setSearch(next, { replace: true });
  }, [search, setSearch, setViewMode, activeId]);

  const { onCreate, onUpdate, onDeleteConfirmed, onCreateRelationship, onDeleteRelationship, onRelationshipLabelChange } = useCharacterMutations({
    bookId,
    userId: user?.id,
    characters,
    active,
    hasNextPage,
    cancelSave,
    onError: setError,
    onCreated: handleCreated,
    onDeleted: handleDeleted,
  });

  const onCreateRef = useRef(onCreate);
  onCreateRef.current = onCreate;

  const handleCreate = useCallback(() => {
    if ((characters?.length ?? 0) >= limits.maxCharacters) {
      setShowUpgrade(true);
    } else {
      void onCreateRef.current();
    }
  }, [characters?.length, limits.maxCharacters]);

  useCreateOnMount(handleCreate);

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

  if (!book || !characters || !relationships) {
    return (
      <div className="as page-fill--center">
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

  const showSidebar = !isMobile;
  const showMain = true;
  const showGrid = !isMobile ? viewMode === 'grid' : !activeId;

  const activeIndex = active ? filtered.findIndex((c) => c.id === active.id) : -1;
  const prevChar = activeIndex > 0 ? (filtered[activeIndex - 1] ?? null) : null;
  const nextChar = activeIndex >= 0 && activeIndex < filtered.length - 1 ? (filtered[activeIndex + 1] ?? null) : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }} style={{ height: '100%' }}>
    <WithMode>
      <div className="as as-app" style={{ height: '100%', gridTemplateColumns: isMobile ? '1fr' : '260px 1fr' }}>
        {showSidebar && <Sidebar book={book} subtitle={`персонажи · ${filtered.length}`}><></></Sidebar>}

        {showMain && <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
          {/* Тулбар */}
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isMobile && (
                <button type="button" className="tb-btn" onClick={() => setSbOpen(true)} title="Навигация" aria-label="Навигация" style={{ flexShrink: 0 }}>
                  <Icon name="panel" size={16} />
                </button>
              )}
              {isMobile && activeId && (
                <button className="tb-btn" onClick={clearCharacter} title="К списку персонажей" aria-label="К списку персонажей">
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
                {!isMobile && viewMode === 'detail' && active ? (active.name || 'Без имени') : (isMobile ? 'Персонажи' : 'Картотека персонажей')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Grid: поиск + фильтры по роли */}
              {!isMobile && showGrid && (
                <>
                  <div className="tb-search">
                    <Icon name="search" size={12} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Поиск"
                      aria-label="Поиск персонажей"
                      className="tb-search__input"
                    />
                  </div>
                  <div className="tb-grp">
                    {ROLE_FILTERS.map((f) => (
                      <button
                        key={f.value}
                        className={'tb-btn' + (roleFilter === f.value ? ' tb-btn--on' : '')}
                        onClick={() => setRoleFilter(f.value)}
                        aria-pressed={roleFilter === f.value}
                        title={f.value !== 'all' ? ROLE_LABELS[f.value] : undefined}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleCreate} className="tb-btn" title="Новый персонаж" aria-label="Новый персонаж">
                    <Icon name="plus" size={14} />
                  </button>
                </>
              )}

              {/* Mobile: поиск + кнопка создания (список персонажей) */}
              {isMobile && showGrid && (
                <>
                  <div className="tb-search">
                    <Icon name="search" size={12} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Поиск"
                      aria-label="Поиск персонажей"
                      className="tb-search__input"
                    />
                  </div>
                  <button onClick={handleCreate} className="tb-btn" title="Новый персонаж" aria-label="Новый персонаж">
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
              {!showGrid && (
                <div className="tb-grp">
                  <button
                    className="tb-btn"
                    onClick={() => prevChar && selectCharacter(prevChar.id)}
                    disabled={!prevChar}
                    title="Предыдущий персонаж"
                    aria-label="Предыдущий персонаж"
                  >
                    <Icon name="arrows" size={13} />
                  </button>
                  <button
                    className="tb-btn"
                    onClick={() => nextChar && selectCharacter(nextChar.id)}
                    disabled={!nextChar}
                    title="Следующий персонаж"
                    aria-label="Следующий персонаж"
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
                    aria-pressed={viewMode === 'grid'}
                    title="Картотека (сетка)"
                    aria-label="Картотека (сетка)"
                  >
                    <Icon name="grid" size={14} />
                  </button>
                  <button
                    className={'tb-btn' + (viewMode === 'detail' ? ' tb-btn--on' : '')}
                    onClick={() => { if (activeId) setViewMode('detail'); }}
                    disabled={!activeId}
                    aria-pressed={viewMode === 'detail'}
                    title="Детальная карточка"
                    aria-label="Детальная карточка"
                  >
                    <Icon name="char" size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Мобилка: фильтр по роли — отдельная строка, без сжатия в тулбар (см. Corkboard.tsx) */}
          {isMobile && showGrid && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--border-soft)' }}>
              {ROLE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setRoleFilter(f.value)}
                  className={'tb-btn' + (roleFilter === f.value ? ' tb-btn--on' : '')}
                  aria-pressed={roleFilter === f.value}
                  title={f.value !== 'all' ? ROLE_LABELS[f.value] : undefined}
                  style={{ border: '1px solid var(--border)', borderRadius: 7 }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Основное содержимое */}
          {!showGrid && active ? (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: isMobile ? '20px 16px' : '32px 48px' }}>
              <CharacterHeroBlock character={active} bookId={bookId!} onChange={(patch) => scheduleSave(active.id, patch)} onError={setError} isMobile={isMobile} />

              {/* Вкладки */}
              <div className="char-tabs" role="tablist" aria-label="Вкладки персонажа">
                {(['info', 'chapters'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={detailTab === tab}
                    onClick={() => setDetailTab(tab)}
                    className={`char-tab${detailTab === tab ? ' char-tab--on' : ''}`}
                  >
                    {tab === 'info' ? 'Сведения' : 'Главы'}
                  </button>
                ))}
              </div>

              {detailTab === 'info' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
                    <CharacterFieldCard
                      label="Внешность"
                      hint="Внешний вид, манера держаться, первое впечатление"
                      value={active.appearance}
                      onChange={(v) => scheduleSave(active.id, { appearance: v })}
                    />
                    <CharacterFieldCard
                      label="Характер"
                      hint="Черты личности, привычки, реакции на стресс"
                      value={active.personality}
                      onChange={(v) => scheduleSave(active.id, { personality: v })}
                    />
                    <CharacterFieldCard
                      label="Внутренний мир"
                      hint="Что думает и чувствует внутри — страхи, желания, скрытое"
                      value={active.interior_life}
                      onChange={(v) => scheduleSave(active.id, { interior_life: v })}
                    />
                    <CharacterFieldCard
                      label="Внешнее поведение"
                      hint="Как выглядит в глазах других — слова, поступки, маска"
                      value={active.exterior_life}
                      onChange={(v) => scheduleSave(active.id, { exterior_life: v })}
                    />
                    <div style={{ gridColumn: '1 / -1' }}>
                      <CharacterFieldCard
                        label="Разрыв"
                        hint="Где внутреннее расходится с внешним — источник конфликта"
                        value={active.gap}
                        onChange={(v) => scheduleSave(active.id, { gap: v })}
                      />
                    </div>
                    <CharacterFieldCard
                      label="Предыстория"
                      hint="События прошлого, сформировавшие персонажа"
                      value={active.backstory}
                      onChange={(v) => scheduleSave(active.id, { backstory: v })}
                    />
                    <CharacterFieldCard
                      label="Авторские заметки"
                      value={active.notes}
                      onChange={(v) => scheduleSave(active.id, { notes: v })}
                      warn
                    />
                  </div>

                  <CharacterRelationsBlock
                    activeId={active.id}
                    characters={characters}
                    relationships={relationships}
                    onCreate={onCreateRelationship}
                    onDelete={onDeleteRelationship}
                    onLabelChange={onRelationshipLabelChange}
                  />
                </>
              ) : (
                <CharacterChaptersTab
                  characterId={active.id}
                  characterIndex={characters ? characters.findIndex((c) => c.id === active.id) : 0}
                  onNavigate={(chapterId) => navigate(`/books/${bookId}/editor?chapter=${chapterId}`)}
                />
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, paddingBottom: 32 }}>
                <button onClick={() => active && setCharToDelete(active)} className="btn btn--danger-ghost">Удалить персонажа</button>
              </div>
            </div>
          ) : (
            <CharacterGrid
              characters={filtered}
              emptyAll={characters.length === 0}
              onSelect={selectCharacter}
              onCreate={handleCreate}
              onDelete={setCharToDelete}
              onClearFilter={() => { setQuery(''); setRoleFilter('all'); }}
              hasMore={!!hasNextPage}
              onLoadMore={() => void fetchNextPage()}
              loadingMore={isFetchingNextPage}
            />
          )}
        </main>}

      </div>

      <ConfirmDialog
        open={!!charToDelete}
        message={charToDelete ? `Удалить «${charToDelete.name || 'Без имени'}»? Это действие нельзя отменить.` : ''}
        onConfirm={() => { void onDeleteConfirmed(charToDelete!.id); }}
        onCancel={() => setCharToDelete(null)}
      />
      <UpgradePrompt open={showUpgrade} feature="characters" onClose={() => setShowUpgrade(false)} />

      <MobileSidebarDrawer
        open={sbOpen}
        onClose={() => setSbOpen(false)}
        book={book}
        subtitle={`персонажи · ${filtered.length}`}
      />
    </WithMode>

    {mutationError && (
      <div
        role="alert"
        tabIndex={0}
        className="toast toast--error"
        onClick={clearError}
        onPointerDown={clearError}
        onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') clearError(); }}
      >
        {mutationError}
      </div>
    )}
    </motion.div>
  );
}

// ─── Обзорная сетка персонажей ────────────────────────────────────────────

const CHAR_CARD_HEIGHT = 168; // __portrait 110px + __body ~58px
const CHAR_GRID_GAP = 14;
const CHAR_GRID_PADDING = 24;
const CHAR_CARD_MIN_WIDTH = 160;

function CharacterGrid({
  characters,
  emptyAll,
  onSelect,
  onCreate,
  onDelete,
  onClearFilter,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
}: {
  characters: Character[];
  emptyAll: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (c: Character) => void;
  onClearFilter?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore?.(); },
      { rootMargin: '120px', root: containerRef.current },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  // characters[] + один слот для AddCard
  const allItems: (Character | null)[] = emptyAll || characters.length === 0
    ? []
    : [...characters, null];

  const columnCount = containerWidth > 0
    ? Math.max(1, Math.floor((containerWidth + CHAR_GRID_GAP) / (CHAR_CARD_MIN_WIDTH + CHAR_GRID_GAP)))
    : 4;
  const rowCount = allItems.length > 0 ? Math.ceil(allItems.length / columnCount) : 0;

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    // estimateSize включает gap: следующий ряд начинается через CHAR_CARD_HEIGHT + CHAR_GRID_GAP
    estimateSize: () => CHAR_CARD_HEIGHT + CHAR_GRID_GAP,
    overscan: 2,
  });

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

  if (characters.length === 0) {
    return (
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px ${CHAR_GRID_PADDING}px 28px` }}>
        <div style={{ paddingTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)' }}>Ничего не найдено</div>
          {onClearFilter && (
            <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={onClearFilter}>
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px ${CHAR_GRID_PADDING}px 28px` }}
    >
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * columnCount;
          const rowItems = allItems.slice(startIdx, startIdx + columnCount);
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: CHAR_CARD_HEIGHT,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                gap: CHAR_GRID_GAP,
              }}
            >
              {rowItems.map((item) =>
                item === null
                  ? <AddCard key="add" onCreate={onCreate} />
                  : <CharacterCard key={item.id} character={item} onSelect={onSelect} onDelete={onDelete} />
              )}
            </div>
          );
        })}
      </div>
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
          <div className="page-spinner" style={{ width: 20, height: 20 }} />
        </div>
      )}
    </div>
  );
}

function CharacterCard({ character: c, onSelect, onDelete }: { character: Character; onSelect: (id: string) => void; onDelete: (c: Character) => void }) {
  return (
    <div className="char-card-wrap">
      <button
        onClick={() => onSelect(c.id)}
        data-testid="character-card"
        className="char-card"
      >
        <div className="char-card__portrait" style={{ background: ROLE_PORTRAIT_BG[c.role] }}>
          {c.avatar_url ? (
            <img
              src={c.avatar_url}
              alt={c.name}
              loading="lazy"
              decoding="async"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span className="char-card__initials">
              {initialsFromName(c.name)}
            </span>
          )}
        </div>
        <div className="char-card__body">
          <div className="char-card__name">{c.name || 'Без имени'}</div>
          <div className="char-card__role" style={{ color: ROLE_COLOR[c.role] }}>
            {ROLE_LABELS[c.role]}
          </div>
        </div>
      </button>
      <button
        className="char-card__del"
        onClick={(e) => { e.stopPropagation(); onDelete(c); }}
        title="Удалить персонажа"
        aria-label="Удалить персонажа"
      >
        ×
      </button>
    </div>
  );
}

function AddCard({ onCreate }: { onCreate: () => void }) {
  return (
    <button onClick={onCreate} className="add-card">
      <Icon name="plus" size={15} />
      Добавить
    </button>
  );
}
