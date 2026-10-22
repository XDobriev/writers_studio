import '@fontsource/ibm-plex-sans/cyrillic-300.css';
import '@fontsource/ibm-plex-sans/cyrillic-400.css';
import '@fontsource/ibm-plex-sans/cyrillic-500.css';
import '@fontsource/ibm-plex-sans/cyrillic-600.css';
import '@fontsource/ibm-plex-sans/latin-300.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/cyrillic-400.css';
import '@fontsource/ibm-plex-mono/cyrillic-500.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/lora/cyrillic-400.css';
import '@fontsource/lora/cyrillic-400-italic.css';
import '@fontsource/pt-serif/cyrillic-400.css';
import '@fontsource/pt-serif/cyrillic-400-italic.css';
import '@fontsource/spectral/cyrillic-400.css';
import '@fontsource/spectral/cyrillic-400-italic.css';
import '@fontsource-variable/source-serif-4/wght.css';
import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';

import { deployTarget, scrubBreadcrumb, scrubEvent } from './lib/sentryScrub';
import { reloadOnceForChunkError } from './lib/chunkReload';
import { initAnalyticsIfConsented } from './lib/analytics';

const target = deployTarget();
Sentry.init({
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

// Vite не смог подгрузить чанк/CSS динамического import() (обычно — вкладка открыта
// до деплоя). Один релоад с той же защитой от петли, что в ErrorBoundary; если релоад
// уже был — ошибка идёт дальше, до ErrorBoundary или обработчика вызывающего кода.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForChunkError()) event.preventDefault();
});

initAnalyticsIfConsented();

import App from './App';
import './styles/design-system.css';
import { applyTheme, getStoredTheme } from './lib/theme';
import { applyEditorFont, getStoredEditorFont } from './lib/editorFont';

// Применяем до рендера, чтобы не было мигания темы и шрифта
applyTheme(getStoredTheme());
applyEditorFont(getStoredEditorFont());

const rootEl = document.getElementById('root')!;
// Анти-флэш: index.html помечает <html class="prerender-stale">, когда предотрисованный
// лендинг из SPA-fallback не относится к текущему роуту (см. комментарий в index.html).
// Чистим устаревшую разметку и снимаем класс — #root становится виден уже под React.
// JSON-LD страниц (useJsonLd) запечён пререндером в HTML; index.html лендинга отдаётся
// SPA-fallback-ом для всех роутов, поэтому его FAQPage оказался бы на /offer, /books и т.д.
// Убираем запечённые скрипты — каждая страница вставит свой заново при монтировании.
document.querySelectorAll('script[data-jsonld]').forEach((el) => el.remove());
if (document.documentElement.classList.contains('prerender-stale')) {
  rootEl.textContent = '';
  document.documentElement.classList.remove('prerender-stale');
}

createRoot(rootEl).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
