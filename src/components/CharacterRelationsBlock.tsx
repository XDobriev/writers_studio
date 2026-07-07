import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { initialsFromName, type Character } from '../lib/characters';
import type { CharacterRelationship } from '../lib/relationships';
import { Icon } from './Icon';

const RELATION_PRESETS = ['Друг', 'Враг', 'Родственник'] as const;

export function CharacterRelationsBlock({ activeId, characters, relationships, onCreate, onDelete, onLabelChange, panel }: {
  activeId: string;
  characters: Character[];
  relationships: CharacterRelationship[];
  onCreate: (toId: string, labelMine: string, labelTheirs: string) => void;
  onDelete: (id: string) => void;
  onLabelChange: (id: string, labelMine: string, labelTheirs: string) => void;
  panel?: boolean;
}) {
  const charMap = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters]);
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

  return (
    <div className={panel ? 'rel-block rel-block--panel' : 'rel-block'}>
      <div className="rel-block__head">
        <span className="rel-block__title">Связи</span>
        {!adding && (
          <button onClick={startAdd} disabled={candidates.length === 0} className="btn btn--ghost btn--sm">
            <Icon name="plus" size={12} /> Добавить связь
          </button>
        )}
      </div>

      {adding && (
        <div className="rel-form">
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="input input--sm rel-form__select"
            aria-label="Персонаж для связи"
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name || 'Без имени'}</option>
            ))}
          </select>

          <div className="rel-presets">
            {RELATION_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className="chip"
              >
                {p}
              </button>
            ))}
          </div>

          <div className="rel-fields">
            <div className="rel-field">
              <div className="rel-field__label">Как вы видите их</div>
              <input
                value={labelMine}
                onChange={(e) => setLabelMine(e.target.value)}
                placeholder="наставник, спутник, сестра…"
                aria-label="Как вы видите их"
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
                autoFocus
                className="input input--sm"
              />
            </div>
            <div className="rel-field">
              <div className="rel-field__label">Как они видят вас <span className="rel-field__label-opt">(если отличается)</span></div>
              <input
                value={labelTheirs}
                onChange={(e) => setLabelTheirs(e.target.value)}
                placeholder="ученик, хозяин…"
                aria-label="Как они видят вас"
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
                className="input input--sm"
              />
            </div>
          </div>

          <div className="rel-form__actions">
            <button onClick={submit} className="btn btn--primary btn--sm">Добавить</button>
            <button onClick={() => setAdding(false)} className="btn btn--ghost btn--sm">Отмена</button>
          </div>
        </div>
      )}

      {myRels.length === 0 && !adding ? (
        <div className="rel-empty">
          {candidates.length === 0 ? 'Нет других персонажей для связи.' : 'Связей пока нет.'}
        </div>
      ) : (
        <div className="rel-list">
          {myRels.map((rel) => {
            const iAmA = rel.char_a_id === activeId;
            const partnerId = iAmA ? rel.char_b_id : rel.char_a_id;
            const partner = charMap.get(partnerId);
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
    <div className="rel-row">
      <div className="rel-row__avatar">
        {partner.avatar_url
          ? <img src={partner.avatar_url} alt={partner.name} loading="lazy" decoding="async" />
          : initialsFromName(partner.name)}
      </div>
      <div className="rel-row__body">
        <div className="rel-row__name">{partner.name || 'Без имени'}</div>
        <div className="rel-row__fields">
          <div className="rel-field">
            <div className="rel-row__label">Вы видите их</div>
            <input
              value={mine}
              onChange={onMineChange}
              placeholder="кем приходятся"
              aria-label="Вы видите их"
              className="rel-row__input"
            />
          </div>
          <div className="rel-field">
            <div className="rel-row__label">Они видят вас</div>
            <input
              value={theirs}
              onChange={onTheirsChange}
              placeholder={symmetric ? '(взаимная)' : 'кем вы им приходитесь'}
              aria-label="Они видят вас"
              className={symmetric ? 'rel-row__input rel-row__input--muted' : 'rel-row__input'}
            />
          </div>
        </div>
      </div>
      <button onClick={onDelete} title="Удалить связь" aria-label="Удалить связь" className="rel-del-btn">
        ×
      </button>
    </div>
  );
}
