import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useResponsive } from '../lib/useResponsive';
import { Navigate, useParams } from 'react-router-dom';
import { useCreateOnMount } from '../lib/useCreateOnMount';
import { useErrorState } from '../lib/useErrorState';
import { ErrorBanner } from '../components/ErrorBanner';
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
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { WithMode } from '../components/Chrome';
import { Sidebar } from '../components/Chrome';
import { type Note, type NoteKind } from '../lib/notes';
import { useBook, useChapters, useNotes } from '../lib/queries';
import { useNoteMutations } from '../lib/useNoteMutations';

type BaseKind = 'idea' | 'question' | 'todo' | 'important';

const BASE_KINDS: BaseKind[] = ['idea', 'question', 'todo', 'important'];

const KIND_LABELS: Record<NoteKind, string> = {
  idea: 'Идея',
  question: 'Вопрос',
  todo: 'TODO',
  important: 'Важно',
  custom: 'Прочее',
};

const KIND_COLORS: Record<NoteKind, string> = {
  idea: 'var(--note-idea)',
  question: 'var(--note-question)',
  todo: 'var(--note-todo)',
  important: 'var(--note-important)',
  custom: 'var(--note-idea)',
};

const KIND_COLORS_SOFT: Record<NoteKind, string> = {
  idea: 'var(--note-idea-soft)',
  question: 'var(--note-question-soft)',
  todo: 'var(--note-todo-soft)',
  important: 'var(--note-important-soft)',
  custom: 'var(--note-idea-soft)',
};

function noteColor(n: Note): string {
  if (n.kind === 'custom' && n.custom_color) return KIND_COLORS[n.custom_color as NoteKind] ?? KIND_COLORS.idea;
  return KIND_COLORS[n.kind];
}
function noteColorSoft(n: Note): string {
  if (n.kind === 'custom' && n.custom_color) return KIND_COLORS_SOFT[n.custom_color as NoteKind] ?? KIND_COLORS_SOFT.idea;
  return KIND_COLORS_SOFT[n.kind];
}
function noteLabel(n: Note): string {
  return n.kind === 'custom' ? (n.custom_label || KIND_LABELS.custom) : KIND_LABELS[n.kind];
}

interface SortableNoteCardProps {
  note: Note;
  chapterTitle: string | null;
  color: string;
  colorSoft: string;
  label: string;
  onOpen: (n: Note) => void;
}

function SortableNoteCard({ note, chapterTitle, color, colorSoft, label, onOpen }: SortableNoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });

  return (
    <div
      ref={setNodeRef}
      className="note-card"
      onClick={() => onOpen(note)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        background: `color-mix(in oklch, ${color} 6%, var(--surface))`,
        border: `1px solid color-mix(in oklch, ${color} 28%, var(--border-soft))`,
        borderRadius: 8,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        height: NOTE_CARD_HEIGHT,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 20,
          background: colorSoft, color,
          fontWeight: 500, flexShrink: 0,
        }}>
          {label}
        </span>
        {chapterTitle && (
          <span style={{
            fontSize: 11, color: 'var(--ink-4)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginLeft: 'auto', paddingRight: 20,
          }}>
            {chapterTitle}
          </span>
        )}
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Переместить"
          title="Переместить"
          style={{
            position: 'absolute', top: 10, right: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 20, height: 20,
            background: 'none', border: 'none',
            color: 'var(--ink-4)', cursor: 'grab',
            padding: 0, borderRadius: 4,
            flexShrink: 0,
          }}
        >
          <Icon name="drag" size={13} />
        </button>
      </div>

      <p style={{
        margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.55,
        whiteSpace: 'pre-wrap', flex: 1, overflow: 'hidden',
        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
      }}>
        {note.text}
      </p>

      <span style={{ fontSize: 11, color: 'var(--ink-4)', flexShrink: 0 }}>
        {new Date(note.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
      </span>
    </div>
  );
}

const NOTE_CARD_HEIGHT = 160;
const NOTE_GRID_GAP = 12;
const NOTE_CARD_MIN_WIDTH = 260;
const NOTE_GRID_PADDING = 24;

