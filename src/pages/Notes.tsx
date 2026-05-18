import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { WithMode } from '../components/Chrome';
import { Sidebar } from '../components/Chrome';
import { createNote, updateNote, deleteNote, type Note, type NoteKind } from '../lib/notes';
import { QUERY_KEYS, useBook, useChapters, useNotes } from '../lib/queries';

const KIND_LABELS: Record<NoteKind, string> = {
  idea: 'Идея',
  question: 'Вопрос',
  todo: 'TODO',
  important: 'Важно',
};

const KIND_OPTIONS: NoteKind[] = ['idea', 'question', 'todo', 'important'];

const KIND_COLORS: Record<NoteKind, string> = {
  idea: 'var(--accent)',
  question: 'oklch(0.72 0.18 260)',
  todo: 'oklch(0.72 0.18 140)',
  important: 'oklch(0.65 0.22 30)',
};

export default function Notes() {
  const { id: bookId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const { data: notes, error: notesError } = useNotes(bookId);
  const [error, setError] = useState<string | null>(null);
  const queryError = (bookError ?? chaptersError ?? notesError)?.message ?? null;

  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState<NoteKind>('idea');
  const [formText, setFormText] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<NoteKind>('idea');
  const [editText, setEditText] = useState('');

  const [filterKind, setFilterKind] = useState<NoteKind | 'all'>('all');

  const handleAdd = async () => {
    if (!bookId || !formText.trim()) return;
    setSaving(true);
    try {
      const note = await createNote(bookId, formKind, formText.trim());
      queryClient.setQueryData<Note[]>(QUERY_KEYS.notes(bookId), (prev) => [note, ...(prev ?? [])]);
      setFormText('');
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
  };

  const handleUpdate = async () => {
    if (!editingId || !editText.trim() || !bookId) return;
    setSaving(true);
    try {
      const updated = await updateNote(editingId, editKind, editText.trim());
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

  return (
    <WithMode active="notes" bookId={bookId}>
      <div className="as as-app as-app--no-right" style={{ height: '100%' }}>
        <Sidebar
          book={book}
          chapters={chapters}
          bookHref={`/books/${bookId}/editor`}
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
              {(['all', ...KIND_OPTIONS] as Array<NoteKind | 'all'>).map((k) => (
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
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {KIND_OPTIONS.map((k) => (
                    <button
                      key={k}
                      onClick={() => setFormKind(k)}
                      style={{
                        fontSize: 12, padding: '4px 12px', borderRadius: 20,
                        border: `1px solid ${formKind === k ? KIND_COLORS[k] : 'var(--border)'}`,
                        background: formKind === k ? `${KIND_COLORS[k]}22` : 'transparent',
                        color: formKind === k ? KIND_COLORS[k] : 'var(--ink-3)',
                        cursor: 'pointer',
                      }}
                    >
                      {KIND_LABELS[k]}
                    </button>
                  ))}
                </div>
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
                    onClick={() => { setShowForm(false); setFormText(''); }}
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
              <div style={{ color: 'var(--ink-4)', fontSize: 13, textAlign: 'center', paddingTop: 48 }}>
                {filterKind === 'all' ? 'Нет заметок. Нажмите «Добавить».' : `Нет заметок типа «${KIND_LABELS[filterKind]}».`}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {filtered.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: 'var(--bg-2)', border: `1px solid var(--border)`,
                    borderLeft: `3px solid ${KIND_COLORS[n.kind]}`,
                    borderRadius: 8, padding: '14px 16px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                >
                  {editingId === n.id ? (
                    <>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {KIND_OPTIONS.map((k) => (
                          <button
                            key={k}
                            onClick={() => setEditKind(k)}
                            style={{
                              fontSize: 11, padding: '3px 10px', borderRadius: 20,
                              border: `1px solid ${editKind === k ? KIND_COLORS[k] : 'var(--border)'}`,
                              background: editKind === k ? `${KIND_COLORS[k]}22` : 'transparent',
                              color: editKind === k ? KIND_COLORS[k] : 'var(--ink-3)',
                              cursor: 'pointer',
                            }}
                          >
                            {KIND_LABELS[k]}
                          </button>
                        ))}
                      </div>
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
                          background: `${KIND_COLORS[n.kind]}22`, color: KIND_COLORS[n.kind],
                          fontWeight: 500,
                        }}>
                          {KIND_LABELS[n.kind]}
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
