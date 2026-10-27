// Решение billing-scheduler о повторе списания, когда прошлый дочерний счёт ещё не подтверждён.
// Чистый модуль без импортов — его импортирует unit-тест (billingRetry.test.ts).
// Коды State — см. fetchOpState в robokassa.ts.

type OpState = { resultCode: number | null; stateCode: number | null };

/** Счёт инициирован (5), деньги получены (50), приостановлен (80), оплачен (100) — списывать снова нельзя. */
const IN_FLIGHT_OR_PAID = [5, 50, 80, 100];

/**
 * state — ответ OpStateExt по прошлому счёту; null — статус узнать не удалось
 * (Робокасса недоступна или нечем подписать запрос). Без статуса не списываем:
 * лучше отложить попытку на сутки, чем списать дважды.
 */
export function retryDecision(state: OpState | null): 'charge' | 'postpone' | 'in_flight' | 'paid' {
  if (state === null) return 'postpone';
  if (state.resultCode === 0 && state.stateCode !== null && IN_FLIGHT_OR_PAID.includes(state.stateCode)) {
    return state.stateCode === 100 ? 'paid' : 'in_flight';
  }
  return 'charge';
}

/** Банк отклонил прошлое списание (State 10) — повод сказать пользователю (G-6). */
export function isDeclined(state: OpState | null): boolean {
  return state !== null && state.resultCode === 0 && state.stateCode === 10;
}
