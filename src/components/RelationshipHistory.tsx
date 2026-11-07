import { useState } from 'react';
import type { Character } from '../lib/characters';
import { orderedRelationshipChapters, resolveRelationship, type CharacterRelationship, type RelationshipChapter, type RelationshipEvent, type RelationshipEventInput } from '../lib/relationships';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';

export type RelationshipState = Pick<CharacterRelationship, 'label_a' | 'label_b' | 'is_secret'>;
export type RelationshipHistoryDraft = { relationshipId: string; editing: 'baseline' | 'new' | RelationshipEvent; value: RelationshipEventInput };

export function RelationshipStateFields({ value, onChange, nameA, nameB, symmetricDefault = false }: {
  value: RelationshipState; onChange: (value: RelationshipState) => void; nameA: string; nameB: string; symmetricDefault?: boolean;
}) {
  return <>
    <label className="rel-field">Отношение: {nameA} → {nameB}
      <input className="input input--sm" aria-label={`${nameA} → ${nameB}`} value={value.label_a} maxLength={200}
        placeholder="друг, соперник, наставник..." onChange={(e) => onChange({ ...value, label_a: e.target.value })} />
    </label>
    <label className="rel-field">Отношение: {nameB} → {nameA} {symmetricDefault && <span className="rel-hint">(если отличается)</span>}
      <input className="input input--sm" aria-label={`${nameB} → ${nameA}`} value={value.label_b} maxLength={200}
        placeholder={symmetricDefault ? 'Взаимно (или введите другое: соперник, тайно завидует...)' : 'друг, соперник, наставник...'} onChange={(e) => onChange({ ...value, label_b: e.target.value })} />
    </label>
    <span className="rel-hint">Можно указать любую свою роль или статус отношений (друг, союзник, соперник, должник и т.д.).</span>
    <label className="rel-secret-toggle"><input type="checkbox" checked={value.is_secret}
      onChange={(e) => onChange({ ...value, is_secret: e.target.checked })} /> Секретная связь
    </label>
    <span className="rel-hint">Тайна внутри сюжета. Автор всегда видит эту связь.</span>
  </>;
}

