// Генерирует dist/sitemap.xml при build.
// lastmod — дата последнего коммита файла страницы (а не дата сборки: иначе каждый
// деплой «обновляет» все URL и поисковики перестают доверять lastmod). Если git
// недоступен или история обрезана (shallow clone) — lastmod не указывается.
// /login и /demo в sitemap не входят: оба закрыты noindex.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');

const routes = [
  { loc: '/', source: 'src/pages/Landing.tsx', changefreq: 'monthly', priority: '1.0' },
  { loc: '/offer', source: 'src/pages/Offer.tsx', changefreq: 'monthly', priority: '0.8' },
  { loc: '/terms', source: 'src/pages/Terms.tsx', changefreq: 'monthly', priority: '0.3' },
  { loc: '/privacy', source: 'src/pages/Privacy.tsx', changefreq: 'monthly', priority: '0.3' },
  { loc: '/changelog', source: 'src/pages/Changelog.tsx', changefreq: 'weekly', priority: '0.4' },
];

// %cd + --date=format-local — дата коммита в локальной таймзоне машины сборки, YYYY-MM-DD.
function lastCommitDate(file) {
  try {
    const out = execFileSync('git', ['log', '-1', '--date=format-local:%Y-%m-%d', '--format=%cd', '--', file], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(r => {
  const lastmod = lastCommitDate(r.source);
  return `  <url>
    <loc>https://avtorstudio.com${r.loc}</loc>
${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`;
}).join('\n')}
</urlset>
`;

writeFileSync(resolve(distDir, 'sitemap.xml'), xml, 'utf-8');
console.log('sitemap.xml сгенерирован:', resolve(distDir, 'sitemap.xml'));
