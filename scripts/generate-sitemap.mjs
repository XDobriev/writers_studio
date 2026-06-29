// Генерирует dist/sitemap.xml при build с актуальным lastmod (дата сборки).
// Заменяет public/sitemap.xml с ручными датами — больше не нужно править вручную.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../dist');
const today = new Date().toISOString().slice(0, 10);

const routes = [
  { loc: '/', changefreq: 'monthly', priority: '1.0' },
  { loc: '/offer', changefreq: 'monthly', priority: '0.8' },
  { loc: '/login', changefreq: 'yearly', priority: '0.5' },
  { loc: '/terms', changefreq: 'monthly', priority: '0.3' },
  { loc: '/privacy', changefreq: 'monthly', priority: '0.3' },
  { loc: '/changelog', changefreq: 'weekly', priority: '0.4' },
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(r => `  <url>
    <loc>https://avtorstudio.com${r.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

writeFileSync(resolve(distDir, 'sitemap.xml'), xml, 'utf-8');
console.log('sitemap.xml сгенерирован:', resolve(distDir, 'sitemap.xml'));
