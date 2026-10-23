import { useState } from 'react';
import { getConsent, setConsent } from '../lib/analytics';

// Смена выбора из CookieBanner после того, как баннер скрылся: на /privacy.
// Отзыв перезагружает страницу (см. setConsent) — уже загруженный счётчик иначе не остановить.
export function CookieConsentControl() {
  const [consent, setLocal] = useState(getConsent);
  const isOn = consent === 'accepted';

  const toggle = () => {
    const next = isOn ? 'rejected' : 'accepted';
    setConsent(next);
    setLocal(next);
  };

  return (
    <span className="consent-control" role="group" aria-label="Согласие на Яндекс.Метрику">
      <span className="consent-control__state">
        Сейчас: {isOn ? 'Метрика включена' : consent === 'rejected' ? 'Метрика отключена' : 'выбор не сделан, Метрика отключена'}.
      </span>
      <button type="button" onClick={toggle} className="btn btn--ghost btn--sm">
        {isOn ? 'Отозвать согласие' : 'Разрешить Метрику'}
      </button>
    </span>
  );
}
