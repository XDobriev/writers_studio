# Profile + Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/profile` page where users can set a display name and upload an avatar; show the avatar (or OAuth photo) in SidebarFoot instead of initials.

**Architecture:** Hybrid fallback — `profiles.avatar_url` stores only user-uploaded photos; `useUserDisplay` resolves the display chain in memory (uploaded → OAuth → initials). The refactored `useUserDisplay` delegates to the existing `useProfile` React Query hook, eliminating a duplicate fetch. The Profile page follows the compact settings-style layout (option B from brainstorming).

**Tech Stack:** React + TypeScript, Supabase (Postgres + Storage), React Query (`useMutation`), React Router v6, Framer Motion (existing `PageMotion` wrapper)

---

## File Map

| Action | Path |
|--------|------|
| CREATE | `supabase/migrations/0034_profile_display.sql` |
| MODIFY | `src/lib/profiles.ts` |
| MODIFY | `src/lib/useUserDisplay.ts` |
| MODIFY | `src/styles/design-system.css` |
| MODIFY | `src/components/Sidebar/SidebarFoot.tsx` |
| MODIFY | `src/components/AccountMenu.tsx` |
| CREATE | `src/pages/Profile.tsx` |
| MODIFY | `src/App.tsx` |
| MODIFY | `CLAUDE.md` |
| MODIFY | `.gitignore` |

---

### Task 1: DB Migration — add `display_name` и `avatar_url` к `profiles`

**Files:**
- Create: `supabase/migrations/0034_profile_display.sql`

- [ ] **Step 1: Написать SQL миграцию**

Создать файл `supabase/migrations/0034_profile_display.sql`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url   text;
```

- [ ] **Step 2: Применить миграцию через Supabase MCP**

Вызвать `mcp__supabase__apply_migration` с:
- `project_ref`: `joaxeoavjvlqmtlepkrr`
- `name`: `profile_display`
- `query`: содержимое SQL выше

- [ ] **Step 3: Проверить схему**

Вызвать `mcp__supabase__execute_sql` с запросом:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('display_name', 'avatar_url');
```
Ожидаемый результат: две строки, оба `text`, `YES` (nullable).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0034_profile_display.sql
git commit -m "feat(db): add display_name + avatar_url columns to profiles"
```

---

### Task 2: Supabase Storage — бакет `avatars`

**Files:** (только MCP-вызовы, файлы не меняются)

- [ ] **Step 1: Создать публичный бакет через MCP**

Вызвать `mcp__supabase__execute_sql` с:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Настроить RLS для Storage**

Вызвать `mcp__supabase__execute_sql` с:
```sql
-- Разрешить чтение всем (бакет публичный)
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Разрешить загрузку только в свою папку
CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Разрешить замену только своих файлов
CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Разрешить удаление только своих файлов
CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 3: Проверить**

Вызвать `mcp__supabase__execute_sql` с:
```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'avatars';
```
Ожидаемый результат: строка с `public = true`.

---

### Task 3: `profiles.ts` — расширить интерфейс и добавить функции

**Files:**
- Modify: `src/lib/profiles.ts`

- [ ] **Step 1: Расширить интерфейс `Profile` и обновить `getProfile`**

В `src/lib/profiles.ts` заменить интерфейс `Profile` и функцию `getProfile`:

```typescript
export interface Profile {
  user_id: string;
  plan: string;
  plan_expires_at: string | null;
  onboarded_at: string | null;
  user_dictionary: string[];
  grandfathered: boolean;
  display_name: string | null;
  avatar_url: string | null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, onboarded_at, user_dictionary, grandfathered, display_name, avatar_url')
    .eq('user_id', userId)
    .single();
  if (error) console.error('[profiles] getProfile failed:', error.message);
  return (data as Profile | null) ?? null;
}
```

- [ ] **Step 2: Добавить `updateProfile`, `uploadAvatar`, `deleteAvatar`**

В конец файла `src/lib/profiles.ts` добавить:

```typescript
export async function updateProfile(
  userId: string,
  patch: { display_name?: string | null; avatar_url?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  await updateProfile(userId, { avatar_url: data.publicUrl });
  return data.publicUrl;
}

export async function deleteAvatar(userId: string, avatarUrl: string): Promise<void> {
  const marker = '/avatars/';
  const idx = avatarUrl.indexOf(marker);
  if (idx !== -1) {
    const storagePath = avatarUrl.slice(idx + marker.length);
    await supabase.storage.from('avatars').remove([storagePath]);
  }
  await updateProfile(userId, { avatar_url: null });
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Ожидаемый результат: 0 ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/lib/profiles.ts
git commit -m "feat(profiles): add display_name/avatar_url to Profile; add updateProfile, uploadAvatar, deleteAvatar"
```

