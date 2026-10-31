# Codex: project harness

The local `AGENTS.md` is the Codex entry point. It references the project's local
`CLAUDE.md` for architecture and acceptance checks. Neither file, business docs,
credentials nor the local skill catalog should be force-added to this public repo.

## Shared checks

Run `npm.cmd run prepare` on Windows (`npm run prepare` elsewhere) once per clone
to activate `.githooks`. Git Bash executes the shell hooks; Node launches npm.cmd
on Windows without changing PowerShell execution policy.

- `pre-commit`: require a task branch, check the local architecture registry for
  added source files, validate the local roadmap when its validator is installed,
  then run typecheck and lint.
- `pre-push`: inspect every destination ref; reject main (including deletion)
  and non-fast-forward updates, then run the same local checks.
- CI remains the independent PR gate for types, lint, unit tests, build and E2E.

Check hook behavior with `npm.cmd run test:harness` (or `npm run test:harness`).
Hooks are shared by Claude, Codex and manual Git. They do not implement Codex
tool permissions, and can be bypassed with Git's explicit bypass options. Agents
must never bypass them. Keep merge approval in chat and repository protections.

## Local Codex setup

Keep `.codex/config.toml`, `.codex/rules/`, local instructions and skills private.
Project config and rules require a trusted project; inspect effective configuration
in the client. A linked worktree needs its own local instructions, config and
skills because Git does not copy ignored files. Keep dependencies available there.

Codex native `PostToolUse` hooks can run `scripts/codex-post-tool.mjs` for
`apply_patch|Edit|Write`. The handler reads the event from stdin: TypeScript edits
run typecheck/lint, roadmap edits run the local validator with an explicit path,
and source edits remind the agent about the architecture registry. Failed checks
return structured feedback. Shell-based edits still require the instructed manual
checks and Git gates; the patch hook does not parse arbitrary shell programs.
Use an absolute launcher path in local TOML and set `timeout = 180`. Configure
hooks only in a trusted project. See the [native hooks guide](https://learn.chatgpt.com/docs/hooks).

Skills require YAML `name` and `description` in `SKILL.md`. In Codex, invoke
`$ship`, `$audit` or `$care-refactoring`; Claude uses slash commands. Verify the
skills are listed after reloading the client/session.

Supabase MCP is configured in the project's `.codex/config.toml`. Its local
stdio launcher reads the existing ignored `.mcp.json` credential at runtime,
without duplicating it in TOML or logging it. Check `codex mcp list` and perform
an MCP initialize/tools-list and a read-only call. A config entry alone does not
prove a working connection or add tools to an already-running chat.

Native command rules provide additional prompts for SSH, deployment and PR merge;
they apply to command prefixes and do not replace the Git ref checks or explicit
approval for production SQL/migrations/Edge deployment. Per-tool MCP approval
must cover production writes. Do not grant blanket auto-approval for Supabase.

## Unattended work

Start only when explicitly requested. Use the project queue and persistent report,
one task at a time, no production writes or merges, and skip tasks requiring a
decision. Record task, status, commit and next action after each step. Resume from
that report after interruption. Codex does not inherit Claude CLI's
`autoContinueAtUsageLimit`; do not promise automatic recovery after a usage limit,
app exit or Windows sleep. A blocked run ends with a checkpoint for resumption.

References: [configuration](https://learn.chatgpt.com/docs/config-file/config-reference),
[MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli),
[command rules](https://learn.chatgpt.com/docs/agent-configuration/rules),
[skills](https://learn.chatgpt.com/docs/build-skills).
