export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'as-theme';

export function getStoredTheme(): Theme {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' ? raw : 'dark';
}

export function applyTheme(theme: Theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem(STORAGE_KEY, theme);
}
