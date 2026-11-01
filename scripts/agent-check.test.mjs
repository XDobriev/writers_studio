import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkPush, runChecks } from './agent-check.mjs'

const zero = '0'.repeat(40)
const old = '1'.repeat(40)
const next = '2'.repeat(40)

test('blocks every destination main, including explicit refspecs and deletion', () => {
  for (const local of ['refs/heads/agent/task', 'HEAD', '(delete)']) {
    assert.throws(() => checkPush(`${local} ${local === '(delete)' ? zero : next} refs/heads/main ${old}`, () => true), /main/)
  }
})
test('allows new task branches and fast-forward updates', () => {
  checkPush(`refs/heads/agent/task ${next} refs/heads/agent/task ${zero}`, () => assert.fail('new branch has no ancestor'))
  checkPush(`HEAD ${next} refs/heads/agent/task ${old}`, (a, b) => a === old && b === next)
})
test('blocks non-fast-forward updates even when mixed with an allowed ref', () => {
  assert.throws(() => checkPush(`HEAD ${next} refs/heads/agent/new ${zero}\nHEAD ${next} refs/heads/agent/old ${old}`, () => false), /Non-fast-forward/)
})
test('allows cleanup of a task branch and rejects malformed input', () => {
  checkPush(`(delete) ${zero} refs/heads/agent/task ${old}`, () => assert.fail('deletion'))
  assert.throws(() => checkPush('broken input', () => true), /Invalid/)
})
test('stops at the first failed check, including terminated processes', () => {
  const ran = []
  assert.throws(() => runChecks(s => { ran.push(s); return 1 }), /typecheck/)
  assert.deepEqual(ran, ['typecheck'])
  assert.throws(() => runChecks(() => null), /typecheck/)
  assert.throws(() => runChecks(s => s === 'typecheck' ? 0 : 1), /lint/)
})
test('runs typecheck followed by lint on success', () => {
  const ran = []
  runChecks(s => { ran.push(s); return 0 })
  assert.deepEqual(ran, ['typecheck', 'lint'])
})
