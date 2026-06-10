# /ship — Scoped Commit Flow

Standardised end-of-task commit: typecheck → lint → scope confirm → commit → roadmap sync.

**Stop at any failure — do not skip steps.**

---

## Step 1: Typecheck

```bash
npm run typecheck
```

If fails: show the errors verbatim. Do NOT proceed. Tell the user what to fix first.

## Step 2: Lint

```bash
npm run lint
```

If fails: show the errors verbatim. Do NOT proceed. Tell the user what to fix first.

## Step 3: Scope confirmation

```bash
git diff --name-only
git diff --cached --name-only
```

Show the combined list to the user. If files from more than one logical area are changed (e.g. a feature file + an unrelated config, or two unrelated features), ask:

> "Какие из этих файлов входят в скоуп текущей задачи?"

Wait for the user's explicit answer before proceeding. If only one logical area is touched, confirm and proceed.

## Step 4: Stage

Stage only the confirmed files:

```bash
git add <confirmed file 1> <confirmed file 2> ...
```

Never use `git add -A` or `git add .` — these stage unrelated changes.

## Step 5: Commit message

Write a commit message:
- Imperative mood, present tense in Russian or English (match the project's existing style)
- Describes the **why**, not the what
- Under 72 characters
- Conventional commits prefix where it fits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`

Show the message to the user. Wait for approval or correction before committing.

## Step 6: Commit

```bash
git commit -m "$(cat <<'EOF'
<approved message>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## Step 7: Roadmap sync

Read `docs/roadmap.md`. If the completed task closes an active bug or item in any section:
- Delete that line entirely — do not mark as "done", do not add ~~strikethrough~~
- Save the file

If nothing to remove, skip this step silently.

## Step 8: Report

Output a short summary:
- Commit hash (short, from `git rev-parse --short HEAD`)
- Files committed (list)
- Roadmap change: what line was removed, or "roadmap без изменений"
