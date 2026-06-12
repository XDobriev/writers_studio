# Robokassa Payment Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать полный платёжный флоу: SettingsModal → Robokassa → webhook → `profiles.plan` → `/payment-success`.

**Architecture:** Edge Function `create-payment-url` генерирует подписанную ссылку с JWT-верификацией; существующий `robokassa-webhook` получает небольшой патч для IsTest; страница `/payment-success` поллит профиль каждые 2с до подтверждения.

**Tech Stack:** Supabase Edge Functions (Deno), React + React Query v5, TypeScript strict, `ts-md5` для MD5 (уже используется в webhook).

---

## File Map

| Action | File | Ответственность |
|--------|------|----------------|
| CREATE | `supabase/functions/create-payment-url/index.ts` | JWT-верификация, генерация подписанного URL Robokassa |
| MODIFY | `supabase/functions/robokassa-webhook/index.ts` | Добавить ветку IsTest=1 → ROBOKASSA_TEST_PASSWORD2 |
| CREATE | `src/pages/PaymentSuccess.tsx` | Polling + 3 состояния (checking / success / timeout) |
| MODIFY | `src/App.tsx` | Lazy import + маршрут `/payment-success` |
| MODIFY | `src/components/SettingsModal.tsx` | Кнопки «Оформить» вызывают `create-payment-url` |

---

## Task 1: Edge Function `create-payment-url`

**Files:**
- Create: `supabase/functions/create-payment-url/index.ts`

- [ ] **Step 1: Создать файл Edge Function**

```typescript
// supabase/functions/create-payment-url/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Md5 } from 'https://esm.sh/ts-md5@1.3.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PRICES: Record<string, string> = {
  pro: '290.00',
  lifetime: '4990.00',
};

const DESCRIPTIONS: Record<string, string> = {
  pro: 'Подписка Pro — Авторская студия',
  lifetime: 'Lifetime — Авторская студия',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function md5hex(input: string): string {
  return new Md5().update(input).toString('hex');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const merchantLogin = Deno.env.get('ROBOKASSA_MERCHANT_LOGIN');
  const supabaseUrl   = Deno.env.get('SUPABASE_URL');
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const isTestMode    = Deno.env.get('ROBOKASSA_IS_TEST') === 'true';
  const password1     = isTestMode
    ? Deno.env.get('ROBOKASSA_TEST_PASSWORD1')
    : Deno.env.get('ROBOKASSA_PASSWORD1');

  if (!merchantLogin || !supabaseUrl || !serviceKey || !password1) {
    console.error('[create-payment-url] missing env');
    return json(500, { error: 'server misconfigured' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { error: 'missing auth' });
  }
  const token = authHeader.slice(7);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) {
    return json(401, { error: 'invalid token' });
  }

  let plan: string;
  try {
    const body = await req.json();
    plan = body?.plan;
  } catch {
    return json(400, { error: 'invalid body' });
  }

  if (!PRICES[plan]) {
    return json(400, { error: `unknown plan: ${plan}` });
  }

  const outSum    = PRICES[plan];
  const invId     = String(Math.floor(Date.now() / 1000) % 2_147_483_647);
  const shpPlan   = plan;
  const shpUserId = user.id;

  // Shp-параметры сортируются алфавитно: Shp_plan < Shp_user_id
  const sigString = `${merchantLogin}:${outSum}:${invId}:${password1}:Shp_plan=${shpPlan}:Shp_user_id=${shpUserId}`;
  const signature = md5hex(sigString);

  const params = new URLSearchParams({
    MerchantLogin:  merchantLogin,
    OutSum:         outSum,
    InvId:          invId,
    Description:    DESCRIPTIONS[plan],
    SignatureValue: signature,
    IsTest:         isTestMode ? '1' : '0',
    Shp_plan:       shpPlan,
    Shp_user_id:    shpUserId,
  });

  const url = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`;
  console.log(`[create-payment-url] plan=${plan} invId=${invId} userId=${user.id} isTest=${isTestMode}`);
  return json(200, { url });
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/create-payment-url/index.ts
git commit -m "feat(payments): create-payment-url Edge Function"
```

---

## Task 2: Патч `robokassa-webhook` — поддержка IsTest

**Files:**
- Modify: `supabase/functions/robokassa-webhook/index.ts:62-68`

- [ ] **Step 1: Добавить чтение тестового пароля и ветку IsTest**

Найди строку (≈62):
```typescript
  const password2 = Deno.env.get('ROBOKASSA_PASSWORD2');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!password2 || !supabaseUrl || !serviceKey) {
    console.error('[robokassa-webhook] missing env');
    return text(200, 'ERROR: env not configured');
  }