---

### Task 4: `useUserDisplay.ts` — рефакторинг под `useProfile`

**Files:**
- Modify: `src/lib/useUserDisplay.ts`

> **Контекст:** сейчас `useUserDisplay` делает собственный `useEffect` с вызовом `getProfile`. Это дублирует `useProfile` из `queries.ts`. После рефакторинга хук использует тот же React Query кэш. Возвращаемый тип расширяется: добавляется `avatarUrl`.

- [ ] **Step 1: Заменить содержимое `useUserDisplay.ts`**

```typescript
import { useAuth } from './auth';
import { useProfile } from './queries';

export function useUserDisplay() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile(user?.id);

  const meta = user?.user_metadata;
  const tgName = meta?.provider === 'telegram'
    ? ([meta?.first_name, meta?.last_name].filter(Boolean).join(' ') || (meta?.telegram_username ? `@${meta.telegram_username}` : null))
    : null;

  const displayName: string = profile?.display_name
    ?? meta?.full_name
    ?? meta?.name
    ?? tgName
    ?? user?.email
    ?? '';

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join('') || '?';

  const avatarUrl: string | null = profile?.avatar_url
    ?? meta?.avatar_url
    ?? meta?.photo_url
    ?? null;

  return {
    displayName,
    initials,
    plan: profile?.plan ?? 'free',
    planLoaded: !isLoading,
    avatarUrl,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Ожидаемый результат: 0 ошибок. Если `avatarUrl` используется в других файлах — они пока не существуют, ошибок не будет.

- [ ] **Step 3: Commit**

```bash
git add src/lib/useUserDisplay.ts
git commit -m "refactor(useUserDisplay): delegate to useProfile hook; add avatarUrl fallback chain"
```

---

### Task 5: CSS — стили аватара с фото + страница профиля

**Files:**
- Modify: `src/styles/design-system.css`

- [ ] **Step 1: Добавить `overflow: hidden` в `.sb-avatar` и стиль для `img`**

Найти в `design-system.css` блок `.sb-avatar` (около строки 355) и добавить `overflow: hidden`:

```css
.sb-avatar {
  width: 28px; height: 28px; border-radius: 999px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  display: flex; align-items: center; justify-content: center;
  font: 500 11px var(--font-ui); color: oklch(0.98 0 0);
  overflow: hidden;
}
.sb-avatar img { width: 100%; height: 100%; object-fit: cover; }
```

- [ ] **Step 2: Добавить стили для страницы профиля**

В конец `design-system.css` добавить:

```css
/* ── Profile page ──────────────────────────────────────────────── */
.profile-wrap {
  max-width: 460px;
  margin: 0 auto;
  padding: clamp(24px, 5vw, 48px) clamp(16px, 4vw, 32px);
}
.profile-back {
  display: inline-flex; align-items: center; gap: 6px;
  background: none; border: none; cursor: pointer;
  font: 400 12.5px var(--font-ui); color: var(--ink-3);
  padding: 0; margin-bottom: 28px;
  transition: color 0.1s;
}
.profile-back:hover { color: var(--ink); }
.profile-header {
  display: flex; align-items: center; gap: 14px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-soft);
  margin-bottom: 20px;
}
.avatar-upload-zone {
  position: relative;
  width: 52px; height: 52px;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
}
.avatar-upload-zone:hover .avatar-upload-overlay { opacity: 1; }
.avatar-upload-zone .sb-avatar {
  width: 52px; height: 52px;
  font-size: 17px;
}
.avatar-upload-overlay {
  position: absolute; inset: 0;
  border-radius: 999px;
  background: oklch(0 0 0 / 0.55);
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
  color: oklch(0.98 0 0); /* иконка камеры белая поверх тёмного оверлея */
}
.avatar-upload-zone.is-uploading .avatar-upload-overlay { opacity: 1; }
.profile-field {
  display: flex; flex-direction: column; gap: 6px;
  margin-bottom: 16px;
}
.profile-field-row {
  display: flex; align-items: center; gap: 10px;
}
.profile-readonly {
  font: 400 13px var(--font-ui); color: var(--ink-3);
  padding: 6px 0;
}
```

- [ ] **Step 3: Typecheck (CSS нет TS, просто убедиться что dev-сервер не ломается)**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/design-system.css
git commit -m "feat(css): add avatar img support + profile page styles"
```

---

### Task 6: `SidebarFoot.tsx` — показывать фото вместо инициалов

**Files:**
- Modify: `src/components/Sidebar/SidebarFoot.tsx`

- [ ] **Step 1: Обновить SidebarFoot**

