# Авторская студия

> Редактор для писателей: рукопись, картотека персонажей, карта мира, хронология — в одном тихом редакторе.

**Прод:** https://avtorstudio.com  
**Резервный:** https://avtorskaya-studiya.vercel.app

---

## Скриншоты

![Редактор — режим Studio](docs/screenshots/03-editor.png)
*Редактор в режиме Studio: сайдбар с главами, rich-text поле, панель заметок*

| ![Дашборд книги](docs/screenshots/02-dashboard.png) | ![Хронология](docs/screenshots/06-timeline.png) |
|---|---|
| Дашборд: прогресс по словам, heatmap активности | Хронология: 15 событий по слоям |

| ![Персонажи](docs/screenshots/05-characters.png) | ![Карта мира](docs/screenshots/04-map.png) |
|---|---|
| Картотека персонажей | Карта мира с режимами: Место / Связь / Перемещение |

---

## Стек

| Слой | Технологии |
|---|---|
| Frontend | React 18, TypeScript (strict), Vite |
| Редактор | TipTap (ProseMirror) |
| Backend / Auth | Supabase (Postgres + Auth + RLS) |
| Деплой — основной | Timeweb VPS, Ubuntu 24.04, Nginx, Let's Encrypt |
| Деплой — резервный | Vercel |
| CI/CD | GitHub Actions (build → rsync → reload) |
| Экспорт | docx.js, JSZip (EPUB), XML (FB2) |

---

## Что реализовано

### Ядро редактора
- **Rich-text редактор** на TipTap: жирный, курсив, заголовки, списки, ссылки, выравнивание
- **4 режима вёрстки:** Студия / Левый / Правый / Страница
- **История версий** — снимки, diff между версиями, восстановление
- **Автосохранение** + горячие клавиши (Ctrl+S, Ctrl+Enter, Ctrl+F/N)
- **Outline** (дерево глав с drag & drop), **Corkboard** (карточки), **Focus** (полноэкранный), **Split** (два редактора)

### Структура произведения
- **Персонажи** — карточки, связи между персонажами, привязка к главам
- **Хронология** — события с датами и привязкой к главе
- **Карта мира** — SVG-холст с zoom/pan, режимы «Место / Связь / Перемещение», загрузка фона, inline-редактирование пинов
- **Заметки на полях** — живые заметки к тексту, цвета, Supabase CRUD

### Аккаунт и данные
- **Авторизация** — email/пароль + Google OAuth, одношаговая регистрация
- **RLS-политики** — каждый пользователь видит только свои данные
- **Полка книг** — список, создание (название, жанр, цель по словам)
- **Дашборд книги** — прогресс по словам, heatmap активности (GitHub-style), недельные бары

### Экспорт и статистика
- **Экспорт** в DOCX / FB2 / EPUB / HTML с настройкой стиля абзацев
- **StatusBar** — дневной прогресс, серия дней, время чтения главы

### Платформа
- **Мобильный адаптив** — редактор, дашборд, персонажи, хронология, карта, навигация
- **Admin-панель** `/admin` — DAU/WAU/MAU, retention, топ-10, аномалии, управление пользователями и планами
- **Лендинг** — публичная страница с тарифами и FAQ. `/privacy`, `/terms`

---

## Архитектура

```
src/
  components/        — Chrome (Sidebar, Toolbar, RightPanel, StatusBar), EditorHybrid, RichEditor, EditorToolbar, AuthGuard, ErrorBoundary
  pages/             — Auth, Home, Dashboard, Editor, Outline, Corkboard, Map, Timeline, Characters, Focus, Split, Export, Admin, Landing, Privacy, Terms
  lib/               — supabase-клиент, AuthProvider
  styles/            — design-system.css (CSS-переменные oklch, классы .as, .btn, .input и др.)
  App.tsx            — роутер
supabase/migrations/ — SQL-миграции
deploy/              — nginx.conf, GitHub Actions workflow
```

---

## Деплой

**Основной (VPS):** push в `main` → GitHub Actions → `npm run build` → rsync в `/var/www/avtorstudio/dist/`. Nginx + SSL (Let's Encrypt). Supabase-запросы проксируются через `/sb/` на том же домене.

**Резервный (Vercel):** push в `main` → авто-деплой. `vercel.json` содержит SPA-fallback для React Router.

---

## Быстрый старт

```bash
npm install
cp .env.example .env
# Заполни VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY
npm run dev   # http://127.0.0.1:5273
```

Миграции: применить SQL-файлы из `supabase/migrations/` по порядку нумерации через Supabase SQL Editor.

## Скрипты

```bash
npm run dev        # dev-сервер
npm run build      # продакшен-сборка в dist/
npm run preview    # превью сборки
npm run typecheck  # TypeScript без сборки
npm run lint       # ESLint
```

---

## AI-assisted development

Проект разрабатывается с применением **Claude Code** — AI-инструмента для разработки в терминале. Это означает, что часть кода написана при участии AI-ассистента, аналогично тому, как команды используют GitHub Copilot или Cursor.

Архитектурные решения, продуктовые приоритеты, UX-решения и код-ревью — на стороне разработчика. Claude Code используется как мультипликатор скорости, а не как замена пониманию кода.

Если вы рекрутер или ревьюер — готов объяснить любую часть кода на интервью.
