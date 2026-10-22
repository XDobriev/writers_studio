// Яндекс.Метрика — только после явного согласия в CookieBanner.
// Раньше счётчик стоял безусловно в index.html и работал даже после «Отклонить».
//
// Вебвизор включён, но приватное не записывается: всё содержимое защищённых маршрутов
// (/books/*, /admin, /dictionary, /payment-success) и /share/* обёрнуто в App.tsx в
// контейнер с классами ym-hide-content + ym-disable-keys (текст скрыт, нажатия клавиш
// не пишутся); порталы с текстом рукописи (hover-карточка персонажа, подсказки орфографии)
// помечены теми же классами. Отключать Вебвизор по маршруту в SPA ненадёжно: он
// инициализируется один раз и пишет всю сессию, включая переходы после входа.

const COUNTER_ID = 109723861;
const CONSENT_KEY = 'cookie_consent_v1';

type ConsentValue = 'accepted' | 'rejected';
type YmFn = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

declare global {
  interface Window {
    ym?: YmFn;
  }
}

let started = false;

export function getConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'accepted' || v === 'rejected' ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: ConsentValue): void {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* приватный режим */ }
  if (value === 'accepted') startAnalytics();
}

export function initAnalyticsIfConsented(): void {
  if (getConsent() === 'accepted') startAnalytics();
}

// Не считаем: dev-сборку, локальный превью, headless-браузеры (пререндер, visual-check,
// e2e — у них navigator.webdriver === true).
function canRun(): boolean {
  if (!import.meta.env.PROD) return false;
  if (typeof window === 'undefined' || navigator.webdriver) return false;
  const host = location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

function startAnalytics(): void {
  if (started || !canRun()) return;
  started = true;

  const queue: YmFn = (...args: unknown[]) => {
    (queue.a = queue.a || []).push(args);
  };
  queue.l = Date.now();
  const ym = window.ym || queue;
  window.ym = ym;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://mc.yandex.ru/metrika/tag.js?id=${COUNTER_ID}`;
  document.head.appendChild(script);

  ym(COUNTER_ID, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
}
