// Возврат дубля автосписания (L-8): дочерний платёж, подтверждённый за уже оплаченный
// или закрытый период (activate_payment → status 'duplicate_period'). Подписку дубль
// не продлевал, поэтому apply_refund не вызывается — только refunded_at/refund_request_id.
// Владелец получает сообщение в Telegram при любом исходе; не вышло вернуть
// автоматически — audit duplicate_refund_manual, возврат вручную в ЛК Робокассы.
// Зависимости внедряются — модуль тестируется из src/lib/duplicateRefund.test.ts.
import type { RefundCreateResult } from './robokassa.ts';

export type DuplicatePayment = {
  invId: string;
  userId: string;
  amount: string;
  reason: string;
  opKey: string | null;
};

export type DuplicateRefundDeps = {
  password3: string | null;
  /** claim refunded_at (только если ещё NULL). false — уже возвращается/возвращён. */
  claim: () => Promise<boolean>;
  release: () => Promise<void>;
  saveRequestId: (requestId: string) => Promise<void>;
  audit: (action: string, payload: Record<string, unknown>) => Promise<void>;
  notify: (text: string) => Promise<unknown>;
  createRefund: (opKey: string, password3: string) => Promise<RefundCreateResult>;
  pollState: (requestId: string) => Promise<'finished' | 'canceled' | 'processing'>;
};

export type DuplicateRefundOutcome =
  | 'refunded'
  | 'already_claimed'
  | 'no_op_key'
  | 'no_password3'
  | 'already_created'
  | 'insufficient_balance'
  | 'rejected'
  | 'canceled'
  | 'unreachable';

const REASON_TEXT: Record<string, string> = {
  period_already_paid: 'период уже оплачен',
  subscription_inactive: 'подписка уже закрыта',
};

const MANUAL_TEXT: Record<Exclude<DuplicateRefundOutcome, 'refunded' | 'already_claimed'>, string> = {
  no_op_key: 'нет OpKey',
  no_password3: 'не задан ROBOKASSA_PASSWORD3',
  already_created: 'Робокасса ответила NotEnoughOperationFunds — возврат по операции уже создан, сверить в ЛК',
  insufficient_balance: 'на балансе меньше суммы возврата (8401)',
  rejected: 'Робокасса отклонила возврат',
  canceled: 'заявка на возврат отменена',
  unreachable: 'Refund API недоступен',
};

export async function refundDuplicatePayment(p: DuplicatePayment, deps: DuplicateRefundDeps): Promise<DuplicateRefundOutcome> {
  const head = `Двойное автосписание: inv=${p.invId}, ${p.amount} ₽ (${REASON_TEXT[p.reason] ?? p.reason}). Pro не продлён.`;

  const manual = async (outcome: Exclude<DuplicateRefundOutcome, 'refunded' | 'already_claimed'>, extra: Record<string, unknown> = {}) => {
    await deps.audit('duplicate_refund_manual', { inv_id: p.invId, amount: p.amount, reason: outcome, ...extra });
    await deps.notify(`${head} Автовозврат не прошёл: ${MANUAL_TEXT[outcome]}. Вернуть вручную в ЛК Робокассы.`);
    return outcome;
  };

  if (!p.opKey) return manual('no_op_key');
  if (!deps.password3) return manual('no_password3');

  if (!(await deps.claim())) {
    await deps.notify(`${head} Возврат уже оформляется — проверить в ЛК Робокассы.`);
    return 'already_claimed';
  }

  let result: RefundCreateResult;
  try {
    result = await deps.createRefund(p.opKey, deps.password3);
  } catch (e) {
    await deps.release();
    return manual('unreachable', { error: e instanceof Error ? e.message : String(e) });
  }

  if (result.kind === 'already_created') return manual('already_created');
  if (result.kind !== 'created') {
    await deps.release();
    return manual(result.kind, result.kind === 'rejected' ? { message: result.message } : {});
  }

  const label = await deps.pollState(result.requestId);
  if (label === 'canceled') {
    await deps.release();
    return manual('canceled', { request_id: result.requestId });
  }

  await deps.saveRequestId(result.requestId);
  await deps.audit('duplicate_refunded', { inv_id: p.invId, amount: p.amount, request_id: result.requestId, status: label });
  await deps.notify(`${head} Деньги возвращены автоматически (${label === 'finished' ? 'возврат выполнен' : 'заявка принята'}).`);
  return 'refunded';
}