Заменить всё содержимое `src/components/Sidebar/SidebarFoot.tsx`:

```typescript
import { useUserDisplay } from '../../lib/useUserDisplay';
import { Icon } from '../Icon';
import { AccountMenu } from '../AccountMenu';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  lifetime: 'Lifetime',
};

export function SidebarFoot() {
  const { displayName, initials, avatarUrl, plan, planLoaded } = useUserDisplay();

  return (
    <AccountMenu placement="above">
      {({ onClick, open, signingOut }) => (
        <button
          type="button"
          className="sb-foot"
          aria-label="Аккаунт"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={onClick}
        >
          <div className="sb-avatar" style={signingOut ? { opacity: 0.5 } : undefined}>
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} referrerPolicy="no-referrer" />
              : initials
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sb-foot-name">{displayName || '—'}</div>
            <div className="sb-foot-meta">{planLoaded ? (PLAN_LABEL[plan] ?? plan) : '…'}</div>
          </div>
          <span style={{ color: 'var(--ink-4)', flexShrink: 0, transition: 'transform 0.12s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', display: 'flex' }}>
            <Icon name="chevd" size={12} />
          </span>
        </button>
      )}
    </AccountMenu>
  );
}
```

> **Заметка:** `referrerPolicy="no-referrer"` важен для Google-аватаров — без него браузер иногда блокирует запрос.

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Ожидаемый результат: 0 ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar/SidebarFoot.tsx
git commit -m "feat(sidebar): show avatar photo in SidebarFoot with initials fallback"
```

---

### Task 7: `AccountMenu.tsx` — добавить пункт «Профиль»

**Files:**
- Modify: `src/components/AccountMenu.tsx`

- [ ] **Step 1: Добавить `useNavigate` и кнопку «Профиль»**

В начале файла добавить импорт:
```typescript
import { useNavigate } from 'react-router-dom';
```

Внутри функции `AccountMenu` сразу после строк с `const [settingsOpen, setSettingsOpen]` добавить:
```typescript
const navigate = useNavigate();
```

В JSX, перед кнопкой «Настройки», добавить новый пункт меню:
```tsx
<button
  type="button"
  role="menuitem"
  className="sb-dropdown-item"
  onClick={() => { setOpen(false); navigate('/profile'); }}
>
  <Icon name="user" size={14} />
  Профиль
</button>
<div style={{ height: 1, background: 'var(--border-soft)', margin: '2px 0' }} />
```

Итоговый порядок пунктов меню: Профиль → разделитель → Настройки → разделитель → Выйти.

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AccountMenu.tsx
git commit -m "feat(account-menu): add Профиль navigation item"
```

---

### Task 8: `Profile.tsx` — новая страница

**Files:**
- Create: `src/pages/Profile.tsx`

- [ ] **Step 1: Создать `src/pages/Profile.tsx`**

