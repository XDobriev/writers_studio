// Отдельный модуль, чтобы динамический import() из monitoring.ts не тянул весь @sentry/react:
// с именованными импортами сборщик вырезает неиспользуемое (477 КБ → ~86 КБ raw).
export { init, captureException, captureMessage, addBreadcrumb } from '@sentry/react';
