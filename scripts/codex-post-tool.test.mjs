import assert from 'node:assert/strict'
import { test } from 'node:test'
import { editedPaths, checksForPaths } from './codex-post-tool.mjs'

test('recognizes Codex patch paths, including moved files and Windows absolute paths', () => {
  const paths = editedPaths({ tool_input: { command: '*** Update File: src/pages/Home.tsx\n*** Move to: C:\\repo\\src\\pages\\Books.tsx\n*** Delete File: src/lib/old.ts' } })
  assert.deepEqual(paths, ['src/pages/Home.tsx', 'C:/repo/src/pages/Books.tsx', 'src/lib/old.ts'])
  assert.deepEqual(checksForPaths(paths), { typescript: true, roadmap: false, registry: true })
})
test('handles direct edits and roadmap without running unrelated type checks', () => {
  assert.deepEqual(checksForPaths(editedPaths({ tool_input: { file_path: 'docs/roadmap.md' } })), { typescript: false, roadmap: true, registry: false })
})
test('does not trigger checks on read-only calls or prose mentioning source files', () => {
  assert.deepEqual(editedPaths({ tool_input: { command: 'rg src/pages/Home.tsx' } }), [])
  assert.deepEqual(checksForPaths(['docs/readme.md']), { typescript: false, roadmap: false, registry: false })
})
