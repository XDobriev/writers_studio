import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConsent, setConsent } from '../lib/analytics';

// «Принять» — включает Яндекс.Метрику (src/lib/analytics.ts); «Отклонить» — Метрика
// не загружается. Куки входа (сессия Supabase) нужны для работы и от выбора не зависят.
export function CookieBanner() {
  const [decided, setDecided] = useState(() => getConsent() !== null);
  const ref = useRef<HTMLDivElement>(null);

  // Высота баннера → --cookie-banner-h: экраны на 100dvh (/demo) на мобилке ужимаются на неё,
  // чтобы баннер не перекрывал редактор.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty('--cookie-banner-h', `${el.getBoundingClientRect().height}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--cookie-banner-h');
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
