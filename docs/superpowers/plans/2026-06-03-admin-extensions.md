# Admin Panel Extensions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Расширить панель администратора: история платежей, блокировка пользователей, CSV-экспорт, карточка пользователя, управление Lifetime-слотами, grace period, revenue-метрики, feature flags.

**Architecture:** Все admin-операции проходят через SECURITY DEFINER PostgreSQL RPC с проверкой `app_config.admin_email` — точно как существующий `set_user_plan`. UI расширяет `Admin.tsx` новыми вкладками и inline-действиями; одна новая страница `AdminUserDetail.tsx` для drilldown по пользователю. Платежи записываются Edge Function `yukassa-webhook` через INSERT в уже существующую таблицу `admin_audit_log`.

**Tech Stack:** React + TypeScript, Supabase Postgres RPCs (SECURITY DEFINER), Supabase Edge Functions (Deno/TypeScript), React Router v6.

---

## Карта файлов

**Изменяются:**
- `supabase/functions/yukassa-webhook/index.ts` — INSERT в audit_log после успешного платежа
- `src/pages/Admin.tsx` — новые вкладки (Платежи, Финансы, Флаги), suspend/unsuspend, CSV, grace period, lifetime slots
- `src/App.tsx` — маршрут `/admin/users/:id`

**Создаются:**
- `supabase/migrations/0028_admin_actions.sql` — RPC: suspend_user, extend_plan, set_lifetime_slots, get_admin_user_detail; обновление get_admin_users (+ suspended)
- `supabase/migrations/0029_revenue_flags.sql` — таблица feature_flags, RPC: get_admin_revenue, set_feature_flag, get_feature_flags
- `src/pages/AdminUserDetail.tsx` — страница `/admin/users/:id`

---

## Фаза 1 — Критично (§4 ЮKassa)

### Task 1: Webhook → payment_received в audit log

**Files:**
- Modify: `supabase/functions/yukassa-webhook/index.ts`

- [ ] **Step 1: Добавить вспомогательную функцию logPayment**

После объявления функции `json(...)` (после строки 33) вставить:

```typescript
async function logPayment(
  db: ReturnType<typeof createClient>,
  userId: string,
  payment: YookassaPayment,
  plan: string,
): Promise<void> {
  await db.from('admin_audit_log').insert({
    admin_id: '00000000-0000-0000-0000-000000000000',
    admin_email: 'system',
    action: 'payment_received',
    target_user_id: userId,
    payload: {
      amount: payment.amount.value,
      currency: payment.amount.currency,
      plan,
      payment_id: payment.id,
    },
  });
}
```

- [ ] **Step 2: Вызвать logPayment в конце lifetime-ветки**

В файле `supabase/functions/yukassa-webhook/index.ts` найти строку:
```typescript
    if (error) return json(500, { error: `profiles update failed: ${error.message}` });

  } else if (plan === 'pro' || plan === 'pro_annual') {
```
Заменить на:
```typescript
    if (error) return json(500, { error: `profiles update failed: ${error.message}` });
    await logPayment(db, userId, payment, plan);

  } else if (plan === 'pro' || plan === 'pro_annual') {
```

- [ ] **Step 3: Вызвать logPayment в конце pro/pro_annual-ветки**

Найти вторую строку:
```typescript
    if (error) return json(500, { error: `profiles update failed: ${error.message}` });

  } else {
    return json(400, { error: `unknown plan: ${plan}` });
```
Заменить на:
```typescript
    if (error) return json(500, { error: `profiles update failed: ${error.message}` });
    await logPayment(db, userId, payment, plan);

  } else {
    return json(400, { error: `unknown plan: ${plan}` });
```

- [ ] **Step 4: Задеплоить Edge Function через Supabase MCP**

Использовать `mcp__supabase__deploy_edge_function` с `function_name: "yukassa-webhook"` и содержимым обновлённого файла.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/yukassa-webhook/index.ts
git commit -m "feat(webhook): log payment_received events to admin_audit_log"
```

---

### Task 2: Migration 0028 — admin actions RPCs

**Files:**
- Create: `supabase/migrations/0028_admin_actions.sql`

- [ ] **Step 1: Создать файл миграции**

Создать `supabase/migrations/0028_admin_actions.sql` со следующим содержимым:

```sql
-- Admin panel extensions: suspend_user, extend_plan, set_lifetime_slots,
-- get_admin_user_detail, и обновление get_admin_users (+ suspended field).