export function RelationshipHistory({ relationship, characters, chapters, events, chapterId, draft, onDraftChange, onClose, onBaselineSave, onSave, onDelete, onNavigateChapter }: {
  relationship: CharacterRelationship; characters: Character[];
  draft: RelationshipHistoryDraft | null; onDraftChange: (draft: RelationshipHistoryDraft | null) => void;
  chapters: RelationshipChapter[]; events: RelationshipEvent[]; chapterId: string;
  onClose: () => void; onBaselineSave: (id: string, patch: RelationshipState) => Promise<boolean>;
  onSave: (relationshipId: string, input: RelationshipEventInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>; onNavigateChapter: (id: string) => void;
}) {
  const ordered = orderedRelationshipChapters(chapters);
  const ranks = new Map(ordered.map((c, i) => [c.id, i]));
  const myEvents = events.filter((e) => e.relationship_id === relationship.id)
    .sort((a, b) => (ranks.get(a.chapter_id ?? '') ?? Infinity) - (ranks.get(b.chapter_id ?? '') ?? Infinity) || a.id.localeCompare(b.id));
  const nameA = characters.find((c) => c.id === relationship.char_a_id)?.name || 'Без имени';
  const nameB = characters.find((c) => c.id === relationship.char_b_id)?.name || 'Без имени';
  const editing = draft?.editing ?? null;
  const value = draft?.value ?? { chapter_id: null, label_a: '', label_b: '', is_secret: false, note: '' };
  const setValue = (next: RelationshipEventInput) => { if (draft) onDraftChange({ ...draft, value: next }); };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<RelationshipEvent | null>(null);

  const start = (target: 'baseline' | 'new' | RelationshipEvent) => {
    const used = new Set(myEvents.filter((e) => typeof target !== 'object' || e.id !== target.id).map((e) => e.chapter_id));
    const preferred = ranks.has(chapterId) && !used.has(chapterId) ? chapterId : ordered.find((c) => !used.has(c.id))?.id ?? '';
    const targetChapter = typeof target === 'object' && target.chapter_id && ranks.has(target.chapter_id) ? target.chapter_id : preferred;
    const source = target === 'baseline' ? relationship : target === 'new' ? resolveRelationship(relationship, events, chapters, targetChapter) : target;
    onDraftChange({ relationshipId: relationship.id, editing: target, value: {
      label_a: source.label_a, label_b: source.label_b, is_secret: !!source.is_secret,
      chapter_id: targetChapter, note: typeof target === 'object' ? target.note : '',
    } });
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !editing) return;
    setBusy(true); setError('');
    const state = { label_a: value.label_a.trim(), label_b: value.label_b.trim() || (editing === 'new' ? value.label_a.trim() : ''), is_secret: value.is_secret };
    try {
      if (editing === 'baseline') {
        if (!await onBaselineSave(relationship.id, state)) throw new Error('Не удалось сохранить. Попробуйте ещё раз.');
      } else {
        if (!value.chapter_id) throw new Error('Выберите главу изменения.');
        await onSave(relationship.id, { ...value, ...state }, typeof editing === 'object' ? editing.id : undefined);
      }
      onDraftChange(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить изменение.'); }
    finally { setBusy(false); }
  };

  return <section className="rel-history" aria-label="История отношений">
    <div className="rel-history__head"><div><h3>История отношений</h3><p>{nameA} ↔ {nameB}</p></div>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} disabled={busy || !!editing} aria-label="Закрыть историю">×</button>
    </div>
    {error && <div role="alert" className="rel-error">{error}</div>}
    {editing ? <form data-relationship-form className="rel-form" onSubmit={(e) => { void submit(e); }}>
      <h4>{editing === 'baseline' ? 'Исправление исходного состояния' : editing === 'new' ? 'Изменение по сюжету' : 'Исправление записи'}</h4>
      <fieldset disabled={busy}>
        {editing !== 'baseline' && <label className="rel-field">Изменение к концу главы
          <select className="input input--sm" value={value.chapter_id ?? ''} required aria-label="Глава изменения"
            onChange={(e) => setValue({ ...value, chapter_id: e.target.value })}>
            <option value="" disabled>Выберите главу</option>
            {ordered.filter((c) => !myEvents.some((event) => event.chapter_id === c.id && (typeof editing !== 'object' || event.id !== editing.id)))
              .map((c) => <option key={c.id} value={c.id}>{c.title || 'Без названия'}</option>)}
          </select>
        </label>}
        <RelationshipStateFields value={value} onChange={(state) => setValue({ ...value, ...state })} nameA={nameA} nameB={nameB} symmetricDefault={editing === 'new'} />
        {editing !== 'baseline' && <label className="rel-field">Что изменилось и почему <span className="rel-hint">(необязательно)</span>
          <textarea className="input input--sm" rows={3} maxLength={4000} value={value.note} onChange={(e) => setValue({ ...value, note: e.target.value })} />
        </label>}
        <div className="rel-form__actions"><button className="btn btn--primary btn--sm" type="submit">{busy ? 'Сохранение…' : 'Сохранить'}</button>
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => { onDraftChange(null); setError(''); }}>Отмена</button></div>
      </fieldset>
    </form> : <>
      <div className="rel-history__baseline"><span className="rel-kicker">Исходное состояние · без привязки к главе</span>
        <p>{nameA} → {nameB}: {relationship.label_a || 'Без подписи'}</p>
        <p>{nameB} → {nameA}: {relationship.label_b || 'Без подписи'}</p>
        {relationship.is_secret && <span className="rel-secret"><Icon name="lock" size={12} /> Секретная связь</span>}
        <button className="btn btn--ghost btn--sm" onClick={() => start('baseline')}>Исправить исходное</button>
      </div>
      <ol className="rel-timeline">{myEvents.map((event) => {
        const chapter = ordered.find((c) => c.id === event.chapter_id);
        return <li key={event.id} className={chapter ? '' : 'rel-timeline__orphan'}>
          {chapter ? <button className="rel-chapter-link" onClick={() => onNavigateChapter(chapter.id)}>После: {chapter.title || 'Без названия'} →</button>
            : <span className="rel-kicker">Глава удалена: {event.chapter_title || 'Без названия'}</span>}
          {!chapter && <p className="rel-hint">Запись сохранена, но не влияет на граф. Назначьте другую главу через «Исправить».</p>}
          <p>{nameA} → {nameB}: {event.label_a || 'Без подписи'}</p>
          <p>{nameB} → {nameA}: {event.label_b || 'Без подписи'}</p>
          {event.is_secret && <span className="rel-secret"><Icon name="lock" size={12} /> Секретная связь</span>}
          {event.note && <p className="rel-history__note">{event.note}</p>}
          <div className="rel-form__actions"><button className="btn btn--ghost btn--sm" onClick={() => start(event)}>Исправить</button>
            <button className="btn btn--danger-ghost btn--sm" onClick={() => setDeleting(event)}>Удалить запись</button></div>
        </li>;
      })}</ol>
      {myEvents.length === 0 && <p className="rel-hint">Изменений пока нет. Записывайте только поворотные события — состояние сохранится до следующего изменения.</p>}
      <button className="btn btn--primary btn--sm" disabled={!ordered.some((c) => !myEvents.some((e) => e.chapter_id === c.id))} onClick={() => start('new')}>
        <Icon name="plus" size={12} /> Добавить изменение
      </button>
      {ordered.length === 0 && <p className="rel-hint">Создайте главу, чтобы привязать изменение к сюжету.</p>}
    </>}
    <ConfirmDialog open={!!deleting} message="Удалить эту запись истории? Состояние связи будет рассчитано по оставшимся изменениям."
      onCancel={() => setDeleting(null)} onConfirm={async () => {
        if (!deleting) return;
        try { await onDelete(deleting.id); setDeleting(null); }
        catch (e) { setError(e instanceof Error ? e.message : 'Не удалось удалить запись.'); setDeleting(null); }
      }} />
  </section>;
}
