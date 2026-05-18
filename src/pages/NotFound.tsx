import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      className="as"
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        background: 'var(--bg-deep)',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          font: '300 9rem/1 var(--font-serif)',
          color: 'var(--ink-4)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        404
      </div>

      <div
        style={{
          font: '400 1.125rem var(--font-serif)',
          color: 'var(--ink-2)',
          marginTop: 20,
        }}
      >
        Страница не найдена
      </div>

      <div
        style={{
          font: '400 0.8125rem var(--font-ui)',
          color: 'var(--ink-4)',
          marginTop: 8,
          maxWidth: 300,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Возможно, адрес изменился или такой страницы никогда не существовало.
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 28 }}>
        <button
          className="btn btn--ghost"
          onClick={() => navigate(-1)}
        >
          ← Назад
        </button>
        <button
          className="btn btn--primary"
          onClick={() => navigate('/books', { replace: true })}
        >
          На главную
        </button>
      </div>
    </div>
  );
}
