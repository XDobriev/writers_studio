import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { getProfile, isPaidPlan } from './profiles';
import {
  CheckoutError, PENDING_CONSENT_KEY, isCheckoutPlan, isRecurringPlan, startCheckout,
  type CheckoutPlan,
} from './checkout';

/** Оплата, ожидающая действия пользователя: согласие на рекуррент или повтор после ошибки. */
interface PendingCheckout {
  plan: CheckoutPlan;
  error: string | null;
}

export function usePostAuthRedirect() {
  const { session, initializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [redirectingToPay, setRedirectingToPay] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);

  const pay = async (plan: CheckoutPlan, consent: boolean) => {
    if (!session) return;
    setPendingCheckout(null);
    setRedirectingToPay(true);
    try {
      const profile = await getProfile(session.user.id);
      // Нет профиля или тариф уже оплачен — на оплату не идём.
      if (!profile || isPaidPlan(profile)) {
        setRedirectingToPay(false);
        navigate('/books', { replace: true });
        return;
      }
      window.location.href = await startCheckout(plan, consent);
    } catch (e) {
      setRedirectingToPay(false);
      if (e instanceof CheckoutError && (e.code === 'already_pro' || e.code === 'already_lifetime')) {
        navigate('/books', { replace: true });
        return;
      }
      setPendingCheckout({ plan, error: e instanceof Error ? e.message : 'Не удалось перейти к оплате.' });
    }
  };

  useEffect(() => {
    // Ждём подтверждения сессии сервером (getSession()) — иначе локально
    // восстановленная, но невалидная сессия может дойти до редиректа на оплату.
    if (initializing || !session) return;
    const params = new URLSearchParams(location.search);
    const urlPlan = params.get('plan');
    const storedPlan = sessionStorage.getItem('pending_plan');
    const rawPlan = urlPlan ?? storedPlan;
    const plan = isCheckoutPlan(rawPlan) ? rawPlan : null;

    if (plan) {
      // Очищаем источники ДО редиректа — иначе Back-кнопка из Робокассы
      // вернёт пользователя на /login?plan=pro и запустит цикл заново.
      const consentedPlan = sessionStorage.getItem(PENDING_CONSENT_KEY);
      sessionStorage.removeItem('pending_plan');
      sessionStorage.removeItem(PENDING_CONSENT_KEY);
      if (urlPlan) {
        params.delete('plan');
        navigate({ search: params.toString() }, { replace: true });
      }
      if (isRecurringPlan(plan) && consentedPlan !== plan) {
        // Ссылка /login?plan=pro без чекбокса на лендинге — спрашиваем согласие здесь.
        setPendingCheckout({ plan, error: null });
        return;
      }
      void pay(plan, isRecurringPlan(plan));
      return;
    }
    const rawFrom = (location.state as { from?: string } | null)?.from ?? '/books';
    // Срезаем до /books если from указывает на конкретную книгу —
    // после смены аккаунта (VK/Telegram → email и наоборот) та книга недоступна.
    const from = rawFrom.startsWith('/books/') ? '/books' : rawFrom;
    navigate(from, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, initializing]);

  return {
    redirectingToPay,
    pendingCheckout,
    confirmCheckout: (consent: boolean) => {
      if (pendingCheckout) void pay(pendingCheckout.plan, consent);
    },
    cancelCheckout: () => {
      setPendingCheckout(null);
      navigate('/books', { replace: true });
    },
  };
}
