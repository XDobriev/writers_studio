// Общие куски интеграции с Робокассой (create-payment-url, billing-scheduler,
// robokassa-webhook, process-refund). Рабочие формулы — docs/features/payments.md.
import { md5hex } from './crypto.ts';
import { isDeliverableEmail } from './email.ts';

/**
 * Receipt по ФЗ-54 для РобоЧеков СМЗ: без НДС (самозанятый), email — для чека покупателю.
 * Недоставляемый адрес (*.local Telegram/VK) не передаётся: страница оплаты сама спросит
 * email, а чек дочернего списания без email уйдёт на адрес материнской оплаты
 * (поддержка Робокассы, 25.10.2026).
 */
export function buildReceipt(description: string, sum: string, email?: string | null): {
  json: string;
  encoded: string;
} {
  const receipt: Record<string, unknown> = {
    items: [{
      name: description,
      quantity: 1,
      sum: parseFloat(sum),
      payment_method: 'full_payment',
      payment_object: 'service',
      tax: 'none',
    }],
  };
  if (isDeliverableEmail(email)) receipt['email'] = email;
  const json = JSON.stringify(receipt);
  return { json, encoded: encodeURIComponent(json) };
}

/**
 * Состояние операции через OpStateExt. code — State/Code Робокассы:
 * 5 инициирована, 10 отменена, 50 деньги получены (в обработке), 60 возвращена,
 * 80 приостановлена, 100 оплачена. resultCode != 0 (Result/Code) — операции нет/ошибка.
 */
export async function fetchOpState(
  login: string,
  invId: string,
  password2: string,
  attempts = 1,
): Promise<{ resultCode: number | null; stateCode: number | null; opKey: string | null } | null> {
  const sig = md5hex(`${login}:${invId}:${password2}`);
  const url =
    `https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt` +
    `?MerchantLogin=${encodeURIComponent(login)}&InvoiceID=${encodeURIComponent(invId)}&Signature=${sig}`;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const xml = await res.text();
      const result = xml.match(/<Result>\s*<Code>(\d+)<\/Code>/);
      const state = xml.match(/<State>\s*<Code>(\d+)<\/Code>/);
      const op = xml.match(/<OpKey>([^<]+)<\/OpKey>/);
      const parsed = {
        resultCode: result ? Number(result[1]) : null,
        stateCode: state ? Number(state[1]) : null,
        opKey: op ? op[1] : null,
      };
      if (parsed.opKey || attempt === attempts - 1) return parsed;
    } catch (e) {
      console.warn('[robokassa] OpStateExt fetch error:', e instanceof Error ? e.message : String(e));
    }
  }
  return null;
}

/** OpKey операции (нужен для возврата). Есть только у оплаты банковской картой. */
export async function fetchOpKey(login: string, invId: string, password2: string, attempts = 3): Promise<string | null> {
  const state = await fetchOpState(login, invId, password2, attempts);
  return state?.opKey ?? null;
}

export type RefundCreateResult =
  | { kind: 'created'; requestId: string }
  | { kind: 'already_created' }
  | { kind: 'insufficient_balance' }
  | { kind: 'rejected'; message: string };

/**
 * Разбор ответа Refund/Create (поддержка Робокассы, 23–24.10.2026):
 *   * `NotEnoughOperationFunds` — повтор по уже возвращённому OpKey, возврат уже создан;
 *     при нехватке баланса этот ответ не приходит;
 *   * `Refund error 8401` — на балансе магазина нет всей суммы возврата. Возврат не создан.
 *     В каком поле приходит код, поддержка не уточнила — ищем и в `message`, и в сыром теле.
 * Тексты ошибок API возвратов Робокасса называет неинформативными и обещает менять:
 * всё нераспознанное — общий `rejected`.
 */
export function classifyRefundCreate(
  data: { success?: boolean; message?: string | null; requestId?: string | null },
  raw = '',
): RefundCreateResult {
  if (data.success && data.requestId) return { kind: 'created', requestId: data.requestId };
  if (data.message === 'NotEnoughOperationFunds') return { kind: 'already_created' };
  if (/\b8401\b/.test(`${data.message ?? ''} ${raw}`)) return { kind: 'insufficient_balance' };
  return { kind: 'rejected', message: data.message ?? 'unknown' };
}

/** Числовой InvId: Date.now() + 3 цифры (Робокасса требует целое). */
export function newInvId(suffix?: number): string {
  const tail = suffix ?? Math.floor(Math.random() * 1000);
  return String(Date.now()) + String(tail).padStart(3, '0');
}
