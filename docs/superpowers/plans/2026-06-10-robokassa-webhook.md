# robokassa-webhook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать Edge Function `robokassa-webhook`, принимающую POST от Robokassa, проверяющую MD5-подпись и активирующую план пользователя; удалить неиспользуемую `yukassa-webhook`.

**Architecture:** Edge Function читает form-urlencoded тело, считает MD5-подпись по протоколу Robokassa (Password2 + shp-параметры по алфавиту), обновляет `profiles.plan`, логирует в `admin_audit_log`, вызывает `payment-confirmation` fire-and-forget, возвращает `OK{InvId}`.

**Tech Stack:** Deno (Supabase Edge Functions), `@supabase/supabase-js@2.45.0`, `https://deno.land/std@0.168.0/crypto/mod.ts` (MD5).

---

### Task 1: Создать `robokassa-webhook/index.ts`

**Files:**
- Create: `supabase/functions/robokassa-webhook/index.ts`

- [ ] **Шаг 1.1: Создать файл с полной реализацией**

```typescript
// supabase/functions/robokassa-webhook/index.ts
//
// Robokassa Result URL webhook.
// Принимает POST application/x-www-form-urlencoded.
// Проверяет подпись: MD5(OutSum:InvId:Password2:Shp_plan=…:Shp_user_id=…)
// Обязательный ответ при успехе: строка OK{InvId} (иначе Robokassa повторяет запрос).
//
// Обязательные Supabase Secrets:
//   ROBOKASSA_MERCHANT_LOGIN — идентификатор магазина (для логирования)
//   ROBOKASSA_PASSWORD2      — пароль #2 для проверки подписи вебхука
// Опциональные:
//   GRANDFATHERING_ENDS_AT   — ISO-дата окончания грандфазеринга (напр. '2026-09-01')
// Автоматические (Supabase предоставляет):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { crypto as stdCrypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function text(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { ...CORS, 'Content-Type': 'text/plain' },
  });
}

async function md5hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await stdCrypto.subtle.digest('MD5', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Строит строку подписи для Result URL:
// OutSum:InvId:Password2:Shp_param1=val1:Shp_param2=val2 (shp — по алфавиту)
function buildSignatureString(
  outSum: string,
  invId: string,
  password2: string,
  shpParams: Record<string, string>,
): string {
  const shpParts = Object.entries(shpParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return [outSum, invId, password2, ...shpParts].join(':');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return text(405, 'method not allowed');

  const password2 = Deno.env.get('ROBOKASSA_PASSWORD2');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!password2 || !supabaseUrl || !serviceKey) {
    console.error('[robokassa-webhook] missing env');
    // Возвращаем 200 чтобы Robokassa не retryила — это наша ошибка конфигурации
    return text(200, 'ERROR: env not configured');
  }

  // Читаем form-urlencoded тело
  let params: URLSearchParams;
  try {
    const bodyText = await req.text();
    params = new URLSearchParams(bodyText);
  } catch {
    return text(200, 'ERROR: cannot read body');
  }

  const outSum = params.get('OutSum') ?? '';
  const invId = params.get('InvId') ?? '';
  const signatureValue = params.get('SignatureValue') ?? '';
  const shpPlan = params.get('Shp_plan') ?? '';
  const shpUserId = params.get('Shp_user_id') ?? '';

  if (!outSum || !invId || !signatureValue || !shpPlan || !shpUserId) {
    console.error('[robokassa-webhook] missing params', { outSum, invId, shpPlan, shpUserId });
    return text(200, 'ERROR: missing params');
  }

  // Проверяем подпись
  const sigString = buildSignatureString(outSum, invId, password2, {
    Shp_plan: shpPlan,
    Shp_user_id: shpUserId,
  });
  const expectedSig = await md5hex(sigString);
  if (expectedSig.toLowerCase() !== signatureValue.toLowerCase()) {
    console.error('[robokassa-webhook] bad signature', { expected: expectedSig, got: signatureValue });
    return text(200, 'BAD SIGN');
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Получаем email пользователя для письма-подтверждения
  let userEmail: string | null = null;
  try {
    const { data } = await db.auth.admin.getUserById(shpUserId);
    userEmail = data.user?.email ?? null;
  } catch (e) {
    console.warn('[robokassa-webhook] could not fetch user email:', e);
  }

  if (shpPlan === 'lifetime') {
    // Атомарно декрементируем счётчик lifetime-слотов
    const { data: slotOk, error: slotErr } = await db.rpc('decrement_lifetime_slot');
    if (slotErr) {
      console.error('[robokassa-webhook] slot decrement failed:', slotErr.message);
      return text(500, 'ERROR: slot decrement failed');
    }
    if (!slotOk) {
      console.error('[robokassa-webhook] no lifetime slots remaining for user:', shpUserId);
      // Продолжаем: не блокируем пользователя, он уже заплатил
    }

    const { error } = await db
      .from('profiles')
      .update({ plan: 'lifetime', plan_expires_at: null })
      .eq('user_id', shpUserId);
    if (error) {
      console.error('[robokassa-webhook] profiles update failed:', error.message);
      return text(500, 'ERROR: profiles update failed');
    }

  } else if (shpPlan === 'pro' || shpPlan === 'pro_annual') {
    const daysToAdd = shpPlan === 'pro_annual' ? 365 : 31;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    const grandfatheringEndsAt = Deno.env.get('GRANDFATHERING_ENDS_AT');
    const isGrandfathering = grandfatheringEndsAt
      ? new Date() < new Date(grandfatheringEndsAt)
      : false;

    const updateData: Record<string, unknown> = {
      plan: 'pro',
      plan_expires_at: expiresAt.toISOString(),
    };
    if (isGrandfathering) updateData.grandfathered = true;

    const { error } = await db
      .from('profiles')
      .update(updateData)
      .eq('user_id', shpUserId);
    if (error) {
      console.error('[robokassa-webhook] profiles update failed:', error.message);
      return text(500, 'ERROR: profiles update failed');
    }

  } else {
    console.error('[robokassa-webhook] unknown plan:', shpPlan);
    return text(200, `ERROR: unknown plan ${shpPlan}`);
  }

  // Логируем платёж в admin_audit_log
  await db.from('admin_audit_log').insert({
    admin_id: '00000000-0000-0000-0000-000000000000',
    admin_email: 'system',
    action: 'payment_received',
    target_user_id: shpUserId,
    payload: {
      amount: outSum,
      plan: shpPlan,
      inv_id: invId,
      provider: 'robokassa',
    },
  });

  // fire-and-forget: отправляем email-подтверждение
  if (userEmail) {
    const confirmationUrl = `${supabaseUrl}/functions/v1/payment-confirmation`;
    fetch(confirmationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        user_email: userEmail,
        transaction_id: invId,
        amount: outSum,
        plan: shpPlan === 'pro_annual' ? 'pro_yearly' : shpPlan === 'pro' ? 'pro_monthly' : 'lifetime',
        ...(shpPlan !== 'lifetime' && {
          plan_expires_at: (() => {
            const d = new Date();
            d.setDate(d.getDate() + (shpPlan === 'pro_annual' ? 365 : 31));
            return d.toISOString();
          })(),
        }),
      }),
    }).catch((e) => console.warn('[robokassa-webhook] payment-confirmation error:', e));
  }

  // Обязательный ответ Robokassa — строка OK{InvId}
  return text(200, `OK${invId}`);
});
```

