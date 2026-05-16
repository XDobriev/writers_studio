import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { WithMode } from '../components/Chrome';
import { useAuth } from '../lib/auth';
import { supabase, type Book } from '../lib/supabase';
import { createChapter, listChapters, type Chapter } from '../lib/chapters';

const STATUS_COLOR: Record<Chapter['status'], string> = {
  draft: 'var(--ink-4)',
  progress: 'var(--accent-2)',
  done: 'var(--ok)',
};

export default function Outline() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      try {
        const [bookRes, list] = await Promise.all([
          supabase.from('books').select('*').eq('id', bookId).single(),
          listChapters(bookId),
        ]);
        if (cancelled) return;
        if (bookRes.error) throw bookRes.error;
        setBook(bookRes.data as Book);
        setChapters(list);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  const totals = useMemo(() => {
    if (!chapters) return { count: 0, words: 0, done: 0, progress: 0, draft: 0 };
    return chapters.reduce(
      (acc, c) => {
        acc.count += 1;
        acc.words += c.words;
        acc[c.status] += 1;
        return acc;
      },
      { count: 0, words: 0, done: 0, progress: 0, draft: 0 },
    );
  }, [chapters]);

  const onCreate = async () => {
    if (!bookId || !user) return;
    try {
      const created = await createChapter(bookId, user.id, {
        title: `Глава ${(chapters?.length ?? 0) + 1}`,
        position: chapters?.length ?? 0,
      });
      setChapters((prev) => [...(prev ?? []), created]);
      navigate(`/books/${bookId}/editor?chapter=${created.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <WithMode active="editor">
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <aside className="sb">
          <div className="sb-head">
            <Link to="/books" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, textDecoration: 'none' }}>
              <span style={{ width: 18, height: 22, background: 'var(--accent)', borderRadius: '1px 4px 4px 1px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 3, top: 3, right: 3, bottom: 3, border: '0.5px solid oklch(0.98 0 0 / 0.6)' }} />
              </span>
              <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>авторская студия</span>
            </Link>
            <div className="sb-book-title">{book?.title ?? '…'}</div>
            <div className="sb-book-author">
              структура · {totals.words.toLocaleString('ru')} / {(book?.goal ?? 0).toLocaleString('ru')} сл
            </div>
          </div>
          <div className="sb-tabs">
            <button className="sb-tab" onClick={() => bookId && navigate(`/books/${bookId}/editor`)}>Список</button>
            <button className="sb-tab" onClick={() => bookId && navigate(`/books/${bookId}/corkboard`)}>Доска</button>
            <button className="sb-tab sb-tab--on">Структура</button>
          </div>
          <div style={{ padding: '18px 18px 14px', color: 'var(--ink-3)', fontSize: 12 }}>
            Дерево структуры показывает книгу целиком. Главы и сцены — настраиваются по мере работы.
          </div>
          <div style={{ padding: '4px 14px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="btn" onClick={onCreate}><Icon name="plus" size={13} /> Новая глава</button>
          </div>
          {bookId && (
            <div style={{ padding: '12px 14px 0' }}>
              <Link to={`/books/${bookId}`} className="sb-item" style={{ color: 'var(--ink-3)' }}>
                <span style={{ display: 'flex', justifyContent: 'center', color: 'var(--ink-3)' }}><Icon name="arrows" size={14} /></span>
                <span className="sb-item-title" style={{ color: 'var(--ink-3)' }}>← К дэшборду</span>
                <span />
              </Link>
            </div>
          )}
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)' }}>Структура</span>
              <span className="chip">{totals.count} {totals.count === 1 ? 'глава' : 'глав'} · {totals.words.toLocaleString('ru')} сл</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn" onClick={onCreate}><Icon name="plus" size={14} /> Новая глава</button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '28px 40px' }}>
            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'oklch(0.65 0.18 25 / 0.10)', color: 'var(--danger)', fontSize: 13 }}>
                {error}
              </div>
            )}

            {!chapters && !error && <div style={{ color: 'var(--ink-3)' }}>Загрузка…</div>}

            {chapters && chapters.length === 0 && (
              <div style={{ padding: '64px 32px', textAlign: 'center', border: '1px dashed var(--border-strong)', borderRadius: 12, color: 'var(--ink-3)' }}>
                <div style={{ font: '500 18px var(--font-serif)', color: 'var(--ink-2)', marginBottom: 8 }}>Глав пока нет.</div>
                <div style={{ marginBottom: 16, fontSize: 13 }}>Создайте первую главу — структура книги начнёт собираться отсюда.</div>
                <button className="btn btn--primary" onClick={onCreate}>
                  <Icon name="plus" size={14} /> Новая глава
                </button>
              </div>
            )}

            {chapters && chapters.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border-soft)' }}>
                  <h2 style={{ font: '600 22px var(--font-serif)', letterSpacing: '-0.01em' }}>Главы</h2>
                  <span style={{ flex: 1 }} />
                  <span style={{ font: '400 11.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                    {totals.done} готово · {totals.progress} в работе · {totals.draft} черновик
                  </span>
                </div>
                {chapters.map((c, i) => (
                  <Link
                    key={c.id}
                    to={`/books/${bookId}/editor?chapter=${c.id}`}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px 12px 28px', borderRadius: 8, position: 'relative' }}
                  >
                    <span style={{ font: '500 12px var(--font-mono)', color: c.status === 'draft' ? 'var(--ink-4)' : 'var(--accent)', letterSpacing: '0.04em', marginTop: 3, minWidth: 28 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '500 15px var(--font-serif)', color: c.status === 'draft' ? 'var(--ink-3)' : 'var(--ink)' }}>
                        {c.title || 'Без названия'}
                      </div>
                    </div>
                    <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', marginTop: 4 }}>{c.words.toLocaleString('ru')} сл</span>
                    <span style={{ width: 6, height: 6, borderRadius: 999, marginTop: 8, background: STATUS_COLOR[c.status] }} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </WithMode>
  );
}
