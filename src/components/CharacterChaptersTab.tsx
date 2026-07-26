import type { CSSProperties } from 'react';
import { useChapterCharacters } from '../lib/queries';
import { getCharacterColor } from '../lib/pov';

export function CharacterChaptersTab({ characterId, characterIndex, onNavigate }: {
  characterId: string;
  characterIndex: number;
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

  const povRows = rows.filter((r) => r.is_pov);
  const presentRows = rows.filter((r) => !r.is_pov);
  const color = getCharacterColor(characterIndex);

  const povStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '8px 12px',
    background: `color-mix(in oklch, ${color} 14%, transparent)`,
    border: `1px solid color-mix(in oklch, ${color} 28%, transparent)`,
    borderRadius: 8, cursor: 'pointer', textAlign: 'left',
    font: '400 13px var(--font-ui)', color, transition: 'opacity 0.15s',
  };
  const titleStyle: CSSProperties = {
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {povRows.length > 0 && (
        <div>
          <div style={{
            font: '500 9px var(--font-mono)', color,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6,
          }}>
            POV
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {povRows.map((cc) => (
              <button key={cc.id} type="button" onClick={() => onNavigate(cc.chapter_id)} style={povStyle}>
                <span style={titleStyle}>{cc.chapters?.title || 'Без названия'}</span>
                {cc.auto_detected && (
                  <span style={{ font: '400 11px var(--font-ui)', color: `color-mix(in oklch, ${color} 60%, transparent)`, flexShrink: 0 }}>(авто)</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {presentRows.length > 0 && (
        <div>
          <div style={{
            font: '500 9px var(--font-mono)', color: 'var(--ink-4)',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6,
          }}>
            Присутствует
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {presentRows.map((cc) => (
              <button
                key={cc.id} type="button"
                onClick={() => onNavigate(cc.chapter_id)}
                className="chapter-row"
              >
                <span style={titleStyle}>{cc.chapters?.title || 'Без названия'}</span>
                {cc.auto_detected && (
                  <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-3)', flexShrink: 0 }}>(авто)</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
