import { useNavigate } from 'react-router-dom';
import { LogoMark } from './LogoMark';

// Верхняя полоса демо-режима: напоминает, что это песочница, и ведёт на регистрацию.
// Рендерится страницей /demo как in-flow элемент над редактором.
export function DemoBanner() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        height: 46,
        padding: '0 16px',
        background: 'var(--bg-deep)',
        borderBottom: '1px solid var(--border-soft)',
      }}
    >
      <LogoMark size={18} />
      <span style={{ font: '500 12px var(--font-ui)', color: 'var(--ink)', flexShrink: 0 }}>
        Демо-режим
      </span>
      <span
        className="demo-banner-desc"
        style={{
          font: '400 12px var(--font-ui)',
          color: 'var(--ink-3)',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        Печатайте и переключайте главы — это живой редактор. Изменения не сохранятся.
      </span>
      <button
        type="button"
        className="btn btn--primary btn--sm"
        style={{ flexShrink: 0 }}
        onClick={() => navigate('/login?tab=signup')}
      >
        Начать свою книгу →
      </button>
    </div>
  );
}
