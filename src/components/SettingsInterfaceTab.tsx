import { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { applyTheme, getStoredTheme, type Theme } from '../lib/theme';
import { EDITOR_FONTS, getStoredEditorFont, applyEditorFont, EDITOR_FONT_EVENT, type EditorFontId } from '../lib/editorFont';

export function SettingsInterfaceTab() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [activeFont, setActiveFont] = useState<EditorFontId>(getStoredEditorFont);

  useEffect(() => {
    const handler = (e: Event) => setActiveFont((e as CustomEvent<EditorFontId>).detail);
    window.addEventListener(EDITOR_FONT_EVENT, handler);
    return () => window.removeEventListener(EDITOR_FONT_EVENT, handler);
  }, []);

  const handleTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  const handleFont = (id: EditorFontId) => {
    setActiveFont(id);
    applyEditorFont(id);
  };

  return (
    <div id="sm-panel-interface" role="tabpanel" aria-labelledby="sm-tab-interface" tabIndex={0} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', marginBottom: 2 }}>Тема</div>
          <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>Оформление интерфейса</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => handleTheme('dark')}
            aria-pressed={theme === 'dark'}
            className={'btn' + (theme === 'dark' ? ' btn--primary' : ' btn--ghost')}
            style={{ fontSize: 12, gap: 5 }}
          >
            <Icon name="moon" size={13} /> Тёмная
          </button>
          <button
            onClick={() => handleTheme('light')}
            aria-pressed={theme === 'light'}
            className={'btn' + (theme === 'light' ? ' btn--primary' : ' btn--ghost')}
            style={{ fontSize: 12, gap: 5 }}
          >
            <Icon name="sun" size={13} /> Светлая
          </button>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border-soft)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', marginBottom: 2 }}>Шрифт редактора</div>
          <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>Используется при наборе текста</div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
          {EDITOR_FONTS.map(f => (
            <button
              key={f.id}
              onClick={() => handleFont(f.id)}
              aria-pressed={activeFont === f.id}
              style={{
                fontFamily: f.family,
                fontSize: 13,
                padding: '0 12px',
                height: 30,
                borderRadius: 7,
                border: activeFont === f.id ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                background: activeFont === f.id ? 'var(--accent-soft)' : 'transparent',
                color: activeFont === f.id ? 'var(--ink)' : 'var(--ink-3)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'border-color 0.13s, background 0.12s, color 0.12s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{
          background: 'var(--bg-deep)',
          border: '1px solid var(--border-soft)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <div style={{ font: '500 10px var(--font-mono)', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 8 }}>
            {EDITOR_FONTS.find(f => f.id === activeFont)?.fullName} · предпросмотр
          </div>
          <div style={{ fontFamily: EDITOR_FONTS.find(f => f.id === activeFont)?.family, fontSize: 17, lineHeight: 1.78, color: 'var(--ink-2)', transition: 'font-family 0.2s ease' }}>
            Она вошла тихо, как входят люди, которые боятся спугнуть что-то хрупкое.{' '}
            <em>Письмо было всё ещё на столе.</em>
          </div>
        </div>
      </div>
    </div>
  );
}
