import { useState, useCallback } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { WithMode } from '../components/Chrome';
import { Sidebar } from '../components/Chrome';
import { createNote, updateNote, deleteNote, type Note, type NoteKind } from '../lib/notes';
import { QUERY_KEYS, useBook, useChapters, useNotes } from '../lib/queries';

type BaseKind = 'idea' | 'question' | 'todo' | 'important';

const BASE_KINDS: BaseKind[] = ['idea', 'question', 'todo', 'important'];

const KIND_LABELS: Record<NoteKind, string> = {
  idea: 'Идея',
  question: 'Вопрос',
  todo: 'TODO',
  important: 'Важно',
  custom: 'Своё',
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
  return n.kind === 'custom' ? (n.custom_label || 'Своё') : KIND_LABELS[n.kind];
}

export default function Notes() {
  const { id: bookId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const { data: notes, error: notesError } = useNotes(bookId);
  const [error, setError] = useState<string | null>(null);
  const queryError = (bookError ?? chaptersError ?? notesError)?.message ?? null;

  // Форма создания
  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState<NoteKind>('idea');
  const [formText, setFormText] = useState('');
  const [formCustomLabel, setFormCustomLabel] = useState('');
  const [formCustomColor, setFormCustomColor] = useState<BaseKind>('idea');
  const [saving, setSaving] = useState(false);

  // Модальное окно
  const [modalNote, setModalNote] = useState<Note | null>(null);
  const [modalEditing, setModalEditing] = useState(false);
  const [modalEditKind, setModalEditKind] = useState<NoteKind>('idea');
  const [modalEditText, setModalEditText] = useState('');
  const [modalEditCustomLabel, setModalEditCustomLabel] = useState('');
  const [modalEditCustomColor, setModalEditCustomColor] = useState<BaseKind>('idea');

  const [filterKind, setFilterKind] = useState<NoteKind | 'all'>('all');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; text: string } | null>(null);

  const handleSelectChapter = useCallback((id: string) => {
    setActiveChapterId(prev => prev === id ? null : id);
  }, []);

  const handleAdd = async () => {
    if (!bookId || !formText.trim()) return;
    setSaving(true);
    try {
      const note = await createNote(
        bookId, formKind, formText.trim(),
        formKind === 'custom' ? formCustomLabel : undefined,
        formKind === 'custom' ? formCustomColor : undefined,
        activeChapterId ?? undefined,
      );
      queryClient.setQueryData<Note[]>(QUERY_KEYS.notes(bookId), (prev) => [note, ...(prev ?? [])]);
      setFormText('');
      setFormCustomLabel('');
      setFormCustomColor('idea');
      setShowForm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!bookId) return;
    queryClient.setQueryData<Note[]>(QUERY_KEYS.notes(bookId), (prev) => prev?.filter((n) => n.id !== id) ?? []);
    deleteNote(id).catch(() => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(bookId) });
    });
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
    if (!modalNote || !modalEditText.trim() || !bookId) return;
    setSaving(true);
    try {
      const updated = await updateNote(
        modalNote.id, modalEditKind, modalEditText.trim(),
        modalEditKind === 'custom' ? modalEditCustomLabel : undefined,
        modalEditKind === 'custom' ? modalEditCustomColor : undefined,
      );
      queryClient.setQueryData<Note[]>(QUERY_KEYS.notes(bookId), (prev) =>
        prev?.map((n) => (n.id === modalNote.id ? updated : n)) ?? []
      );
      setModalNote(updated);
      setModalEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleModalDelete = (id: string) => {
    const note = (notes ?? []).find((n) => n.id === id);
    setConfirmDelete({ id, text: note?.text ?? '' });
  };

  if (!bookId) return <Navigate to="/books" replace />;

  const displayError = error ?? queryError;

  if (displayError) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)' }}>Ошибка: {displayError}</div>
      </div>
    );
  }

  if (!book || notes === undefined || !chapters) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink-3)', padding: 32 }}>
        Загрузка…
      </div>
    );
  }

  const chapterFiltered = activeChapterId ? (notes ?? []).filter(n => n.chapter_id === activeChapterId) : (notes ?? []);
  const filtered = filterKind === 'all' ? chapterFiltered : chapterFiltered.filter((n) => n.kind === filterKind);
  const activeChapter = chapters?.find(c => c.id === activeChapterId) ?? null;

  const colorSwatch = (color: BaseKind, selected: string, onSelect: (c: BaseKind) => void) => (
    <button
      key={color}
      onClick={() => onSelect(color)}
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
            onClick={() => onSelect(k)}
            style={{
              fontSize: fs, padding: pad, borderRadius: 20,
              border: `1px solid ${activeKind === k ? KIND_COLORS[k] : 'var(--border)'}`,
              background: activeKind === k ? KIND_COLORS_SOFT[k] : 'transparent',
              color: activeKind === k ? KIND_COLORS[k] : 'var(--ink-3)',
              cursor: 'pointer',
            }}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
        <button
          onClick={() => onSelect('custom')}
          style={{
            fontSize: fs, padding: pad, borderRadius: 20,
            border: `1px solid ${activeKind === 'custom' ? 'var(--ink-3)' : 'var(--border)'}`,
            background: activeKind === 'custom' ? 'var(--surface)' : 'transparent',
            color: activeKind === 'custom' ? 'var(--ink)' : 'var(--ink-3)',
            cursor: 'pointer',
          }}
        >
          + Тип
        </button>
      </div>
    );
  };

  return (
    <WithMode>
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <Sidebar
          book={book}
          chapters={chapters}
          activeChapterId={activeChapterId}
          bookHref={`/books/${bookId}/editor`}
          chapterActions={{ onSelectChapter: handleSelectChapter }}
        />
        <main className="as-main" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 24px', borderBottom: '1px solid var(--border-soft)',
            flexShrink: 0,
          }}>
            <span style={{ font: '600 15px var(--font)', color: 'var(--ink)' }}>Заметки</span>
            <span style={{ font: '13px var(--font)', color: 'var(--ink-4)' }}>{filtered.length}</span>
            {activeChapter && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--ink-2)' }}>
                <span>{activeChapter.title || 'Без названия'}</span>
                <button
                  onClick={() => setActiveChapterId(null)}
                  style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: '0 2px', fontSize: 14, lineHeight: 1 }}
                  title="Сбросить фильтр"
                >×</button>
              </div>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', ...BASE_KINDS, 'custom'] as Array<NoteKind | 'all'>).map((k) => (
                <button
                  key={k}
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

          <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
            {showForm && (
              <div style={{
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '16px', marginBottom: 16,
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
                    style={{ fontSize: 12, padding: '5px 14px' }}
                    onClick={handleAdd}
                    disabled={saving || !formText.trim()}
                  >Сохранить</button>
                </div>
              </div>
            )}

            {filtered.length === 0 && !showForm && (
              filterKind !== 'all' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 13, paddingTop: 48 }}>
                  {`Нет заметок типа «${KIND_LABELS[filterKind]}».`}
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
              )
            )}

            {/* Карточки заметок */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {filtered.map((n) => {
                const chapterTitle = n.chapter_id ? (chapters?.find(c => c.id === n.chapter_id)?.title || 'Глава') : null;
                return (
                  <div
                    key={n.id}
                    className="note-card"
                    onClick={() => openModal(n)}
                    style={{
                      background: 'var(--bg-2)',
                      border: `1px solid var(--border)`,
                      borderLeft: `3px solid ${noteColor(n)}`,
                      borderRadius: 8,
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      height: 160,
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Тип + глава */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20,
                        background: noteColorSoft(n), color: noteColor(n),
                        fontWeight: 500, flexShrink: 0,
                      }}>
                        {noteLabel(n)}
                      </span>
                      {chapterTitle && (
                        <span style={{
                          fontSize: 11, color: 'var(--ink-4)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          marginLeft: 'auto',
                        }}>
                          {chapterTitle}
                        </span>
                      )}
                    </div>

                    {/* Превью текста */}
                    <p style={{
                      margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.55,
                      whiteSpace: 'pre-wrap', flex: 1, overflow: 'hidden',
                      display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                    }}>
                      {n.text}
                    </p>

                    {/* Дата */}
                    <span style={{ fontSize: 11, color: 'var(--ink-4)', flexShrink: 0 }}>
                      {new Date(n.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* Модальное окно заметки */}
        {modalNote && (
          <div
            className="note-modal-overlay"
            onClick={closeModal}
          >
            <div
              className="note-modal-panel"
              onClick={(e) => e.stopPropagation()}
              style={{ borderLeft: `4px solid ${noteColor(modalNote)}` }}
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
                      style={{ fontSize: 12, padding: '5px 14px' }}
                      onClick={handleModalSave}
                      disabled={saving || !modalEditText.trim()}
                    >Сохранить</button>
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
                        {chapters?.find(c => c.id === modalNote.chapter_id)?.title || 'Глава'}
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

      {confirmDelete && (
        <ConfirmDialog
          message={
            confirmDelete.text.length > 200
              ? `Удалить заметку?\n\n«${confirmDelete.text.slice(0, 120)}…»\n\nЭто действие нельзя отменить.`
              : 'Удалить заметку? Это действие нельзя отменить.'
          }
          onConfirm={() => {
            handleDelete(confirmDelete.id);
            setConfirmDelete(null);
            closeModal();
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </WithMode>
  );
}