function NotesGrid({ notes, chapterMap, onOpen }: {
  notes: Note[];
  chapterMap: Map<string, string>;
  onOpen: (n: Note) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columnCount = containerWidth > 0
    ? Math.max(1, Math.floor((containerWidth + NOTE_GRID_GAP) / (NOTE_CARD_MIN_WIDTH + NOTE_GRID_GAP)))
    : 3;
  const rowCount = Math.ceil(notes.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => NOTE_CARD_HEIGHT + NOTE_GRID_GAP,
    overscan: 2,
  });

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `20px ${NOTE_GRID_PADDING}px 28px` }}
    >
      <SortableContext items={notes.map(n => n.id)} strategy={rectSortingStrategy}>
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIdx = virtualRow.index * columnCount;
            const rowNotes = notes.slice(startIdx, startIdx + columnCount);
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: NOTE_CARD_HEIGHT,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                  gap: NOTE_GRID_GAP,
                }}
              >
                {rowNotes.map(n => (
                  <SortableNoteCard
                    key={n.id}
                    note={n}
                    chapterTitle={n.chapter_id ? (chapterMap.get(n.chapter_id) ?? 'Глава') : null}
                    color={noteColor(n)}
                    colorSoft={noteColorSoft(n)}
                    label={noteLabel(n)}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
}

export default function Notes() {
  const { id: bookId } = useParams<{ id: string }>();
  const { isMobile } = useResponsive();

  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const { data: notes, error: notesError } = useNotes(bookId);
  const { error, setError, clearError } = useErrorState();
  const { isSaving, onAdd, onUpdate, onDelete, onReorder } = useNoteMutations({ bookId, setError });
  const queryError = (bookError ?? chaptersError ?? notesError)?.message ?? null;

  // Форма создания
  const [showForm, setShowForm] = useState(false);
  useCreateOnMount(() => setShowForm(true));
  const [formKind, setFormKind] = useState<NoteKind>('idea');
  const [formText, setFormText] = useState('');
  const [formCustomLabel, setFormCustomLabel] = useState('');
  const [formCustomColor, setFormCustomColor] = useState<BaseKind>('idea');

  // Модальное окно
  const [modalNote, setModalNote] = useState<Note | null>(null);
  const [modalEditing, setModalEditing] = useState(false);
  const [modalEditKind, setModalEditKind] = useState<NoteKind>('idea');
  const [modalEditText, setModalEditText] = useState('');
  const [modalEditCustomLabel, setModalEditCustomLabel] = useState('');
  const [modalEditCustomColor, setModalEditCustomColor] = useState<BaseKind>('idea');
  const modalPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (modalNote) modalPanelRef.current?.focus(); }, [modalNote]);

  const [filterKind, setFilterKind] = useState<NoteKind | 'all'>('all');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; text: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const onDragEnd = (event: DragEndEvent) => {
    if (notes) void onReorder(notes, event);
  };

  const handleSelectChapter = useCallback((id: string) => {
    setActiveChapterId(prev => prev === id ? null : id);
  }, []);

  const handleAdd = async () => {
    if (!formText.trim()) return;
    const note = await onAdd(
      formKind, formText,
      formKind === 'custom' ? formCustomLabel : undefined,
      formKind === 'custom' ? formCustomColor : undefined,
      activeChapterId ?? undefined,
    );
    if (note) {
      setFormText('');
      setFormCustomLabel('');
      setFormCustomColor('idea');
      setShowForm(false);
    }
  };

  const openModal = (n: Note) => {
    setModalNote(n);
    setModalEditing(false);
  };

  const closeModal = () => {
    setModalNote(null);
    setModalEditing(false);
  };

  const startModalEdit = (n: Note) => {
    setModalEditKind(n.kind);
    setModalEditText(n.text);
    setModalEditCustomLabel(n.custom_label ?? '');
    setModalEditCustomColor((n.custom_color as BaseKind) ?? 'idea');
    setModalEditing(true);
  };

  const handleModalSave = async () => {
    if (!modalNote || !modalEditText.trim()) return;
    const updated = await onUpdate(
      modalNote.id, modalEditKind, modalEditText,
      modalEditKind === 'custom' ? modalEditCustomLabel : undefined,
      modalEditKind === 'custom' ? modalEditCustomColor : undefined,
    );
    if (updated) {
      setModalNote(updated);
      setModalEditing(false);
    }
  };

  const handleModalDelete = (id: string) => {
    const note = (notes ?? []).find((n) => n.id === id);
    setConfirmDelete({ id, text: note?.text ?? '' });
  };

  const chapterMap = useMemo(() => {
    const m = new Map<string, string>();
    (chapters ?? []).forEach(c => m.set(c.id, c.title || 'Глава'));
    return m;
  }, [chapters]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (queryError) {
    return (
      <div className="as page-fill--error">
        <div style={{ color: 'var(--danger)' }}>Ошибка: {queryError}</div>
        <a href={bookId ? `/books/${bookId}` : '/books'} style={{ color: 'var(--accent)', fontSize: 13 }}>← К книге</a>
      </div>
    );
  }

  if (!book || notes === undefined || !chapters) {
    return (
      <div className="as page-fill--center">
        <div className="page-spinner" />
      </div>
    );
  }

  const chapterFiltered = activeChapterId ? notes.filter(n => n.chapter_id === activeChapterId) : notes;
  const filtered = filterKind === 'all' ? chapterFiltered : chapterFiltered.filter((n) => n.kind === filterKind);
  const activeChapterTitle = activeChapterId ? (chapterMap.get(activeChapterId) ?? 'Без названия') : null;

  const colorSwatch = (color: BaseKind, selected: string, onSelect: (c: BaseKind) => void) => (
    <button
      key={color}
      type="button"
      onClick={() => onSelect(color)}
      aria-label={KIND_LABELS[color]}
      title={KIND_LABELS[color]}
      style={{
        width: 16, height: 16, borderRadius: '50%',
        background: KIND_COLORS[color],
        border: `2px solid ${selected === color ? 'var(--ink)' : 'transparent'}`,
        outline: selected === color ? '1px solid var(--bg)' : 'none',
        outlineOffset: -3,
        cursor: 'pointer', flexShrink: 0,
      }}
    />
  );

  const kindChips = (
    activeKind: NoteKind,
    onSelect: (k: NoteKind) => void,
    size: 'sm' | 'xs' = 'sm',
  ) => {
    const pad = size === 'xs' ? '3px 10px' : '4px 12px';
    const fs = size === 'xs' ? 11 : 12;
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {BASE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onSelect(k)}
            className="note-kind-chip"
            style={{
              fontSize: fs, padding: pad,
              border: `1px solid ${activeKind === k ? KIND_COLORS[k] : 'var(--border)'}`,
              ...(activeKind === k ? { background: KIND_COLORS_SOFT[k], color: KIND_COLORS[k] } : { color: 'var(--ink-3)' }),
            }}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSelect('custom')}
          className="note-kind-chip"
          style={{
            fontSize: fs, padding: pad,
            border: `1px solid ${activeKind === 'custom' ? 'var(--ink-3)' : 'var(--border)'}`,
            ...(activeKind === 'custom' ? { background: 'var(--surface)', color: 'var(--ink)' } : { color: 'var(--ink-3)' }),
          }}
        >
          + Тип
        </button>
      </div>
    );
  };

  return (
    <WithMode>
      <div className="as as-app as-app--no-right" style={{ height: '100%', gridTemplateColumns: isMobile ? '1fr' : undefined }}>
        {!isMobile && (
          <Sidebar
            book={book}
            chapters={chapters}
            activeChapterId={activeChapterId}
            chapterActions={{ onSelectChapter: handleSelectChapter }}
            subtitle={`заметки · ${notes.length}`}
          />
        )}
        <main className="as-main" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 24px', borderBottom: '1px solid var(--border-soft)',
            flexShrink: 0,
          }}>
            <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)' }}>Заметки</span>
            <span className="chip">{filtered.length}</span>
            {activeChapterTitle && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--ink-2)' }}>
                <span>{activeChapterTitle}</span>
                <button
                  onClick={() => setActiveChapterId(null)}
                  style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: '3px 5px', fontSize: 14, lineHeight: 1, minHeight: 24 }}
                  aria-label="Сбросить фильтр"
                  title="Сбросить фильтр"
                >×</button>
              </div>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', ...BASE_KINDS, 'custom'] as Array<NoteKind | 'all'>).map((k) => (
                <button
                  key={k}
                  aria-pressed={filterKind === k}
                  className={'btn btn--ghost' + (filterKind === k ? ' btn--active' : '')}
                  style={{ fontSize: 12, padding: '3px 10px', opacity: filterKind === k ? 1 : 0.6 }}
                  onClick={() => setFilterKind(k)}
                >
                  {k === 'all' ? 'Все' : KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <button
              className="btn btn--primary"
              style={{ fontSize: 12, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setShowForm(true)}
            >
              <Icon name="plus" size={13} />
              Добавить
            </button>
          </div>

          {/* статичная область: ошибки + форма */}
          {(error || showForm) && (
            <div style={{ flexShrink: 0, padding: '16px 24px 0' }}>
              {error && (
                <ErrorBanner message={error} onDismiss={clearError} style={{ marginBottom: 12 }} />
              )}
              {showForm && (
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '16px',
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  {kindChips(formKind, setFormKind)}
                  {formKind === 'custom' && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className="input"
                        placeholder="Название типа…"
                        value={formCustomLabel}
                        onChange={(e) => setFormCustomLabel(e.target.value)}
                        style={{ fontSize: 12, flex: 1, padding: '5px 10px' }}
                        maxLength={32}
                      />
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        {BASE_KINDS.map((c) => colorSwatch(c, formCustomColor, setFormCustomColor))}
                      </div>
                    </div>
                  )}
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Текст заметки…"
                    value={formText}
                    onChange={(e) => setFormText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void handleAdd(); }
                      if (e.key === 'Escape') { setShowForm(false); setFormText(''); setFormCustomLabel(''); setFormCustomColor('idea'); setFormKind('idea'); }
                    }}
                    style={{ fontSize: 13, resize: 'vertical' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn--ghost"
                      style={{ fontSize: 12, padding: '5px 14px' }}
                      onClick={() => { setShowForm(false); setFormText(''); setFormCustomLabel(''); setFormCustomColor('idea'); setFormKind('idea'); }}
                    >Отмена</button>
                    <button
                      className="btn btn--primary"
                      style={{ fontSize: 12, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={handleAdd}
                      disabled={isSaving || !formText.trim()}
                    >
                      {isSaving && <span className="btn-spinner" style={{ width: 11, height: 11 }} />}
                      {isSaving ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* основной контент: заглушка пустого состояния или виртуализированная сетка */}
          {filtered.length === 0 && !showForm ? (
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {filterKind !== 'all' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--ink-4)', fontSize: 13 }}>
                  {`Нет заметок типа «${KIND_LABELS[filterKind]}».`}
                  <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => setFilterKind('all')}>Сбросить фильтр</button>
                </div>
              ) : activeChapterId ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '48px 24px' }}>
                  <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'var(--surface)', color: 'var(--ink-4)', border: '1px solid var(--border-soft)' }}>
                    <Icon name="note" size={22} />
                  </div>
                  <div style={{ textAlign: 'center', maxWidth: 260 }}>
                    <div style={{ font: '500 14px var(--font-ui)', color: 'var(--ink-2)', marginBottom: 6 }}>Заметок для этой главы нет</div>
                    <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.6 }}>Добавьте первую заметку — она сразу привяжется к текущей главе</div>
                  </div>
                  <button className="btn btn--primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowForm(true)}>
                    <Icon name="plus" size={13} /> Добавить заметку
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '48px 24px' }}>
                  <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, background: 'var(--surface)', color: 'var(--ink-4)', border: '1px solid var(--border-soft)' }}>
                    <Icon name="note" size={22} />
                  </div>
                  <div style={{ textAlign: 'center', maxWidth: 260 }}>
                    <div style={{ font: '500 14px var(--font-ui)', color: 'var(--ink-2)', marginBottom: 6 }}>Заметок пока нет</div>
                    <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', lineHeight: 1.6 }}>Записывайте идеи, вопросы и важные мысли по ходу работы над книгой</div>
                  </div>
                  <button className="btn btn--primary" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowForm(true)}>
                    <Icon name="plus" size={13} /> Добавить заметку
                  </button>
                </div>
              )}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <NotesGrid notes={filtered} chapterMap={chapterMap} onOpen={openModal} />
            </DndContext>
          )}
        </main>

        {/* Модальное окно заметки */}
        {modalNote && (
          <div
            className="note-modal-overlay"
            onClick={closeModal}
          >
            <div
              ref={modalPanelRef}
              role="dialog"
              aria-modal="true"
              aria-label={`Заметка: ${noteLabel(modalNote)}`}
              tabIndex={-1}
              className="note-modal-panel"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { closeModal(); return; }
                if (e.key === 'Tab') {
                  const focusable = e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
                  const arr = Array.from(focusable);
                  if (!arr.length) return;
                  const first = arr[0], last = arr[arr.length - 1];
                  if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
                    e.preventDefault();
                    (e.shiftKey ? last : first).focus();
                  }
                }
              }}
              style={{
                borderColor: `color-mix(in oklch, ${noteColor(modalNote)} 35%, var(--border-soft))`,
                background: `color-mix(in oklch, ${noteColor(modalNote)} 5%, var(--bg))`,
                outline: 'none',
              }}
            >
              {/* Шапка */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{
                  fontSize: 12, padding: '3px 10px', borderRadius: 20,
                  background: noteColorSoft(modalNote), color: noteColor(modalNote),
                  fontWeight: 500,
                }}>
                  {noteLabel(modalNote)}
                </span>
                <span style={{ flex: 1 }} />
                <button
                  className="tb-btn"
                  style={{ width: 28, height: 28, fontSize: 16 }}
                  onClick={closeModal}
                  aria-label="Закрыть"
                  title="Закрыть"
                >×</button>
              </div>

              {modalEditing ? (
                /* Режим редактирования */
                <>
                  {kindChips(modalEditKind, setModalEditKind, 'xs')}
                  {modalEditKind === 'custom' && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className="input"
                        placeholder="Название типа…"
                        value={modalEditCustomLabel}
                        onChange={(e) => setModalEditCustomLabel(e.target.value)}
                        style={{ fontSize: 12, flex: 1, padding: '5px 10px' }}
                        maxLength={32}
                      />
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        {BASE_KINDS.map((c) => colorSwatch(c, modalEditCustomColor, setModalEditCustomColor))}
                      </div>
                    </div>
                  )}
                  <textarea
                    className="input"
                    rows={6}
                    value={modalEditText}
                    onChange={(e) => setModalEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void handleModalSave(); }
                      if (e.key === 'Escape') setModalEditing(false);
                    }}
                    aria-label="Текст заметки"
                    style={{ fontSize: 13, resize: 'vertical', flex: 1 }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button
                      className="btn btn--ghost"
                      style={{ fontSize: 12, padding: '5px 14px' }}
                      onClick={() => setModalEditing(false)}
                    >Отмена</button>
                    <button
                      className="btn btn--primary"
                      style={{ fontSize: 12, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={handleModalSave}
                      disabled={isSaving || !modalEditText.trim()}
                    >
                      {isSaving && <span className="btn-spinner" style={{ width: 11, height: 11 }} />}
                      {isSaving ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                  </div>
                </>
              ) : (
                /* Режим просмотра */
                <>
                  <p style={{
                    margin: 0, fontSize: 14, color: 'var(--ink)',
                    lineHeight: 1.65, whiteSpace: 'pre-wrap',
                    flex: 1, overflowY: 'auto',
                  }}>
                    {modalNote.text}
                  </p>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    paddingTop: 14, borderTop: '1px solid var(--border-soft)',
                    flexShrink: 0,
                  }}>
                    {modalNote.chapter_id && (
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                        {chapterMap.get(modalNote.chapter_id) ?? 'Глава'}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                      {new Date(modalNote.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                    <span style={{ flex: 1 }} />
                    <button
                      className="btn btn--ghost"
                      style={{ fontSize: 12, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => startModalEdit(modalNote)}
                    >
                      <Icon name="pencil" size={12} />
                      Изменить
                    </button>
                    <button
                      className="btn btn--ghost"
                      style={{ fontSize: 12, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 5, color: 'var(--danger)' }}
                      onClick={() => handleModalDelete(modalNote.id)}
                    >
                      <Icon name="trash" size={12} />
                      Удалить
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        message={
          confirmDelete && confirmDelete.text.length > 200
            ? `Удалить заметку?\n\n«${confirmDelete.text.slice(0, 120)}…»\n\nЭто действие нельзя отменить.`
            : 'Удалить заметку?\nЭто действие нельзя отменить.'
        }
        onConfirm={() => {
          onDelete(confirmDelete!.id);
          setConfirmDelete(null);
          closeModal();
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </WithMode>
  );
}
