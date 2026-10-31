import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function editedPaths(event) {
  const input = event.tool_input ?? {}
  const paths = [input.file_path, input.path].filter(p => typeof p === 'string')
  for (const match of (input.command ?? input.patch ?? '').matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)) {
    paths.push(match[1].trim())
  }
  return paths.map(p => p.replaceAll('\\', '/'))
}

export function checksForPaths(paths) {
  return {
    typescript: paths.some(p => /(?:^|\/)src\/.*\.tsx?$/.test(p)),
    roadmap: paths.some(p => /(?:^|\/)docs\/roadmap\.md$/.test(p)),
    registry: paths.some(p => /(?:^|\/)src\/(components|pages|lib)\//.test(p)),
  }
}

export function main() {
  const event = JSON.parse(readFileSync(0, 'utf8'))
  const checks = checksForPaths(editedPaths(event))
  const cwd = event.cwd ?? process.cwd()
  const messages = []
  const run = (command, args) => {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true })
    if (result.error || result.status !== 0) {
      // Compiler/validator diagnostics only; do not echo the tool input or environment.
      console.log(JSON.stringify({ decision: 'block', reason: 'Project check failed; fix before continuing.\n' + (result.stdout + result.stderr).split(/\r?\n/).slice(-18).join('\n') }))
      return false
    }
    return true
  }
  if (checks.roadmap && existsSync(resolve(cwd, '.claude/hooks/check-roadmap.mjs'))) {
    if (!run(process.execPath, ['.claude/hooks/check-roadmap.mjs', 'docs/roadmap.md'])) return
    messages.push('Roadmap validation passed.')
  }
  if (checks.typescript) {
    for (const script of ['typecheck', 'lint']) {
      const ok = process.platform === 'win32'
        ? run('cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${script}`])
        : run('npm', ['run', script])
      if (!ok) return
    }
    messages.push('Typecheck and lint passed.')
  }
  if (checks.registry) messages.push('If a source file was added, add its purpose to CLAUDE.md architecture.')
  if (messages.length) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: messages.join(' ') } }))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
