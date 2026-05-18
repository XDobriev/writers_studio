import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../components/Icon';
import { WithMode } from '../components/Chrome';
import { useAuth } from '../lib/auth';
import { createChapter, deleteChapter, reorderChapters, type Chapter } from '../lib/chapters';
import { QUERY_KEYS, useBook, useChapters } from '../lib/queries';

const STATUS_COLOR: Record<Chapter['status'], string> = {
  draft: 'var(--ink-4)',
  progress: 'var(--accent-2)',
  done: 'var(--ok)',
};

interface RowProps {
  chapter: Chapter;
  index: number;
  bookId: string;
  menuFor: string | null;
  setMenuFor: (id: string | null) => void;
  deleteConfirmFor: string | null;
  setDeleteConfirmFor: (id: string | null) => void;
  onDelete: (id: string) => void;
  menuRef: React.RefObject<HTMLDivElement>;
}

function SortableChapterRow({
  chapter: c,
  index: i,
  bookId,
  menuFor,
  setMenuFor,
  deleteConfirmFor,
  setDeleteConfirmFor,
  onDelete,
  menuRef,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 8,
      }}
    >
      <button
        type="button"
        {...listeners}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 44,
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          color: 'var(--ink-4)',
          padding: 0,
        }}
        title="Перетащить"
      >
        <Icon name="drag" size={12} />
      </button>

      <Link
        to={`/books/${bookId}/editor?chapter=${c.id}`}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          padding: '12px 40px 12px 0',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        <span style={{ font: '500 12px var(--font-mono)', color: c.status === 'draft' ? 'var(--ink-4)' : 'var(--accent)', letterSpacing: '0.04em', marginTop: 3, minWidth: 28 }}>
          {String(i + 1).padStart(2, '0')}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '500 15px var(--font-serif)', color: c.status === 'draft' ? 'var(--ink-3)' : 'var(--ink)' }}>
            {c.title || 'Без названия'}
          </div>
        </div>
        <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', marginTop: 4 }}>
          {c.words.toLocaleString('ru')} сл
        </span>
        <span style={{ width: 6, height: 6, borderRadius: 999, marginTop: 8, background: STATUS_COLOR[c.status] }} />
      </Link>

      <div
        ref={menuFor === c.id ? menuRef : null}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
      >
        <button
          type="button"
          onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22,
            background: menuFor === c.id ? 'var(--bg-deep)' : 'transparent',
            border: 'none', cursor: 'pointer', borderRadius: 4, color: 'var(--ink-3)',
          }}
          title="Действия"
        >
          <Icon name="moremenu" size={14} />
        </button>

        {menuFor === c.id && (
          <div style={{
            position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 200,
            background: 'var(--surface)', border: '1px solid var(--border-soft)',
            borderRadius: 6, padding: 4, minWidth: 148,
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          }}>
            {deleteConfirmFor === c.id ? (
              <div style={{ padding: '6px 8px' }}>
                <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 8, lineHeight: 1.4 }}>
                  Удалить главу? Текст будет потерян.
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => void onDelete(c.id)}
                    style={{ flex: 1, fontSize: 11, padding: '5px 0', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', font: '500 11px var(--font-ui)' }}
                  >Удалить</button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmFor(null)}
                    style={{ flex: 1, fontSize: 11, padding: '5px 0', background: 'var(--bg-deep)', color: 'var(--ink-2)', border: 'none', borderRadius: 4, cursor: 'pointer', font: '400 11px var(--font-ui)' }}
                  >Отмена</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (c.words > 0) {
                    setDeleteConfirmFor(c.id);
                  } else {
                    void onDelete(c.id);
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
  );
}

export default function Outline() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: book } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const [mutationError, setError] = useState<string | null>(null);
  const error = chaptersError?.message ?? mutationError;
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [deleteConfirmFor, setDeleteConfirmFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    if (!menuFor) {
      setDeleteConfirmFor(null);
      return;
    }
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFor(null);
        setDeleteConfirmFor(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuFor]);

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

  const onDelete = async (id: string) => {
    setMenuFor(null);
    setDeleteConfirmFor(null);
    if (bookId) {
      queryClient.setQueryData<Chapter[]>(QUERY_KEYS.chapters(bookId), (prev) =>
        (prev ?? []).filter((c) => c.id !== id),
      );
    }
    try {
      await deleteChapter(id);
    } catch (e) {
      setError((e as Error).message);
      if (bookId) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapters(bookId) });
    }
  };

  const onCreate = async () => {
    if (!bookId || !user) return;
    try {
      const created = await createChapter(bookId, user.id, {
        title: `Глава ${(chapters?.length ?? 0) + 1}`,
        position: chapters?.length ?? 0,
      });
      queryClient.setQueryData<Chapter[]>(QUERY_KEYS.chapters(bookId), (prev) => [...(prev ?? []), created]);
      navigate(`/books/${bookId}/editor?chapter=${created.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !bookId || !chapters || active.id === over.id) return;

    const oldIndex = chapters.findIndex((c) => c.id === active.id);
    const newIndex = chapters.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(chapters, oldIndex, newIndex).map((c, i) => ({ ...c, position: i }));

    queryClient.setQueryData<Chapter[]>(QUERY_KEYS.chapters(bookId), reordered);

    try {
      await reorderChapters(reordered.map((c) => ({ id: c.id, position: c.position })));
    } catch (e) {
      setError((e as Error).message);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapters(bookId) });
    }
  };

  return (
    <WithMode active="outline" bookId={bookId}>
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
            Дерево структуры показывает книгу целиком. Перетащите главы, чтобы изменить порядок.
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

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {chapters.map((c, i) => (
                      <SortableChapterRow
                        key={c.id}
                        chapter={c}
                        index={i}
                        bookId={bookId!}
                        menuFor={menuFor}
                        setMenuFor={setMenuFor}
                        deleteConfirmFor={deleteConfirmFor}
                        setDeleteConfirmFor={setDeleteConfirmFor}
                        onDelete={onDelete}
                        menuRef={menuRef}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </main>
      </div>
    </WithMode>
  );
}