- [ ] **Шаг 1.2: Убедиться, что файл создан**

```bash
ls "supabase/functions/robokassa-webhook/"
```

Ожидаем: `index.ts`

---

### Task 2: Удалить `yukassa-webhook`

**Files:**
- Delete: `supabase/functions/yukassa-webhook/index.ts` (и папку)

- [ ] **Шаг 2.1: Удалить папку**

```bash
rm -rf "supabase/functions/yukassa-webhook"
```

- [ ] **Шаг 2.2: Проверить**

```bash
ls "supabase/functions/"
```

Ожидаем: `payment-confirmation/`, `robokassa-webhook/`, `telegram-auth/` — без `yukassa-webhook/`.

---

### Task 3: Убрать упоминания ЮKassa

**Files:**
- Modify: `supabase/migrations/0026_profiles_grandfathered.sql`
- Modify: `CLAUDE.md`

- [ ] **Шаг 3.1: Поправить комментарий в миграции**

В файле `supabase/migrations/0026_profiles_grandfathered.sql` строка 2:

Было:
```sql
-- Поле выставляется Edge Function yukassa-webhook при оплате в период фазы 1
```

Стало:
```sql
-- Поле выставляется Edge Function robokassa-webhook при оплате в период фазы 1
```

- [ ] **Шаг 3.2: Убрать упоминания ЮKassa из CLAUDE.md**

