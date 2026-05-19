import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/design-system.css';
import { applyTheme, getStoredTheme } from './lib/theme';

// Применяем до рендера, чтобы не было мигания темы
applyTheme(getStoredTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