-- 1. suspend_user — блокирует/разблокирует через auth.users.banned_until
CREATE OR REPLACE FUNCTION public.suspend_user(
  target_user_id uuid,
  suspend         boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email  text;
  v_caller_id    uuid;
  v_target_email text;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  v_caller_id := auth.uid();

  SELECT email INTO v_target_email FROM auth.users WHERE id = target_user_id;
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  IF suspend THEN
    UPDATE auth.users SET banned_until = 'infinity' WHERE id = target_user_id;
  ELSE
    UPDATE auth.users SET banned_until = NULL WHERE id = target_user_id;
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (
    v_caller_id,
    v_admin_email,
    CASE WHEN suspend THEN 'suspend_user' ELSE 'unsuspend_user' END,
    target_user_id,
    jsonb_build_object('email', v_target_email)
  );
END;
$$;

-- 2. extend_plan — добавляет N дней Pro (от текущего истечения или от now())
CREATE OR REPLACE FUNCTION public.extend_plan(
  target_user_id uuid,
  days           integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_caller_id   uuid;
  v_current_exp timestamptz;
  v_new_exp     timestamptz;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  v_caller_id := auth.uid();

  SELECT plan_expires_at INTO v_current_exp
  FROM public.profiles WHERE user_id = target_user_id;

  v_new_exp := GREATEST(COALESCE(v_current_exp, now()), now())
               + (days || ' days')::interval;

  UPDATE public.profiles
  SET plan = 'pro', plan_expires_at = v_new_exp
  WHERE user_id = target_user_id;

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (
    v_caller_id,
    v_admin_email,
    'extend_plan',
    target_user_id,
    jsonb_build_object('days', days, 'new_expires_at', v_new_exp)
  );
END;
$$;

-- 3. set_lifetime_slots — ручная корректировка счётчика Lifetime-слотов
CREATE OR REPLACE FUNCTION public.set_lifetime_slots(
  new_value integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_caller_id   uuid;
  v_old_value   text;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  v_caller_id := auth.uid();

  SELECT value INTO v_old_value
  FROM public.app_settings WHERE key = 'lifetime_slots_remaining';

  UPDATE public.app_settings
  SET value = new_value::text
  WHERE key = 'lifetime_slots_remaining';

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (
    v_caller_id,
    v_admin_email,
    'set_lifetime_slots',
    NULL,
    jsonb_build_object('old_value', v_old_value, 'new_value', new_value)
  );
END;
$$;

-- 4. get_admin_user_detail — детальная карточка для /admin/users/:id
CREATE OR REPLACE FUNCTION public.get_admin_user_detail(
  target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_result      jsonb;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'books', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',             b.id,
        'title',          b.title,
        'chapters_count', (SELECT count(*) FROM public.chapters c WHERE c.book_id = b.id),
        'words_total',    COALESCE((SELECT sum(c.words_count) FROM public.chapters c WHERE c.book_id = b.id), 0)
      ) ORDER BY b.created_at DESC)
      FROM public.books b WHERE b.user_id = target_user_id
    ), '[]'::jsonb),
    'plan_history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'action',     l.action,
        'payload',    l.payload,
        'created_at', l.created_at
      ) ORDER BY l.created_at DESC)
      FROM public.admin_audit_log l
      WHERE l.target_user_id = get_admin_user_detail.target_user_id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 5. Обновляем get_admin_users: добавляем plan и suspended.
