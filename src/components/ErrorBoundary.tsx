import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

function isChunkError(e: Error): boolean {
  return (
    e.name === 'ChunkLoadError' ||
    /loading chunk/i.test(e.message) ||
    /failed to fetch dynamically imported module/i.test(e.message)
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const tag = isChunkError(error) ? '[ChunkLoadError]' : '[AppError]';
    console.error(tag, error.message, '\n', error.stack, '\nComponent stack:', info.componentStack);

    // Chunk не загрузился из-за сети — молча перезагружаем страницу.
    // Флаг в sessionStorage предотвращает бесконечную петлю перезагрузок.
    if (isChunkError(error)) {
      const key = 'chunk-reload-attempt';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
    }
  }

  reset = () => {
    sessionStorage.removeItem('chunk-reload-attempt');
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
