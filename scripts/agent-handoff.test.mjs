import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { context, save, show } from './agent-handoff.mjs'

test('handoff preserves intent across worktrees and detects uncommitted changes', () => {
  const folder = mkdtempSync(join(tmpdir(), 'avtor-handoff-'))
  const repo = join(folder, 'repo'), wt = join(folder, 'worktree')
  const git = args => {
    const r = spawnSync('git', args, { cwd: folder, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
  }
  try {
    git(['init', '-b', 'main', repo])
    git(['-C', repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'initial'])
    git(['-C', repo, 'worktree', 'add', '-b', 'agent/task', wt])
    assert.throws(() => save(wt, { goal: 'task' }), /next/)
    save(wt, { goal: 'finish feature', next: 'inspect hook output', agent: 'Claude', checks: ['lint passed'] })
    const initial = show(wt)
    assert.equal(initial.saved.goal, 'finish feature')
    // .qa is ignored in the real repo; ignore it in this fixture as well.
    writeFileSync(join(repo, '.git', 'info', 'exclude'), '.qa/\n')
    assert.equal(show(wt).changedSinceSave, false)
    writeFileSync(join(wt, 'pending.txt'), 'uncommitted work')
    assert.equal(show(wt).changedSinceSave, true)
    save(wt, { ...initial.saved, next: 'review pending.txt', agent: 'Codex' })
    assert.equal(show(wt).saved.goal, 'finish feature')
    assert.equal(show(wt).changedSinceSave, false)
    writeFileSync(join(wt, 'pending.txt'), 'more uncommitted work after handoff')
    assert.equal(show(wt).changedSinceSave, true)
    assert.match(context(wt).root, /repo$/)
    assert.equal(show(repo).saved, null)
  } finally {
    // Only this test's own unique temporary directory may be removed.
    if (!resolve(folder).startsWith(resolve(tmpdir(), 'avtor-handoff-'))) throw new Error('Unsafe test cleanup')
    rmSync(folder, { recursive: true, force: true })
  }
})

