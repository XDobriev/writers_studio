import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { supabase } from './supabase';
import { getProfile } from './profiles';

export function usePostAuthRedirect() {
  const { session, initializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [redirectingToPay, setRedirectingToPay] = useState(false);

  useEffect(() => {
    // Ждём подтверждения сессии сервером (getSession()) — иначе локально
    // восстановленная, но невалидная сессия может дойти до редиректа на оплату.
    if (initializing || !session) return;
    const params = new URLSearchParams(location.search);
    const urlPlan = params.get('plan');
    const storedPlan = sessionStorage.getItem('pending_plan');
    const rawPlan = urlPlan ?? storedPlan;
    const plan = rawPlan === 'pro' || rawPlan === 'lifetime' ? rawPlan : null;

    if (plan) {
      // Очищаем оба источника ДО редиректа — иначе Back-кнопка из Робокассы
      // вернёт пользователя на /login?plan=pro и запустит цикл заново.
      sessionStorage.removeItem('pending_plan');
      if (urlPlan) {
        params.delete('plan');
        navigate({ search: params.toString() }, { replace: true });
      }
      setRedirectingToPay(true);
      void (async () => {
        try {
          const profile = await getProfile(session.user.id);
          // profile === null означает либо реальное отсутствие строки, либо сбой запроса
          // (getProfile глотает ошибку) — в обоих случаях не продолжаем на оплату вслепую.
          if (!profile) {
            setRedirectingToPay(false);
            navigate('/books', { replace: true });
            return;
          }
          if (profile.plan === 'pro' || profile.plan === 'pro_annual' || profile.plan === 'lifetime') {
            setRedirectingToPay(false);
            navigate('/books', { replace: true });
            return;
          }
          const { data, error } = await supabase.functions.invoke('create-payment-url', {
            body: { plan },
          });
          if (error || !data?.url) throw error ?? new Error('no url');
          window.location.href = data.url as string;
        } catch {
          setRedirectingToPay(false);
          navigate('/books', { replace: true });
        }
      })();
      return;
    }
    const rawFrom = (location.state as { from?: string } | null)?.from ?? '/books';
    // Срезаем до /books если from указывает на конкретную книгу —
    // после смены аккаунта (VK/Telegram → email и наоборот) та книга недоступна.
    const from = rawFrom.startsWith('/books/') ? '/books' : rawFrom;
    navigate(from, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, initializing]);

  return { redirectingToPay };
}
