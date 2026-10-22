import { describe, expect, it } from 'vitest';
import { scrubBreadcrumb, scrubUrl } from './sentryScrub';

describe('scrubUrl', () => {
  it('маскирует токен расшаренной книги', () => {
    expect(scrubUrl('https://avtorstudio.com/share/abc123')).toBe('https://avtorstudio.com/share/[token]');
    expect(scrubUrl('/share/abc123/')).toBe('/share/[token]/');
  });

  it('убирает query string и hash', () => {
    expect(scrubUrl('https://avtorstudio.com/sb/rest/v1/books?id=eq.42&select=*')).toBe('https://avtorstudio.com/sb/rest/v1/books');
    expect(scrubUrl('https://avtorstudio.com/reset-password#access_token=secret')).toBe('https://avtorstudio.com/reset-password');
    expect(scrubUrl('/share/tok?x=1#y')).toBe('/share/[token]');
  });

  it('не трогает обычные пути', () => {
    expect(scrubUrl('https://avtorstudio.com/books/1/editor')).toBe('https://avtorstudio.com/books/1/editor');
  });
});

describe('scrubBreadcrumb', () => {
  it('чистит url/from/to навигации и запросов', () => {
    const crumb = scrubBreadcrumb({ category: 'navigation', data: { from: '/share/t1', to: '/books?x=1', other: 5 } });
    expect(crumb.data).toEqual({ from: '/share/[token]', to: '/books', other: 5 });
  });

  it('без data возвращает как есть', () => {
    const crumb = { category: 'console', message: 'hi' };
    expect(scrubBreadcrumb(crumb)).toBe(crumb);
  });
});
