import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { useProfile, QUERY_KEYS } from '../lib/queries';
import { addWordToDictionary, removeWordFromDictionary, type Profile } from '../lib/profiles';
import { plural } from '../lib/i18n';

function groupByLetter(words: string[]): [string, string[]][] {
  const sorted = [...words].sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }));
  const map = new Map<string, string[]>();
  for (const w of sorted) {
    const letter = w[0]?.toUpperCase() ?? '#';
    const arr = map.get(letter) ?? [];
    arr.push(w);
    map.set(letter, arr);
  }
  return Array.from(map.entries());
}

export default function Dictionary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile(user?.id);

  const [newWord, setNewWord] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const words = useMemo(() => profile?.user_dictionary ?? [], [profile?.user_dictionary]);

  const filtered = useMemo(() => {
    if (!search.trim()) return words;
    const q = search.toLowerCase();
    return words.filter(w => w.includes(q));
  }, [words, search]);

  const groups = useMemo(() => groupByLetter(filtered), [filtered]);

  const handleAdd = async () => {
    if (!user || !newWord.trim()) return;
    const word = newWord.trim().toLowerCase();
    if (words.includes(word)) { setNewWord(''); return; }
    setAdding(true);
    const prev = queryClient.getQueryData<Profile>(QUERY_KEYS.profile(user.id));
    queryClient.setQueryData<Profile>(QUERY_KEYS.profile(user.id), old =>
      old ? { ...old, user_dictionary: [...old.user_dictionary, word] } : old
    );
    setNewWord('');
    try {
      await addWordToDictionary(user.id, word);
    } catch {
      if (prev) queryClient.setQueryData<Profile>(QUERY_KEYS.profile(user.id), prev);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (word: string) => {
    if (!user) return;
    const prev = queryClient.getQueryData<Profile>(QUERY_KEYS.profile(user.id));
    queryClient.setQueryData<Profile>(QUERY_KEYS.profile(user.id), old =>
      old ? { ...old, user_dictionary: old.user_dictionary.filter(w => w !== word) } : old
    );
    try {
      await removeWordFromDictionary(user.id, word);
    } catch {
      if (prev) queryClient.setQueryData<Profile>(QUERY_KEYS.profile(user.id), prev);
    }
  };

  const wordCount = words.length;

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 80 }}>

        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-soft)',
          position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10,
        }}>
          <button
            onClick={() => navigate(-1)}
            aria-label="Назад"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              font: '500 12px var(--font-ui)', color: 'var(--ink-3)',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 8px 4px 4px', borderRadius: 8, flexShrink: 0,
              transition: 'color 0.15s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <polyline points="10 4 6 8 10 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Назад
          </button>
          <span style={{ flex: 1, font: '600 15px var(--font-ui)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            Словарь
          </span>
          {wordCount > 0 && (
            <span style={{
              font: '500 10.5px var(--font-mono)', letterSpacing: '0.08em',
              color: 'var(--ink-4)', background: 'var(--surface-2)',
              border: '1px solid var(--border-soft)', borderRadius: 999,
              padding: '2px 9px', flexShrink: 0,
            }}>
              {wordCount} {plural(wordCount, 'слово', 'слова', 'слов')}
            </span>
          )}
        </header>

        <div style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Add form */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={newWord}
              onChange={e => setNewWord(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="Новое слово…"
              disabled={adding}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              className="btn btn--primary"
              onClick={handleAdd}
              disabled={adding || !newWord.trim()}
              style={{ flexShrink: 0, height: 44, fontSize: 13, padding: '0 18px' }}
            >
              Добавить
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg
              width="14" height="14" viewBox="0 0 16 16" fill="none"
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)', pointerEvents: 'none' }}
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className="input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Найти в словаре…"
              style={{ width: '100%', fontSize: 13, paddingLeft: 34 }}
            />
          </div>

          <div style={{ height: 1, background: 'var(--border-soft)' }} />

          {/* Empty state — no words yet */}
          {wordCount === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '48px 0', color: 'var(--ink-4)', textAlign: 'center' }}>
              <span style={{ font: '400 13px var(--font-ui)' }}>Словарь пуст.</span>
              <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)', opacity: 0.7 }}>
                Добавьте слова, которые редактор не должен подчёркивать.
              </span>
            </div>
          )}

          {/* No search results */}
          {wordCount > 0 && filtered.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'var(--ink-4)' }}>
              <span style={{ font: '400 13px var(--font-ui)' }}>Ничего не найдено</span>
            </div>
          )}

          {/* Word list grouped by letter */}
          {groups.map(([letter, groupWords]) => (
            <div key={letter} style={{ marginTop: 4 }}>
              <div style={{
                font: '500 10px var(--font-mono)', letterSpacing: '0.14em',
                color: 'var(--ink-4)', padding: '4px 10px 2px',
                textTransform: 'uppercase',
              }}>
                {letter}
              </div>
              {groupWords.map(word => (
                <div key={word} className="dict-row">
                  <span style={{ flex: 1, font: '400 13px var(--font-ui)', color: 'var(--ink-2)', padding: '9px 10px', letterSpacing: '0.01em', overflowWrap: 'anywhere' }}>
                    {word}
                  </span>
                  <button
                    className="dict-del"
                    onClick={() => handleRemove(word)}
                    aria-label={`Удалить «${word}»`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
