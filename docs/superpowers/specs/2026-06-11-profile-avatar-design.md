# Профиль пользователя + аватар

**Дата:** 2026-06-11  
**Статус:** approved  
**Роут:** `/profile`

---

## Цель

Страница профиля пользователя с возможностью задать отображаемое имя и загрузить аватар. Аватар отображается в SidebarFoot (вместо инициалов) и автоматически подтягивается из OAuth-провайдера (Google, Telegram) если пользователь не загрузил своё фото.

---

## Схема данных

### Миграция `profiles`

```sql
ALTER TABLE profiles
  ADD COLUMN display_name text,       -- null = fallback на user_metadata
  ADD COLUMN avatar_url    text;      -- null = fallback на OAuth или инициалы
```

### Supabase Storage — бакет `avatars`

- Публичный бакет (URL открытый, CDN-кэш)
- RLS на insert/update: `(storage.foldername(name))[1] = auth.uid()::text`
- Путь файла: `{user_id}/{timestamp}.jpg` — timestamp для cache busting при замене
- Старые файлы при замене не удаляются (orphans не критичны при текущем масштабе)

---

## Архитектура компонентов

### Цепочка fallback (аватар)

```
profiles.avatar_url          // загружен вручную
?? user_metadata.avatar_url  // Google OAuth
?? user_metadata.photo_url   // Telegram
?? null                      // → показываем инициалы
```

### Цепочка fallback (отображаемое имя)

```
profiles.display_name
?? user_metadata.full_name / user_metadata.name
?? tgName (first_name + last_name / @username)
?? user.email
```

### Файлы и изменения

| Файл | Что меняется |
|------|-------------|
| `supabase/migrations/NNNN_profile_display.sql` | ADD COLUMN display_name, avatar_url |
| `src/lib/profiles.ts` | Расширить `Profile` интерфейс; добавить `updateProfile`, `uploadAvatar`, `deleteAvatar` |
| `src/lib/useUserDisplay.ts` | Перейти на `useProfile` из queries.ts (убрать дублирующий useEffect); добавить `avatarUrl` в return |
| `src/components/Sidebar/SidebarFoot.tsx` | Условный рендер: `<img>` если `avatarUrl`, иначе инициалы |
| `src/components/AccountMenu.tsx` | Добавить пункт «Профиль» (`useNavigate('/profile')`) перед «Настройками» |
| `src/pages/Profile.tsx` | Новая страница |
| `src/App.tsx` | Маршрут `/profile` под `<Guard>` + lazy import |

---

## Страница `/profile`

### Раскладка (стиль B — compact/settings)

- Шапка: кнопка «← Назад» (`navigate(-1)`, fallback на `/books` если history пуст) + заголовок «Профиль»
- Секция аватара: кружок 52px + hover-оверлей с иконкой камеры → `<input type="file" accept="image/*" hidden>` + loading spinner во время загрузки
- Поле «Отображаемое имя»: `<input>` с текущим значением, кнопка «Сохранить» (disabled пока значение не изменено)
- Email — read-only
- Тариф — read-only + ссылка «Перейти на Pro» на `/offer` если `plan === 'free'`
- Кнопка «Удалить аватар» — показывается только если `profiles.avatar_url !== null`

### Навигация

Попасть на страницу: AccountMenu → пункт «Профиль» (добавляется перед «Настройками»).

---

## Новые функции в `profiles.ts`

```ts
updateProfile(userId: string, patch: { display_name?: string | null; avatar_url?: string | null }): Promise<void>

uploadAvatar(userId: string, file: File): Promise<string>
// 1. supabase.storage.from('avatars').upload(`${userId}/${Date.now()}.jpg`, file)
// 2. getPublicUrl()
// 3. updateProfile({ avatar_url: url })
// возвращает публичный URL

deleteAvatar(userId: string, avatarUrl: string): Promise<void>
// Извлекает storage-path из полного URL: часть после '/avatars/'
// 1. supabase.storage.from('avatars').remove([storagePath])
// 2. updateProfile({ avatar_url: null })
```

---

## Валидация и ошибки

| Ситуация | Реакция |
|----------|---------|
| `file.size > 2MB` | `.error-banner` «Файл слишком большой (макс. 2 МБ)», upload не запускается |
| `file.type` не `image/*` | `.error-banner` «Только изображения» |
| Storage upload failure | `useErrorState` → `.error-banner` на странице |
| Сохранение пустого имени | Сохраняем `null` (не ошибка; fallback на user_metadata) |
| Offline / pending | `isPending` блокирует file input и кнопку «Сохранить» |

---

## Тестирование (ручное)

1. Войти через Google → SidebarFoot показывает Google-фото без загрузки файла
2. Загрузить свой аватар → заменяет Google-фото в SidebarFoot немедленно
3. Удалить аватар → SidebarFoot возвращает Google-фото (не инициалы)
4. Войти через Telegram → `photo_url` из user_metadata подхватывается как fallback
5. Задать отображаемое имя → SidebarFoot и страницы используют его вместо `full_name`

---

## Вне скоупа

- Цель по словам в день (`daily_goal`) — per-book настройка, не переносить в профиль
- POV-автор на странице Characters — не предусмотрено
- Смена email — отдельный flow (Supabase `updateUser` + подтверждение), не реализуется сейчас
- Публичный профиль — не реализуется
