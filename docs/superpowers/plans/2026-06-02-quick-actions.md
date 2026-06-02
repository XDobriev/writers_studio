# §40 Быстрые действия — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить 4 карточки быстрых действий на дашборд книги, каждая из которых создаёт новую сущность через `?create=true` URL-параметр.

**Architecture:** Dashboard.tsx получает статический массив `QUICK_ACTIONS` и рендерит 4 `<Link>`-карточки. Целевые страницы (Outline, Characters, Notes, Timeline) добавляют `useEffect`, который при монтировании читает `?create=true`, вызывает существующий обработчик создания и очищает параметр из URL.

**Tech Stack:** React 18, React Router v6 (`useSearchParams`, `Link`), TypeScript strict, inline styles (паттерн всего Dashboard.tsx).

---

## Файловая карта

| Файл | Изменение |
|---|---|
| `src/pages/Dashboard.tsx` | Добавить `QUICK_ACTIONS` const + Grid секцию между stat cards и goal bar |
| `src/pages/Outline.tsx` | Добавить `useSearchParams` в импорт + `useEffect` → `onCreate()` |
| `src/pages/Characters.tsx` | Добавить `useEffect` (search/setSearch уже есть через useCharacterNavigation) |
| `src/pages/Notes.tsx` | Добавить `useSearchParams` в импорт + `useEffect` → `setShowForm(true)` |
| `src/pages/Timeline.tsx` | Добавить `useSearchParams` в импорт + `useEffect` → `onCreate()` |

---

### Task 1: Dashboard — секция быстрых действий

**Files:**
- Modify: `src/pages/Dashboard.tsx`

Существующая структура scroll-области (строки ~338–363):
```
<div style={{ display: 'grid', ... }}>     ← stat cards
  {statCards.map((s) => (...))}
</div>
                                            ← ВОТ ЗДЕСЬ вставляем
{book.goal > 0 && (
  <div ...>                                ← goal bar
```

- [ ] **Step 1: Добавить `QUICK_ACTIONS` const перед компонентом**

После строки с `const STATUS_DOT` (≈строка 24), перед `function fmtNumber`, вставить:

```tsx
const QUICK_ACTIONS: Array<{ title: string; dest: string; icon: 'tree' | 'char' | 'note' | 'clock'; path: string }> = [
  { title: 'Новая глава',    dest: 'Структура →',  icon: 'tree',  path: '/outline?create=true'    },
  { title: 'Новый персонаж', dest: 'Картотека →',  icon: 'char',  path: '/characters?create=true' },
  { title: 'Новая заметка',  dest: 'Заметки →',    icon: 'note',  path: '/notes?create=true'      },
  { title: 'Новое событие',  dest: 'Хронология →', icon: 'clock', path: '/timeline?create=true'   },
];
```

- [ ] **Step 2: Вставить секцию быстрых действий в JSX**

Найти в `Dashboard.tsx` строку с закрывающим `</div>` после `{statCards.map(...))}` (≈строка 347) и вставить ПОСЛЕ неё (перед `{book.goal > 0 &&`):

```tsx
            <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 10, marginTop: 4 }}>
              Быстрые действия
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {QUICK_ACTIONS.map(({ title, dest, icon, path }) => (
                <Link
                  key={title}
                  to={navTo(path)}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 12,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    textDecoration: 'none',
                    color: 'var(--ink)',
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-soft)';
                  }}
                >
                  <div style={{
                    width: 32, height: 32,
                    background: 'oklch(0.63 0.16 30 / 0.13)',
                    borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent)',
                    flexShrink: 0,
                  }}>
                    <Icon name={icon} size={15} />
                  </div>
                  <div style={{ font: '500 12.5px var(--font-ui)', color: 'var(--ink)' }}>{title}</div>
                  <div style={{ font: '400 10.5px var(--font-mono)', letterSpacing: '0.06em', color: 'var(--ink-4)', marginTop: 'auto' }}>{dest}</div>
                </Link>
              ))}
            </div>
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Ожидается: 0 ошибок.

- [ ] **Step 4: Проверить вручную**

```bash
npm run dev
```

Открыть http://localhost:5273, зайти на дашборд книги. Убедиться:
- Между статистикой и прогресс-баром появилась секция «БЫСТРЫЕ ДЕЙСТВИЯ»
- 4 карточки: Новая глава / Новый персонаж / Новая заметка / Новое событие
- Hover-эффект работает (фон светлеет, граница темнеет)
- На мобильной ширине < 768px — 2 колонки

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): §40 секция быстрых действий — 4 карточки создания сущностей"
```

---

### Task 2: Outline — обработка `?create=true`

**Files:**
- Modify: `src/pages/Outline.tsx`

Существующий `onCreate` (строки 514–532) создаёт главу и навигирует в редактор — именно этот обработчик нам нужен.

- [ ] **Step 1: Добавить `useSearchParams` в импорт**

Найти строку (≈строка 4):
```tsx
import { Link, useNavigate, useParams } from 'react-router-dom';
```
Заменить на:
```tsx
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
```

- [ ] **Step 2: Добавить `useEffect` после `onCreate`**

