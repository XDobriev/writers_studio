import { Component, type ErrorInfo, type ReactNode } from 'react';

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
    console.error('[ErrorBoundary] Uncaught error:', error.message, '\n', error.stack, '\nComponent stack:', info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
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
            500
          </div>
          <div style={{ font: '400 1.125rem var(--font-serif)', color: 'var(--ink-2)', marginTop: 16 }}>
            Что-то пошло не так
          </div>
          <div style={{ font: '400 0.8125rem var(--font-ui)', color: 'var(--ink-4)', maxWidth: 300, textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
            Произошла непредвиденная ошибка. Попробуйте ещё раз или обновите страницу.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button
              className="btn btn--ghost"
              onClick={this.reset}
            >
              Попробовать снова
            </button>
            <button
              className="btn btn--primary"
              onClick={() => window.location.reload()}
            >
              Обновить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
