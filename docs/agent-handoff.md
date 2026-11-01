# Working across Claude, Codex and Gemini

The private `.agents/HARNESS.md` defines the common workflow and handoff protocol.
The private `.agents/PROJECT.md` holds architecture and product conventions.
`AGENTS.md`, `CLAUDE.md` and `GEMINI.md` are short entry points into the same files.
Client details live in `.agents/clients/`; keep shared behavior out of those adapters.
Do not force-add private context, credentials or handoff files to this public repo.

## Continue in another client

Stop the first agent, then open the same checkout in the next client. Ask it to
continue the current task from the common instructions and handoff. Chat history
is not shared. Use a different worktree for concurrent work, with explicit scope.

`node scripts/agent-handoff.mjs show` reads the current branch's saved task and
compares its Git facts with current files. `list` shows tasks on other branches.
`save` accepts JSON on stdin with required `goal` and `next`, plus optional
`completed`, `checks`, `decisions`, `blockers` and `agent`. Save incrementally,
after meaningful steps, rather than waiting until a usage limit is reached.
When using a branch without the new scripts, use the prepared local copy at
`.agents/runtime/agent-handoff.mjs` instead.

Records live in the main checkout's ignored `.qa/handoff/`, separately per branch,
including when saved from linked worktrees. Writes use atomic replacement. The
record contains task notes and Git metadata; it never automatically reads env or
credentials. Do not put secrets or user content in task notes. Git fingerprints
detect code changes; they do not reconstruct reasoning or prove tests passed.
A crash may leave notes older than the files: the next agent must inspect Git.

## Checks and client setup

Git hooks and CI are common. Native hooks, MCP configuration and approval settings
are client specific. Keep explicit production/merge approval regardless of client.
Use canonical skills from `.agents/skills/`; read SKILL.md directly if a client
does not expose a slash command. Claude may use local links under `.claude/skills/`.

The Codex adapter uses `.codex/config.toml` and command rules. The Antigravity
adapter uses `.agents/mcp_config.json` and `.agents/hooks.json` in current clients;
older installed IDEs may also use user-level MCP settings. Claude uses `.mcp.json`
and `.claude/settings.json`. A successful config listing is not proof that every
server is authenticated in each running chat. Reload and verify in the client.

After a folder move, regenerate absolute launcher paths and check Git, MCP and
hooks. Do not copy bearer tokens into each client's config: all adapters should
use the same ignored credential source at runtime. Private adapters are installed
separately from the public PR and must preserve other active tasks.

Validation: `npm.cmd run test:harness` on Windows, `npm run test:harness` elsewhere.
The integration test covers shared state between worktrees, missing required notes,
branch isolation, and edits made after the latest handoff.

References: [Codex instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
[Antigravity discovery](https://antigravity.google/docs/customization-discovery).