```

Замени на:
```typescript
  const password2     = Deno.env.get('ROBOKASSA_PASSWORD2');
  const testPassword2 = Deno.env.get('ROBOKASSA_TEST_PASSWORD2');
  const supabaseUrl   = Deno.env.get('SUPABASE_URL');
  const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    console.error('[robokassa-webhook] missing env');
    return text(200, 'ERROR: env not configured');
  }
```

Затем найди строку после `const shpUserId = params.get('Shp_user_id') ?? '';` (≈87) — там заканчивается парсинг параметров. Сразу после `const signatureValue = params.get('SignatureValue') ?? '';` добавь:

```typescript
  const isTest = params.get('IsTest') === '1';
  const activePassword2 = isTest ? testPassword2 : password2;
  if (!activePassword2) {
    console.error('[robokassa-webhook] missing password2 for isTest=' + isTest);
    return text(200, 'ERROR: env not configured');
  }
```

И замени в вызове `buildSignatureString` (≈90) `password2` на `activePassword2`:
```typescript
  const sigString = buildSignatureString(outSum, invId, activePassword2, {
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/robokassa-webhook/index.ts
git commit -m "fix(payments): robokassa-webhook — support IsTest=1 with test password"
```

---

## Task 3: Страница `/payment-success`

**Files:**
- Create: `src/pages/PaymentSuccess.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
// src/pages/PaymentSuccess.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { getProfile } from '../lib/profiles';
import { QUERY_KEYS } from '../lib/queries';

type ViewState = 'checking' | 'success' | 'timeout';

export default function PaymentSuccess() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan') ?? 'pro';

  const [polling, setPolling]   = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  const { data: profile } = useQuery({
    queryKey: user?.id ? QUERY_KEYS.profile(user.id) : ['profile', null],
    queryFn:  () => getProfile(user!.id),
    enabled:  !!user?.id,
    staleTime: 0,
    refetchInterval: polling ? 2000 : false,
  });

  useEffect(() => {
    if (profile?.plan && profile.plan !== 'free') {
      setPolling(false);
    }
  }, [profile?.plan]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
      setPolling(false);
    }, 30_000);
    return () => clearTimeout(timer);
  }, []);

  const state: ViewState =
    profile?.plan && profile.plan !== 'free' ? 'success'
    : timedOut ? 'timeout'
    : 'checking';

  const planLabel = planParam === 'lifetime' ? 'Lifetime' : 'Pro';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}>
        {state === 'checking' && (
          <>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--accent)',
              animation: 'spin 0.9s linear infinite',
            }} />
            <p style={{ font: '500 15px var(--font-ui)', color: 'var(--ink-2)', margin: 0 }}>
              Активируем подписку {planLabel}…
            </p>
            <p style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)', margin: 0 }}>
              Это займёт несколько секунд
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--ok-soft, color-mix(in oklch, var(--ok) 12%, var(--bg)))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28,
            }}>
              ✓
            </div>
            <h1 style={{ font: '600 20px var(--font-ui)', color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>
              Добро пожаловать в {planLabel}!
            </h1>
            <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', margin: 0 }}>
              Все функции уже доступны
            </p>
            <button
              className="btn btn--primary"
              style={{ height: 40, paddingInline: 28, fontSize: 14 }}
              onClick={() => navigate('/books')}
            >
              Начать писать
            </button>
          </>
        )}

        {state === 'timeout' && (
          <>
            <div style={{ fontSize: 40 }}>🕐</div>
            <h1 style={{ font: '600 17px var(--font-ui)', color: 'var(--ink)', margin: 0 }}>
              Платёж получен
            </h1>
            <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', margin: 0, maxWidth: 300 }}>
              Статус подписки обновится в течение нескольких минут. Если через 5 минут ничего не изменилось — напишите в поддержку.
            </p>
            <button
              className="btn btn--ghost"
              style={{ height: 38, paddingInline: 20, fontSize: 13 }}
              onClick={() => navigate('/books')}
            >
              Перейти в редактор
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/PaymentSuccess.tsx
git commit -m "feat(payments): PaymentSuccess page with polling"
```

---

## Task 4: Маршрут `/payment-success` в `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Добавить lazy import**

После строки `const NotFound = lazy(() => import('./pages/NotFound'));` добавь:

```typescript
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
```

- [ ] **Step 2: Добавить маршрут**

В `AnimatedRoutes`, после маршрута `/offer`, перед `path="*"`, добавь:

```tsx
<Route path="/payment-success" element={<PageMotion><Guard><PaymentSuccess /></Guard></PageMotion>} />
```

- [ ] **Step 3: Проверить typecheck и lint**

```bash
npm run typecheck
npm run lint
```

Ожидаемый результат: 0 ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(payments): register /payment-success route"
```

---

## Task 5: `SettingsModal` — подключить реальную оплату

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] **Step 1: Добавить состояние загрузки и handler в `UpgradeModal`**

В компонент `UpgradeModal` (строка 30), после строки `const [lifetimeSlots, setLifetimeSlots] = useState<number | null>(null);` добавь:

```typescript
  const [isLoading, setIsLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  async function handlePurchase(plan: 'pro' | 'lifetime') {
    setIsLoading(true);
    setPurchaseError(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-url', {
        body: { plan },
      });
      if (error || !data?.url) throw error ?? new Error('Не удалось получить ссылку на оплату');
      window.location.href = data.url;
    } catch (e) {
      setPurchaseError(e instanceof Error ? e.message : 'Ошибка оплаты');
      setIsLoading(false);
    }
  }
```

- [ ] **Step 2: Заменить кнопку «Оформить подписку»**

Найди (≈строки 106-117):
```tsx
            <a
              href="https://avtorskaya-studiya.vercel.app/#pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--primary"
              style={{
                textDecoration: 'none', justifyContent: 'center', fontSize: 13,
                height: 38, display: 'flex', alignItems: 'center',
              }}
            >
              Оформить подписку
            </a>
```

Замени на:
```tsx
            <button
              className="btn btn--primary"
              style={{ justifyContent: 'center', fontSize: 13, height: 38 }}
              onClick={() => handlePurchase('pro')}
              disabled={isLoading}
            >
              {isLoading ? 'Переход к оплате…' : 'Оформить подписку'}
            </button>
```

- [ ] **Step 3: Заменить кнопку «Купить Lifetime»**

Найди (≈строки 143-154):
```tsx
              <a
                href="https://avtorskaya-studiya.vercel.app/#pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{
                  textDecoration: 'none', justifyContent: 'center', fontSize: 13,
                  height: 36, display: 'flex', alignItems: 'center', width: '100%',
                }}
              >
                Купить Lifetime
              </a>
