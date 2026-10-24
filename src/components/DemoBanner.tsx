import { useNavigate } from 'react-router-dom';
import { LogoMark } from './LogoMark';

// Верхняя полоса демо-режима: напоминает, что это песочница, и ведёт на регистрацию.
// Рендерится страницей /demo как in-flow элемент над редактором.
export function DemoBanner() {
  const navigate = useNavigate();
  return (
    <div className="demo-banner">
      <LogoMark size={18} />
      <span className="demo-banner__title">Демо-режим</span>
      <span className="demo-banner__desc">
        Печатайте и переключайте главы — это живой редактор. Изменения не сохранятся.
      </span>
      <button
        type="button"
        className="btn btn--primary btn--sm demo-banner__cta"
        onClick={() => navigate('/login?tab=signup')}
      >
        Начать свою книгу →
      </button>
    </div>
  );
}
