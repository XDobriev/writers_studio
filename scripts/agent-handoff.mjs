import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true })
  if (r.error || r.status !== 0) throw new Error('Cannot inspect Git: ' + (r.stderr || r.error?.message))
  return r.stdout.trim()
}
export function context(cwd) {
  const common = git(cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  const untracked = git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean).map(p => {
    const st = statSync(resolve(cwd, p)); return [p, st.size, st.mtimeMs]
  })
  const fingerprint = createHash('sha256').update(git(cwd, ['diff', 'HEAD', '--'])).update(JSON.stringify(untracked)).digest('hex')
  return {
    fingerprint, root: dirname(common),
    branch: git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
    head: git(cwd, ['rev-parse', 'HEAD']),
    changes: git(cwd, ['status', '--porcelain=v1', '--untracked-files=normal']),
  }
}
export function statePath(ctx) {
  return join(ctx.root, '.qa', 'handoff', Buffer.from(ctx.branch).toString('base64url') + '.json')
}
export function save(cwd, input) {
  if (typeof input.goal !== 'string' || !input.goal.trim() || typeof input.next !== 'string' || !input.next.trim()) {
    throw new Error('Handoff requires nonempty goal and next fields')
  }
  const facts = context(cwd)
  const state = {
    version: 1, updatedAt: new Date().toISOString(),
    goal: input.goal, next: input.next,
    completed: input.completed ?? [], checks: input.checks ?? [],
    decisions: input.decisions ?? [], blockers: input.blockers ?? [],
    agent: input.agent ?? 'unspecified', facts,
  }
  const path = statePath(facts)
  mkdirSync(dirname(path), { recursive: true })
  const temp = path + '.' + process.pid + '.tmp'
  writeFileSync(temp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 })
  renameSync(temp, path)
  return state
}
export function show(cwd) {
  const current = context(cwd), path = statePath(current)
  if (!existsSync(path)) return { current, saved: null, instruction: 'No handoff for this branch. Use list to find another task; do not infer its intent from Git.' }
  const saved = JSON.parse(readFileSync(path, 'utf8'))
  return { current, saved, changedSinceSave: saved.facts.head !== current.head || saved.facts.changes !== current.changes || saved.facts.fingerprint !== current.fingerprint }
}
function main() {
  const cwd = process.cwd(), command = process.argv[2] ?? 'show'
  if (command === 'save') console.log(JSON.stringify(save(cwd, JSON.parse(readFileSync(0, 'utf8'))), null, 2))
  else if (command === 'show') console.log(JSON.stringify(show(cwd), null, 2))
  else if (command === 'list') {
    const folder = join(context(cwd).root, '.qa', 'handoff')
    console.log(JSON.stringify(existsSync(folder) ? readdirSync(folder).filter(f => f.endsWith('.json')).map(f => {
      const s = JSON.parse(readFileSync(join(folder, f), 'utf8'))
      return { branch: s.facts.branch, goal: s.goal, updatedAt: s.updatedAt }
    }) : [], null, 2))
  } else throw new Error('Use show, list or save (JSON on stdin)')
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (e) { console.error(e.message); process.exitCode = 1 }
}