```typescript
import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { useUserDisplay } from '../lib/useUserDisplay';
import { useProfile, QUERY_KEYS } from '../lib/queries';
import { updateProfile, uploadAvatar, deleteAvatar } from '../lib/profiles';
import { useErrorState } from '../lib/useErrorState';
import { Icon } from '../components/Icon';

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  lifetime: 'Lifetime',
};

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { displayName, initials, avatarUrl } = useUserDisplay();
  const { data: profile } = useProfile(user?.id);
  const queryClient = useQueryClient();
  const { error, setError, clearError } = useErrorState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nameInput, setNameInput] = useState('');
  const [nameInitialized, setNameInitialized] = useState(false);

  useEffect(() => {
    if (!nameInitialized && profile !== undefined) {
      setNameInput(profile?.display_name ?? '');
      setNameInitialized(true);
    }
  }, [profile, nameInitialized]);

  const savedName = profile?.display_name ?? '';
  const isDirty = nameInitialized && nameInput !== savedName;

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(user!.id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(user!.id) });
      clearError();
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err : new Error(String(err))),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAvatar(user!.id, profile!.avatar_url!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(user!.id) });
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err : new Error(String(err))),
  });

  const nameMutation = useMutation({
    mutationFn: (name: string) =>
      updateProfile(user!.id, { display_name: name.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(user!.id) });
      clearError();
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err : new Error(String(err))),
  });

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/books');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(new Error('Только изображения'));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(new Error('Файл слишком большой (макс. 2 МБ)'));
      return;
    }
    clearError();
    uploadMutation.mutate(file);
  }

  const isPending =
    uploadMutation.isPending || deleteMutation.isPending || nameMutation.isPending;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="profile-wrap">
        <button type="button" className="profile-back" onClick={handleBack}>
          <Icon name="chev" size={14} />
          Назад
        </button>

        {error && (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            {error.message}
          </div>
        )}

        <div className="profile-header">
          <div
            className={`avatar-upload-zone${uploadMutation.isPending ? ' is-uploading' : ''}`}
            onClick={() => !isPending && fileInputRef.current?.click()}
            role="button"
            aria-label="Изменить фото профиля"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && !isPending && fileInputRef.current?.click()}
          >
            <div className="sb-avatar">
              {avatarUrl
                ? <img src={avatarUrl} alt={displayName} referrerPolicy="no-referrer" />
                : initials
              }
            </div>
            <div className="avatar-upload-overlay">
              {uploadMutation.isPending
                ? <span style={{ fontSize: 10, color: 'oklch(0.98 0 0)' }}>…</span>
                : <Icon name="camera" size={16} />
              }
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={isPending}
          />

          <div>
            <div style={{ font: '600 15px var(--font-ui)', color: 'var(--ink)' }}>
              {displayName || '—'}
            </div>
            <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', marginTop: 2 }}>
              {PLAN_LABEL[profile?.plan ?? 'free'] ?? profile?.plan}
            </div>
          </div>
        </div>

        <div className="profile-field">
          <label className="label" htmlFor="profile-name">Отображаемое имя</label>
          <div className="profile-field-row">
            <input
              id="profile-name"
              className="input"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={displayName}
              disabled={isPending}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={!isDirty || isPending}
              onClick={() => nameMutation.mutate(nameInput)}
            >
              {nameMutation.isPending ? '…' : 'Сохранить'}
            </button>
          </div>
        </div>

        <div className="profile-field">
          <span className="label">Email</span>
          <div className="profile-readonly">{user?.email}</div>
        </div>

        <div className="profile-field">
          <span className="label">Тариф</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="profile-readonly">
              {PLAN_LABEL[profile?.plan ?? 'free'] ?? profile?.plan}
            </div>
            {profile?.plan === 'free' && (
              <Link
                to="/offer"
                className="btn btn--primary btn--sm"
                style={{ textDecoration: 'none' }}
              >
                Перейти на Pro
              </Link>
            )}
          </div>
        </div>

        {profile?.avatar_url && (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => deleteMutation.mutate()}
              disabled={isPending}
              style={{ color: 'var(--danger)' }}
            >
              {deleteMutation.isPending ? 'Удаляем…' : 'Удалить аватар'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Ожидаемый результат: 0 ошибок. Если `QUERY_KEYS.profile` не принимает `string` (т.к. `user!.id` — это `string`) — всё ок.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: add /profile page with avatar upload and display name editing"
```

---

### Task 9: `App.tsx` — добавить маршрут `/profile`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Добавить lazy import**

В блоке lazy-импортов (строки 15–36) добавить:
```typescript
const Profile = lazy(() => import('./pages/Profile'));
```

- [ ] **Step 2: Добавить маршрут**

В `AnimatedRoutes`, после маршрута `/books`, добавить:
```tsx
<Route path="/profile" element={<PageMotion><Guard><Profile /></Guard></PageMotion>} />
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(router): add /profile route"
```

---

### Task 10: Финальная проверка + housekeeping

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.gitignore`

- [ ] **Step 1: Добавить `.superpowers/` в `.gitignore`**

Если в `.gitignore` нет строки `.superpowers/` — добавить её (файлы визуального companion хранить локально, не в репо).

- [ ] **Step 2: Обновить `CLAUDE.md` — добавить Profile в реестр**

В раздел `### Страницы` в `CLAUDE.md` добавить строку:
```
- `src/pages/Profile.tsx` — страница профиля `/profile`: аватар (загрузка/удаление), отображаемое имя, email (read-only), тариф.
```

- [ ] **Step 3: Полный typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Ожидаемый результат: 0 ошибок, 0 предупреждений.

- [ ] **Step 4: Ручное тестирование (список из спека)**

1. Войти через Google → SidebarFoot показывает Google-фото без загрузки файла
2. AccountMenu → «Профиль» → попадаем на `/profile`
3. Загрузить свой аватар → заменяет Google-фото в SidebarFoot немедленно
4. Удалить аватар → SidebarFoot возвращает Google-фото
5. Задать отображаемое имя → SidebarFoot и другие места используют новое имя
6. Загрузить файл > 2 МБ → видим error-banner «Файл слишком большой»
7. Нажать «← Назад» → возврат на предыдущую страницу

- [ ] **Step 5: Финальный commit**

```bash
git add CLAUDE.md .gitignore
git commit -m "chore: register Profile page in CLAUDE.md; add .superpowers to .gitignore"
```
