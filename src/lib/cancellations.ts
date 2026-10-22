export type CancelReason = 'price' | 'not_writing' | 'missing_features' | 'bugs' | 'other_tool' | 'other';

export const CANCEL_REASONS: { key: CancelReason; label: string }[] = [
  { key: 'price',            label: 'Дорого для меня' },
  { key: 'not_writing',      label: 'Сейчас не пишу' },
  { key: 'missing_features', label: 'Не хватает нужных возможностей' },
  { key: 'bugs',             label: 'Что-то работало неправильно' },
  { key: 'other_tool',       label: 'Перешёл(ла) на другой редактор' },
  { key: 'other',            label: 'Другая причина' },
];

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = Object.fromEntries(
  CANCEL_REASONS.map(r => [r.key, r.label]),
) as Record<CancelReason, string>;

// Запись причины — на сервере: cancel-subscription принимает { reason, comment } и пишет
// cancellation_reasons под service role после успешной отмены.
