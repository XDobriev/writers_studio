import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { WithMode } from '../components/Chrome';
import { LogoMark } from '../components/LogoMark';
import { useAuth } from '../lib/auth';
import { createChapter, deleteChapter, updateChapter, type ChapterMeta, type ChapterStatus } from '../lib/chapters';
import { QUERY_KEYS, useBook, useChapters } from '../lib/queries';
import { plural } from '../lib/useWritingStats';

type Filter = 'all' | ChapterStatus;

const STATUS_LABEL: Record<ChapterStatus, string> = {
  draft: 'черновик',
  progress: 'в работе',
  done: 'готово',
};

const STATUS_COLOR: Record<ChapterStatus, string> = {
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

const STATUS_ORDER: ChapterStatus[] = ['draft', 'progress', 'done'];

function Card({ c, index, href, onStatusChange, onDeleteChapter }: { c: ChapterMeta; index: number; href: string; onStatusChange: (id: string, status: ChapterStatus) => void; onDeleteChapter: (id: string) => void }) {
  const synopsis = firstParagraph('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      setDeleteConfirm(false);
      return;
    }
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setDeleteConfirm(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, minHeight: 180 }}>
      <Link
        to={href}
        style={{ display: 'flex', flexDirection: 'column', padding: '14px 16px 48px', height: '100%', minHeight: 'inherit', position: 'relative' }}
      >
        <div style={{ position: 'absolute', top: -6, left: 14, width: 10, height: 10, borderRadius: 999, background: 'var(--accent-2)', border: '2px solid var(--bg-deep)' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span style={{ font: '500 10px var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.1em' }}>ГЛ. {String(index + 1).padStart(2, '0')}</span>
          <span style={{ flex: 1 }} />
          <span style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)' }}>{c.words.toLocaleString('ru')} сл</span>
        </div>
        <div style={{ font: '500 16px var(--font-serif)', letterSpacing: '-0.005em', marginBottom: 10 }}>{c.title || 'Без названия'}</div>
        <div style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{synopsis}</div>
      </Link>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px 14px', borderTop: '1px dashed var(--border-soft)' }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: STATUS_COLOR[c.status], flexShrink: 0 }} />
        <span style={{ font: '400 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {STATUS_LABEL[c.status]}
        </span>
        <span style={{ flex: 1 }} />
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, margin: -4, background: menuOpen ? 'var(--bg-deep)' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: 4, color: 'var(--ink-3)' }}
            title="Изменить статус"
          >
            <Icon name="moremenu" size={14} />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: 4, minWidth: 148, boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}>
              <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 8px 6px' }}>Статус</div>
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { onStatusChange(c.id, s); setMenuOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', width: '100%', borderRadius: 4, background: c.status === s ? 'var(--bg-deep)' : 'transparent', cursor: 'pointer', font: '400 12px var(--font-ui)', color: 'var(--ink)', border: 'none', textAlign: 'left' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: STATUS_COLOR[s], flexShrink: 0 }} />
                  {STATUS_LABEL[s]}
                  {c.status === s && <span style={{ marginLeft: 'auto', font: '400 10px var(--font-mono)', color: 'var(--ink-4)' }}>✓</span>}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border-soft)', margin: '4px 0' }} />
              {deleteConfirm ? (
                <div style={{ padding: '6px 8px' }}>
                  <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 8, lineHeight: 1.4 }}>
                    Удалить главу? Текст будет потерян.
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => { onDeleteChapter(c.id); setMenuOpen(false); setDeleteConfirm(false); }}
                      style={{ flex: 1, fontSize: 11, padding: '5px 0', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', font: '500 11px var(--font-ui)' }}
                    >Удалить</button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      style={{ flex: 1, fontSize: 11, padding: '5px 0', background: 'var(--bg-deep)', color: 'var(--ink-2)', border: 'none', borderRadius: 4, cursor: 'pointer', font: '400 11px var(--font-ui)' }}
                    >Отмена</button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (c.words > 0) {
                      setDeleteConfirm(true);
                    } else {
                      onDeleteChapter(c.id);
                      setMenuOpen(false);
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', width: '100%', borderRadius: 4, background: 'transparent', cursor: 'pointer', font: '400 12px var(--font-ui)', color: 'var(--danger)', border: 'none', textAlign: 'left' }}
                >
                  Удалить главу
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Corkboard() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const queryClient = useQueryClient();
  const { data: book } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const [mutationError, setError] = useState<string | null>(null);
  const error = chaptersError?.message ?? mutationError;
  const [filter, setFilter] = useState<Filter>('all');

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

  const onStatusChange = async (id: string, status: ChapterStatus) => {
    if (bookId) {
      queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? { ...c, status } : c)) : prev
      );
    }
    await updateChapter(id, { status }).catch((e: Error) => {
      setError(e.message);
      if (bookId) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapters(bookId) });
    });
  };

  const onDeleteChapter = async (id: string) => {
    if (bookId) {
      queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
        prev ? prev.filter((c) => c.id !== id) : prev
      );
    }
    await deleteChapter(id).catch((e: Error) => {
      setError(e.message);
      if (bookId) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapters(bookId) });
    });
  };

  const onCreate = async () => {
    if (!bookId || !user) return;
    try {
      const created = await createChapter(bookId, user.id, {
        title: `Глава ${(chapters?.length ?? 0) + 1}`,
        position: chapters?.length ?? 0,
      });
      const { content: _, ...createdMeta } = created;
      queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) => [...(prev ?? []), createdMeta]);
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
    <WithMode>
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <aside className="sb">
          <div className="sb-head">
            <Link to="/books" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, textDecoration: 'none' }}>
              <LogoMark size={20} />
              <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>авторская студия</span>
            </Link>
            <div className="sb-book-title">{book?.title ?? '…'}</div>
            <div className="sb-book-author">
              {counts.all} {counts.all === 1 ? 'глава' : 'глав'} · {(book?.words ?? 0).toLocaleString('ru')} сл
            </div>
          </div>
          <div className="sb-tabs">
            <button className="sb-tab" onClick={() => bookId && navigate(`/books/${bookId}/outline`)}>Структура</button>
            <button className="sb-tab sb-tab--on">Доска</button>
          </div>
          <div style={{ padding: '18px 18px 14px', color: 'var(--ink-3)', fontSize: 12, lineHeight: 1.6 }}>
            На доске — главы как индексные карточки. Щелчок по карточке — открыть в редакторе.
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
              <span className="chip">{counts.done} готово · {counts.progress} в работе · {counts.draft} {plural(counts.draft, 'черновик', 'черновика', 'черновиков')}</span>
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
                      onStatusChange={onStatusChange}
                      onDeleteChapter={onDeleteChapter}
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
