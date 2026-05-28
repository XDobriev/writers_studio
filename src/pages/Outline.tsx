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
import { WithMode, SidebarFoot, SidebarNav } from '../components/Chrome';
import { LogoMark } from '../components/LogoMark';
import { useAuth } from '../lib/auth';
import { createChapter, deleteChapter, reorderChapters, updateChapter, type ChapterMeta, type ChapterStatus } from '../lib/chapters';
import { QUERY_KEYS, useBook, useChapters } from '../lib/queries';
import { plural } from '../lib/useWritingStats';

const STATUS_COLOR: Record<ChapterStatus, string> = {
  draft: 'var(--ink-4)',
  progress: 'var(--accent-2)',
  done: 'var(--ok)',
};

interface RowProps {
  chapter: ChapterMeta;
  index: number;
  bookId: string;
  menuFor: string | null;
  setMenuFor: (id: string | null) => void;
  deleteConfirmFor: string | null;
  setDeleteConfirmFor: (id: string | null) => void;
  onDelete: (id: string) => void;
  menuRef: React.RefObject<HTMLDivElement>;
  renameFor: string | null;
  setRenameFor: (id: string | null) => void;
  onRename: (id: string, title: string) => void;
}

const MENU_ITEM: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '6px 8px', width: '100%', borderRadius: 4,
  background: 'transparent', cursor: 'pointer',
  font: '400 12px var(--font-ui)', border: 'none', textAlign: 'left',
};

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
  renameFor,
  setRenameFor,
  onRename,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (renameFor === c.id) {
      setRenameValue(c.title);
      setTimeout(() => renameInputRef.current?.select(), 0);
    }
  }, [renameFor, c.id, c.title]);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== c.title) onRename(c.id, trimmed);
    setRenameFor(null);
  };

  const isRenaming = renameFor === c.id;

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
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 44, flexShrink: 0,
          background: 'transparent', border: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
          color: 'var(--ink-4)', padding: 0,
        }}
        title="Перетащить"
      >
        <Icon name="drag" size={12} />
      </button>

      {isRenaming ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '8px 40px 8px 0' }}>
          <span style={{ font: '500 12px var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.04em', minWidth: 28 }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenameFor(null);
            }}
            style={{
              flex: 1, font: '500 15px var(--font-serif)', color: 'var(--ink)',
              background: 'var(--bg-deep)', border: '1px solid var(--accent)',
              borderRadius: 4, padding: '2px 6px', outline: 'none',
            }}
          />
        </div>
      ) : (
        <Link
          to={`/books/${bookId}/editor?chapter=${c.id}`}
          style={{
            flex: 1, display: 'flex', alignItems: 'flex-start', gap: 14,
            padding: '12px 40px 12px 0', borderRadius: 8, textDecoration: 'none',
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
      )}

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
            background: 'var(--bg-deep)', border: '1px solid var(--border-strong)',
            borderRadius: 6, padding: 4, minWidth: 160,
            boxShadow: '0 8px 24px oklch(0.05 0.01 50 / 0.35)',
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
                    style={{ flex: 1, fontSize: 11, padding: '5px 0', background: 'var(--surface)', color: 'var(--ink-2)', border: 'none', borderRadius: 4, cursor: 'pointer', font: '400 11px var(--font-ui)' }}
                  >Отмена</button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setRenameFor(c.id); setMenuFor(null); }}
                  style={{ ...MENU_ITEM, color: 'var(--ink)' }}
                >
                  Переименовать
                </button>
                <div style={{ height: 1, background: 'var(--border-soft)', margin: '4px 0' }} />
                <button
                  type="button"
                  onClick={() => {
                    if (c.words > 0) setDeleteConfirmFor(c.id);
                    else void onDelete(c.id);
                  }}
                  style={{ ...MENU_ITEM, color: 'var(--danger)' }}
                >
                  Удалить главу
                </button>
              </>
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
  const [renameFor, setRenameFor] = useState<string | null>(null);
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
      queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
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
      const nums = (chapters ?? [])
        .map((c) => c.title.match(/^Глава (\d+)$/))
        .filter(Boolean)
        .map((m) => parseInt(m![1]));
      const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      const created = await createChapter(bookId, user.id, {
        title: `Глава ${nextNum}`,
        position: chapters?.length ?? 0,
      });
      const { content: _, ...createdMeta } = created;
      queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) => [...(prev ?? []), createdMeta]);
      navigate(`/books/${bookId}/editor?chapter=${created.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onRename = async (id: string, title: string) => {
    if (!bookId) return;
    queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
      (prev ?? []).map((c) => (c.id === id ? { ...c, title } : c)),
    );
    try {
      await updateChapter(id, { title });
    } catch (e) {
      setError((e as Error).message);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapters(bookId) });
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !bookId || !chapters || active.id === over.id) return;

    const oldIndex = chapters.findIndex((c) => c.id === active.id);
    const newIndex = chapters.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(chapters, oldIndex, newIndex).map((c, i) => ({ ...c, position: i }));

    queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), reordered);

    try {
      await reorderChapters(reordered.map((c) => ({ id: c.id, position: c.position })));
    } catch (e) {
      setError((e as Error).message);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapters(bookId) });
    }
  };

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
              структура · {totals.words.toLocaleString('ru')} / {(book?.goal ?? 0).toLocaleString('ru')} сл
            </div>
          </div>
          <SidebarNav bookId={bookId!} />
          <div className="sb-tabs">
            <button className="sb-tab sb-tab--on">Структура</button>
            <button className="sb-tab" onClick={() => bookId && navigate(`/books/${bookId}/corkboard`)}>Доска</button>
          </div>
          <div style={{ padding: '18px 18px 14px', color: 'var(--ink-3)', fontSize: 12 }}>
            Дерево структуры показывает книгу целиком. Перетащите главы, чтобы изменить порядок.
          </div>
          <div style={{ padding: '4px 14px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="btn" onClick={onCreate}><Icon name="plus" size={13} /> Новая глава</button>
          </div>
        <div style={{ flex: 1 }} />
        <SidebarFoot />
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', background: 'var(--bg)' }}>
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
                    {totals.done} готово · {totals.progress} в работе · {totals.draft} {plural(totals.draft, 'черновик', 'черновика', 'черновиков')}
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
                        renameFor={renameFor}
                        setRenameFor={setRenameFor}
                        onRename={onRename}
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
