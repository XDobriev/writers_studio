import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '../lib/monitoring';
import { isChunkError, reloadOnceForChunkError, resetChunkReloadGuard } from '../lib/chunkReload';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const chunk = isChunkError(error);
    console.error(chunk ? '[ChunkLoadError]' : '[AppError]', error.message, '\n', error.stack, '\nComponent stack:', info.componentStack);

    // React 18: ошибки, пойманные boundary, не доходят до window.onerror — без явного
    // captureException Sentry их не видит. Chunk-ошибки лечатся релоадом — warning.
    Sentry.captureException(error, {
      level: chunk ? 'warning' : 'error',
      contexts: { react: { componentStack: info.componentStack ?? '' } },
    });

    // Chunk не загрузился (деплой или сеть) — один раз перезагружаем страницу.
    if (chunk) reloadOnceForChunkError();
  }

  reset = () => {
    resetChunkReloadGuard();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      const chunk = isChunkError(this.state.error);
      return (
        <div
          className="as"
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 0,
            padding: 32,
            background: 'var(--bg-deep)',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              font: '300 6rem/1 var(--font-serif)',
              color: 'var(--surface-3)',
              letterSpacing: '-0.04em',
            }}
          >
            {chunk ? '…' : '500'}
          </div>
          <div style={{ font: '400 1.125rem var(--font-serif)', color: 'var(--ink-2)', marginTop: 16 }}>
            {chunk ? 'Ошибка загрузки' : 'Что-то пошло не так'}
          </div>
          <div style={{ font: '400 0.8125rem var(--font-ui)', color: 'var(--ink-4)', maxWidth: 300, textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
            {chunk
              ? 'Не удалось загрузить страницу. Проверьте соединение и обновите.'
              : 'Произошла непредвиденная ошибка. Попробуйте ещё раз или обновите страницу.'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button className="btn btn--ghost" onClick={this.reset}>
              Попробовать снова
            </button>
            <button className="btn btn--primary" onClick={() => window.location.reload()}>
              Обновить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
