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

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.2,
  ignoreErrors: [
    // VK ID SDK делает внутренние запросы к id.vk.ru при инициализации виджета;
    // если VK недоступен (блокировщик, РФ-провайдер) — летит unhandled rejection.
    // Ошибка не в нашем коде и не требует действий с нашей стороны.
    /Failed to fetch.*id\.vk\.ru/,
  ],
});
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
