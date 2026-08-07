import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  initialsFromName,
  ROLE_LABELS,
  uploadCharacterAvatar,
  deleteCharacterAvatar,
  type Character,
  type CharacterPatch,
  type CharacterRole,
} from '../lib/characters';
import { findNameVariantsInText } from '../lib/crossrefs';
import { Icon } from './Icon';

const AVATAR_MAX_FILE_BYTES = 2 * 1024 * 1024;

export function CharacterHeroBlock({ character, bookId, onChange, onError, isMobile = false }: {
  character: Character;
  bookId: string;
  onChange: (patch: CharacterPatch) => void;
  onError: (msg: string) => void;
  isMobile?: boolean;
}) {
  const [name, setName] = useState(character.name);
  const [quote, setQuote] = useState(character.quote);
  const [aliases, setAliases] = useState<string[]>(character.aliases ?? []);
  const [aliasInput, setAliasInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [editingQuote, setEditingQuote] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);
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

  const onAvatarDelete = async () => {
    if (!character.avatar_url) return;
    setAvatarDeleting(true);
    try {
      await deleteCharacterAvatar(character.id, character.avatar_url);
      onChange({ avatar_url: null });
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setAvatarDeleting(false);
    }
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > AVATAR_MAX_FILE_BYTES) { onError('Файл слишком большой. Максимум 2 МБ.'); return; }
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
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 32, alignItems: isMobile ? 'center' : 'flex-start', marginBottom: 36 }}>
      <div
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={() => setAvatarHovered(true)}
        onMouseLeave={() => setAvatarHovered(false)}
        title={character.avatar_url ? 'Сменить портрет' : 'Загрузить портрет'}
        style={{ width: isMobile ? 120 : 160, height: isMobile ? 150 : 200, borderRadius: 8, background: 'linear-gradient(160deg, oklch(0.45 0.04 50), oklch(0.25 0.02 50))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 18, position: 'relative', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}
      >
        {!character.avatar_url && (
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, oklch(0.40 0.04 50) 0 6px, oklch(0.36 0.04 50) 6px 12px)', opacity: 0.4 }} />
        )}
        {character.avatar_url && (
          <img src={character.avatar_url} alt={name} decoding="async" onLoad={e => { (e.currentTarget as HTMLImageElement).style.opacity = '1'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0, transition: 'opacity 0.25s ease' }} />
        )}
        {!character.avatar_url && (
          <div style={{ position: 'relative', font: '600 56px var(--font-serif)', color: 'oklch(0.95 0.01 80 / 0.9)', letterSpacing: '-0.02em' }}>
            {initialsFromName(name)}
          </div>
        )}
        {(avatarHovered || avatarUploading || avatarDeleting) && (
          <div style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, color: 'oklch(0.98 0 0)' }}>
            {(avatarUploading || avatarDeleting)
              ? <span style={{ font: '400 11px var(--font-ui)' }}>{avatarDeleting ? 'Удаление…' : 'Загрузка…'}</span>
              : <><Icon name="camera" size={20} /><span style={{ font: '400 10px var(--font-ui)', letterSpacing: '0.04em' }}>{character.avatar_url ? 'Сменить' : 'Загрузить'}</span></>
            }
          </div>
        )}
        {avatarHovered && character.avatar_url && !avatarUploading && !avatarDeleting && (
          <button
            onClick={(e) => { e.stopPropagation(); void onAvatarDelete(); }}
            title="Удалить портрет"
            aria-label="Удалить портрет"
            style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 4, background: 'oklch(0.35 0.18 20 / 0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.98 0 0)', zIndex: 2, padding: 0 }}
          >
            <Icon name="trash" size={11} />
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => { void onFileChange(e); }} />
      </div>

      <div style={{ flex: 1, minWidth: 0, width: isMobile ? '100%' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {(['protagonist', 'secondary', 'minor'] as const).map((r) => (
            <button
              key={r}
              onClick={() => onRoleChange(r)}
              className={'chip' + (character.role === r ? ' chip--accent' : '')}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>

        <input
          value={name}
          onChange={onNameChange}
          placeholder="Имя персонажа"
          aria-label="Имя персонажа"
          maxLength={100}
          autoFocus={!character.name}
          style={{ width: '100%', font: `600 ${isMobile ? 28 : 44}px var(--font-serif)`, letterSpacing: '-0.018em', marginBottom: 6, background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', padding: '4px 0', textAlign: isMobile ? 'center' : 'left' }}
        />

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
            <span style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Другие имена
            </span>
            {!isMobile && (
              <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)' }}>
                — система найдёт упоминания в главах автоматически
              </span>
            )}
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
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', padding: '3px 9px', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 999, font: '400 12px var(--font-ui)', color: 'var(--ink-2)' }}
              >
                <span style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{alias}</span>
                <button
                  type="button"
                  onClick={() => removeAlias(alias)}
                  className="alias-remove-btn"
                  aria-label={`Удалить псевдоним ${alias}`}
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
            style={{ width: '100%', maxWidth: 560, font: '400 15px/1.65 var(--font-serif)', color: quote ? 'var(--ink-2)' : 'var(--ink-4)', fontStyle: 'italic', borderBottom: '1px solid var(--border-soft)', padding: '0 0 6px 0', cursor: 'text', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minHeight: '1.65em' }}
          >
            {quote || 'Цитата или девиз персонажа'}
          </div>
        )}
      </div>
    </div>
  );
}
