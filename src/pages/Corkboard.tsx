import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { WithMode } from '../components/Chrome';
import { useAuth } from '../lib/auth';
import { supabase, type Book } from '../lib/supabase';
import { createChapter, listChapters, type Chapter } from '../lib/chapters';

type Filter = 'all' | Chapter['status'];

const STATUS_LABEL: Record<Chapter['status'], string> = {
  draft: 'черновик',
  progress: 'в работе',
  done: 'готово',
};

const STATUS_COLOR: Record<Chapter['status'], string> = {
  draft: 'var(--ink-4)',
  progress: 'var(--accent-2)',
  done: 'var(--ok)',
};

function firstParagraph(html: string): string {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 'Синопсис пока не написан. Откройте главу — первые строки появятся здесь.';
  return text.length > 240 ? text.slice(0, 240).trimEnd() + '…' : text;
}

function Card({ c, index, href }: { c: Chapter; index: number; href: string }) {
  const synopsis = firstParagraph(c.content);
  return (
    <Link
      to={href}
      style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '14px 16px 16px', position: 'relative', minHeight: 180, display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ position: 'absolute', top: -6, left: 14, width: 10, height: 10, borderRadius: 999, background: 'var(--accent-2)', border: '2px solid var(--bg-deep)' }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ font: '500 10px var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.1em' }}>ГЛ. {String(index + 1).padStart(2, '0')}</span>
        <span style={{ flex: 1 }} />
        <span style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)' }}>{c.words.toLocaleString('ru')} сл</span>
      </div>
      <div style={{ font: '500 16px var(--font-serif)', letterSpacing: '-0.005em', marginBottom: 10 }}>{c.title || 'Без названия'}</div>
      <div style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{synopsis}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border-soft)' }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: STATUS_COLOR[c.status] }} />
        <span style={{ font: '400 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {STATUS_LABEL[c.status]}
        </span>
        <span style={{ flex: 1 }} />
        <Icon name="moremenu" size={14} />
      </div>
    </Link>
  );
}

export default function Corkboard() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

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

  const counts = useMemo(() => {
    if (!chapters) return { all: 0, draft: 0, progress: 0, done: 0 };
    return chapters.reduce(
      (acc, c) => {
        acc.all += 1;
        acc[c.status] += 1;
        return acc;
      },
      { all: 0, draft: 0, progress: 0, done: 0 } as Record<Filter, number>,
    );
  }, [chapters]);

  const visible = useMemo(() => {
    if (!chapters) return [];
    if (filter === 'all') return chapters;
    return chapters.filter((c) => c.status === filter);
  }, [chapters, filter]);

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

  const filterItems: Array<[Filter, string]> = [
    ['all', 'все'],
    ['done', 'готово'],
    ['progress', 'в работе'],
    ['draft', 'черновик'],
  ];

  return (
    <WithMode active="editor">
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <aside className="sb">
          <div className="sb-head">
            <div className="sb-book-title">{book?.title ?? '…'}</div>
            <div className="sb-book-author">
              {counts.all} {counts.all === 1 ? 'глава' : 'глав'} · {(book?.words ?? 0).toLocaleString('ru')} сл
            </div>
          </div>
          <div className="sb-tabs">
            <button className="sb-tab" onClick={() => bookId && navigate(`/books/${bookId}/editor`)}>Список</button>
            <button className="sb-tab sb-tab--on">Доска</button>
            <button className="sb-tab" onClick={() => bookId && navigate(`/books/${bookId}/outline`)}>Структура</button>
          </div>
          <div style={{ padding: '18px 18px 14px', color: 'var(--ink-3)', fontSize: 12, lineHeight: 1.6 }}>
            На доске — главы как индексные карточки. Двойной щелчок — открыть в редакторе.
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Фильтр</div>
            {filterItems.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={'sb-item' + (filter === key ? ' sb-item--on' : '')}
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
              >
                <span />
                <span className="sb-item-title" style={{ textTransform: 'capitalize' }}>{label}</span>
                <span className="sb-item-meta">{counts[key]}</span>
              </button>
            ))}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)' }}>Доска глав</span>
              <span className="chip">{counts.done} готово · {counts.progress} в работе · {counts.draft} черновик</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" onClick={onCreate}><Icon name="plus" size={14} /> Новая глава</button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '28px 32px', background: 'repeating-linear-gradient(45deg, var(--bg) 0 24px, var(--bg-deep) 24px 25px)' }}>
            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'oklch(0.65 0.18 25 / 0.10)', color: 'var(--danger)', fontSize: 13 }}>
                {error}
              </div>
            )}

            {!chapters && !error && <div style={{ color: 'var(--ink-3)' }}>Загрузка…</div>}

            {chapters && chapters.length === 0 && (
              <div style={{ padding: '64px 32px', textAlign: 'center', border: '1px dashed var(--border-strong)', borderRadius: 12, color: 'var(--ink-3)', background: 'var(--bg)' }}>
                <div style={{ font: '500 18px var(--font-serif)', color: 'var(--ink-2)', marginBottom: 8 }}>Доска пуста.</div>
                <div style={{ marginBottom: 16, fontSize: 13 }}>Создайте первую главу — она появится здесь карточкой.</div>
                <button className="btn btn--primary" onClick={onCreate}>
                  <Icon name="plus" size={14} /> Новая глава
                </button>
              </div>
            )}

            {chapters && chapters.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {visible.map((c) => {
                  const index = chapters.findIndex((x) => x.id === c.id);
                  return (
                    <Card
                      key={c.id}
                      c={c}
                      index={index}
                      href={`/books/${bookId}/editor?chapter=${c.id}`}
                    />
                  );
                })}
              </div>
            )}

            {chapters && chapters.length > 0 && visible.length === 0 && (
              <div style={{ marginTop: 24, color: 'var(--ink-3)', fontSize: 13 }}>
                В этом статусе пока нет глав.
              </div>
            )}
          </div>
        </main>
      </div>
    </WithMode>
  );
}
