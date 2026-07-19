import { useEffect, useMemo, useRef, useState } from 'react';
import { useDropdownPosition } from '../lib/useDropdownPosition';
import { useErrorState } from '../lib/useErrorState';
import { ErrorBanner } from '../components/ErrorBanner';
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
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../components/Icon';
import { WithMode, Sidebar } from '../components/Chrome';
import { MobileSidebarDrawer } from '../components/MobileSidebarDrawer';
import { useResponsive } from '../lib/useResponsive';
import { useAuth } from '../lib/auth';
import { createChapter, deleteChapter, reorderChapters, updateChapter, type ChapterMeta, type ChapterStatus } from '../lib/chapters';
import { QUERY_KEYS, useBook, useChapters } from '../lib/queries';
import {
  createChapterWithCache,
  deleteChapterWithCache,
  invalidateChaptersCache,
} from '../lib/chapterMutations';
import { plural } from '../lib/i18n';

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


const STATUS_ORDER: ChapterStatus[] = ['draft', 'progress', 'done'];

function SortableCorkCard({
  c,
  index,
  href,
  onStatusChange,
  onDeleteChapter,
  onSynopsisChange,
  dragEnabled,
}: {
  c: ChapterMeta;
  index: number;
  href: string;
  onStatusChange: (id: string, status: ChapterStatus) => void;
  onDeleteChapter: (id: string) => void;
  onSynopsisChange: (id: string, synopsis: string) => void;
  dragEnabled: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editingSynopsis, setEditingSynopsis] = useState(false);
  const [synopsisValue, setSynopsisValue] = useState('');
  const menuRef = useRef<HTMLButtonElement>(null);
  const dropdownStyle = useDropdownPosition(menuRef, menuOpen ? 'open' : null, 100);

  const startSynopsisEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    setSynopsisValue(c.synopsis ?? '');
    setEditingSynopsis(true);
  };

  const commitSynopsis = () => {
    setEditingSynopsis(false);
    onSynopsisChange(c.id, synopsisValue.trim());
  };

  const handleSynopsisKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitSynopsis(); }
    if (e.key === 'Escape') { setEditingSynopsis(false); }
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
    disabled: !dragEnabled,
  });

  useEffect(() => {
    if (!menuOpen) {
      setDeleteConfirm(false);
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuOpen(false); setDeleteConfirm(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [menuOpen]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={{
        position: 'relative',
        background: 'var(--surface)',
        border: '1px solid var(--border-soft)',
        borderRadius: 8,
        minHeight: 180,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
    >
      {dragEnabled && (
        <button
          type="button"
          {...listeners}
          className="cork-card__drag"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
            color: 'var(--ink-4)',
            padding: 0,
            zIndex: 2,
            borderRadius: 4,
            touchAction: 'none',
          }}
          title="Перетащить"
          aria-label="Перетащить"
        >
          <Icon name="drag" size={12} />
        </button>
      )}

      <Link
        to={href}
        style={{ display: 'block', padding: '14px 16px 10px', position: 'relative' }}
      >
        <div style={{ position: 'absolute', top: -6, left: 14, width: 10, height: 10, borderRadius: 999, background: 'var(--accent-2)', border: '2px solid var(--bg-deep)' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span style={{ font: '500 10px var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.1em' }}>ГЛ. {String(index + 1).padStart(2, '0')}</span>
          <span style={{ flex: 1 }} />
          <span style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', marginRight: dragEnabled ? 22 : 0 }}>{c.words.toLocaleString('ru')} сл</span>
        </div>
        <div style={{ font: '500 16px var(--font-serif)', letterSpacing: '-0.005em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.title || 'Без названия'}</div>
      </Link>

      <div style={{ padding: '8px 16px 48px', minHeight: 80 }}>
        {editingSynopsis ? (
          <textarea
            autoFocus
            value={synopsisValue}
            onChange={(e) => setSynopsisValue(e.target.value)}
            onBlur={commitSynopsis}
            onKeyDown={handleSynopsisKeyDown}
            aria-label={`Краткое содержание: ${c.title || 'Без названия'}`}
            placeholder="Напишите о чём эта глава…"
            style={{
              width: '100%',
              minHeight: 80,
              resize: 'vertical',
              background: 'var(--bg-deep)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '6px 8px',
              font: '400 12.5px/1.55 var(--font-ui)',
              color: 'var(--ink)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={startSynopsisEdit}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') startSynopsisEdit(e as unknown as React.MouseEvent); }}
            title="Нажмите, чтобы редактировать синопсис"
            style={{
              fontSize: 12.5,
              color: c.synopsis ? 'var(--ink-2)' : 'var(--ink-4)',
              lineHeight: 1.55,
              display: '-webkit-box',
              WebkitLineClamp: 5,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              cursor: 'text',
              fontStyle: c.synopsis ? 'normal' : 'italic',
            }}
          >
            {c.synopsis || 'Нет синопсиса — нажмите, чтобы добавить'}
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px 14px', borderTop: '1px dashed var(--border-soft)' }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: STATUS_COLOR[c.status], flexShrink: 0 }} />
        <span style={{ font: '400 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {STATUS_LABEL[c.status]}
        </span>
        <span style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <button
            ref={menuRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, margin: -4, background: menuOpen ? 'var(--bg-deep)' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: 4, color: 'var(--ink-3)' }}
            title="Изменить статус"
            aria-label="Изменить статус"
          >
            <Icon name="moremenu" size={14} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onMouseDown={() => { setMenuOpen(false); setDeleteConfirm(false); }} />
              {dropdownStyle && <div role="menu" aria-label="Статус главы" style={{ ...dropdownStyle, background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 6, padding: 4, minWidth: 148, boxShadow: '0 4px 20px oklch(0 0 0 / 0.18)' }}>
              <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 8px 6px' }}>Статус</div>
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitemradio"
                  aria-checked={c.status === s}
                  onClick={() => { onStatusChange(c.id, s); setMenuOpen(false); }}
                  className="ctx-item"
                  style={c.status === s ? { background: 'var(--bg-deep)' } : undefined}
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
                      style={{ flex: 1, fontSize: 11, padding: '5px 0', background: 'var(--danger)', color: 'oklch(0.98 0 0)', border: 'none', borderRadius: 4, cursor: 'pointer', font: '500 11px var(--font-ui)' }}
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
                  className="ctx-item ctx-item--danger"
                >
                  Удалить главу
                </button>
              )}
              </div>}
            </>
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
  const { error: mutationError, setError } = useErrorState();
  const error = chaptersError?.message ?? mutationError;
  const { isMobile } = useResponsive();
  const [sbOpen, setSbOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

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
      if (bookId) invalidateChaptersCache(queryClient, bookId);
    });
  };

  const onDeleteChapter = async (id: string) => {
    if (bookId) deleteChapterWithCache(queryClient, bookId, id);
    await deleteChapter(id).catch((e: Error) => {
      setError(e.message);
      if (bookId) invalidateChaptersCache(queryClient, bookId);
    });
  };

  const onSynopsisChange = async (id: string, synopsis: string) => {
    if (bookId) {
      queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(bookId), (prev) =>
        prev ? prev.map((c) => (c.id === id ? { ...c, synopsis } : c)) : prev
      );
    }
    await updateChapter(id, { synopsis }).catch((e: Error) => {
      setError(e.message);
      if (bookId) invalidateChaptersCache(queryClient, bookId);
    });
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
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      invalidateChaptersCache(queryClient, bookId);
    }
  };

  const creatingRef = useRef(false);
  const onCreate = async () => {
    if (!bookId || !user || creatingRef.current) return;
    creatingRef.current = true;
    try {
      const nums = (chapters ?? []).map((c) => c.title.match(/^Глава (\d+)$/)).filter(Boolean).map((m) => parseInt(m![1]));
      const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      const created = await createChapter(bookId, user.id, {
        title: `Глава ${nextNum}`,
        position: chapters?.length ?? 0,
      });
      createChapterWithCache(queryClient, bookId, created);
      navigate(`/books/${bookId}/editor?chapter=${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      creatingRef.current = false;
    }
  };

  const filterItems: Array<[Filter, string]> = [
    ['all', 'все'],
    ['done', 'готово'],
    ['progress', 'в работе'],
    ['draft', 'черновик'],
  ];

  const dragEnabled = filter === 'all';

  return (
    <WithMode>
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        {!isMobile && <Sidebar book={book} subtitle={`${counts.all} ${plural(counts.all, 'глава', 'главы', 'глав')} · ${(book?.words ?? 0).toLocaleString('ru')} сл`}>
          <div className="sb-tabs">
            <button className="sb-tab" onClick={() => bookId && navigate(`/books/${bookId}/outline`)}>Структура</button>
            <button className="sb-tab sb-tab--on" aria-current="true">Доска</button>
          </div>
          <div style={{ padding: '18px 18px 14px', color: 'var(--ink-3)', fontSize: 12, lineHeight: 1.6 }}>
            На доске — главы как индексные карточки. Щелчок по карточке — открыть в редакторе.
          </div>
        </Sidebar>}

        <main style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', background: 'var(--bg)' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
              {isMobile && (
                <button type="button" className="tb-btn" onClick={() => setSbOpen(true)} title="Навигация" aria-label="Навигация" style={{ flexShrink: 0 }}>
                  <Icon name="panel" size={16} />
                </button>
              )}
              <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', whiteSpace: 'nowrap' }}>Доска глав</span>
              {!isMobile && <span className="tb-sep" />}
              {!isMobile && (
                <div className="tb-grp" style={{ border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
                  {filterItems.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={'tb-btn' + (filter === key ? ' tb-btn--on' : '')}
                      aria-pressed={filter === key}
                      style={{ borderRadius: 0, textTransform: 'capitalize' }}
                    >
                      {label}
                      <span style={{ color: 'var(--ink-4)' }}>{counts[key]}</span>
                    </button>
                  ))}
                </div>
              )}
              {!dragEnabled && !isMobile && (
                <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                  перетаскивание доступно при фильтре «все»
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button className="btn" onClick={onCreate} aria-label="Новая глава">{isMobile ? <Icon name="plus" size={14} /> : <><Icon name="plus" size={14} /> Новая глава</>}</button>
            </div>
          </div>
          {/* Фильтры на мобилке были скрыты совсем (!isMobile), без альтернативы.
              Не сжимаем их в один ряд с заголовком (нет места под 4 кнопки+счётчики)
              и не делаем горизонтально скроллящимися (нежелательно) — выносим в
              отдельную полноширинную строку с flex-wrap, места достаточно без обрезки. */}
          {isMobile && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--border-soft)' }}>
              {filterItems.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={'tb-btn' + (filter === key ? ' tb-btn--on' : '')}
                  aria-pressed={filter === key}
                  style={{ border: '1px solid var(--border)', borderRadius: 7, textTransform: 'capitalize' }}
                >
                  {label}
                  <span style={{ color: 'var(--ink-4)' }}>{counts[key]}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '28px 32px', background: 'repeating-linear-gradient(45deg, var(--bg) 0 24px, var(--bg-deep) 24px 25px)' }}>
            {error && (
              <ErrorBanner message={error} style={{ marginBottom: 16 }} />
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={chapters.map((c) => c.id)} strategy={rectSortingStrategy}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 14 : 20 }}>
                    {visible.map((c) => {
                      const index = chapters.findIndex((x) => x.id === c.id);
                      return (
                        <SortableCorkCard
                          key={c.id}
                          c={c}
                          index={index}
                          href={`/books/${bookId}/editor?chapter=${c.id}`}
                          onStatusChange={onStatusChange}
                          onDeleteChapter={onDeleteChapter}
                          onSynopsisChange={onSynopsisChange}
                          dragEnabled={dragEnabled}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {chapters && chapters.length > 0 && visible.length === 0 && (
              <div style={{ marginTop: 24, color: 'var(--ink-3)', fontSize: 13 }}>
                В этом статусе пока нет глав.
              </div>
            )}
          </div>
        </main>
      </div>

      <MobileSidebarDrawer
        open={sbOpen}
        onClose={() => setSbOpen(false)}
        book={book}
        subtitle={`${counts.all} ${plural(counts.all, 'глава', 'главы', 'глав')} · ${(book?.words ?? 0).toLocaleString('ru')} сл`}
      >
        <div className="sb-tabs">
          <button className="sb-tab" onClick={() => { setSbOpen(false); if (bookId) navigate(`/books/${bookId}/outline`); }}>Структура</button>
          <button className="sb-tab sb-tab--on" aria-current="true">Доска</button>
        </div>
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ font: '500 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Фильтр</div>
          {filterItems.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setFilter(key); setSbOpen(false); }}
              className={'sb-item' + (filter === key ? ' sb-item--on' : '')}
              aria-pressed={filter === key}
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <span />
              <span className="sb-item-title" style={{ textTransform: 'capitalize' }}>{label}</span>
              <span className="sb-item-meta">{counts[key]}</span>
            </button>
          ))}
        </div>
      </MobileSidebarDrawer>
    </WithMode>
  );
}
