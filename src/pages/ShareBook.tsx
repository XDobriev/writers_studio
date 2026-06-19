import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { supabase } from '../lib/supabase';
import type { Book } from '../lib/supabase';
import { LogoMark } from '../components/LogoMark';

interface Chapter {
  id: string;
  title: string;
  position: number;
  content: string;
  words: number;
}

type State = 'loading' | 'found' | 'not_found' | 'error';

export default function ShareBook() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>('loading');
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setState('not_found'); return; }

    let cancelled = false;
    async function load() {
      const { data, error } = await supabase.rpc('get_shared_book', { p_token: token });

      if (cancelled) return;
      if (error || !data) { setState(error ? 'error' : 'not_found'); return; }

      const { book: bookData, chapters: chapData } = data as { book: Book; chapters: Chapter[] };
      setBook(bookData);
      const chaps = chapData ?? [];
      setChapters(chaps);
      if (chaps.length > 0) setActiveId(chaps[0].id);
      setState('found');
    }

    load();
    return () => { cancelled = true; };
  }, [token]);

  if (state === 'loading') {
    return (
      <div className="as" style={{ height: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-deep)' }}>
        <span style={{ font: '400 0.875rem var(--font-ui)', color: 'var(--ink-4)' }}>Загрузка…</span>
      </div>
    );
  }

  if (state === 'not_found') {
    return (
      <div className="as" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, background: 'var(--bg-deep)' }}>
        <div style={{ font: '300 6rem/1 var(--font-serif)', color: 'var(--ink-4)' }}>404</div>
        <div style={{ font: '400 1rem var(--font-serif)', color: 'var(--ink-2)', marginTop: 16 }}>Ссылка недействительна или доступ отключён</div>
        <Link to="/" style={{ marginTop: 24, font: '400 0.8125rem var(--font-ui)', color: 'var(--ink-3)', textDecoration: 'underline' }}>
          Авторская студия
        </Link>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="as" style={{ height: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-deep)' }}>
        <span style={{ font: '400 0.875rem var(--font-ui)', color: 'var(--ink-3)' }}>Ошибка загрузки</span>
      </div>
    );
  }

  const active = chapters.find(c => c.id === activeId) ?? null;
  const meta = [book?.author, book?.genre].filter(Boolean).join(' · ');

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 12, height: 48 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <LogoMark size={16} />
          </Link>
          <div style={{ width: 1, height: 16, background: 'var(--border-soft)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {book?.title}
            </div>
            {meta && (
              <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)', marginTop: 1 }}>{meta}</div>
            )}
          </div>
          <Link to="/" style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', whiteSpace: 'nowrap', textDecoration: 'none', border: '1px solid var(--border-soft)', borderRadius: 6, padding: '4px 10px' }}>
            Открыть студию
          </Link>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', maxWidth: 1040, margin: '0 auto', width: '100%', padding: '0 24px 48px', gap: 32 }}>
        {/* Chapter list */}
        {chapters.length > 1 && (
          <nav aria-label="Главы книги" style={{ flexShrink: 0, width: 200, paddingTop: 32 }}>
            <div style={{ position: 'sticky', top: 72, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ font: '500 10px var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-4)', padding: '0 8px 8px' }}>
                Главы
              </div>
              {chapters.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  aria-current={activeId === c.id ? true : undefined}
                  onClick={() => setActiveId(c.id)}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 8px',
                    background: activeId === c.id ? 'var(--surface)' : 'transparent',
                    border: 'none', borderRadius: 5, cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)', flexShrink: 0 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{
                    font: activeId === c.id ? '500 12px var(--font-ui)' : '400 12px var(--font-ui)',
                    color: activeId === c.id ? 'var(--ink)' : 'var(--ink-2)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.title || 'Без названия'}
                  </span>
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0, paddingTop: 40 }}>
          {chapters.length === 0 ? (
            <div style={{ font: '400 0.875rem var(--font-ui)', color: 'var(--ink-4)', textAlign: 'center', paddingTop: 64 }}>
              В этой книге пока нет глав.
            </div>
          ) : active ? (
            <>
              <h1 style={{ font: '600 26px var(--font-serif)', color: 'var(--ink)', marginBottom: 28, letterSpacing: '-0.01em' }}>
                {active.title || 'Без названия'}
              </h1>
              <div
                className="tiptap"
                style={{ font: '400 17px/1.75 var(--font-serif)', color: 'var(--ink)', maxWidth: 640 }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(active.content) }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border-soft)' }}>
                {chapters.findIndex(c => c.id === activeId) > 0 && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      const idx = chapters.findIndex(c => c.id === activeId);
                      if (idx > 0) setActiveId(chapters[idx - 1].id);
                    }}
                  >
                    ← Предыдущая
                  </button>
                )}
                {chapters.findIndex(c => c.id === activeId) < chapters.length - 1 && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => {
                      const idx = chapters.findIndex(c => c.id === activeId);
                      if (idx < chapters.length - 1) setActiveId(chapters[idx + 1].id);
                    }}
                  >
                    Следующая →
                  </button>
                )}
              </div>
            </>
          ) : null}
        </main>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-soft)', padding: '16px 24px', textAlign: 'center' }}>
        <span style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)' }}>
          Создано в{' '}
          <Link to="/" style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>Авторской студии</Link>
        </span>
      </footer>
    </div>
  );
}
