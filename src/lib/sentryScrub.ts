import type { Breadcrumb, Event } from '@sentry/react';

// Токен из /share/<token> — это доступ к книге: любой, кто видит событие в Sentry,
// открыл бы рукопись. Query string и hash режем целиком: там бывают фильтры Supabase
// (id пользователей/книг) и токены авторизации из редиректов (#access_token=…).
export function scrubUrl(url: string): string {
  return url.replace(/\/share\/[^/?#]+/g, '/share/[token]').replace(/[?#].*$/, '');
}

function scrubMaybe(value: unknown): unknown {
  return typeof value === 'string' ? scrubUrl(value) : value;
}

export function scrubEvent<T extends Event>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.query_string;
    if (event.request.headers?.Referer) event.request.headers.Referer = scrubUrl(event.request.headers.Referer);
  }
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb);
  return event;
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  if (!crumb.data) return crumb;
  const data = { ...crumb.data };
  for (const key of ['url', 'from', 'to']) {
    if (key in data) data[key] = scrubMaybe(data[key]);
  }
  return { ...crumb, data };
}

// Различаем зеркала: сборка VPS получает VITE_DEPLOY_TARGET=vps в workflow,
// у Vercel env через vercel.json не задать — определяем по хосту в рантайме.
export function deployTarget(): string {
  const fromEnv = import.meta.env.VITE_DEPLOY_TARGET;
  if (fromEnv) return fromEnv;
  const host = typeof location !== 'undefined' ? location.hostname : '';
  if (host === 'avtorstudio.com' || host === 'www.avtorstudio.com') return 'vps';
  if (host.endsWith('.vercel.app')) return 'vercel';
  return 'local';
}
