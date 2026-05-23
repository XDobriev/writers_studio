import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from './Icon';
import { ConfirmDialog } from './ConfirmDialog';
import { createNote, updateNote, deleteNote, type Note, type NoteKind } from '../lib/notes';
import { useNotes, QUERY_KEYS } from '../lib/queries';
import { VersionsPanel } from './VersionsPanel';

interface RightPanelProps {
  bookId?: string;
  chapterId?: string;
  chapterTitle?: string;
  userId?: string;
  currentContent?: string;
  isPro?: boolean;
}

export function RightPanel({ bookId, chapterId, chapterTitle, userId, currentContent, isPro }: RightPanelProps) {
  const labels: Record<string, string> = { idea: 'Идея', question: 'Вопрос', todo: 'TODO', important: 'Важно' };
  const queryClient = useQueryClient();
  const { data: allNotes = [] } = useNotes(bookId);
  const notes = chapterId ? allNotes.filter(n => n.chapter_id === chapterId) : allNotes;
  const [activeTab, setActiveTab] = useState<'notes' | 'versions'>('notes');
  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState<NoteKind>('idea');
  const [formText, setFormText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<NoteKind>('idea');
  const [editText, setEditText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; text: string } | null>(null);

  const invalidate = () => {
    if (bookId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(bookId) });
  };

  const handleAdd = async () => {
    if (!bookId || !formText.trim()) return;
    setSaving(true);
    try {
      await createNote(bookId, formKind, formText.trim(), undefined, undefined, chapterId);
      invalidate();
      setFormText('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (note: Note) => {
    setConfirmDelete({ id: note.id, text: note.text });
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
        <button
          className={'rp-tab' + (activeTab === 'notes' ? ' rp-tab--on' : '')}
          onClick={() => setActiveTab('notes')}
        >
          Заметки
        </button>
        <button
          className={'rp-tab' + (activeTab === 'versions' ? ' rp-tab--on' : '')}
          onClick={() => setActiveTab('versions')}
        >
          Версии
        </button>
        <span style={{ flex: 1 }} />
        {activeTab === 'notes' && (
          <button className="tb-btn" onClick={() => setShowForm((v) => !v)} title="Добавить заметку" aria-label="Добавить заметку">
            <Icon name="plus" size={14} />
          </button>
        )}
      </div>
      <div className="rp-body">
        {activeTab === 'versions' && chapterId && bookId && userId && (
          <VersionsPanel
            chapterId={chapterId}
            chapterTitle={chapterTitle}
            bookId={bookId}
            userId={userId}
            currentContent={currentContent ?? ''}
            isPro={isPro ?? false}
          />
        )}
        {activeTab === 'versions' && !chapterId && (
          <div style={{ padding: '24px 14px', color: 'var(--ink-4)', fontSize: 12, textAlign: 'center' }}>
            Выберите главу
          </div>
        )}
        {activeTab === 'notes' && (
          <>
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
              <div style={{ padding: '24px 14px', color: 'var(--ink-4)', fontSize: 12, textAlign: 'center' }}>
                {chapterId ? 'Заметок для этой главы нет' : 'Нет заметок'}
              </div>
            )}
          </>
        )}
        {activeTab === 'notes' && notes.map((n) => (
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
                    onClick={() => requestDelete(n)}
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

      {confirmDelete && (
        <ConfirmDialog
          message={
            confirmDelete.text.length > 200
              ? `Удалить заметку?\n\n«${confirmDelete.text.slice(0, 120)}…»\n\nЭто действие нельзя отменить.`
              : 'Удалить заметку? Это действие нельзя отменить.'
          }
          onConfirm={() => {
            void handleDelete(confirmDelete.id);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </aside>
  );
}
