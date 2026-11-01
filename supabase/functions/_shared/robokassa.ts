// Общие куски интеграции с Робокассой (create-payment-url, billing-scheduler,
// robokassa-webhook, process-refund). Рабочие формулы — docs/features/payments.md.
import { md5hex, sha256hex, timingSafeEqual } from './crypto.ts';
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
      sum: parseAmount(sum),
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
 * Парсинг суммы оплаты: поддерживает точку и запятую ("299.50", "299,50").
 * Возвращает число с плавающей точкой или NaN при невалидном вводе.
 */
export function parseAmount(sum: string | number): number {
  if (typeof sum === 'number') return Number.isFinite(sum) ? sum : NaN;
  if (!sum || typeof sum !== 'string') return NaN;
  const cleaned = sum.trim().replace(',', '.');
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? val : NaN;
}

export type ShpParamsSource =
  | URLSearchParams
  | Record<string, string | undefined | null>
  | [string, string][]
  | Map<string, string>;

/**
 * Извлечение и сортировка пользовательских параметров Shp_*.
 * В документации Робокассы: параметры Shp_* сортируются строго по алфавиту имен параметров.
 */
export function extractShpParams(source?: ShpParamsSource): Record<string, string> {
  if (!source) return {};

  const entries: [string, string][] = [];

  if (source instanceof URLSearchParams || source instanceof Map) {
    for (const [k, v] of source.entries()) {
      if (/^shp_/i.test(k) && v !== undefined && v !== null) {
        entries.push([k, v]);
      }
    }
  } else if (Array.isArray(source)) {
    for (const [k, v] of source) {
      if (/^shp_/i.test(k) && v !== undefined && v !== null) {
        entries.push([k, v]);
      }
    }
  } else if (typeof source === 'object') {
    for (const [k, v] of Object.entries(source)) {
      if (/^shp_/i.test(k) && v !== undefined && v !== null) {
        entries.push([k, String(v)]);
      }
    }
  }

  // Сортировка по алфавиту ключей (localeCompare для надежности Unicode / ASCII)
  entries.sort(([a], [b]) => a.localeCompare(b));

  const result: Record<string, string> = {};
  for (const [k, v] of entries) {
    result[k] = v;
  }
  return result;
}

export interface SignatureOptions {
  outSum: string | number;
  invId: string | number;
  password: string;
  shp?: ShpParamsSource;
  receiptJson?: string;
  merchantLogin?: string;
}

/**
 * Построение сырой строки подписи Робокассы:
 * - Для оплаты/чекаута: MerchantLogin:OutSum:InvId:[Receipt:]Password1:Shp_param1=val1:...
 * - Для вебхука ResultURL: OutSum:InvId:Password2:Shp_param1=val1:...
 */
export function buildSignatureString(
  outSumOrOpts: string | number | SignatureOptions,
  invId?: string | number,
  password?: string,
  shp?: ShpParamsSource,
  receiptJson?: string,
  merchantLogin?: string,
): string {
  let outSumStr = '';
  let invIdStr = '';
  let pwd = '';
  let shpSource: ShpParamsSource | undefined = shp;
  let receipt: string | undefined = receiptJson;
  let login: string | undefined = merchantLogin;

  if (typeof outSumOrOpts === 'object' && outSumOrOpts !== null) {
    const o = outSumOrOpts as SignatureOptions;
    outSumStr = String(o.outSum);
    invIdStr = String(o.invId);
    pwd = o.password;
    shpSource = o.shp;
    receipt = o.receiptJson;
    login = o.merchantLogin;
  } else {
    outSumStr = String(outSumOrOpts);
    invIdStr = String(invId ?? '');
    pwd = password ?? '';
  }

  const sortedShp = extractShpParams(shpSource);
  const shpParts = Object.entries(sortedShp).map(([k, v]) => `${k}=${v}`);

  const parts: string[] = [];
  if (login) parts.push(login);
  parts.push(outSumStr, invIdStr);
  if (receipt) parts.push(receipt);
  parts.push(pwd);
  parts.push(...shpParts);

  return parts.join(':');
}

/** Расчёт контрольной подписи MD5 в lowercase hex. */
export function calculateSignatureMd5(
  outSumOrOpts: string | number | SignatureOptions,
  invId?: string | number,
  password?: string,
  shp?: ShpParamsSource,
  receiptJson?: string,
  merchantLogin?: string,
): string {
  const str = buildSignatureString(outSumOrOpts, invId, password, shp, receiptJson, merchantLogin);
  return md5hex(str).toLowerCase();
}

/** Расчёт контрольной подписи SHA-256 в lowercase hex. */
export async function calculateSignatureSha256(
  outSumOrOpts: string | number | SignatureOptions,
  invId?: string | number,
  password?: string,
  shp?: ShpParamsSource,
  receiptJson?: string,
  merchantLogin?: string,
): Promise<string> {
  const str = buildSignatureString(outSumOrOpts, invId, password, shp, receiptJson, merchantLogin);
  return (await sha256hex(str)).toLowerCase();
}

