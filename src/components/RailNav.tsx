import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { LogoMark } from './LogoMark';
import { SettingsModal } from './SettingsModal';
import { useUserDisplay } from '../lib/useUserDisplay';

type RailKey = 'editor' | 'characters' | 'map' | 'timeline' | 'notes' | 'dashboard' | 'outline';

interface RailNavProps {
  active?: RailKey;
  bookId?: string;
  style?: CSSProperties;
}

export function RailNav({ active = 'editor', bookId, style }: RailNavProps) {
  const { initials } = useUserDisplay();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const items: Array<[RailKey, Parameters<typeof Icon>[0]['name'], string, string]> = [
    ['dashboard',  'layout', 'Дэшборд',   ''],
    ['editor',     'book',   'Манускрипт', 'editor'],
    ['characters', 'char',   'Персонажи',  'characters'],
    ['timeline',   'clock',  'Хронология', 'timeline'],
    ['notes',      'note',   'Заметки',    'notes'],
    ['outline',    'tree',   'Структура',  'outline'],
    ['map',        'map',    'Карта мира', 'map'],
  ];

  const href = (segment: string) =>
    bookId ? `/books/${bookId}${segment ? `/${segment}` : ''}` : '#';

  return (
    <aside style={{
      position: 'absolute', left: 0, top: 0, bottom: 0, width: 56,
      background: 'var(--bg-deep)', borderRight: '1px solid var(--border-soft)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '14px 0', gap: 6, zIndex: 4, ...style,
    }}>
      <Link to="/books" title="Библиотека" aria-label="Библиотека" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, marginBottom: 8, opacity: 0.75 }}>
        <LogoMark size={28} />
      </Link>
      {items.map(([k, icn, label, segment]) => (
        <Link
          key={k}
          to={href(segment)}
          title={label}
          aria-label={label}
          aria-current={k === active ? 'page' : undefined}
          className={'tb-btn' + (k === active ? ' tb-btn--on' : '')}
          style={{ width: 36, height: 36, borderRadius: 8 }}
        >
          <Icon name={icn} size={17} />
        </Link>
      ))}
      <div style={{ flex: 1 }} />
      <button className="tb-btn" title="Настройки" aria-label="Настройки" style={{ width: 36, height: 36, borderRadius: 8 }} onClick={() => setSettingsOpen(true)}><Icon name="settings" size={17} /></button>
      <div className="sb-avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{initials}</div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
