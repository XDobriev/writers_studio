// Заливает скриншоты для описания PR в отдельную ветку pr-assets (в main они не попадают)
// и печатает markdown-ссылки на них.
//
//   node scripts/pr-assets.mjs <номер PR> <файл.png> [<файл.png> ...]
//
// Без worktree: дерево и коммит собираются plumbing-командами во временном индексе,
// поэтому pre-push хук отрабатывает в основной папке (с node_modules), как обычно.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [pr, ...files] = process.argv.slice(2);
if (!/^\d+$/.test(pr ?? '') || files.length === 0) {
  console.error('Использование: node scripts/pr-assets.mjs <номер PR> <файл.png> [...]');
  process.exit(1);
}

const BRANCH = 'pr-assets';
const index = path.join(os.tmpdir(), `pr-assets-index-${process.pid}`);
const git = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', env: { ...process.env, GIT_INDEX_FILE: index }, ...opts }).trim();

const remoteUrl = git(['remote', 'get-url', 'origin']);
const repo = remoteUrl.match(/github\.com[:/](.+?)(\.git)?$/)?.[1];
if (!repo) throw new Error(`Не GitHub-remote: ${remoteUrl}`);

let parent = '';
try {
  git(['fetch', '-q', 'origin', BRANCH]);
  parent = git(['rev-parse', 'FETCH_HEAD']);
} catch { /* ветки ещё нет — первый коммит без родителя */ }

try {
  if (parent) git(['read-tree', parent]);
  else git(['read-tree', '--empty']);
  const links = [];
  for (const f of files) {
    const dest = `pr-${pr}/${path.basename(f)}`;
    const sha = git(['hash-object', '-w', f]);
    git(['update-index', '--add', '--cacheinfo', `100644,${sha},${dest}`]);
    links.push(`https://raw.githubusercontent.com/${repo}/${BRANCH}/${dest}`);
  }
  const tree = git(['write-tree']);
  const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `pr-${pr}: скриншоты (${files.length})`]);
  execFileSync('git', ['push', '-q', 'origin', `${commit}:refs/heads/${BRANCH}`], { stdio: 'inherit' });
  files.forEach((f, i) => console.log(`![${path.basename(f, path.extname(f))}](${links[i]})`));
} finally {
  fs.rmSync(index, { force: true });
}
