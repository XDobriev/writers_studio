import { describe, expect, it, vi } from 'vitest';
import { refundDuplicatePayment, type DuplicateRefundDeps } from '../../supabase/functions/_shared/duplicateRefund.ts';

const payment = { invId: '42', userId: 'u1', amount: '199.00', reason: 'period_already_paid', opKey: 'op-1' };

function makeDeps(over: Partial<DuplicateRefundDeps> = {}) {
  const deps = {
    password3: 'p3',
    claim: vi.fn().mockResolvedValue(true),
    release: vi.fn().mockResolvedValue(undefined),
    saveRequestId: vi.fn().mockResolvedValue(undefined),
    audit: vi.fn().mockResolvedValue(undefined),
    notify: vi.fn().mockResolvedValue(true),
    createRefund: vi.fn().mockResolvedValue({ kind: 'created', requestId: 'req-1' }),
    pollState: vi.fn().mockResolvedValue('finished'),
    ...over,
  };
  return deps;
}

describe('refundDuplicatePayment', () => {
  it('возвращает по OpKey дубля, сохраняет request_id, пишет audit и уведомляет', async () => {
    const deps = makeDeps();
    expect(await refundDuplicatePayment(payment, deps)).toBe('refunded');
    expect(deps.createRefund).toHaveBeenCalledWith('op-1', 'p3');
    expect(deps.saveRequestId).toHaveBeenCalledWith('req-1');
    expect(deps.release).not.toHaveBeenCalled();
    expect(deps.audit).toHaveBeenCalledWith('duplicate_refunded', expect.objectContaining({ inv_id: '42', request_id: 'req-1' }));
    expect(deps.notify).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenCalledWith(expect.stringContaining('возвращены'));
  });

  it('без OpKey — в Робокассу не ходит, ручной возврат', async () => {
    const deps = makeDeps();
    expect(await refundDuplicatePayment({ ...payment, opKey: null }, deps)).toBe('no_op_key');
    expect(deps.claim).not.toHaveBeenCalled();
    expect(deps.createRefund).not.toHaveBeenCalled();
    expect(deps.audit).toHaveBeenCalledWith('duplicate_refund_manual', expect.objectContaining({ reason: 'no_op_key' }));
    expect(deps.notify).toHaveBeenCalledWith(expect.stringContaining('вручную'));
  });

  it('без Password3 — ручной возврат', async () => {
    const deps = makeDeps({ password3: null });
    expect(await refundDuplicatePayment(payment, deps)).toBe('no_password3');
    expect(deps.createRefund).not.toHaveBeenCalled();
  });

  it('claim занят — второго возврата нет, владелец уведомлён', async () => {
    const deps = makeDeps({ claim: vi.fn().mockResolvedValue(false) });
    expect(await refundDuplicatePayment(payment, deps)).toBe('already_claimed');
    expect(deps.createRefund).not.toHaveBeenCalled();
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });

  it('8401 — claim снимается, ручной возврат', async () => {
    const deps = makeDeps({ createRefund: vi.fn().mockResolvedValue({ kind: 'insufficient_balance' }) });
    expect(await refundDuplicatePayment(payment, deps)).toBe('insufficient_balance');
    expect(deps.release).toHaveBeenCalledTimes(1);
    expect(deps.saveRequestId).not.toHaveBeenCalled();
    expect(deps.audit).toHaveBeenCalledWith('duplicate_refund_manual', expect.objectContaining({ reason: 'insufficient_balance' }));
  });

  it('NotEnoughOperationFunds — claim остаётся (возврат уже создан)', async () => {
    const deps = makeDeps({ createRefund: vi.fn().mockResolvedValue({ kind: 'already_created' }) });
    expect(await refundDuplicatePayment(payment, deps)).toBe('already_created');
    expect(deps.release).not.toHaveBeenCalled();
  });

  it('отказ и сетевой сбой — claim снимается', async () => {
    const rejected = makeDeps({ createRefund: vi.fn().mockResolvedValue({ kind: 'rejected', message: 'x' }) });
    expect(await refundDuplicatePayment(payment, rejected)).toBe('rejected');
    expect(rejected.release).toHaveBeenCalledTimes(1);

    const down = makeDeps({ createRefund: vi.fn().mockRejectedValue(new Error('timeout')) });
    expect(await refundDuplicatePayment(payment, down)).toBe('unreachable');
    expect(down.release).toHaveBeenCalledTimes(1);
  });

  it('заявка отменена — claim снимается, request_id не сохраняется', async () => {
    const deps = makeDeps({ pollState: vi.fn().mockResolvedValue('canceled') });
    expect(await refundDuplicatePayment(payment, deps)).toBe('canceled');
    expect(deps.release).toHaveBeenCalledTimes(1);
    expect(deps.saveRequestId).not.toHaveBeenCalled();
  });
});
