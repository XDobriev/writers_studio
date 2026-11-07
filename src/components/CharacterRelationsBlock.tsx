import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { initialsFromName, type Character } from '../lib/characters';
import { orderedRelationshipChapters, resolveRelationship, type CharacterRelationship, type RelationshipChapter, type RelationshipEvent, type RelationshipEventInput } from '../lib/relationships';
import { CharacterRelationshipGraph } from './CharacterRelationshipGraph';
import { RelationshipHistory, RelationshipStateFields, type RelationshipState, type RelationshipHistoryDraft } from './RelationshipHistory';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';
import { useCharacterRelationships } from '../lib/useCharacterRelationships';
import '../styles/character-relationships.css';

export interface ChapterMomentDropdownProps {
  id?: string;
  labelId?: string;
  value: string;
  chapters: RelationshipChapter[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ChapterMomentDropdown({
  id = 'rel-moment-trigger',
  labelId,
  value,
  chapters,
  onChange,
  disabled,
}: ChapterMomentDropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const options = useMemo(() => [
    { value: '', label: 'Конец книги' },
    { value: 'baseline', label: 'Исходное состояние' },
    ...orderedRelationshipChapters(chapters).map((c) => ({
      value: c.id,
      label: c.title || 'Без названия',
    })),
  ], [chapters]);

  optionsRef.current.length = options.length;

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const currentOption = selectedIndex >= 0 ? options[selectedIndex] : options[0];
  const currentLabel = currentOption ? currentOption.label : 'Конец книги';

  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
    setHighlightedIndex(selectedIndex >= 0 && selectedIndex < options.length ? selectedIndex : (options.length > 0 ? 0 : -1));
  };

  const closeDropdown = () => {
    setOpen(false);
  };

  const selectOption = (optValue: string) => {
    onChange(optValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (disabled && open) {
      setOpen(false);
    }
  }, [disabled, open]);

  useEffect(() => {
    if (open && highlightedIndex >= options.length) {
      setHighlightedIndex(Math.max(-1, options.length - 1));
    }
  }, [open, options.length, highlightedIndex]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (labelId && document.getElementById(labelId)?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open, labelId]);

  useEffect(() => {
    if (open && highlightedIndex >= 0 && optionsRef.current[highlightedIndex]) {
      const node = optionsRef.current[highlightedIndex];
      if (typeof node?.scrollIntoView === 'function') {
        node.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [open, highlightedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown();
      triggerRef.current?.focus();
      return;
    }

    if (e.key === 'Tab') {
      closeDropdown();
      return;
    }

    if (options.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < 0 || prev >= options.length - 1 ? 0 : prev + 1));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? options.length - 1 : prev - 1));
      return;
    }

    if (e.key === 'Home') {
      e.preventDefault();
      setHighlightedIndex(0);
      return;
    }

    if (e.key === 'End') {
      e.preventDefault();
      setHighlightedIndex(options.length - 1);
      return;
    }

    if (e.key === 'PageUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(0, (prev < 0 ? 0 : prev) - 5));
      return;
    }

    if (e.key === 'PageDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(options.length - 1, (prev < 0 ? 0 : prev) + 5));
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < options.length) {
        selectOption(options[highlightedIndex].value);
      }
    }
  };

  const listboxId = `${id}-listbox`;
  const activeOptionId = open && highlightedIndex >= 0 && highlightedIndex < options.length
    ? `${id}-opt-${highlightedIndex}`
    : undefined;

  return (
    <div className="rel-dropdown" ref={containerRef}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        role="combobox"
        className="input input--sm rel-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        aria-labelledby={labelId ? `${labelId} ${id}` : undefined}
        aria-label={labelId ? undefined : `Момент истории: ${currentLabel}`}
        disabled={disabled}
        onClick={() => {
          if (open) closeDropdown();
          else openDropdown();
        }}
        onKeyDown={handleKeyDown}
        title={currentLabel}
      >
        <span className="rel-dropdown-trigger__text">{currentLabel}</span>
        <span
          className={`rel-dropdown-trigger__chevron ${open ? 'rel-dropdown-trigger__chevron--open' : ''}`}
          aria-hidden="true"
        >
          <Icon name="chevd" size={12} />
        </span>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Момент истории"
          aria-labelledby={labelId ? labelId : undefined}
          tabIndex={-1}
          className="rel-dropdown-menu"
        >
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isHighlighted = index === highlightedIndex;
            return (
              <button
                key={opt.value}
                id={`${id}-opt-${index}`}
                ref={(node) => {
                  optionsRef.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                className={`rel-dropdown-option ${isSelected ? 'rel-dropdown-option--selected' : ''} ${isHighlighted ? 'rel-dropdown-option--highlighted' : ''}`}
                onClick={() => selectOption(opt.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
                title={opt.label}
              >
                <span className="rel-dropdown-option__label">{opt.label}</span>
                {isSelected && (
                  <span className="rel-dropdown-option__check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const PRESET_RELATIONSHIP_ROLES = ['Друг', 'Враг', 'Родственник', 'Союзник', 'Наставник', 'Соперник'] as const;

export type RelationshipWorkspaceDraft = {
  creation: { sourceId: string; toId: string; value: RelationshipState } | null;
  history: RelationshipHistoryDraft | null;
};

export function CharacterRelationsBlock({ activeId, characters, relationships, events, chapters, chapterId, draft: externalDraft, onDraftChange, onChapterChange, onCreate, onDelete, onLabelChange, onSaveEvent, onDeleteEvent, onSelectCharacter, onNavigateChapter, previousCharacter, onBack }: {
  activeId: string; characters: Character[]; relationships: CharacterRelationship[];
  events: RelationshipEvent[]; chapters: RelationshipChapter[]; chapterId: string; onChapterChange: (id: string) => void;
  draft?: RelationshipWorkspaceDraft; onDraftChange?: Dispatch<SetStateAction<RelationshipWorkspaceDraft>>;
  onCreate: (toId: string, labelMine: string, labelTheirs: string, isSecret: boolean, sourceId: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>; onLabelChange: (id: string, state: RelationshipState) => Promise<boolean>;
  onSaveEvent: (relationshipId: string, input: RelationshipEventInput, id?: string) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>; onSelectCharacter: (id: string) => void; onNavigateChapter: (id: string) => void;
  previousCharacter?: string; onBack?: () => void;
}) {
  const charMap = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters]);
  const states = useMemo(() => relationships.map((r) => resolveRelationship(r, events, chapters, chapterId)), [relationships, events, chapters, chapterId]);
  const myRels = states.filter((r) => r.char_a_id === activeId || r.char_b_id === activeId);
  const [localDraft, setLocalDraft] = useState<RelationshipWorkspaceDraft>({ creation: null, history: null });
  const draft = externalDraft ?? localDraft;
  const setDraft = onDraftChange ?? setLocalDraft;
  const adding = !!draft.creation;
  const sourceId = draft.creation?.sourceId ?? activeId;
  const toId = draft.creation?.toId ?? '';
  const value = draft.creation?.value ?? { label_a: '', label_b: '', is_secret: false };
  const setValue = (next: RelationshipState) => setDraft((prev) => prev.creation ? { ...prev, creation: { ...prev.creation, value: next } } : prev);
  const partnerIds = new Set(relationships.filter((r) => r.char_a_id === sourceId || r.char_b_id === sourceId).map((r) => r.char_a_id === sourceId ? r.char_b_id : r.char_a_id));
  const candidates = characters.filter((c) => c.id !== sourceId && !partnerIds.has(c.id));
  const [view, setView] = useState<'graph' | 'list'>('graph');
  const [selectedId, setSelectedId] = useState<string | null>(draft.history?.relationshipId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => {
    setSelectedId(draft.history?.relationshipId ?? null);
    setError('');
  }, [activeId, draft.history?.relationshipId]);
  const selected = relationships.find((r) => r.id === selectedId);

  return <div className="rel-block rel-workspace">
    <div className="rel-block__head">
      {onBack && <button type="button" className="btn btn--ghost btn--sm rel-back" onClick={onBack}>← {previousCharacter || 'Предыдущий персонаж'}</button>}
      <div className="rel-block__title-group">
        <h3>Связи персонажа</h3>
        <button className="btn btn--ghost btn--sm rel-add-btn" disabled={adding || !!draft.history || candidates.length === 0} onClick={() => {
          setSelectedId(null); setDraft((prev) => ({ ...prev, creation: { sourceId: activeId, toId: candidates[0]?.id ?? '', value: { label_a: '', label_b: '', is_secret: false } } })); setError('');
        }}><Icon name="plus" size={12} /> Добавить связь</button>
      </div>
      <p className="rel-hint">Отношения к концу выбранной главы</p>
    </div>
    <div className="rel-toolbar">
      <div className="rel-field">
        <label id="rel-moment-label" htmlFor="rel-moment-trigger">Момент истории</label>
        <ChapterMomentDropdown
          id="rel-moment-trigger"
          labelId="rel-moment-label"
          value={chapterId}
          chapters={chapters}
          onChange={onChapterChange}
          disabled={adding || busy}
        />
      </div>
      <div className="rel-view-switch" role="group" aria-label="Представление связей">
        <button className="btn btn--ghost btn--sm" aria-pressed={view === 'graph'} onClick={() => setView('graph')}><Icon name="tree" size={13} /> Граф</button>
        <button className="btn btn--ghost btn--sm" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" size={13} /> Список</button>
      </div>
    </div>
    {error && <div className="rel-error" role="alert">{error}</div>}
    {draft.history && !relationships.some((r) => r.id === draft.history!.relationshipId) && <div className="rel-form" role="alert">
      <p>Связь удалена. Несохранённый текст оставлен здесь, чтобы его можно было скопировать.</p>
      <p>{draft.history.value.label_a} / {draft.history.value.label_b}</p>
      <p className="rel-history__note">{draft.history.value.note}</p>
      <button className="btn btn--ghost btn--sm" onClick={() => setDraft((prev) => ({ ...prev, history: null }))}>Отменить черновик</button>
    </div>}
    {adding && <form className="rel-form" onSubmit={async (e) => {
      e.preventDefault(); if (busy || !toId) return;
      setBusy(true); setError('');
      try {
        if (await onCreate(toId, value.label_a.trim(), value.label_b.trim(), value.is_secret, sourceId)) setDraft((prev) => ({ ...prev, creation: null }));
        else setError('Связь не сохранена. Попробуйте ещё раз.');
      } catch (e) { setError(e instanceof Error ? e.message : 'Связь не сохранена.'); }
      finally { setBusy(false); }
    }}><fieldset disabled={busy}>
      <label className="rel-field">Персонаж<select className="input input--sm" aria-label="Персонаж для связи" value={toId} onChange={(e) => { const toId = e.target.value; setDraft((prev) => prev.creation ? { ...prev, creation: { ...prev.creation, toId } } : prev); }}>
        {candidates.map((c) => <option key={c.id} value={c.id}>{c.name || 'Без имени'}</option>)}
      </select></label>
      <div className="rel-presets" role="group" aria-label="Быстрый выбор роли">
        {PRESET_RELATIONSHIP_ROLES.map((label) => {
          const isSelected = value.label_a === label;
          return (
            <button
              type="button"
              className={`chip${isSelected ? ' chip--accent' : ''}`}
              key={label}
              aria-pressed={isSelected}
              onClick={() => setValue({
                ...value,
                label_a: isSelected ? '' : label,
                label_b: '',
              })}
            >
              {label}
            </button>
          );
        })}
      </div>
      <RelationshipStateFields value={value} onChange={setValue} symmetricDefault nameA={charMap.get(sourceId)?.name || 'Без имени'} nameB={charMap.get(toId)?.name || 'Без имени'} />
      <p className="rel-hint">Создаётся исходное состояние. Повороты сюжета добавляются в историю связи.</p>
      <div className="rel-form__actions"><button type="submit" className="btn btn--primary btn--sm">{busy ? 'Сохранение…' : 'Добавить'}</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft((prev) => ({ ...prev, creation: null }))}>Отмена</button></div>
    </fieldset></form>}
    {myRels.length === 0 ? <div className="rel-empty">{characters.length < 2 ? 'Создайте ещё одного персонажа, чтобы добавить связь.' : 'Связей пока нет. Добавьте первую — она появится в списке и на графе.'}</div>
      : view === 'graph' ? <>
        <CharacterRelationshipGraph key={activeId} activeId={activeId} characters={characters} relationships={states} disabled={!!draft.history || adding} onSelectCharacter={onSelectCharacter} onSelectRelationship={setSelectedId} />
      </> : <div className="rel-list">{myRels.map((rel) => {
        const iAmA = rel.char_a_id === activeId;
        const partner = charMap.get(iAmA ? rel.char_b_id : rel.char_a_id);
        if (!partner) return null;
        const mine = iAmA ? rel.label_a : rel.label_b;
        const theirs = iAmA ? rel.label_b : rel.label_a;
        return <div key={rel.id} className="rel-row">
          <button className="rel-row__avatar" aria-label={`Связи: ${partner.name || 'Без имени'}`} onClick={() => onSelectCharacter(partner.id)}>{initialsFromName(partner.name)}</button>
          <div className="rel-row__body"><button className="rel-person-link" onClick={() => onSelectCharacter(partner.id)}>{partner.name || 'Без имени'}</button>
            <p>{charMap.get(activeId)?.name || 'Без имени'} → {partner.name || 'Без имени'}: {mine || 'Без подписи'}</p>
            <p>{partner.name || 'Без имени'} → {charMap.get(activeId)?.name || 'Без имени'}: {theirs || 'Без подписи'}</p>
            {rel.is_secret && <span className="rel-secret"><Icon name="lock" size={12} /> Секретная связь</span>}
          </div>
          <div className="rel-row__actions">
            <button className="btn btn--ghost btn--sm" disabled={!!draft.history || adding} onClick={() => setSelectedId(rel.id)}>История</button>
            <button className="rel-del-btn" disabled={!!draft.history || adding} onClick={() => setDeleting(rel.id)} aria-label={`Удалить связь с ${partner.name || 'персонажем'}`}>×</button>
          </div>
        </div>;
      })}</div>}
    {selected && <RelationshipHistory key={selected.id} relationship={selected}
      draft={draft.history} onDraftChange={(history) => setDraft((prev) => ({ ...prev, history }))}
      characters={characters} chapters={chapters} events={events} chapterId={chapterId} onClose={() => setSelectedId(null)}
      onBaselineSave={onLabelChange} onSave={onSaveEvent} onDelete={onDeleteEvent} onNavigateChapter={onNavigateChapter} />}
    <ConfirmDialog open={!!deleting} message="Удалить связь и всю историю её изменений? Это действие нельзя отменить." onCancel={() => setDeleting(null)} onConfirm={async () => {
      if (deleting && await onDelete(deleting)) { setDeleting(null); setSelectedId(null); }
      else { setError('Не удалось удалить связь. Попробуйте ещё раз.'); setDeleting(null); }
    }} />
  </div>;
}

export function CharacterRelationshipsSection({
  bookId,
  activeId,
  characters,
  userId,
  onSelectCharacter,
  onNavigateChapter,
}: {
  bookId: string;
  activeId: string;
  characters: Character[];
  userId?: string;
  onSelectCharacter: (id: string) => void;
  onNavigateChapter: (chapterId: string) => void;
}) {
  const [search] = useSearchParams();
  const rels = useCharacterRelationships({
    bookId,
    userId,
    activeId,
    characters,
  });

  const onBack = rels.previousCharacter
    ? () => {
        const prevId = rels.popTrail();
        if (prevId) onSelectCharacter(prevId);
      }
    : undefined;

  const handleSelectCharacter = (id: string) => {
    if (id !== activeId) {
      rels.pushTrail(activeId);
      onSelectCharacter(id);
    }
  };

  return (
    <>
      {search.get('from') === 'editor' && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() =>
            onNavigateChapter(search.get('chapter') ?? '')
          }
        >
          ← Вернуться к редактору
        </button>
      )}
      {rels.historyError && (
        <div role="alert" className="rel-error">
          Не удалось загрузить историю отношений.
          <button type="button" className="btn btn--ghost btn--sm" onClick={rels.refetchHistory}>
            Повторить
          </button>
        </div>
      )}
      {rels.isLoading ? (
        <p className="rel-hint">Загрузка связей и истории…</p>
      ) : (
        <CharacterRelationsBlock
          activeId={activeId}
          characters={characters}
          relationships={rels.relationships}
          events={rels.events}
          chapters={rels.chapters}
          chapterId={rels.chapterId}
          draft={rels.draft}
          onDraftChange={rels.setDraft}
          onChapterChange={rels.onChapterChange}
          onCreate={rels.onCreate}
          onDelete={rels.onDelete}
          onLabelChange={rels.onLabelChange}
          onSaveEvent={rels.onSaveEvent}
          onDeleteEvent={rels.onDeleteEvent}
          onSelectCharacter={handleSelectCharacter}
          onNavigateChapter={onNavigateChapter}
          previousCharacter={rels.previousCharacter}
          onBack={onBack}
        />
      )}
    </>
  );
}
