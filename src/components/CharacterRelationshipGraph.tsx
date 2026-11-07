import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { getRelationshipGraph, getRelationshipEdge, getRelationshipLayout } from '../lib/relationshipGraph';
import { initialsFromName, ROLE_LABELS, type Character } from '../lib/characters';
import { getCharacterColor } from '../lib/pov';
import type { CharacterRelationship } from '../lib/relationships';
import { Icon } from './Icon';

type Focus = { kind: 'character' | 'relationship'; id: string } | null;

export function CharacterRelationshipGraph({ activeId, characters, relationships, disabled = false, onSelectCharacter, onSelectRelationship }: {
  activeId: string; characters: Character[]; relationships: CharacterRelationship[];
  disabled?: boolean;
  onSelectCharacter: (id: string) => void; onSelectRelationship: (id: string) => void;
}) {
  const graph = getRelationshipGraph(activeId, characters, relationships);
  const { width, height, center, points } = getRelationshipLayout(graph.characters);
  const coords = [...points.values()];
  const minX = coords.reduce((m, p) => Math.min(m, p.x), center.x);
  const maxX = coords.reduce((m, p) => Math.max(m, p.x), center.x);
  const minY = coords.reduce((m, p) => Math.min(m, p.y), center.y);
  const maxY = coords.reduce((m, p) => Math.max(m, p.y), center.y);
  const boxX = Math.max(0, minX - 104);
  const boxY = Math.max(0, minY - 96);
  const boxW = Math.min(width, Math.max(420, maxX - minX + 208));
  const boxH = Math.min(height, Math.max(360, maxY - minY + 216));
  const uid = useId().replace(/:/g, '');
  const viewport = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(() => new Set());
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null);
  const scale = zoom ?? fitScale;
  const names = new Map(characters.map((c) => [c.id, c.name || 'Без имени']));
  const characterMap = new Map(characters.map((c) => [c.id, c]));
  const active = characterMap.get(activeId);
  const secretCount = graph.relationships.filter((r) => r.is_secret).length;
  const focusedRelationship = focus?.kind === 'relationship' ? graph.relationships.find((r) => r.id === focus.id) : undefined;
  const focusedCharacter = focus?.kind === 'character' ? characterMap.get(focus.id) : undefined;
  const tone = (id: string) => `color-mix(in oklch, ${getCharacterColor(characterMap.get(id)?.position ?? 0)} 58%, var(--atlas-ink))`;

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const frame = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      const topInset = parseFloat(getComputedStyle(element).getPropertyValue('--atlas-top-inset')) || 0;
      const availH = Math.max(240, element.clientHeight - topInset - 36);
      const nextFit = Math.min(1, element.clientWidth / boxW, availH / boxH);
      const nextScale = zoom ?? nextFit;
      setFitScale(nextFit);
      element.scrollLeft = Math.max(0, (center.x - boxX) * nextScale - element.clientWidth / 2);
      element.scrollTop = Math.max(0, topInset + (center.y - boxY) * nextScale - element.clientHeight / 2);
    };
    frame();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(frame);
    observer.observe(element);
    return () => observer.disconnect();
  }, [boxX, boxY, boxW, boxH, center.x, center.y, zoom]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const topInset = parseFloat(getComputedStyle(element).getPropertyValue('--atlas-top-inset')) || 0;
    element.scrollLeft = Math.max(0, (center.x - boxX) * scale - element.clientWidth / 2);
    element.scrollTop = Math.max(0, topInset + (center.y - boxY) * scale - element.clientHeight / 2);
  }, [activeId, boxX, boxY, center.x, center.y, scale]);

  const activate = (action: () => void) => { if (!disabled) action(); };

  return <section className={`rel-atlas${focus ? ' rel-atlas--focused' : ''}${graph.characters.length > 10 ? ' rel-atlas--dense' : ''}`} aria-label="Карта отношений">
    <div className="rel-atlas__heading">
      <div><span className="rel-atlas__eyebrow">Карта отношений</span><h4>{active?.name || 'Без имени'}</h4></div>
      <div className="rel-atlas__numbers"><span><strong>{String(graph.relationships.length).padStart(2, '0')}</strong> связей</span>
        {secretCount > 0 && <span className="rel-atlas__secret-count" aria-label={`Секретных связей: ${secretCount}`}><Icon name="lock" size={13} /> {secretCount}</span>}
      </div>
    </div>
    <div className="rel-atlas__tools" role="group" aria-label="Масштаб графа">
      <button type="button" aria-label="Увеличить граф" title="Увеличить" onClick={() => setZoom(Math.min(2, scale * 1.25))}>+</button>
      <button type="button" aria-label="Уменьшить граф" title="Уменьшить" onClick={() => setZoom(scale * .8)}>−</button>
      <button type="button" aria-label="Уместить граф" title="Уместить граф" onClick={() => setZoom(fitScale)}><Icon name="focus" size={15} /></button>
      <span>{Math.round(scale * 100)}%</span>
    </div>
    <div ref={viewport} className="rel-graph-scroll" tabIndex={0} role="region" aria-label="Граф связей. Прокрутите для просмотра большого окружения.">
      <svg className="rel-graph" viewBox={`${boxX} ${boxY} ${boxW} ${boxH}`} style={{ width: boxW * scale, minWidth: boxW * scale, height: boxH * scale }} aria-label="Связи персонажа">
        <defs>
          <radialGradient id={`${uid}-halo`}><stop stopColor="var(--atlas-accent)" stopOpacity=".08" /><stop offset="1" stopColor="var(--atlas-accent)" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${uid}-medallion`} cx=".3" cy=".2" r="1"><stop stopColor="var(--surface-2)" /><stop offset="1" stopColor="var(--surface)" /></radialGradient>
          <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stopColor="var(--bg-void)" stopOpacity="0" /><stop offset="1" stopColor="var(--bg-void)" stopOpacity=".9" /></linearGradient>
          <filter id={`${uid}-glow`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7" /></filter>
          {graph.characters.map((c) => {
            const p = points.get(c.id)!; const r = c.id === activeId ? 63 : 43;
            return <clipPath key={c.id} id={`${uid}-portrait-${c.id}`}><circle cx={p.x} cy={p.y} r={r} /></clipPath>;
          })}
          {graph.relationships.map((r) => {
            const a = points.get(r.char_a_id)!; const b = points.get(r.char_b_id)!;
            const partner = r.char_a_id === activeId ? r.char_b_id : r.char_a_id;
            return <linearGradient key={r.id} id={`${uid}-edge-${r.id}`} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
              <stop stopColor={r.is_secret ? 'var(--accent-2)' : tone(partner)} stopOpacity=".85" /><stop offset=".5" stopColor={r.is_secret ? 'var(--accent-2)' : tone(partner)} /><stop offset="1" stopColor="var(--atlas-accent)" stopOpacity=".75" />
            </linearGradient>;
          })}
        </defs>
        <g aria-hidden="true" className="rel-atlas__construction">
          <circle cx={center.x} cy={center.y} r={225} fill={`url(#${uid}-halo)`} stroke="none" />
          <ellipse cx={center.x} cy={center.y} rx={Math.max(350, (width - 360) / 2)} ry={Math.max(230, (height - 240) / 2)} />
          <ellipse cx={center.x} cy={center.y} rx={Math.max(270, (width - 520) / 2)} ry={Math.max(170, (height - 360) / 2)} strokeDasharray="2 12" />
          <path d={`M ${center.x - 120} ${center.y} h 240 M ${center.x} ${center.y - 120} v 240`} strokeDasharray="2 8" />
        </g>
        {graph.relationships.map((r, index) => {
          const a = points.get(r.char_a_id)!; const b = points.get(r.char_b_id)!;
          const central = r.char_a_id === activeId || r.char_b_id === activeId;
          const { path, label: { x, y } } = getRelationshipEdge(a, b, central, center);
          const partner = r.char_a_id === activeId ? r.char_b_id : r.char_a_id;
          const rawLabel = (central ? r.char_a_id === activeId ? r.label_a : r.label_b : r.label_a) || 'Без подписи';
          const label = rawLabel.length > 26 ? `${rawLabel.slice(0, 25)}…` : rawLabel;
          const labelWidth = Math.min(208, Math.max(100, label.length * 6.4 + (r.is_secret ? 44 : 28)));
          const highlighted = focus?.kind === 'relationship' ? focus.id === r.id : focus?.kind === 'character' && (r.char_a_id === focus.id || r.char_b_id === focus.id);
          const accessible = `${names.get(r.char_a_id)} → ${names.get(r.char_b_id)}: ${r.label_a || 'Без подписи'}; ${names.get(r.char_b_id)} → ${names.get(r.char_a_id)}: ${r.label_b || 'Без подписи'}${r.is_secret ? '; Секретная связь' : ''}`;
          return <g key={r.id} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} data-relationship-id={r.id}
            aria-label={`История: ${accessible}`} className={`rel-atlas__edge${central ? '' : ' rel-atlas__edge--neighbor'}${highlighted ? ' rel-atlas__edge--lit' : ''}${r.is_secret ? ' rel-atlas__edge--secret' : ''}`}
            style={{ '--rel-tone': r.is_secret ? 'var(--accent-2)' : tone(partner), '--reveal-delay': `${Math.min(index * 35, 280)}ms` } as CSSProperties}
            onPointerEnter={() => setFocus({ kind: 'relationship', id: r.id })} onPointerLeave={() => setFocus(null)} onFocus={() => setFocus({ kind: 'relationship', id: r.id })} onBlur={() => setFocus(null)}
            onClick={() => activate(() => onSelectRelationship(r.id))}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(() => onSelectRelationship(r.id)); } }}>
            <title>{accessible}</title>
            <path className="rel-atlas__edge-hit" d={path} />
            <path className="rel-atlas__edge-glow" d={path} stroke={`url(#${uid}-edge-${r.id})`} filter={`url(#${uid}-glow)`} />
            <path className="rel-atlas__edge-line" d={path} stroke={`url(#${uid}-edge-${r.id})`} strokeDasharray={r.is_secret ? '5 8' : undefined} />
            <rect className="rel-atlas__edge-caption" x={x - labelWidth / 2} y={y - 15} width={labelWidth} height={30} rx={15} />
            {r.is_secret && <g transform={`translate(${x - labelWidth / 2 + 12},${y - 6})`} className="rel-atlas__lock"><Icon name="lock" size={12} /></g>}
            <text className="rel-atlas__edge-label" x={x + (r.is_secret ? 7 : 0)} y={y + 4} textAnchor="middle">{label}</text>
          </g>;
        })}
        {graph.characters.map((c, index) => {
          const p = points.get(c.id)!; const isActive = c.id === activeId; const radius = isActive ? 63 : 43;
          const avatar = c.avatar_url && !failedAvatars.has(c.avatar_url) ? c.avatar_url : null;
          const [firstName, ...rest] = (c.name || 'Без имени').split(/\s+/);
          const lastName = rest.join(' ');
          const highlighted = focus?.kind === 'character' ? focus.id === c.id || c.id === activeId : !!focusedRelationship && (focusedRelationship.char_a_id === c.id || focusedRelationship.char_b_id === c.id);
          return <g key={c.id} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} data-character-id={c.id}
            className={`rel-atlas__node${isActive ? ' rel-atlas__node--hero' : ''}${highlighted ? ' rel-atlas__node--lit' : ''}`}
            aria-label={`Показать связи: ${c.name || 'Без имени'}`} style={{ '--rel-tone': isActive ? 'var(--atlas-accent)' : tone(c.id), '--reveal-delay': `${Math.min(index * 65, 350)}ms` } as CSSProperties}
            onPointerEnter={() => setFocus({ kind: 'character', id: c.id })} onPointerLeave={() => setFocus(null)} onFocus={() => setFocus({ kind: 'character', id: c.id })} onBlur={() => setFocus(null)}
            onClick={() => activate(() => onSelectCharacter(c.id))}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(() => onSelectCharacter(c.id)); } }}>
            <title>{c.name || 'Без имени'} · {ROLE_LABELS[c.role] || 'Персонаж'}</title>
            <circle className="rel-atlas__node-aura" cx={p.x} cy={p.y} r={radius + 17} />
            <circle className="rel-atlas__node-orbit" cx={p.x} cy={p.y} r={radius + 11} strokeDasharray={isActive ? '1 10' : '1 7'} />
            <circle className="rel-atlas__node-rim" cx={p.x} cy={p.y} r={radius + 5} />
            <circle className="rel-atlas__portrait" cx={p.x} cy={p.y} r={radius} fill={`url(#${uid}-medallion)`} />
            {avatar ? <g clipPath={`url(#${uid}-portrait-${c.id})`}>
              <image href={avatar} x={p.x - radius} y={p.y - radius} width={radius * 2} height={radius * 2} preserveAspectRatio="xMidYMid slice"
                onError={() => setFailedAvatars((prev) => new Set(prev).add(avatar))} />
              {isActive && <circle cx={p.x} cy={p.y} r={radius} fill={`url(#${uid}-shade)`} />}
            </g> : <g aria-hidden="true">
              <path className="rel-atlas__monogram-lines" d={`M ${p.x - radius + 9} ${p.y + 18} l ${radius * 1.1} ${-radius * 1.1} M ${p.x - radius + 13} ${p.y + 30} l ${radius * 1.35} ${-radius * 1.35}`} clipPath={`url(#${uid}-portrait-${c.id})`} />
              <text className="rel-atlas__monogram" x={p.x} y={p.y + (isActive ? 12 : 10)} textAnchor="middle">{initialsFromName(c.name || '')}</text>
            </g>}
            {isActive ? <text className="rel-atlas__hero-name" x={p.x} y={p.y + 43} textAnchor="middle" style={avatar ? { fill: 'oklch(0.98 0 0)' } : undefined}>{firstName.slice(0, 16)}</text> : <>
              <text className="rel-atlas__name" x={p.x} y={p.y + 74} textAnchor="middle">{firstName.length > 18 ? `${firstName.slice(0, 17)}…` : firstName}</text>
              <text className="rel-atlas__surname" x={p.x} y={p.y + 94} textAnchor="middle">{lastName.length > 23 ? `${lastName.slice(0, 22)}…` : lastName}</text>
            </>}
            <circle className="rel-atlas__node-pin" cx={p.x + radius * .76} cy={p.y + radius * .65} r={isActive ? 5 : 3.5} />
          </g>;
        })}
      </svg>
    </div>
    <div className="rel-atlas__footer">
      <div className="rel-atlas__legend"><span><i /> Связь</span><span><i className="rel-atlas__legend-secret" /><Icon name="lock" size={11} /> Секретная</span></div>
      <span className="rel-atlas__instruction">{graph.characters.length > 10 ? 'Наведите на связь, чтобы увидеть отношение' : 'Персонаж → окружение · связь → история'}</span>
    </div>
    {(focusedRelationship || focusedCharacter) && <div className="rel-atlas__inspector" aria-hidden="true">
      {focusedRelationship ? <><span className="rel-atlas__eyebrow">{focusedRelationship.is_secret ? 'Секретная связь' : 'Отношения'}</span>
        <strong>{names.get(focusedRelationship.char_a_id)} <span>↔</span> {names.get(focusedRelationship.char_b_id)}</strong>
        <p>{focusedRelationship.label_a || 'Без подписи'} <span>/</span> {focusedRelationship.label_b || 'Без подписи'}</p></>
        : <><span className="rel-atlas__eyebrow">{ROLE_LABELS[focusedCharacter!.role] || 'Персонаж'}</span><strong>{focusedCharacter!.name || 'Без имени'}</strong><p>Нажмите, чтобы исследовать окружение</p></>}
    </div>}
  </section>;
}
