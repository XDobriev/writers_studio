-- Грандфазеринг: первые пользователи Pro сохраняют цену 290 ₽ навсегда.
-- Поле выставляется Edge Function robokassa-webhook при оплате в период фазы 1
-- (пока переменная окружения GRANDFATHERING_ENDS_AT не истекла).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grandfathered boolean NOT NULL DEFAULT false;
