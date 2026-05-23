# Авторская студия

Редактор для писателей: рукопись, картотека персонажей, карта мира, хронология — в одном тихом редакторе. Vite + React + TypeScript, Supabase (Postgres + Auth), деплой на Vercel.

**Прод:** https://avtorskaya-studiya.vercel.app

## Что работает

- **Авторизация** — email/пароль + Google OAuth.
- **Полка книг** — список, создание (название, жанр, цель по словам), RLS — каждый видит только свои.
- **Дэшборд книги** — прогресс по словам, heatmap активности за год (GitHub-style), недельные бары.
- **Редактор** — TipTap (rich text): жирный, курсив, заголовки, списки, ссылки, выравнивание. Текст по умолчанию — justify (книжный формат). 4 режима: Студия / Левый / Правый / Страница. Автосохранение в Supabase.
- **Структура** — Outline (дерево глав), Corkboard (карточки), Focus (полноэкранный режим), Split (два редактора). Удаление глав из меню (⋯) во всех представлениях, с подтверждением для непустых глав.
- **Заметки на полях** — живые заметки к тексту, Supabase CRUD.
- **Персонажи** — карточки, связи между персонажами, привязка к главам.
- **Хронология** — события с датами и позицией.
- **Карта мира** — SVG-холст с zoom/pan, режимы «Место / Связь / Перемещение», связи между локациями (дороги, реки, тропы, границы), загрузка фонового изображения, inline-редактирование пинов, mobile bottom sheet.
- **Экспорт** — экспорт текста глав.
- **StatusBar** — дневной прогресс и серия дней из `writing_snapshots`.
- **Админ-панель** `/admin` — метрики пользователей, контента, активности (DAU/WAU/MAU), список пользователей; доступна только владельцу.

## Быстрый старт

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. В **Project Settings → API** скопируйте `Project URL` и `anon`-ключ.
3. Примените все миграции из `supabase/migrations/` через SQL Editor (в порядке нумерации).
4. В **Authentication → Providers** включите Google OAuth (опционально).
5. В **Authentication → URL Configuration** добавьте ваш домен в `Site URL` и `Redirect URLs`.

### 3. Заполнить .env

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 4. Запустить локально

```bash
npm run dev   # http://127.0.0.1:5273
```

## Деплой на Vercel

Push в `main` → авто-деплой. При первом подключении:
1. Импортируйте репо на [vercel.com](https://vercel.com).
2. Добавьте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` в Environment Variables.
3. `vercel.json` уже содержит SPA-fallback — ничего дополнительно настраивать не нужно.

## Структура проекта

```
src/
  components/        — Chrome (Sidebar, Toolbar, RightPanel, StatusBar), EditorHybrid, RichEditor, EditorToolbar, Icon, AuthGuard
  pages/             — Auth, Home, Dashboard, Editor, Outline, Corkboard, Map, Timeline, Characters, Focus, Split, Export, Admin
  lib/               — supabase-клиент, AuthProvider
  styles/            — design-system.css (CSS-переменные oklch, классы .as, .btn, .input и др.)
  App.tsx            — роутер
supabase/migrations/ — SQL-миграции (применять по порядку)
_design-source/      — оригинальные .jsx (референс, не активный код)
```

## Скрипты

```bash
npm run dev        # dev-сервер на 127.0.0.1:5273
npm run build      # продакшен-сборка в dist/
npm run preview    # превью сборки
npm run typecheck  # TypeScript без сборки
```
