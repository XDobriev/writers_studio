// Слияние ответа сервера с оптимистичным кэшем без «эха».
// Пока запрос летел, пользователь мог допечатать поле — тогда в кэше уже новее,
// чем в ответе, и ответ это поле не трогает. Поля, которые ушли и с тех пор
// не менялись, берутся с сервера (нормализация на стороне БД, updated_at).

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function mergeConfirmed<T extends object>(current: T, server: T, sent: Partial<T>): T {
  const merged = { ...current };
  for (const key of Object.keys(sent) as (keyof T)[]) {
    if (same(current[key], sent[key])) merged[key] = server[key];
  }
  if ('updated_at' in server) {
    (merged as Record<string, unknown>).updated_at = (server as Record<string, unknown>).updated_at;
  }
  return merged;
}

export function mergeConfirmedInList<T extends { id: string }>(list: T[] | undefined, server: T, sent: Partial<T>): T[] | undefined {
  return list?.map((item) => (item.id === server.id ? mergeConfirmed(item, server, sent) : item));
}