-- Полная замена функции из 0010_admin_rpc_security.sql.
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE(
  id          uuid,
  email       text,
  created_at  timestamptz,
  books_count bigint,
  words_total bigint,
  last_active date,
  plan        text,
  suspended   boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.created_at,
    COUNT(DISTINCT b.id)::bigint                                        AS books_count,
    COALESCE(SUM(b.words), 0)::bigint                                   AS words_total,
    MAX(ws.date)                                                        AS last_active,
    COALESCE(p.plan, 'free')::text                                      AS plan,
    (u.banned_until IS NOT NULL AND u.banned_until > now())             AS suspended
  FROM auth.users u
  LEFT JOIN public.books b               ON b.user_id = u.id
  LEFT JOIN public.writing_snapshots ws  ON ws.user_id = u.id
  LEFT JOIN public.profiles p            ON p.user_id = u.id
  GROUP BY u.id, u.email, u.created_at, p.plan, u.banned_until
  ORDER BY u.created_at DESC;
END;
$$;
```

- [ ] **Step 2: Применить миграцию через Supabase MCP**

Использовать `mcp__supabase__apply_migration` с `name: "0028_admin_actions"` и содержимым файла.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0028_admin_actions.sql
git commit -m "feat(db): admin RPCs — suspend_user, extend_plan, set_lifetime_slots, user_detail"
```

---

### Task 3: Migration 0029 — revenue metrics + feature flags

**Files:**
- Create: `supabase/migrations/0029_revenue_flags.sql`

- [ ] **Step 1: Создать файл миграции**

Создать `supabase/migrations/0029_revenue_flags.sql`:

```sql
-- Revenue metrics RPC + feature flags table.

-- 1. get_admin_revenue — MRR, churn, план-разбивка
CREATE OR REPLACE FUNCTION public.get_admin_revenue()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email    text;
  v_pro_count      bigint;
  v_lifetime_count bigint;
  v_churn_count    bigint;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_pro_count
  FROM public.profiles
  WHERE plan = 'pro'
    AND (plan_expires_at IS NULL OR plan_expires_at > now());

  SELECT COUNT(*) INTO v_lifetime_count
  FROM public.profiles WHERE plan = 'lifetime';

  -- Churn = set_plan из pro → free за последние 30 дней
  SELECT COUNT(*) INTO v_churn_count
  FROM public.admin_audit_log
  WHERE action = 'set_plan'
    AND payload->>'old_plan' = 'pro'
    AND payload->>'new_plan' = 'free'
    AND created_at >= now() - interval '30 days';

  RETURN json_build_object(
    'mrr',            v_pro_count * 390,
    'arr',            v_pro_count * 390 * 12,
    'pro_count',      v_pro_count,
    'lifetime_count', v_lifetime_count,
    'churn_count_30d', v_churn_count,
    'churn_rate',     CASE
      WHEN (v_pro_count + v_churn_count) > 0
      THEN ROUND((v_churn_count::numeric / (v_pro_count + v_churn_count) * 100), 1)
      ELSE 0
    END
  );
END;
$$;

-- 2. feature_flags — таблица флагов фичей
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         text        PRIMARY KEY,
  enabled     boolean     NOT NULL DEFAULT false,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags select all"
  ON public.feature_flags FOR SELECT
  USING (true);

GRANT SELECT ON TABLE public.feature_flags TO anon, authenticated;

-- 3. get_feature_flags — публичный RPC для клиентской стороны
CREATE OR REPLACE FUNCTION public.get_feature_flags()
RETURNS TABLE(key text, enabled boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT key, enabled FROM public.feature_flags ORDER BY key;
$$;

-- 4. set_feature_flag — только для администратора
CREATE OR REPLACE FUNCTION public.set_feature_flag(
  p_key     text,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_email text;
  v_caller_id   uuid;
  v_old_enabled boolean;
BEGIN
  SELECT value INTO v_admin_email FROM public.app_config WHERE key = 'admin_email';
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM v_admin_email THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  v_caller_id := auth.uid();

  SELECT enabled INTO v_old_enabled
  FROM public.feature_flags WHERE key = p_key;

  INSERT INTO public.feature_flags (key, enabled, updated_at)
  VALUES (p_key, p_enabled, now())
  ON CONFLICT (key) DO UPDATE SET enabled = p_enabled, updated_at = now();

  INSERT INTO public.admin_audit_log (admin_id, admin_email, action, target_user_id, payload)
  VALUES (
    v_caller_id,
    v_admin_email,
    'set_feature_flag',
    NULL,
    jsonb_build_object('key', p_key, 'old_enabled', v_old_enabled, 'new_enabled', p_enabled)
  );
END;
$$;
```

- [ ] **Step 2: Применить миграцию через Supabase MCP**

Использовать `mcp__supabase__apply_migration` с `name: "0029_revenue_flags"`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0029_revenue_flags.sql
git commit -m "feat(db): get_admin_revenue RPC + feature_flags table + set/get RPCs"
```

---

### Task 4: Admin.tsx — CSV-экспорт, Suspend, Grace period, Lifetime slots

**Files:**
- Modify: `src/pages/Admin.tsx`

Этот таск содержит все inline-изменения в таблице пользователей и блоке статистики. Выполнять последовательно.

- [ ] **Step 1: Обновить тип AdminUser — добавить suspended**

В `src/pages/Admin.tsx` найти:
```typescript
interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  books_count: number;
  words_total: number;
  last_active: string | null;
  plan: Plan;
}
```
Заменить на:
```typescript
interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  books_count: number;
  words_total: number;
  last_active: string | null;
  plan: Plan;
  suspended: boolean;
}
```

- [ ] **Step 2: Добавить новый state для inline-действий**

В `Admin()` после строки `const [auditLoading, setAuditLoading] = useState(false);` добавить:
```typescript
  const [suspending, setSuspending] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null);
  const [lifetimeSlots, setLifetimeSlots] = useState('');
  const [slotsSaving, setSlotsSaving] = useState(false);
