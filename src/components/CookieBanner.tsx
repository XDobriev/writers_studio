import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConsent, setConsent } from '../lib/analytics';

// «Принять» — включает Яндекс.Метрику (src/lib/analytics.ts); «Отклонить» — Метрика
// не загружается. Куки входа (сессия Supabase) нужны для работы и от выбора не зависят.
export function CookieBanner() {
  const [decided, setDecided] = useState(() => getConsent() !== null);
  const ref = useRef<HTMLDivElement>(null);

  // Место, которое баннер занимает снизу экрана (высота + отступ от края) → --cookie-banner-space:
  // экраны на 100dvh (/demo) ужимаются на него, чтобы баннер не перекрывал редактор.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() =>
      root.style.setProperty('--cookie-banner-space', `${window.innerHeight - el.getBoundingClientRect().top}px`),
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--cookie-banner-space');
    };
  }, [decided]);

  if (decided) return null;

  function accept() {
    setConsent('accepted');
    setDecided(true);
  }

  function reject() {
    setConsent('rejected');
    setDecided(true);
  }

  return (
    <div ref={ref} role="region" aria-label="Согласие на аналитику" className="cookie-banner">
      <span className="cookie-banner__text">
        Для входа нужны технические куки. С вашего согласия подключим Яндекс.Метрику, чтобы
        понимать, как пользуются сайтом; текст ваших книг она не видит.{' '}
        <Link to="/privacy" className="cookie-banner__link">
          Политика&nbsp;конфиденциальности
        </Link>
      </span>
      <div className="cookie-banner__actions">
        <button onClick={reject} className="btn btn--ghost cookie-banner__btn">
          Отклонить
        </button>
        <button onClick={accept} className="btn btn--primary cookie-banner__btn">
          Принять
        </button>
      </div>
    </div>
  );
}
