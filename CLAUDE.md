# Авторская студия — Claude Code

Редактор для писателей. Vite + React + TypeScript, Supabase (Auth + Postgres), деплой на Timeweb VPS + Vercel.

## Боевые ссылки

- **Прод (основной):** https://avtorstudio.com — Timeweb VPS, Ubuntu 24.04
  - Публичный IP (DNS): `72.56.233.223` — NAT Timeweb, для браузера/DNS
  - Реальный IP (SSH): `72.56.232.231` — для rsync/ssh. GitHub Secret `VPS_HOST=72.56.232.231`
- **Прод (резервный):** https://avtorskaya-studiya.vercel.app — Vercel (деплоится параллельно)
- **GitHub:** https://github.com/XDobriev/writers_studio (push в `main` → авто-деплой на оба)
- **Supabase ref:** `joaxeoavjvlqmtlepkrr` · [Dashboard](https://supabase.com/dashboard/project/joaxeoavjvlqmtlepkrr)
- **Vercel project:** `khamza-s-projects/avtorskaya-studiya`
- **Supabase MCP** подключён (`~/.claude.json`, `--project-ref=joaxeoavjvlqmtlepkrr`). Грузить через ToolSearch: `select:mcp__supabase__...`.

## Timeweb VPS

- **IP:** `72.56.233.223`, пользователь `deploy`, SSH-ключ в GitHub Secrets (`VPS_SSH_KEY`)
- **Деплой:** GitHub Actions (`.github/workflows/deploy-timeweb.yml`) — `npm ci` → `npm run build` → `rsync dist/ → /var/www/avtorstudio/dist/`
- **nginx:** `/etc/nginx/sites-available/avtorstudio.com` (конфиг в `deploy/nginx.conf`)
- **SSL:** Let's Encrypt через certbot. ⚠️ На 2026-05-25 ещё не выпущен — ждём распространения AAAA-записи DNS (Timeweb обновляет 3-24ч). Команда когда DNS обновится: `certbot --nginx -d avtorstudio.com -d www.avtorstudio.com --non-interactive --agree-tos -m frfrancuz@gmail.com`
- **После certbot** заменить nginx конфиг: `curl -sL https://raw.githubusercontent.com/XDobriev/writers_studio/main/deploy/nginx.conf -o /etc/nginx/sites-available/avtorstudio.com && nginx -t && systemctl reload nginx`
- **Supabase-прокси** активен: `/sb/` в nginx проксирует Supabase, VPS-сборка использует `VITE_SUPABASE_URL=https://avtorstudio.com/sb`

## Команды

```bash
npm run dev        # dev-сервер на 127.0.0.1:5273
npm run build      # продакшен-сборка в dist/
npm run typecheck  # только TS, без сборки
npm run lint       # ESLint: типы + react-hooks/rules-of-hooks (ловит хуки после return)
npm run preview    # превью продакшен-сборки
```

> **После изменений в React-компонентах всегда запускать оба:** `typecheck` + `lint`.

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
- `src/components/ErrorBoundary.tsx` — перехват краша компонентов, показывает fallback UI.

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
- `src/data/sample.ts` — фоллбэк-данные. Используется в `Chrome.tsx` как заглушка (`NOVEL`, `SAMPLE_PROSE`) когда нет реального контекста книги. Не удалять.

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
- **При изменении кода обновлять `docs/learning-plan.md`**: если добавляется новый компонент, хук, паттерн или значимо меняется существующий файл — обновить соответствующий раздел плана (новые ссылки `файл:строка`, новые задания). Не переписывать план целиком — только точечные правки в затронутых темах.
- **После реализации фикса удалять его из `docs/roadmap.md`**: закрытый баг или выполненная задача немедленно убирается из Активных багов / соответствующего раздела приоритетов. Не оставлять как «выполнено» — просто удалять.
- **При обнаружении нового бага или планируемой фичи — сразу добавлять в `docs/roadmap.md`** в соответствующую зону критичности: если баг блокирует работу или критичен для пользователя — вверх раздела (перед остальными); если некритичен — вниз раздела. Не откладывать и не ждать явного запроса.
- **Периодически запускать `npx knip` и `npm run typecheck`** для проверки мёртвого кода, неиспользуемых экспортов и зависимостей. Инструмент: `knip` (без установки, через `npx`). Делать перед каждым крупным релизом или по явному запросу.

## Скиллы

Канонический источник: `skills-lock.json` + `.agents/skills/` (в репо).
`.claude/skills/` — локальный кэш Claude Code (gitignored, не редактировать вручную).

**Проектные** (`.agents/skills/`):
- `/vercel-react-best-practices` — bundle, lazy loading, производительность React на Vercel
- `/supabase-postgres-best-practices` — RLS, индексы, структура запросов
- `/systematic-debugging` — методология отладки, особенно TipTap + Supabase
- `/improve-codebase-architecture` — анализ и рефакторинг архитектуры компонентов
- `/impeccable` — дизайн-аудит: critique, audit, polish, colorize, typeset (23 команды)

**Глобальные** (`~/.claude/skills/`):
- `gstack` — браузерный агент для QA: скриншоты, тест форм, проверка деплоя (❗ `/browse` не работает — нужен нативный Bun)
- `marketingskills` — 50+ скиллов для маркетинга: CRO, копирайтинг, SEO, реклама, аналитика

**Установить позже** (подробности в [docs/roadmap.md](docs/roadmap.md)):
- SEO/GEO — перед публичным запуском
- Frontend Slides — перед питчем/демо
- Expense Tracker Market — при запуске монетизации §3

## Документация (читать по задаче)

Вся документация в `docs/`:

- [docs/roadmap.md](docs/roadmap.md) — активные баги, приоритеты, backlog, продвижение, монетизация.
- [docs/design.md](docs/design.md) — дизайн-система, цвета, типографика, токены.
- [docs/product.md](docs/product.md) — продуктовое описание, планы, монетизация.
- [docs/features/editor.md](docs/features/editor.md) — редактор, TipTap, focus, split.
- [docs/features/characters.md](docs/features/characters.md) — персонажи, связи, chapter_characters.
- [docs/features/timeline.md](docs/features/timeline.md) — хронология.
- [docs/features/maps.md](docs/features/maps.md) — карта мира.
- [docs/features/export.md](docs/features/export.md) — экспорт.
- [docs/learning-plan.md](docs/learning-plan.md) — план изучения TypeScript/React (в .gitignore, личный).
- [docs/email-onboarding.md](docs/email-onboarding.md) — blueprint email-цепочки онбординга (7 писем, тексты, стек). Реализовывать после §2 ЮKassa.
- [docs/acquisition.md](docs/acquisition.md) — план привлечения первых пользователей: фазы, площадки, шаблоны сообщений, трекинг.