```

Замени на:
```tsx
              <button
                className="btn"
                style={{ justifyContent: 'center', fontSize: 13, height: 36, width: '100%' }}
                onClick={() => handlePurchase('lifetime')}
                disabled={isLoading}
              >
                {isLoading ? 'Переход к оплате…' : 'Купить Lifetime'}
              </button>
```

- [ ] **Step 4: Добавить показ ошибки**

После закрывающего тега кнопки «Позже» (строка ≈119) добавь:

```tsx
            {purchaseError && (
              <p style={{ font: '400 12px var(--font-ui)', color: 'var(--danger)', margin: '4px 0 0', textAlign: 'center' }}>
                {purchaseError}
              </p>
            )}
```

- [ ] **Step 5: Проверить typecheck и lint**

```bash
npm run typecheck
npm run lint
```

Ожидаемый результат: 0 ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat(payments): wire SettingsModal buttons to create-payment-url"
```

---

## Task 6: Задеплоить Edge Functions через Supabase MCP

- [ ] **Step 1: Задеплоить `create-payment-url`**

Использовать MCP-инструмент `mcp__supabase__deploy_edge_function`:
- `name`: `create-payment-url`
- `files`: содержимое `supabase/functions/create-payment-url/index.ts`

- [ ] **Step 2: Задеплоить обновлённый `robokassa-webhook`**