Найти в `CLAUDE.md` строку со ссылкой на `yukassa-webhook` в разделе `supabase/functions/`:
```
- `supabase/functions/yukassa-webhook/` — вебхук ЮKassa: ...
```
Удалить строку целиком (или заменить на актуальную для robokassa-webhook если есть).

Также найти упоминания `YUKASSA_SHOP_ID`, `YUKASSA_SECRET_KEY` — удалить.

- [ ] **Шаг 3.3: Grep-проверка**

```bash
grep -r "yukassa\|юкасс\|YUKASSA" --include="*.ts" --include="*.sql" --include="*.md" . \
  --exclude-dir=".git" --exclude-dir="node_modules"
```

Ожидаем: только `docs/superpowers/plans/` или `specs/` — никакого активного кода.

---

### Task 4: Задеплоить функции и финальная проверка

- [ ] **Шаг 4.1: Задеплоить `robokassa-webhook` через Supabase MCP**

Использовать MCP `mcp__supabase__deploy_edge_function` с:
- `function_name: "robokassa-webhook"`
- `entrypoint_path: "supabase/functions/robokassa-webhook/index.ts"`

- [ ] **Шаг 4.2: Задеплоить `payment-confirmation` (обновление)**

Аналогично через MCP:
- `function_name: "payment-confirmation"`
- `entrypoint_path: "supabase/functions/payment-confirmation/index.ts"`

- [ ] **Шаг 4.3: Проверить деплой через MCP**

```
mcp__supabase__list_edge_functions
```

Ожидаем в списке: `robokassa-webhook`, `payment-confirmation`, `telegram-auth`.
Не ожидаем: `yukassa-webhook`.

- [ ] **Шаг 4.4: Проверить подпись вручную (smoke test)**

Вычислить ожидаемую подпись для тестового запроса:
```
OutSum=1.00
InvId=1
Password2=<ваш_пароль2>
Shp_plan=pro
Shp_user_id=test-uuid
```
Строка: `1.00:1:<password2>:Shp_plan=pro:Shp_user_id=test-uuid`
MD5 онлайн: md5.cz или аналог.

Послать curl:
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/robokassa-webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "OutSum=1.00&InvId=1&SignatureValue=<md5>&Shp_plan=pro&Shp_user_id=test-uuid"
```

Ожидаем: `OK1` (строка, не JSON).

С неверной подписью: `BAD SIGN`.

- [ ] **Шаг 4.5: typecheck**

```bash
npm run typecheck
```

Ожидаем: 0 ошибок. (Edge Functions — Deno, typecheck проверяет только `src/`.)

- [ ] **Шаг 4.6: Коммит**

```bash
git add supabase/functions/robokassa-webhook/index.ts \
        supabase/migrations/0026_profiles_grandfathered.sql \
        CLAUDE.md \
        docs/superpowers/specs/2026-06-10-robokassa-webhook-design.md \
        docs/superpowers/plans/2026-06-10-robokassa-webhook.md
git commit -m "feat(payments): robokassa-webhook, удалить yukassa-webhook"
```

---

## Напоминание: Secrets

После деплоя вручную установить в Supabase Dashboard → Edge Functions → Manage secrets:

| Secret | Значение |
|--------|---------|
| `ROBOKASSA_MERCHANT_LOGIN` | `AvtorStudio` |
| `ROBOKASSA_PASSWORD2` | Пароль #2 из ЛК Robokassa |
| `GRANDFATHERING_ENDS_AT` | `2026-09-01` (или другая дата) |
| `UNISENDER_API_KEY` | Ключ UniSender Go |
| `EMAIL_FROM` | `Авторская студия <noreply@avtorstudio.com>` |
