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

  const wrapStyle = panel
    ? { padding: 0 }
    : { background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: '18px 22px', marginBottom: 16 };

  return (
    <div style={wrapStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Связи</span>
        {!adding && (
          <button onClick={startAdd} disabled={candidates.length === 0} className="btn btn--ghost btn--sm">
            <Icon name="plus" size={12} /> Добавить связь
          </button>
        )}
      </div>

      {adding && (
        <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="input input--sm"
            aria-label="Персонаж для связи"
            style={{ alignSelf: 'flex-start', minWidth: 200 }}
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
                aria-label="Как вы видите их"
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false); }}
                autoFocus
                className="input input--sm"
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Как они видят вас <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(если отличается)</span></div>
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

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={submit} className="btn btn--primary btn--sm">Добавить</button>
            <button onClick={() => setAdding(false)} className="btn btn--ghost btn--sm">Отмена</button>
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
              aria-label="Вы видите их"
              style={{ width: '100%', font: '400 12px var(--font-ui)', color: 'var(--ink-2)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-soft)', outline: 'none', padding: '2px 0' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '500 9.5px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>Они видят вас</div>
            <input
              value={theirs}
              onChange={onTheirsChange}
              placeholder={symmetric ? '(взаимная)' : 'кем вы им приходитесь'}
              aria-label="Они видят вас"
              style={{ width: '100%', font: '400 12px var(--font-ui)', color: symmetric ? 'var(--ink-4)' : 'var(--ink-2)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-soft)', outline: 'none', padding: '2px 0' }}
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