Найти строку (≈строка 532), которая завершает `onCreate`:
```tsx
  };

  const onRename
```
Вставить между `};` и `const onRename`:
```tsx
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('create') !== 'true') return;
    setSearchParams({}, { replace: true });
    void onCreate();
  }, [searchParams, setSearchParams, onCreate]);
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Ожидается: 0 ошибок.

- [ ] **Step 4: Проверить вручную**

Перейти по `/books/<любой-id>/outline?create=true`. Ожидается:
- Страница `Outline` монтируется, видит `create=true`
- Автоматически создаётся «Глава N», браузер переходит в редактор с этой главой
- URL очищается от `?create=true` (при возврате в структуру его нет)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Outline.tsx
git commit -m "feat(outline): обработка ?create=true — автосоздание главы при переходе"
```

---

### Task 3: Characters — обработка `?create=true`

**Files:**
- Modify: `src/pages/Characters.tsx`

`search` и `setSearch` уже доступны из `useCharacterNavigation` (строка 78). `onCreate` доступен из `useCharacterMutations` (строка 134). Новый `useSearchParams` импорт не нужен.

- [ ] **Step 1: Добавить `useEffect` после `useCharacterMutations`**

Найти строку (≈строка 146), которая закрывает `useCharacterMutations`:
```tsx
  });

  if (!bookId) return <Navigate to="/books" replace />;
```
Вставить между `});` и `if (!bookId)`:
```tsx
  useEffect(() => {
    if (search.get('create') !== 'true') return;
    const next = new URLSearchParams(search);
    next.delete('create');
    setSearch(next, { replace: true });
    void onCreate();
  }, [search, setSearch, onCreate]);
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Ожидается: 0 ошибок.

- [ ] **Step 3: Проверить вручную**

Перейти по `/books/<id>/characters?create=true`. Ожидается:
- Создаётся новый персонаж (имя пустое)
- Открывается detail-панель с этим персонажем
- URL меняется на `?character=<new-id>` без `create=true`

- [ ] **Step 4: Commit**

```bash
git add src/pages/Characters.tsx
git commit -m "feat(characters): обработка ?create=true — автосоздание персонажа при переходе"
```

---

### Task 4: Notes — обработка `?create=true`

**Files:**
- Modify: `src/pages/Notes.tsx`

`showForm` / `setShowForm` определены на строке 163. `setShowForm(true)` открывает форму добавления заметки.

- [ ] **Step 1: Добавить `useSearchParams` в импорт**

Найти строку (≈строка 2):
```tsx
import { Navigate, useParams } from 'react-router-dom';
```
Заменить на:
```tsx
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
```

- [ ] **Step 2: Добавить `useEffect` после `showForm` state**

Найти строку (≈строка 163):
```tsx
  const [showForm, setShowForm] = useState(false);
```
Добавить после неё:
```tsx
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('create') !== 'true') return;
    setSearchParams({}, { replace: true });
    setShowForm(true);
  }, [searchParams, setSearchParams]);
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Ожидается: 0 ошибок.

- [ ] **Step 4: Проверить вручную**

Перейти по `/books/<id>/notes?create=true`. Ожидается:
- Страница заметок открывается, форма создания заметки раскрыта
- URL очищается до `/notes`

- [ ] **Step 5: Commit**

```bash
git add src/pages/Notes.tsx
git commit -m "feat(notes): обработка ?create=true — автооткрытие формы заметки"
```

---

### Task 5: Timeline — обработка `?create=true`

**Files:**
- Modify: `src/pages/Timeline.tsx`

`onCreate` (строка 93) создаёт событие и добавляет его в список.

- [ ] **Step 1: Добавить `useSearchParams` в импорт**

Найти строку (≈строка 4):
```tsx
import { Navigate, useParams } from 'react-router-dom';
```
Заменить на:
```tsx
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
```

- [ ] **Step 2: Добавить `useEffect` после `onCreate`**

Найти строку (≈строка 105), которая завершает `onCreate`:
```tsx
  }, [bookId, user, events, queryClient]);

  const onUpdate
```
Вставить между `});` и `const onUpdate`:
```tsx
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('create') !== 'true') return;
    setSearchParams({}, { replace: true });
    void onCreate();
  }, [searchParams, setSearchParams, onCreate]);
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Ожидается: 0 ошибок.

- [ ] **Step 4: Проверить вручную**

Перейти по `/books/<id>/timeline?create=true`. Ожидается:
- Создаётся новое событие хронологии
- Оно появляется в списке событий

- [ ] **Step 5: Commit**

```bash
git add src/pages/Timeline.tsx
git commit -m "feat(timeline): обработка ?create=true — автосоздание события при переходе"
```

---

### Task 6: End-to-end проверка + roadmap

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Сквозная проверка с дашборда**

```bash
npm run dev
```

Для каждой карточки с дашборда:
1. Нажать «Новая глава» → должна создаться глава, переход в редактор
2. Вернуться на дашборд → нажать «Новый персонаж» → создаётся персонаж, открывается detail
3. Вернуться на дашборд → нажать «Новая заметка» → открывается форма заметки
4. Вернуться на дашборд → нажать «Новое событие» → создаётся событие в хронологии

- [ ] **Step 2: Убрать §40 из roadmap**

Найти и удалить строку с §40 из `docs/roadmap.md`.

- [ ] **Step 3: Финальный typecheck + lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 4: Commit roadmap**

```bash
git add docs/roadmap.md
git commit -m "chore(roadmap): §40 быстрые действия — выполнено"
```
