// Канонические функции работы с датами в локальной таймзоне пользователя.
// ВАЖНО: не использовать toISOString().slice(0,10) для «сегодня» — это даёт UTC-дату,
// из-за чего граница суток смещается на величину часового пояса (для МСК — на 3 часа).

// Локальная дата в формате YYYY-MM-DD (en-CA даёт именно такой формат).
export function toLocalISODate(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

// Сегодняшняя дата (локальная) в формате YYYY-MM-DD.
export function todayLocalISODate(): string {
  return toLocalISODate(new Date());
}