```

- [ ] **Step 3: Добавить handler handleSuspend**

После функции `handlePlanChange` (после строки 164) вставить:
```typescript
  const handleSuspend = async (u: AdminUser) => {
    setSuspending(u.id);
    clearErr();
    const { error } = await supabase.rpc('suspend_user', {
      target_user_id: u.id,
      suspend: !u.suspended,
    });
    if (error) {
      setErr(error.message);
    } else {
      setUsers((prev) => prev?.map((x) => x.id === u.id ? { ...x, suspended: !u.suspended } : x) ?? prev);
    }
    setSuspending(null);
  };

  const handleExtendPlan = async (u: AdminUser) => {
    setExtending(u.id);
    clearErr();
    const { error } = await supabase.rpc('extend_plan', {
      target_user_id: u.id,
      days: 7,
    });
    if (error) {
      setErr(error.message);
    } else {
      setUsers((prev) => prev?.map((x) => x.id === u.id ? { ...x, plan: 'pro' as Plan } : x) ?? prev);
    }
    setExtending(null);
  };

  const handleSaveSlots = async () => {
    const n = parseInt(lifetimeSlots, 10);
    if (isNaN(n) || n < 0) return;
    setSlotsSaving(true);
    clearErr();
    const { error } = await supabase.rpc('set_lifetime_slots', { new_value: n });
    if (error) setErr(error.message);
    setSlotsSaving(false);
  };

  const handleExportCsv = () => {
    if (!users) return;
    const header = ['email', 'created_at', 'plan', 'last_active'].join(',');
    const rows = users.map((u) =>
      [u.email, u.created_at, u.plan, u.last_active ?? ''].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
```

- [ ] **Step 4: Добавить кнопку «Выгрузить CSV» над таблицей**

Найти:
```tsx
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionTitle>Список пользователей {users != null && `(${filtered.length}/${users.length})`}</SectionTitle>
          <input
```
Заменить на:
```tsx
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionTitle>Список пользователей {users != null && `(${filtered.length}/${users.length})`}</SectionTitle>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleExportCsv}
              disabled={!users}
              style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', background: 'none', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
            >
              Выгрузить CSV
            </button>
            <input
```

А закрывающий `/>` у `<input>` оставить, добавив после него:
```tsx
          </div>
```

- [ ] **Step 5: Добавить колонки Suspend и +7д в заголовок таблицы**

Найти:
```tsx
                  <th style={thStyle()}>План</th>
                </tr>
```
Заменить на:
```tsx
                  <th style={thStyle()}>План</th>
                  <th style={thStyle()}>+7д</th>
                  <th style={thStyle()}>Статус</th>
                </tr>
```

- [ ] **Step 6: Добавить ячейки Suspend и +7д в строки таблицы**

Найти:
```tsx
                    <td style={{ padding: '8px 16px' }}>
                      <select
                        value={u.plan}
                        disabled={planChanging === u.id}
                        onChange={(e) => handlePlanChange(u, e.target.value as Plan)}
```
Заменить на (добавляем два `<td>` после `</td>` закрытия select):

```tsx
                    <td style={{ padding: '8px 16px' }}>
                      <select
                        value={u.plan}
                        disabled={planChanging === u.id}
                        onChange={(e) => handlePlanChange(u, e.target.value as Plan)}
```

И после строки `</td>` (конец ячейки select) перед `</tr>` добавить:

```tsx
                    <td style={{ padding: '8px 16px' }}>
                      <button
                        onClick={() => handleExtendPlan(u)}
                        disabled={extending === u.id}
                        style={{ font: '400 11px var(--font-mono)', color: 'oklch(0.62 0.18 270)', background: 'none', border: '1px solid oklch(0.62 0.18 270 / 0.4)', borderRadius: 4, padding: '2px 7px', cursor: extending === u.id ? 'wait' : 'pointer', opacity: extending === u.id ? 0.5 : 1 }}
                      >
                        +7д
                      </button>
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <button
                        onClick={() => handleSuspend(u)}
                        disabled={suspending === u.id}
                        style={{ font: '400 11px var(--font-mono)', color: u.suspended ? 'var(--danger)' : 'var(--ink-3)', background: 'none', border: `1px solid ${u.suspended ? 'oklch(0.65 0.18 25 / 0.5)' : 'var(--border-soft)'}`, borderRadius: 4, padding: '2px 7px', cursor: suspending === u.id ? 'wait' : 'pointer', opacity: suspending === u.id ? 0.5 : 1 }}
                      >
                        {u.suspended ? 'Разблок.' : 'Suspend'}
                      </button>
                    </td>
```

- [ ] **Step 7: Добавить Lifetime-слоты в блок статистики**

Найти в блоке «Активность»:
```tsx
        <SectionTitle>Активность (writing snapshots)</SectionTitle>
```
Перед ним вставить новый блок — lifetime slots:
```tsx
        <SectionTitle>Lifetime-слоты</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }}>
          <input
            className="input"
            type="number"
            min={0}
            placeholder="Кол-во слотов"
            value={lifetimeSlots}
            onChange={(e) => setLifetimeSlots(e.target.value)}
            style={{ width: 120, height: 32, fontSize: 13 }}
          />
          <button
            onClick={handleSaveSlots}
            disabled={slotsSaving || lifetimeSlots === ''}
            style={{ font: '400 12px var(--font-ui)', color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, padding: '4px 14px', cursor: slotsSaving ? 'wait' : 'pointer', opacity: slotsSaving ? 0.5 : 1 }}
          >
            Сохранить
          </button>
        </div>