Использовать `mcp__supabase__deploy_edge_function`:
- `name`: `robokassa-webhook`
- `files`: содержимое `supabase/functions/robokassa-webhook/index.ts`

- [ ] **Step 3: Убедиться, что обе функции видны в списке**

Использовать `mcp__supabase__list_edge_functions` — проверить, что `create-payment-url` и `robokassa-webhook` в статусе ACTIVE.

---

## Task 7: Ручные настройки (делает пользователь)

- [ ] **Step 1: Добавить секреты в Supabase Dashboard**

Перейти: Supabase Dashboard → Project → Edge Functions → Secrets → Add

| Secret | Значение |
|--------|---------|
| `ROBOKASSA_MERCHANT_LOGIN` | `AvtorStudio` |
| `ROBOKASSA_PASSWORD1` | Robokassa ЛК → Технические настройки → Пароль #1 |
| `ROBOKASSA_PASSWORD2` | Robokassa ЛК → Технические настройки → Пароль #2 |
| `ROBOKASSA_TEST_PASSWORD1` | Robokassa ЛК → Тестовые параметры → Пароль #1 |
| `ROBOKASSA_TEST_PASSWORD2` | Robokassa ЛК → Тестовые параметры → Пароль #2 |
| `ROBOKASSA_IS_TEST` | `true` (для первоначального тестирования) |

- [ ] **Step 2: Обновить настройки в Robokassa ЛК**

Технические настройки:
- **Success URL**: изменить на `https://avtorstudio.com/payment-success`
- **Метод Success URL**: переключить с POST на **GET**
- Нажать «Сохранить»

---

## Task 8: End-to-End тест

- [ ] **Step 1: Запустить dev-сервер**

```bash
npm run dev
```

Открыть `http://localhost:5273`, войти в аккаунт.

- [ ] **Step 2: Открыть SettingsModal → вкладка «Подписка» → нажать «Перейти на Pro» → «Оформить подписку»**

Ожидаемое: кнопка показывает «Переход к оплате…», через ~300ms браузер редиректит на страницу Robokassa с `IsTest=1`.

- [ ] **Step 3: Провести тестовый платёж на странице Robokassa**

Выбрать любой способ оплаты, использовать тестовые данные (Robokassa принимает любую карту в тесте, суммы не списываются).

- [ ] **Step 4: Проверить redirect на `/payment-success`**

Ожидаемое: страница показывает спиннер «Активируем подписку Pro…».

- [ ] **Step 5: Убедиться, что webhook сработал**

В Supabase Dashboard → Edge Functions → `robokassa-webhook` → Logs — должна быть запись без ошибок.

В таблице `profiles` → найти свой `user_id` → поле `plan` должно быть `'pro'`.

- [ ] **Step 6: Проверить переключение на `/payment-success`**

Ожидаемое: спиннер сменяется на «Добро пожаловать в Pro!» + кнопка «Начать писать».

- [ ] **Step 7: Кликнуть «Начать писать»**

Ожидаемое: переход на `/books`, SettingsModal → вкладка «Подписка» показывает план «Pro».

- [ ] **Step 8: Переключить в боевой режим (когда всё проверено)**

В Supabase Dashboard → Edge Functions → Secrets:
- Изменить `ROBOKASSA_IS_TEST` на `false` (или удалить секрет)

- [ ] **Step 9: Финальный commit + push**

```bash
git push origin main
```

GitHub Actions задеплоит на VPS и Vercel автоматически.

---

## Чек-лист покрытия спецификации

| Требование спеки | Task |
|-----------------|------|
| Edge Function `create-payment-url` с JWT-верификацией | Task 1 |
| Подпись MD5(MerchantLogin:OutSum:InvId:Password1:Shp_...) | Task 1 |
| IsTest управляется ROBOKASSA_IS_TEST env | Task 1 |
| Webhook патч для IsTest=1 | Task 2 |
| Страница `/payment-success` с 3 состояниями | Task 3 |
| Polling каждые 2с, стоп при plan !== 'free' | Task 3 |
| Таймаут 30с | Task 3 |
| Маршрут под AuthGuard | Task 4 |
| Кнопки SettingsModal → реальный платёж | Task 5 |
| Деплой функций | Task 6 |
| Secrets + Robokassa Success URL (GET) | Task 7 |
| E2E тест в тестовом режиме | Task 8 |
