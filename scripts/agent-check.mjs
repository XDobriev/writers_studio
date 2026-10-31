import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ZERO = /^0+$/

export function checkPush(input, isAncestor) {
  for (const line of input.trim().split(/\r?\n/).filter(Boolean)) {
    const fields = line.trim().split(/\s+/)
    if (fields.length !== 4) throw new Error('Invalid pre-push ref input')
    const [, localSha, remoteRef, remoteSha] = fields
    if (remoteRef === 'refs/heads/main') {
      throw new Error('Push to main is blocked. Push a task branch and open a PR.')
    }
    if (!ZERO.test(remoteSha) && !ZERO.test(localSha) && !isAncestor(remoteSha, localSha)) {
      throw new Error('Non-fast-forward push is blocked. Merge or rebase locally; do not force push.')
    }
  }
}

export function runChecks(run) {
  for (const script of ['typecheck', 'lint']) {
    if (run(script) !== 0) throw new Error(`${script} failed; Git operation blocked`)
  }
}

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true })
  if (result.error) throw result.error
  return result
}

function main(mode) {
  if (!['pre-commit', 'pre-push'].includes(mode)) throw new Error('Expected pre-commit or pre-push')
  if (mode === 'pre-commit') {
    const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'])
    if (branch.status !== 0 || branch.stdout.trim() === 'main') {
      throw new Error('Commit requires a task branch. Do not commit on main or detached HEAD.')
    }
    const diff = git(['diff', '--cached', '--diff-filter=A', '--name-only', '-z'])
    if (diff.status !== 0) throw new Error('Cannot inspect staged files')
    const added = diff.stdout.split('\0').filter(p => /^src\/(components|pages|lib)\//.test(p))
    if (added.length && existsSync('CLAUDE.md')) {
      const registry = readFileSync('CLAUDE.md', 'utf8')
      const missing = added.filter(p => !/\.(test|spec)\./.test(p) && !registry.includes(p))
      if (missing.length) throw new Error(`Add new source files to CLAUDE.md architecture: ${missing.join(', ')}`)
    }
  } else {
    checkPush(readFileSync(0, 'utf8'), (oldSha, newSha) => {
      const result = git(['merge-base', '--is-ancestor', oldSha, newSha])
      return result.status === 0
    })
  }
  // Optional local roadmap validator; never hide its failure when it is installed.
  if (existsSync('docs/roadmap.md') && existsSync('.claude/hooks/check-roadmap.mjs')) {
    const result = spawnSync(process.execPath, ['.claude/hooks/check-roadmap.mjs', 'docs/roadmap.md'], {
      stdio: 'inherit', windowsHide: true,
    })
    if (result.error || result.status !== 0) throw new Error('Roadmap validation failed')
  }
  runChecks(script => {
    console.log(`→ ${mode}: ${script}`)
    const result = process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${script}`], { stdio: 'inherit', windowsHide: true })
      : spawnSync('npm', ['run', script], { stdio: 'inherit' })
    if (result.error) throw result.error
    return result.status
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv[2]) } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
