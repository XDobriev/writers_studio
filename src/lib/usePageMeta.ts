import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description: string;
  path: string;
}

export function usePageMeta({ title, description, path }: PageMeta) {
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

    return () => { document.title = prev; };
  }, [title, description, path]);
}
