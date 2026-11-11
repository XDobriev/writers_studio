// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { usePageMeta } from './usePageMeta';

function MetaProbe(props: Parameters<typeof usePageMeta>[0]) {
  usePageMeta(props);
  return null;
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  document.head.innerHTML = `
    <title>Исходный заголовок</title>
    <meta name="description" content="Исходное описание" />
    <link rel="canonical" href="https://avtorstudio.com/" />
    <meta property="og:title" content="Исходный OG" />
    <meta property="og:description" content="Исходное OG описание" />
    <meta property="og:url" content="https://avtorstudio.com/" />
    <meta name="twitter:title" content="Исходный TW" />
    <meta name="twitter:description" content="Исходное TW описание" />
  `;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.head.innerHTML = '';
});

describe('usePageMeta', () => {
  it('обновляет canonical без завершающего слэша, title и соц-мета и восстанавливает при размонтировании', () => {
    act(() => {
      root.render(
        createElement(MetaProbe, {
          title: 'Тарифы — Авторская студия',
          description: 'Тарифные планы Free, Pro и Lifetime.',
          path: '/offer',
        }),
      );
    });

    expect(document.title).toBe('Тарифы — Авторская студия');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://avtorstudio.com/offer');
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://avtorstudio.com/offer');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Тарифные планы Free, Pro и Lifetime.');
    expect(document.querySelector('meta[name="robots"]')).toBeNull();

    act(() => {
      root.unmount();
    });

    expect(document.title).toBe('Исходный заголовок');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://avtorstudio.com/');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Исходное описание');
  });

  it('добавляет meta robots noindex,nofollow при noindex=true и удаляет после размонтирования', () => {
    act(() => {
      root.render(
        createElement(MetaProbe, {
          title: 'Вход — Авторская студия',
          description: 'Авторизация.',
          path: '/login',
          noindex: true,
        }),
      );
    });

    const robots = document.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute('content')).toBe('noindex,nofollow');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://avtorstudio.com/login');

    act(() => {
      root.unmount();
    });

    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });
});

