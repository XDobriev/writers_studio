# Авторская студия — Claude Code

Редактор для писателей. Vite + React + TypeScript, Supabase (Auth + Postgres), деплой на Vercel.

## Боевые ссылки

- **Прод:** https://avtorskaya-studiya.vercel.app
- **GitHub:** https://github.com/XDobriev/writers_studio (push в `main` → авто-деплой)
- **Supabase ref:** `joaxeoavjvlqmtlepkrr` · [Dashboard](https://supabase.com/dashboard/project/joaxeoavjvlqmtlepkrr)
- **Vercel project:** `khamza-s-projects/avtorskaya-studiya`
- **Supabase MCP** подключён (`~/.claude.json`, `--project-ref=joaxeoavjvlqmtlepkrr`). Грузить через ToolSearch: `select:mcp__supabase__...`.

## Команды

```bash
npm run dev        # dev-сервер на 127.0.0.1:5273
npm run build      # продакшен-сборка в dist/
npm run typecheck  # только TS, без сборки
npm run preview    # превью продакшен-сборки
```

## Архитектура

- `src/App.tsx` — роутер. Все маршруты `/books/:id/...` под `<AuthGuard>`.
- `src/components/Chrome.tsx` — Sidebar, Toolbar, RightPanel, RailNav, WithMode, StatusBar, Sheet.
- `src/components/EditorHybrid.tsx` — главный редактор, 4 режима (studio/left/right/page).
- `src/components/RichEditor.tsx` — TipTap wrapper.
- `src/components/EditorToolbar.tsx` — полноценный тулбар TipTap.
- `src/styles/design-system.css` — CSS-переменные (oklch), классы `.as`, `.sb`, `.tb`, `.sheet`, `.btn`, `.input`, `.label`.
- `src/lib/supabase.ts` — Supabase клиент.
- `src/lib/auth.tsx` — `AuthProvider`, `useAuth`.
- `src/components/AuthGuard.tsx` — защита роутов.

## Supabase

- Клиент читает `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` из `.env`.
- Миграции: `supabase/migrations/*.sql`. Применять через Supabase MCP (`apply_migration` / `execute_sql`). CLI локально не используется.
- **При добавлении таблиц: обязательно RLS** `auth.uid() = user_id` (образец: `0001_init.sql`).
- Auth URL: `site_url=https://avtorskaya-studiya.vercel.app`, allow-list включает прод + `avtorskaya-studiya-*.vercel.app` + `localhost:5273`.
- Confirm email отключён, регистрация одношаговая.

## Vercel

- Push в `main` → авто-деплой prod.
- `vercel deploy --prod --yes`, `vercel env ls`, `vercel logs`.
- `vercel.json` — SPA-fallback (rewrite всех путей на `/`) — критично для React Router.

## Конвенции

- TypeScript strict, `noUnusedLocals` + `noUnusedParameters` — мёртвый код ломает сборку.
- Без комментариев-шумов. Только для неочевидного.
- Inline-стили допустимы, но при 3+ повторениях — выносить в CSS-класс.
- Импорты относительные (`../components/Icon`). Алиас `@/*` объявлён в `tsconfig.app.json`, пока не используется.
- **Reset-правила в `.as` обёрнуты в `:where()`** — критично для специфичности. Не разворачивать в `.as button`.

## Что не трогать

- `_design-source/` — оригинальные .jsx из Cloud Design, референс. Не активный код.
- `src/data/sample.ts` — макетные данные, в активном коде не используется.

## Windows quirk

`npm.ps1` заблокирован execution policy. Все npm-команды — через **Bash-инструмент**, не PowerShell. Не обходить через `Set-ExecutionPolicy` без явного запроса.

## Token Efficiency Rules

- Никогда не анализировать весь проект без прямого запроса.
- Читать только файлы, относящиеся к текущей задаче.
- Не перечитывать неизменённые файлы без необходимости.
- Делать минимальные diff; предпочитать точечные изменения вместо рефакторингов.
- Не давать длинные объяснения без запроса.
- Перед сканированием большой части проекта уточнять scope.
- Для багфиксов сначала проверять минимальный code path.
- Не анализировать несвязанные папки.

## Workflow Rules

- Одна задача за раз, только в рамках текущей feature.
- Предпочитать изменение существующих компонентов вместо переписывания систем.
- Не создавать лишние абстракции.
- Игнорировать несвязанную архитектуру без необходимости.

## Документация (читать по задаче)

- [docs/project-state.md](docs/project-state.md) — changelog заходов + следующие шаги.
- [docs/roadmap.md](docs/roadmap.md) — активные баги, приоритеты, backlog, продвижение, монетизация.
- [docs/features/editor.md](docs/features/editor.md) — редактор, TipTap, focus, split.
- [docs/features/characters.md](docs/features/characters.md) — персонажи, связи, chapter_characters.
- [docs/features/timeline.md](docs/features/timeline.md) — хронология.
- [docs/features/maps.md](docs/features/maps.md) — карта мира.
- [docs/features/export.md](docs/features/export.md) — экспорт.
