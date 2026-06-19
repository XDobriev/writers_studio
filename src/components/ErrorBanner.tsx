import type { CSSProperties } from 'react';

interface ErrorBannerProps {
  message: string;
  /** Если передан — показывается кнопка закрытия (×). */
  onDismiss?: () => void;
  /** Компактный вариант для узких панелей (RightPanel, VersionsPanel). */
  size?: 'sm';
  /** Только layout: отступы/позиционирование. Визуал задаётся внутри компонента. */
  style?: CSSProperties;
}

export function ErrorBanner({ message, onDismiss, size, style }: ErrorBannerProps) {
  return (
    <div
      className={size === 'sm' ? 'error-banner error-banner--sm' : 'error-banner'}
      role="alert"
      style={style}
    >
      <span className="error-banner__msg">{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="error-banner__close"
          onClick={onDismiss}
          title="Закрыть"
          aria-label="Закрыть"
        >
          ×
        </button>
      )}
    </div>
  );
}
