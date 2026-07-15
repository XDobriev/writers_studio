import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getProfile } from './profiles';
import { QUERY_KEYS } from './queries';
import { saveCancellationReason, type CancelReason } from './cancellations';

export type Plan = 'free' | 'pro' | 'lifetime';

type LastPayment = { id: string; paid_at: string };

export interface UseSubscriptionResult {
  plan: Plan;
  planExpiresAt: string | null;
  grandfathered: boolean;
  hasRecurring: boolean;
  cancelAtPeriodEnd: boolean;
  planLoaded: boolean;
  lastProPayment: LastPayment | null;
  refundLoading: boolean;
  refundError: string | null;
  refundDone: boolean;
  refundConfirmOpen: boolean;
  setRefundConfirmOpen: (v: boolean) => void;
  handleRefund: () => Promise<void>;
  cancelLoading: boolean;
  cancelError: string | null;
  cancelConfirmOpen: boolean;
  setCancelConfirmOpen: (v: boolean) => void;
  handleCancel: (reason: CancelReason, comment: string) => Promise<void>;
  handleResume: () => Promise<boolean>;
}

export function useSubscription(userId: string | undefined, fetchPayments: boolean): UseSubscriptionResult {
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState<Plan>('free');
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [grandfathered, setGrandfathered] = useState(false);
  const [hasRecurring, setHasRecurring] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [lastProPayment, setLastProPayment] = useState<LastPayment | null>(null);

  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundDone, setRefundDone] = useState(false);
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    getProfile(userId).then((profile) => {
      if (!mounted) return;
      if (profile?.plan) setPlan(profile.plan as Plan);
      if (profile?.plan_expires_at) setPlanExpiresAt(profile.plan_expires_at);
      if (profile?.grandfathered) setGrandfathered(true);
      if (profile?.recurring_inv_id) setHasRecurring(true);
      setCancelAtPeriodEnd(profile?.cancel_at_period_end ?? false);
      setPlanLoaded(true);
    });
    return () => { mounted = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId || !fetchPayments) return;
    supabase
      .from('payments')
      .select('id, paid_at')
      .in('plan', ['pro', 'pro_annual'])
      .is('refunded_at', null)
      .order('paid_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLastProPayment(data ?? null));
  }, [userId, fetchPayments]);

  const handleRefund = async () => {
    setRefundLoading(true);
    setRefundError(null);
    try {
      const { error } = await supabase.functions.invoke('process-refund');
      if (error) {
        let errCode: string | undefined;
        try { errCode = ((await (error as unknown as { context: Response }).context.json()) as { error?: string }).error; } catch { /* ignore */ }
        if (errCode === 'op_key_missing') throw new Error('Возврат временно недоступен. Попробуйте через несколько минут.');
        if (errCode === 'refund_not_eligible') throw new Error('Срок для возврата истёк.');
        if (errCode === 'lifetime_non_refundable') throw new Error('Lifetime-тариф не возвращается.');
        throw new Error('Ошибка оформления возврата. Обратитесь в поддержку.');
      }
      setPlan('free');
      setPlanExpiresAt(null);
      setLastProPayment(null);
      setRefundDone(true);
      if (userId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(userId) });
    } catch (e) {
      setRefundError(e instanceof Error ? e.message : 'Ошибка возврата');
    } finally {
      setRefundLoading(false);
      setRefundConfirmOpen(false);
    }
  };

  /** true — сервер подтвердил переключение. Вызывающему нужен исход, а не только setState. */
  const invokeCancelToggle = async (resume: boolean): Promise<boolean> => {
    setCancelLoading(true);
    setCancelError(null);
    try {
      const url = resume ? 'cancel-subscription?resume=true' : 'cancel-subscription';
      const { data, error } = await supabase.functions.invoke(url);
      if (error) {
        let errCode: string | undefined;
        try { errCode = ((await (error as unknown as { context: Response }).context.json()) as { error?: string }).error; } catch { /* ignore */ }
        if (errCode === 'no_recurring') throw new Error('У вашей подписки нет автопродления.');
        throw new Error(resume ? 'Не удалось возобновить подписку.' : 'Не удалось отменить подписку.');
      }
      const expiresAt = (data as { expires_at?: string })?.expires_at ?? null;
      setCancelAtPeriodEnd(!resume);
      if (expiresAt) setPlanExpiresAt(expiresAt);
      return true;
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Ошибка');
      return false;
    } finally {
      setCancelLoading(false);
      setCancelConfirmOpen(false);
    }
  };

  const handleCancel = async (reason: CancelReason, comment: string) => {
    const cancelled = await invokeCancelToggle(false);
    // Причина пишется только после подтверждённой отмены — иначе сорвавшаяся отмена
    // оставила бы в БД запись об уходе, которого не было. Сбой самой записи не
    // откатывает отмену: это исследование, а не часть транзакции.
    if (cancelled && userId) {
      try {
        await saveCancellationReason(userId, reason, comment, plan);
      } catch (e) {
        console.error('[useSubscription] saveCancellationReason failed:', e);
      }
    }
  };

  const handleResume = () => invokeCancelToggle(true);

  return {
    plan, planExpiresAt, grandfathered, hasRecurring, cancelAtPeriodEnd, planLoaded,
    lastProPayment, refundLoading, refundError, refundDone,
    refundConfirmOpen, setRefundConfirmOpen, handleRefund,
    cancelLoading, cancelError, cancelConfirmOpen, setCancelConfirmOpen,
    handleCancel, handleResume,
  };
}
