import { useState, useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const { data: notes, error: notesError } = useNotes(bookId);
  const [error, setError] = useState<string | null>(null);
  const queryError = (bookError ?? chaptersError ?? notesError)?.message ?? null;

  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState<NoteKind>('idea');
  const [formText, setFormText] = useState('');
  const [formCustomLabel, setFormCustomLabel] = useState('');
  const [formCustomColor, setFormCustomColor] = useState<BaseKind>('idea');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<NoteKind>('idea');
  const [editText, setEditText] = useState('');
  const [editCustomLabel, setEditCustomLabel] = useState('');
  const [editCustomColor, setEditCustomColor] = useState<BaseKind>('idea');

  const [filterKind, setFilterKind] = useState<NoteKind | 'all'>('all');

  const handleSelectChapter = useCallback((id: string) => {
    navigate(`/books/${bookId}/editor?chapter=${id}`);
  }, [bookId, navigate]);

  const handleAdd = async () => {
    if (!bookId || !formText.trim()) return;
    setSaving(true);
    try {
      const note = await createNote(
        bookId, formKind, formText.trim(),
        formKind === 'custom' ? formCustomLabel : undefined,
        formKind === 'custom' ? formCustomColor : undefined,
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

  const startEdit = (n: Note) => {
    setEditingId(n.id);
    setEditKind(n.kind);
    setEditText(n.text);
    setEditCustomLabel(n.custom_label ?? '');
    setEditCustomColor((n.custom_color as BaseKind) ?? 'idea');
  };

  const handleUpdate = async () => {
    if (!editingId || !editText.trim() || !bookId) return;
    setSaving(true);
    try {
      const updated = await updateNote(
        editingId, editKind, editText.trim(),
        editKind === 'custom' ? editCustomLabel : undefined,
        editKind === 'custom' ? editCustomColor : undefined,
      );
      queryClient.setQueryData<Note[]>(QUERY_KEYS.notes(bookId), (prev) =>
        prev?.map((n) => (n.id === editingId ? updated : n)) ?? []
      );
      setEditingId(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
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

  const filtered = filterKind === 'all' ? notes : (notes ?? []).filter((n) => n.kind === filterKind);

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
            <span style={{ font: '13px var(--font)', color: 'var(--ink-4)' }}>{notes.length}</span>
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
              filterKind === 'all' ? (
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
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontSize: 13, paddingTop: 48 }}>
                  {`Нет заметок типа «${KIND_LABELS[filterKind]}».`}
                </div>
              )
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {filtered.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: 'var(--bg-2)', border: `1px solid var(--border)`,
                    borderLeft: `3px solid ${noteColor(n)}`,
                    borderRadius: 8, padding: '14px 16px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                >
                  {editingId === n.id ? (
                    <>
                      {kindChips(editKind, setEditKind, 'xs')}
                      {editKind === 'custom' && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            className="input"
                            placeholder="Название типа…"
                            value={editCustomLabel}
                            onChange={(e) => setEditCustomLabel(e.target.value)}
                            style={{ fontSize: 11, flex: 1, padding: '4px 8px' }}
                            maxLength={32}
                          />
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {BASE_KINDS.map((c) => colorSwatch(c, editCustomColor, setEditCustomColor))}
                          </div>
                        </div>
                      )}
                      <textarea
                        className="input"
                        rows={3}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        style={{ fontSize: 12, resize: 'vertical' }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn--ghost"
                          style={{ fontSize: 11, padding: '3px 10px' }}
                          onClick={() => setEditingId(null)}
                        >Отмена</button>
                        <button
                          className="btn btn--primary"
                          style={{ fontSize: 11, padding: '3px 10px' }}
                          onClick={handleUpdate}
                          disabled={saving || !editText.trim()}
                        >Сохранить</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 20,
                          background: noteColorSoft(n), color: noteColor(n),
                          fontWeight: 500,
                        }}>
                          {noteLabel(n)}
                        </span>
                        <span style={{ flex: 1 }} />
                        <button
                          className="tb-btn"
                          style={{ width: 24, height: 24 }}
                          onClick={() => startEdit(n)}
                          title="Редактировать"
                        >
                          <Icon name="pencil" size={12} />
                        </button>
                        <button
                          className="tb-btn"
                          style={{ width: 24, height: 24 }}
                          onClick={() => handleDelete(n.id)}
                          title="Удалить"
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                        {n.text}
                      </p>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                        {new Date(n.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </WithMode>
  );
}
