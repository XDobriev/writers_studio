import { useEffect } from 'react';

const SITE = 'https://avtorstudio.com';

/**
 * Разметка Schema.org только на той странице, к которой она относится (Google требует
 * соответствия видимому контенту). Раньше FAQPage и три BreadcrumbList стояли в index.html
 * и попадали на все страницы, включая /books/*. Пререндер (scripts/prerender.mjs) снимает
 * page.content() после рендера, поэтому скрипт оказывается в статическом HTML страницы.
 */
export function useJsonLd(id: string, data: Record<string, unknown>) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  useEffect(() => {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.dataset.jsonld = id;
    el.textContent = json;
    document.head.appendChild(el);
    return () => el.remove();
  }, [id, json]);
}

export function breadcrumbJsonLd(name: string, path: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name, item: `${SITE}${path}` },
    ],
  };
}

export function faqJsonLd(items: ReadonlyArray<{ q: string; a: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}
