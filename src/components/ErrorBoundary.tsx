import { Component, type ReactNode } from 'react';

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
            gap: 12,
            padding: 32,
          }}
        >
          <div style={{ font: '500 15px var(--font-serif)', color: 'var(--ink-2)' }}>
            Что-то пошло не так
          </div>
          <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)', maxWidth: 320, textAlign: 'center' }}>
            {this.state.error.message}
          </div>
          <button
            className="btn btn--primary"
            style={{ marginTop: 8 }}
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
