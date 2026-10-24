import type * as SentryTypes from './sentryClient';
import { deployTarget, scrubBreadcrumb, scrubEvent } from './sentryScrub';

// Sentry (~29 КБ gzip) грузится после первой отрисовки, а не до неё. Пока SDK не готов,
// вызовы копятся в очереди и проигрываются после init; ошибки window — слушаем сами.
type Sentry = typeof SentryTypes;
type Call = (s: Sentry) => void;

const QUEUE_LIMIT = 50;
let sentry: Sentry | null = null;
let queue: Call[] = [];

function run(call: Call) {
  if (sentry) call(sentry);
  else if (queue.length < QUEUE_LIMIT) queue.push(call);
}

export function captureException(...args: Parameters<Sentry['captureException']>) {
  run((s) => s.captureException(...args));
}

export function captureMessage(...args: Parameters<Sentry['captureMessage']>) {
  run((s) => s.captureMessage(...args));
}

export function addBreadcrumb(...args: Parameters<Sentry['addBreadcrumb']>) {
  run((s) => s.addBreadcrumb(...args));
}

function onEarlyError(event: ErrorEvent) {
  captureException(event.error ?? event.message);
}

function onEarlyRejection(event: PromiseRejectionEvent) {
  captureException(event.reason);
}

async function load() {
  const Sentry = await import('./sentryClient');
  const { init } = Sentry;
  const target = deployTarget();
  init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    // production-vps / production-vercel: два зеркала одного релиза различаются в Sentry.
    environment: import.meta.env.PROD ? `production-${target}` : import.meta.env.MODE,
    enabled: !!import.meta.env.VITE_SENTRY_DSN,
    initialScope: { tags: { deploy_target: target } },
    tracesSampleRate: 0.2,
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
    ignoreErrors: [
      // VK ID SDK делает внутренние запросы к id.vk.ru при инициализации виджета;
      // если VK недоступен (блокировщик, РФ-провайдер) — летит unhandled rejection.
      // Ошибка не в нашем коде и не требует действий с нашей стороны.
      /Failed to fetch.*id\.vk\.ru/,
    ],
  });
  sentry = Sentry;
  window.removeEventListener('error', onEarlyError);
  window.removeEventListener('unhandledrejection', onEarlyRejection);
  const pending = queue;
  queue = [];
  pending.forEach((call) => call(Sentry));
}

export function startMonitoring() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  window.addEventListener('error', onEarlyError);
  window.addEventListener('unhandledrejection', onEarlyRejection);
  const start = () => {
    const run = () => { void load(); };
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 3000 });
    else window.setTimeout(run, 1);
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
