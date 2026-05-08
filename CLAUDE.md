# Авторская студия — заметки для Claude Code

Редактор для писателей. Vite + React + TypeScript на фронте, Supabase (Auth + Postgres) на бэке, деплой на Vercel.

## Текущая стадия

Заход 1 завершён 2026-05-09: фундамент, реальная авторизация, реальная полка книг (CRUD из Supabase с RLS). Все остальные экраны (редактор, outline, corkboard, карта, хронология, персонажи, focus, split, экспорт) портированы из дизайна, но рендерятся как макеты на демо-данных из `src/data/sample.ts`.

Дальше:
- **Заход 2** — редактор сохраняет реальный текст глав в Supabase. Главы и сцены — CRUD. Outline и Corkboard работают на тех же данных.
- **Заход 3** — персонажи, хронология, карта, focus/split/export — реальные сущности и реальный экспорт.

## Что не трогать

- `_design-source/` — оригинальные .jsx из Cloud Design, сохранены как референс. Это не активный код, не редактировать и не пересобирать на их основе. При расхождении правда в `src/`.
- `src/data/sample.ts` дублирует то, что было в `_design-source/content.js` — для макетных экранов. По мере перевода экранов на реальные данные эта зависимость будет уходить.

## Команды

- `npm run dev` — dev-сервер на 5173
- `npm run build` — продакшен-сборка в `dist/`
- `npm run typecheck` — только TypeScript, без сборки
- `npm run preview` — превью продакшен-сборки

## Windows quirk

`npm.ps1` заблокирован execution policy на этой машине — запуск `npm` через PowerShell-инструмент падает с PSSecurityException. Использовать **Bash-инструмент** для всех npm-команд (там npm запускается напрямую, не через .ps1-обёртку). Не пытаться обходить через `Set-ExecutionPolicy` без явного запроса пользователя.

## Supabase

- Клиент: `src/lib/supabase.ts`. Читает `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` из `.env`.
- Auth: `src/lib/auth.tsx` (`AuthProvider`, `useAuth`). Защита роутов — `<AuthGuard>` в `src/components/AuthGuard.tsx`.
- Миграции: `supabase/migrations/*.sql`. **Применяются вручную** через Supabase Dashboard → SQL Editor. Не использовать supabase CLI без явного запроса пользователя — у него только Dashboard-доступ.
- При добавлении таблиц обязательно RLS-политики `auth.uid() = user_id` (см. `0001_init.sql` как образец).

## Архитектура коротко

- `src/App.tsx` — роутер. Все рабочие маршруты — `/books/:id/...` под `<AuthGuard>`.
- `src/components/Chrome.tsx` — Sidebar, Toolbar, RightPanel, RailNav, WithMode, StatusBar, Sheet. Все используют `NOVEL`/`SAMPLE_PROSE` из `src/data/sample.ts` — при переводе на реальные данные начинать здесь.
- `src/components/EditorHybrid.tsx` — главный редактор, четыре режима (studio/left/right/page).
- `src/styles/design-system.css` — все CSS-переменные (oklch-палитра, шрифты, радиусы). Кастомные классы `.as`, `.sb`, `.tb`, `.sheet`, `.btn`, `.input`, `.label` и др. описаны там же. Inline-стили в JSX оставлены из дизайна — постепенно переезжают в CSS-классы по мере появления повторений.

## Конвенции

- TypeScript strict, `noUnusedLocals` + `noUnusedParameters` включены — мёртвый код ломает сборку.
- Без комментариев-шумов («// сохраняет книгу»). Комментарии только для неочевидного.
- Inline-стили допустимы (всё ещё много дизайн-кода), но при появлении третьего повторения — выносить в CSS-класс.
- Пути импортов относительные (`../components/Icon`). Алиас `@/*` объявлен в `tsconfig.app.json`, но пока не используется — можно ввести при реальной потребности.