/** Расчёт контрольной подписи по выбранному алгоритму (по умолчанию MD5). */
export function calculateSignature(
  opts: SignatureOptions,
  algorithm: 'MD5' | 'SHA256' = 'MD5',
): string | Promise<string> {
  if (algorithm === 'SHA256') {
    return calculateSignatureSha256(opts);
  }
  return calculateSignatureMd5(opts);
}

/**
 * Сравнение контрольных подписей за постоянное время (timing-safe),
 * нечувствительно к регистру символов (MD5/SHA256 hex).
 */
export function validateSignature(expectedSig: string, actualSig: string): boolean {
  if (!expectedSig || !actualSig) return false;
  return timingSafeEqual(expectedSig.toLowerCase().trim(), actualSig.toLowerCase().trim());
}

export interface WebhookValidationOptions {
  outSum: string;
  invId: string;
  signatureValue: string;
  password2: string;
  shp?: ShpParamsSource;
  expectedAmount?: number | string;
  minAmount?: number;
  algorithm?: 'MD5' | 'SHA256';
}

export type WebhookValidationResult =
  | { valid: true; paidAmount: number }
  | {
      valid: false;
      reason: 'bad_signature' | 'amount_mismatch' | 'amount_below_min' | 'invalid_amount' | 'missing_params';
      paidAmount: number;
    };

/**
 * Валидация вебхука ResultURL Робокассы:
 * - проверка наличия обязательных полей
 * - разбор суммы (с поддержкой запятой и точки)
 * - сверка суммы с минимальной / ожидаемой (защита от занижения)
 * - проверка подписи (MD5 или SHA256) за постоянное время без учёта регистра
 */
export async function validateWebhookSignature(
  opts: WebhookValidationOptions,
): Promise<WebhookValidationResult> {
  const { outSum, invId, signatureValue, password2, shp, expectedAmount, minAmount, algorithm = 'MD5' } = opts;

  if (!outSum || !invId || !signatureValue || !password2) {
    return { valid: false, reason: 'missing_params', paidAmount: 0 };
  }

  const paidAmount = parseAmount(outSum);
  if (Number.isNaN(paidAmount) || paidAmount < 0) {
    return { valid: false, reason: 'invalid_amount', paidAmount: 0 };
  }

  if (minAmount !== undefined && paidAmount + 0.01 < minAmount) {
    return { valid: false, reason: 'amount_below_min', paidAmount };
  }

  if (expectedAmount !== undefined) {
    const expected = typeof expectedAmount === 'number' ? expectedAmount : parseAmount(expectedAmount);
    if (!Number.isNaN(expected) && Math.abs(paidAmount - expected) > 0.005) {
      return { valid: false, reason: 'amount_mismatch', paidAmount };
    }
  }

  const expectedSig = algorithm === 'SHA256'
    ? await calculateSignatureSha256({ outSum, invId, password: password2, shp })
    : calculateSignatureMd5({ outSum, invId, password: password2, shp });

  if (!validateSignature(expectedSig, signatureValue)) {
    return { valid: false, reason: 'bad_signature', paidAmount };
  }

  return { valid: true, paidAmount };
}

/** Синхронная версия валидации вебхука для стандартного MD5. */
export function validateWebhookSignatureMd5(
  opts: Omit<WebhookValidationOptions, 'algorithm'>,
): WebhookValidationResult {
  const { outSum, invId, signatureValue, password2, shp, expectedAmount, minAmount } = opts;

  if (!outSum || !invId || !signatureValue || !password2) {
    return { valid: false, reason: 'missing_params', paidAmount: 0 };
  }

  const paidAmount = parseAmount(outSum);
  if (Number.isNaN(paidAmount) || paidAmount < 0) {
    return { valid: false, reason: 'invalid_amount', paidAmount: 0 };
  }

  if (minAmount !== undefined && paidAmount + 0.01 < minAmount) {
    return { valid: false, reason: 'amount_below_min', paidAmount };
  }

  if (expectedAmount !== undefined) {
    const expected = typeof expectedAmount === 'number' ? expectedAmount : parseAmount(expectedAmount);
    if (!Number.isNaN(expected) && Math.abs(paidAmount - expected) > 0.005) {
      return { valid: false, reason: 'amount_mismatch', paidAmount };
    }
  }

  const expectedSig = calculateSignatureMd5({ outSum, invId, password: password2, shp });

  if (!validateSignature(expectedSig, signatureValue)) {
    return { valid: false, reason: 'bad_signature', paidAmount };
  }

  return { valid: true, paidAmount };
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

/** OpKey операции (нужен для возврата). Есть у любого способа оплаты, включая СБП, SberPay, T-Pay и дочерние списания (поддержка Робокассы, 25.10.2026). */
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
