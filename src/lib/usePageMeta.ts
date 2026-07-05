import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description: string;
  path: string;
  /** Ставит <meta name="robots" content="noindex,nofollow"> на время жизни страницы. */
  noindex?: boolean;
}

export function usePageMeta({ title, description, path, noindex }: PageMeta) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;

    const url = `https://avtorstudio.com${path}`;

    const setAttr = (sel: string, attr: string, val: string) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute(attr, val);
    };

    setAttr('meta[name="description"]', 'content', description);
    setAttr('link[rel="canonical"]', 'href', url);
    setAttr('meta[property="og:title"]', 'content', title);
    setAttr('meta[property="og:description"]', 'content', description);
    setAttr('meta[property="og:url"]', 'content', url);
    setAttr('meta[name="twitter:title"]', 'content', title);
    setAttr('meta[name="twitter:description"]', 'content', description);

    // robots: демо-режим не индексируется (интерактивный инструмент, не контент)
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const prevRobots = robots?.getAttribute('content') ?? null;
    let createdRobots = false;
    if (noindex) {
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
        createdRobots = true;
      }
      robots.setAttribute('content', 'noindex,nofollow');
    }

    return () => {
      document.title = prev;
      if (noindex && robots) {
        if (createdRobots) robots.remove();
        else if (prevRobots !== null) robots.setAttribute('content', prevRobots);
      }
    };
  }, [title, description, path, noindex]);
}
