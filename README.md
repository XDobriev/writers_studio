# Авторская студия

Редактор для писателей: рукопись, картотека персонажей, карта мира, хронология. Vite + React + TypeScript на фронте, Supabase (Postgres + Auth) на бэке, деплой на Vercel.

Исходные дизайн-файлы (HTML+JSX через Babel-standalone) сохранены в `_design-source/` как референс.

## Что работает сейчас (Заход 1)

- Регистрация и вход через Supabase email-auth.
- Полка книг: список, создание, удаление по строке (RLS — каждый видит только свои).
- Дэшборд книги с навигацией в остальные разделы.
- Редактор, outline, corkboard, карта, хронология, персонажи, focus, split, экспорт — портированы из дизайна, рендерятся как макеты на демо-данных.

В Заходе 2 редактор начнёт сохранять реальный текст глав в Supabase.

## Что нужно сделать один раз

### 1. Установить зависимости

```bash
npm install
```

### 2. Создать Supabase-проект

1. Откройте [supabase.com](https://supabase.com) → New project. Любой регион, любой пароль БД.
2. Когда проект поднимется, перейдите в **Project Settings → API**. Скопируйте:
   - `Project URL` (нечто вида `https://xxx.supabase.co`)
   - `anon` / `public` ключ (длинный JWT)
3. Перейдите в **SQL Editor → New query**, вставьте содержимое `supabase/migrations/0001_init.sql`, нажмите Run. Это создаст таблицу `books` и RLS-политики.
4. (Опционально) **Authentication → Providers → Email**: можно отключить «Confirm email», чтобы регистрация была одношаговой.

### 3. Заполнить .env

Скопируйте `.env.example` в `.env` и подставьте свои значения:

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 4. Запустить локально

```bash
npm run dev
```

Откроется на `http://localhost:5173`. Зарегистрируйтесь, создайте книгу, проверьте, что она сохраняется (она будет видна и после перезагрузки страницы).

## Деплой на Vercel

1. Создайте git-репозиторий и запушьте проект на GitHub.
2. На [vercel.com](https://vercel.com) → Add New → Project → импортируйте репо.
3. Vercel сам определит Vite. В разделе **Environment Variables** добавьте:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Получите URL вида `https://your-project.vercel.app`.
5. В Supabase **Authentication → URL Configuration** добавьте этот URL в `Site URL` и в `Redirect URLs`, иначе после регистрации Supabase будет редиректить на localhost.

## Структура проекта

```
src/
  components/        — chrome (Sidebar, Toolbar, RightPanel, Icon, EditorHybrid, AuthGuard)
  pages/             — экраны (Auth, Home, Dashboard, Editor, Outline, Corkboard, Map, Timeline, Characters, Focus, Split, Export)
  lib/               — supabase-клиент и AuthProvider
  data/sample.ts     — демо-данные (роман «Северный архив»), используются всеми макетными экранами
  styles/            — design-system.css (CSS-переменные, оформление)
  App.tsx            — роутер
  main.tsx           — точка входа
supabase/migrations/ — SQL-миграции
_design-source/      — оригинальные .jsx из Cloud Design (референс)
```

## Скрипты

- `npm run dev` — dev-сервер
- `npm run build` — сборка в `dist/`
- `npm run preview` — превью продакшен-сборки
- `npm run typecheck` — только TypeScript