```

- [ ] **Step 8: Запустить typecheck и lint**

```bash
npm run typecheck && npm run lint
```
Ожидаемый результат: 0 ошибок.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Admin.tsx
git commit -m "feat(admin): suspend user, +7d grace period, CSV export, lifetime slots UI"
```

---

### Task 5: Admin.tsx — вкладка «Платежи»

**Files:**
- Modify: `src/pages/Admin.tsx`

- [ ] **Step 1: Расширить тип Tab**

Найти:
```typescript
type Tab = 'users' | 'analytics' | 'audit';
```
Заменить на:
```typescript
type Tab = 'users' | 'analytics' | 'audit' | 'payments';
```

- [ ] **Step 2: Обновить рендер вкладок**

Найти:
```tsx
          {(['users', 'analytics', 'audit'] as Tab[]).map((t) => (
```
Заменить на:
```tsx
          {(['users', 'analytics', 'audit', 'payments'] as Tab[]).map((t) => (
```

И найти:
```tsx
              {t === 'users' ? 'Пользователи' : t === 'analytics' ? 'Аналитика' : 'Аудит'}
```
Заменить на:
```tsx
              {t === 'users' ? 'Пользователи' : t === 'analytics' ? 'Аналитика' : t === 'audit' ? 'Аудит' : 'Платежи'}
```

- [ ] **Step 3: Загружать audit log при переключении на 'payments'**

Найти:
```typescript
    if (next === 'audit') loadAuditLog();
```
Заменить на:
```typescript
    if (next === 'audit' || next === 'payments') loadAuditLog();
```

- [ ] **Step 4: Обновить рендер payload в Audit-таблице и добавить блок Payments**

Найти строку рендера payload в таблице аудита:
```tsx
                            ? `${entry.payload.old_plan ?? '?'} → ${entry.payload.new_plan ?? '?'}`
```
Заменить на:
```tsx
                            ? entry.action === 'payment_received'
                              ? `${entry.payload.plan} — ${entry.payload.amount} ${entry.payload.currency}`
                              : entry.action === 'set_lifetime_slots'
                              ? `${entry.payload.old_value} → ${entry.payload.new_value} слотов`
                              : `${entry.payload.old_plan ?? entry.payload.email ?? '?'} → ${entry.payload.new_plan ?? entry.payload.days ?? '?'}`
```

- [ ] **Step 5: Добавить рендер вкладки Платежи**

Найти строку `{tab === 'audit' && (` и после закрывающего `)}` этого блока вставить:

```tsx
        {tab === 'payments' && (
          <>
            <SectionTitle>История платежей</SectionTitle>
            {auditLoading ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
            ) : (() => {
              const payments = (auditLog ?? []).filter((e) => e.action === 'payment_received');
              return payments.length === 0 ? (
                <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '24px 0' }}>
                  Платежей пока нет
                </div>
              ) : (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <th style={thStyle()}>Дата</th>
                        <th style={thStyle()}>Пользователь</th>
                        <th style={thStyle()}>План</th>
                        <th style={thStyle()}>Сумма</th>
                        <th style={thStyle()}>Payment ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((entry, i) => (
                        <tr key={entry.id} style={{ borderBottom: i < payments.length - 1 ? '1px solid var(--border-soft)' : 'none', background: i % 2 === 0 ? 'transparent' : 'oklch(0.96 0.002 50 / 0.4)' }}>
                          <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{fmtDate(entry.created_at)}</td>
                          <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)', color: 'var(--ink)' }}>{entry.target_email ?? '—'}</td>
                          <td style={{ padding: '10px 16px', font: '500 12px var(--font-mono)', color: PLAN_COLOR[(entry.payload?.plan as Plan) ?? 'free'], letterSpacing: '0.05em', textTransform: 'uppercase' }}>{entry.payload?.plan ?? '—'}</td>
                          <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)' }}>{entry.payload ? `${entry.payload.amount} ${entry.payload.currency}` : '—'}</td>
                          <td style={{ padding: '10px 16px', font: '400 11px var(--font-mono)', color: 'var(--ink-4)' }}>{entry.payload?.payment_id ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </>
        )}
```

