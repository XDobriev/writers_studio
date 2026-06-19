import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { getProfile } from './profiles';

export type Plan = 'free' | 'pro' | 'lifetime';

type LastPayment = { id: string; paid_at: string };

export interface UseSubscriptionResult {
  plan: Plan;
  planExpiresAt: string | null;
  grandfathered: boolean;
  hasRecurring: boolean;
  planLoaded: boolean;
  lastProPayment: LastPayment | null;
  refundLoading: boolean;
  refundError: string | null;
  refundDone: boolean;
  refundConfirmOpen: boolean;
  setRefundConfirmOpen: (v: boolean) => void;
  handleRefund: () => Promise<void>;
}

export function useSubscription(userId: string | undefined, fetchPayments: boolean): UseSubscriptionResult {
  const [plan, setPlan] = useState<Plan>('free');
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [grandfathered, setGrandfathered] = useState(false);
  const [hasRecurring, setHasRecurring] = useState(false);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [lastProPayment, setLastProPayment] = useState<LastPayment | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundDone, setRefundDone] = useState(false);
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    getProfile(userId).then((profile) => {
      if (!mounted) return;
      if (profile?.plan) setPlan(profile.plan as Plan);
      if (profile?.plan_expires_at) setPlanExpiresAt(profile.plan_expires_at);
      if (profile?.grandfathered) setGrandfathered(true);
      if (profile?.recurring_inv_id) setHasRecurring(true);
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
    } catch (e) {
      setRefundError(e instanceof Error ? e.message : 'Ошибка возврата');
    } finally {
      setRefundLoading(false);
      setRefundConfirmOpen(false);
    }
  };

  return {
    plan, planExpiresAt, grandfathered, hasRecurring, planLoaded,
    lastProPayment, refundLoading, refundError, refundDone,
    refundConfirmOpen, setRefundConfirmOpen, handleRefund,
  };
}
