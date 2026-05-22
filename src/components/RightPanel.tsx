import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from './Icon';
import { createNote, updateNote, deleteNote, type Note, type NoteKind } from '../lib/notes';
import { useNotes, QUERY_KEYS } from '../lib/queries';

interface RightPanelProps {
  bookId?: string;
}

export function RightPanel({ bookId }: RightPanelProps) {
  const labels: Record<string, string> = { idea: 'Идея', question: 'Вопрос', todo: 'TODO', important: 'Важно' };
  const queryClient = useQueryClient();
  const { data: notes = [] } = useNotes(bookId);
  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState<NoteKind>('idea');
  const [formText, setFormText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<NoteKind>('idea');
  const [editText, setEditText] = useState('');

  const invalidate = () => {
    if (bookId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(bookId) });
  };

  const handleAdd = async () => {
    if (!bookId || !formText.trim()) return;
    setSaving(true);
    try {
      await createNote(bookId, formKind, formText.trim());
      invalidate();
      setFormText('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote(id);
      invalidate();
    } catch (e) {
      console.error('Не удалось удалить заметку:', e);
    }
  };

  const startEdit = (n: Note) => {
    setEditingId(n.id);
    setEditKind(n.kind);
    setEditText(n.text);
  };

  const handleUpdate = async () => {
    if (!editingId || !editText.trim()) return;
    setSaving(true);
    try {
      await updateNote(editingId, editKind, editText.trim());
      invalidate();
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="rp">
      <div className="rp-head">
        <span className="rp-tab rp-tab--on">Заметки на полях</span>
        <span style={{ flex: 1 }} />
        <button className="tb-btn" onClick={() => setShowForm((v) => !v)} title="Добавить заметку" aria-label="Добавить заметку">
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="rp-body">
        {showForm && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <select
              value={formKind}
              onChange={(e) => setFormKind(e.target.value as NoteKind)}
              className="input"
              style={{ fontSize: 12 }}
            >
              <option value="idea">Идея</option>
              <option value="question">Вопрос</option>
              <option value="todo">TODO</option>
              <option value="important">Важно</option>
            </select>
            <textarea
              className="input"
              rows={3}
              placeholder="Текст заметки…"
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              style={{ fontSize: 12, resize: 'vertical' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                className="btn btn--ghost"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => { setShowForm(false); setFormText(''); }}
              >Отмена</button>
              <button
                className="btn btn--primary"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={handleAdd}
                disabled={saving || !formText.trim()}
              >Сохранить</button>
            </div>
          </div>
        )}
        {notes.length === 0 && !showForm && (
          <div style={{ padding: '24px 14px', color: 'var(--ink-4)', fontSize: 12, textAlign: 'center' }}>Нет заметок</div>
        )}
        {notes.map((n) => (
          <div key={n.id} className={'mn' + (n.kind !== 'idea' ? ' mn--' + n.kind : '')}>
            {editingId === n.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select
                  value={editKind}
                  onChange={(e) => setEditKind(e.target.value as NoteKind)}
                  className="input"
                  style={{ fontSize: 12 }}
                >
                  <option value="idea">Идея</option>
                  <option value="question">Вопрос</option>
                  <option value="todo">TODO</option>
                  <option value="important">Важно</option>
                </select>
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
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => setEditingId(null)}
                  >Отмена</button>
                  <button
                    className="btn btn--primary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={handleUpdate}
                    disabled={saving || !editText.trim()}
                  >Сохранить</button>
                </div>
              </div>
            ) : (
              <>
                <div className="mn-head">
                  <span className="mn-label">{labels[n.kind]}</span>
                  <span style={{ color: 'var(--ink-4)', margin: '0 4px' }}>·</span>
                  <span className="mn-time">{new Date(n.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                  <span style={{ flex: 1 }} />
                  <button
                    className="tb-btn"
                    onClick={() => startEdit(n)}
                    title="Редактировать заметку"
                    aria-label="Редактировать заметку"
                    style={{ opacity: 0.5, padding: '2px 5px', minWidth: 24 }}
                  ><Icon name="pencil" size={11} /></button>
                  <button
                    className="tb-btn"
                    onClick={() => handleDelete(n.id)}
                    title="Удалить заметку"
                    aria-label="Удалить заметку"
                    style={{ opacity: 0.5, fontSize: 14, lineHeight: 1, padding: '2px 6px', minWidth: 24 }}
                  >×</button>
                </div>
                <div className="mn-text">{n.text}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