- [ ] **Step 6: typecheck + lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/Admin.tsx
git commit -m "feat(admin): payments tab — payment_received history from audit log"
```

---

## Фаза 2 — Важно (первые 50 пользователей)

### Task 6: AdminUserDetail — страница /admin/users/:id

**Files:**
- Create: `src/pages/AdminUserDetail.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Создать AdminUserDetail.tsx**

Создать `src/pages/AdminUserDetail.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { LogoMark } from '../components/LogoMark';
import { useErrorState } from '../lib/useErrorState';

interface BookSummary {
  id: string;
  title: string;
  chapters_count: number;
  words_total: number;
}

interface PlanHistoryEntry {
  action: string;
  payload: Record<string, string> | null;
  created_at: string;
}

interface UserDetail {
  books: BookSummary[];
  plan_history: PlanHistoryEntry[];
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtWords(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс`;
  return String(n);
}

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading } = useAuth();
  const { error, setError } = useErrorState();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Find email from parent — pass via state or re-fetch from audit; for simplicity use userId in heading
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !userId) return;
    supabase.rpc('get_admin_user_detail', { target_user_id: userId }).then(({ data, error: err }) => {
      if (err?.code === '42501') { setIsAdmin(false); return; }
      setIsAdmin(true);
      if (err) { setError(err.message); return; }
      const d = data as UserDetail;
      setDetail(d);
      // Pull email from plan_history if available
      const emailEntry = d.plan_history?.find((e) => e.payload?.email);
      if (emailEntry?.payload?.email) setUserEmail(emailEntry.payload.email);
    });
  }, [user, userId, setError]);

  const handleResetPassword = async () => {
    if (!userEmail) return;
    setResetting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) setError(err.message);
    else setResetDone(true);
    setResetting(false);
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin === null) return null;
  if (isAdmin === false) return <Navigate to="/books" replace />;

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 12, borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-deep)' }}>
        <Link to="/books" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <LogoMark size={18} />
          <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
        </Link>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)' }}>/</span>
        <Link to="/admin" style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', textDecoration: 'none' }}>admin</Link>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)' }}>/</span>
        <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.08em', color: 'var(--ink-2)' }}>пользователь</span>
      </div>

      <div style={{ padding: '36px 40px', maxWidth: 900 }}>
        {error && (
          <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 8, background: 'oklch(0.65 0.18 25 / 0.10)', color: 'var(--danger)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 32 }}>
          <h1 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', margin: 0 }}>
            {userEmail ?? userId}
          </h1>
          {userEmail && (
            <button
              onClick={handleResetPassword}
              disabled={resetting || resetDone}
              style={{ font: '400 12px var(--font-ui)', color: resetDone ? 'var(--ink-3)' : 'var(--accent)', background: 'none', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '4px 12px', cursor: resetting || resetDone ? 'default' : 'pointer' }}
            >
              {resetDone ? 'Письмо отправлено' : resetting ? '…' : 'Сбросить пароль'}
            </button>
          )}
        </div>

        {detail === null ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
        ) : (
          <>
            <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
              Книги ({detail.books.length})
            </div>
            {detail.books.length === 0 ? (
              <div style={{ color: 'var(--ink-4)', fontSize: 13, marginBottom: 32 }}>Нет книг</div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden', marginBottom: 36 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      {(['Название', 'Глав', 'Слов'] as const).map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', font: '500 11px var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.books.map((b, i) => (
                      <tr key={b.id} style={{ borderBottom: i < detail.books.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)', color: 'var(--ink)' }}>{b.title || '(без названия)'}</td>
                        <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)' }}>{b.chapters_count}</td>
                        <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)' }}>{fmtWords(Number(b.words_total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
              История плана
            </div>
            {detail.plan_history.length === 0 ? (
              <div style={{ color: 'var(--ink-4)', fontSize: 13 }}>Нет записей</div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      {(['Дата', 'Действие', 'Детали'] as const).map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', font: '500 11px var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.plan_history.map((e, i) => (
                      <tr key={i} style={{ borderBottom: i < detail.plan_history.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{fmtDate(e.created_at)}</td>
                        <td style={{ padding: '10px 16px', font: '500 12px var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.05em' }}>{e.action}</td>
                        <td style={{ padding: '10px 16px', font: '400 12px var(--font-mono)', color: 'var(--ink-2)' }}>
                          {e.payload
                            ? e.action === 'extend_plan'
                              ? `+${e.payload.days}д → до ${e.payload.new_expires_at ? fmtDate(e.payload.new_expires_at) : '?'}`
                              : e.payload.old_plan
                              ? `${e.payload.old_plan} → ${e.payload.new_plan}`
                              : JSON.stringify(e.payload)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Добавить маршрут в App.tsx**

В `src/App.tsx` найти импорт Admin (или первый import Admin). Добавить рядом:
```typescript
import AdminUserDetail from './pages/AdminUserDetail';
```

Найти маршрут `/admin` в роутере и добавить после него:
```tsx
<Route path="/admin/users/:userId" element={<AdminUserDetail />} />
```

- [ ] **Step 3: Сделать email кликабельным в таблице пользователей**

В `Admin.tsx` найти:
```tsx
                    <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)', color: 'var(--ink)' }}>{u.email}</td>
```
Заменить на:
```tsx
                    <td style={{ padding: '10px 16px', font: '400 13px var(--font-ui)' }}>
                      <Link to={`/admin/users/${u.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>
                        {u.email}
                      </Link>
                    </td>
```

- [ ] **Step 4: typecheck + lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/AdminUserDetail.tsx src/App.tsx src/pages/Admin.tsx
git commit -m "feat(admin): user detail page /admin/users/:id — books, plan history, reset password"
```

---

## Фаза 3 — Рост (100+ пользователей)

### Task 7: Admin.tsx — вкладки «Финансы» и «Флаги»

**Files:**
- Modify: `src/pages/Admin.tsx`

- [ ] **Step 1: Расширить тип Tab**

Найти:
```typescript
type Tab = 'users' | 'analytics' | 'audit' | 'payments';
```
Заменить на:
```typescript
type Tab = 'users' | 'analytics' | 'audit' | 'payments' | 'finances' | 'flags';
```

- [ ] **Step 2: Добавить интерфейсы AdminRevenue и FeatureFlag**

После объявления `AuditEntry` (после строки 44) добавить:
```typescript
interface AdminRevenue {
  mrr: number;
  arr: number;
  pro_count: number;
  lifetime_count: number;
  churn_count_30d: number;
  churn_rate: number;
}

interface FeatureFlag {
  key: string;
  enabled: boolean;
}
```

- [ ] **Step 3: Добавить state для revenue и flags**

В `Admin()` после `const [slotsSaving, setSlotsSaving] = useState(false);` добавить:
```typescript
  const [revenue, setRevenue] = useState<AdminRevenue | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[] | null>(null);
  const [flagToggling, setFlagToggling] = useState<string | null>(null);
```

- [ ] **Step 4: Добавить загрузку данных в handleTabChange**

Найти:
```typescript
    if (next === 'audit' || next === 'payments') loadAuditLog();
```
Заменить на:
```typescript
    if (next === 'audit' || next === 'payments') loadAuditLog();
    if (next === 'finances' && revenue === null) {
      supabase.rpc('get_admin_revenue').then(({ data, error: e }) => {
        if (e) setErr(e.message);
        else setRevenue(data as AdminRevenue);
      });
    }
    if (next === 'flags' && flags === null) {
      supabase.rpc('get_feature_flags').then(({ data, error: e }) => {
        if (e) setErr(e.message);
        else setFlags(data as FeatureFlag[]);
      });
    }
```

- [ ] **Step 5: Добавить handler handleToggleFlag**

После `handleSaveSlots`:
```typescript
  const handleToggleFlag = async (key: string, enabled: boolean) => {
    setFlagToggling(key);
    clearErr();
    const { error } = await supabase.rpc('set_feature_flag', { p_key: key, p_enabled: enabled });
    if (error) {
      setErr(error.message);
    } else {
      setFlags((prev) => prev?.map((f) => f.key === key ? { ...f, enabled } : f) ?? prev);
    }
    setFlagToggling(null);
  };
```

- [ ] **Step 6: Обновить рендер вкладок**

Найти:
```tsx
          {(['users', 'analytics', 'audit', 'payments'] as Tab[]).map((t) => (
```
Заменить на:
```tsx
          {(['users', 'analytics', 'audit', 'payments', 'finances', 'flags'] as Tab[]).map((t) => (
```

Найти:
```tsx
              {t === 'users' ? 'Пользователи' : t === 'analytics' ? 'Аналитика' : t === 'audit' ? 'Аудит' : 'Платежи'}
```
Заменить на:
```tsx
              {t === 'users' ? 'Пользователи' : t === 'analytics' ? 'Аналитика' : t === 'audit' ? 'Аудит' : t === 'payments' ? 'Платежи' : t === 'finances' ? 'Финансы' : 'Флаги'}
```

- [ ] **Step 7: Добавить рендер вкладки Финансы**

После блока `{tab === 'payments' && ...}` вставить:
```tsx
        {tab === 'finances' && (
          <>
            <SectionTitle>Revenue-метрики</SectionTitle>
            {revenue === null ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 36 }}>
                <StatCard label="MRR" value={`${fmt(revenue.mrr)} ₽`} sub="Pro × 390 ₽/мес" />
                <StatCard label="ARR" value={`${fmt(revenue.arr)} ₽`} />
                <StatCard label="Pro-подписчиков" value={revenue.pro_count} />
                <StatCard label="Lifetime" value={revenue.lifetime_count} />
                <StatCard label="Отток за 30д" value={revenue.churn_count_30d} sub={`${revenue.churn_rate}%`} />
              </div>
            )}
          </>
        )}
```

- [ ] **Step 8: Добавить рендер вкладки Флаги**

После блока `{tab === 'finances' && ...}` вставить:
```tsx
        {tab === 'flags' && (
          <>
            <SectionTitle>Feature Flags</SectionTitle>
            {flags === null ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Загрузка…</div>
            ) : flags.length === 0 ? (
              <div style={{ color: 'var(--ink-4)', fontSize: 13, padding: '24px 0' }}>Нет флагов</div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 10, overflow: 'hidden', marginBottom: 32 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', font: '500 11px var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Ключ</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', font: '500 11px var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flags.map((f, i) => (
                      <tr key={f.key} style={{ borderBottom: i < flags.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        <td style={{ padding: '10px 16px', font: '500 13px var(--font-mono)', color: 'var(--ink)' }}>{f.key}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <button
                            onClick={() => handleToggleFlag(f.key, !f.enabled)}
                            disabled={flagToggling === f.key}
                            style={{
                              font: '500 11px var(--font-mono)',
                              letterSpacing: '0.08em',
                              color: f.enabled ? 'oklch(0.55 0.18 155)' : 'var(--ink-4)',
                              background: f.enabled ? 'oklch(0.55 0.18 155 / 0.10)' : 'var(--surface-2)',
                              border: `1px solid ${f.enabled ? 'oklch(0.55 0.18 155 / 0.4)' : 'var(--border-soft)'}`,
                              borderRadius: 4,
                              padding: '3px 10px',
                              cursor: flagToggling === f.key ? 'wait' : 'pointer',
                              opacity: flagToggling === f.key ? 0.5 : 1,
                            }}
                          >
                            {f.enabled ? 'ON' : 'OFF'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
```

- [ ] **Step 9: typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Ожидаемый результат: 0 ошибок.

- [ ] **Step 10: Commit**

```bash
git add src/pages/Admin.tsx
git commit -m "feat(admin): finances tab (MRR/churn) + feature flags tab"
```

---

## Self-Review

### Покрытие спецификации

| Требование из спека | Task |
|---|---|
| Вкладка «Платежи» — audit_log filter | Task 5 |
| INSERT в yukassa-webhook action='payment_received' | Task 1 |
| Кнопка «Suspend» + RPC suspend_user | Task 2 + Task 4 |
| Экспорт CSV | Task 4 |
| Карточка пользователя /admin/users/:id | Task 6 |
| Список книг в карточке | Task 6 (get_admin_user_detail) |
| История смены плана в карточке | Task 6 (get_admin_user_detail) |
| Кнопка «Сбросить пароль» | Task 6 (resetPasswordForEmail) |
| Lifetime-слоты ручная правка | Task 2 (set_lifetime_slots) + Task 4 |
| Grace period +7 дней Pro | Task 2 (extend_plan) + Task 4 |
| Revenue MRR/churn вкладка «Финансы» | Task 3 (get_admin_revenue) + Task 7 |
| Feature flags таблица + UI вкладка «Флаги» | Task 3 + Task 7 |

Все требования покрыты.

### Type consistency
- `AdminUser.suspended: boolean` добавляется в Task 4 Step 1 и возвращается RPC из Task 2.
- `AdminRevenue` / `FeatureFlag` используются только в Task 7.
- `logPayment` принимает `ReturnType<typeof createClient>` — тип совпадает с переменной `db` в webhook.
- `target_user_id` в RPC везде `uuid` → TypeScript передаёт `string` (Supabase принимает string UUID).

---

**План сохранён в `docs/superpowers/plans/2026-06-03-admin-extensions.md`.**

**Два варианта исполнения:**

**1. Subagent-Driven (рекомендуется)** — свежий субагент на каждый task, ревью между тасками, быстрая итерация → `/subagent-driven-development`

**2. Inline Execution** — выполнение в этой сессии с чекпоинтами → `/executing-plans`

**Какой подход?**
