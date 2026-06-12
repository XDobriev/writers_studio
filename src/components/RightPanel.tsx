import { useState, useEffect, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from './Icon';
import { ConfirmDialog } from './ConfirmDialog';
import { createNote, updateNote, deleteNote, type Note, type NoteKind } from '../lib/notes';
import { useNotes, QUERY_KEYS } from '../lib/queries';

const VersionsPanel = lazy(() => import('./VersionsPanel').then(m => ({ default: m.VersionsPanel })));
import { useErrorState } from '../lib/useErrorState';

interface RightPanelProps {
  bookId?: string;
  chapterId?: string;
  chapterTitle?: string;
  userId?: string;
  currentContent?: string;
  isPro?: boolean;
  onRestoreContent?: (content: string) => void;
  /** Инкрементируется из EditorHybrid по Ctrl+Shift+N → открывает форму заметки */
  openNoteAt?: number;
}

export function RightPanel({ bookId, chapterId, chapterTitle, userId, currentContent, isPro, onRestoreContent, openNoteAt }: RightPanelProps) {
  const labels: Record<string, string> = { idea: 'Идея', question: 'Вопрос', todo: 'TODO', important: 'Важно', custom: 'Прочее' };
  const KIND_COLORS: Record<string, string> = {
    idea: 'var(--note-idea)', question: 'var(--note-question)',
    todo: 'var(--note-todo)', important: 'var(--note-important)',
  };
  const KIND_COLORS_SOFT: Record<string, string> = {
    idea: 'var(--note-idea-soft)', question: 'var(--note-question-soft)',
    todo: 'var(--note-todo-soft)', important: 'var(--note-important-soft)',
  };
  const queryClient = useQueryClient();
  const { error: noteError, setError: setNoteError, clearError: clearNoteError } = useErrorState();
  const { data: allNotes = [] } = useNotes(bookId);
  const notes = chapterId ? allNotes.filter(n => n.chapter_id === chapterId) : allNotes;
  const [activeTab, setActiveTab] = useState<'notes' | 'versions'>('notes');
  const [showForm, setShowForm] = useState(false);
  const [formKind, setFormKind] = useState<NoteKind>('idea');
  const [formText, setFormText] = useState('');
  const [formCustomLabel, setFormCustomLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<NoteKind>('idea');
  const [editText, setEditText] = useState('');
  const [editCustomLabel, setEditCustomLabel] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; text: string } | null>(null);

  // Ctrl+Shift+N из EditorHybrid — открыть вкладку заметок и показать форму
  useEffect(() => {
    if (!openNoteAt) return;
    setActiveTab('notes');
    setShowForm(true);
  }, [openNoteAt]);

  const invalidate = () => {
    if (bookId) queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(bookId) });
  };

  const handleAdd = async () => {
    if (!bookId || !formText.trim()) return;
    setSaving(true);
    try {
      await createNote(bookId, formKind, formText.trim(),
        formKind === 'custom' ? formCustomLabel || undefined : undefined,
        undefined, chapterId);
      invalidate();
      setFormText('');
      setFormCustomLabel('');
      setFormKind('idea');
      setShowForm(false);
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Не удалось сохранить заметку');
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
      setNoteError(e instanceof Error ? e.message : 'Не удалось удалить заметку');
    }
  };

  const startEdit = (n: Note) => {
    setEditingId(n.id);
    setEditKind(n.kind);
    setEditText(n.text);
    setEditCustomLabel(n.custom_label ?? '');
  };

  const handleUpdate = async () => {
    if (!editingId || !editText.trim()) return;
    setSaving(true);
    try {
      await updateNote(editingId, editKind, editText.trim(),
        editKind === 'custom' ? editCustomLabel || undefined : undefined);
      invalidate();
      setEditingId(null);
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Не удалось обновить заметку');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="rp">
      <div className="rp-head">
        <button
          type="button"
          className={'rp-tab' + (activeTab === 'notes' ? ' rp-tab--on' : '')}
          onClick={() => setActiveTab('notes')}
        >
          Заметки
        </button>
        <button
          type="button"
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
        {noteError && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '8px 10px 0', padding: '6px 10px', borderRadius: 6, background: 'oklch(0.65 0.18 25 / 0.10)', border: '1px solid oklch(0.65 0.18 25 / 0.25)', color: 'var(--danger)', fontSize: 12 }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noteError}</span>
            <button onClick={clearNoteError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0 }} title="Закрыть" aria-label="Закрыть">×</button>
          </div>
        )}
        {activeTab === 'versions' && chapterId && bookId && userId && (
          <Suspense fallback={<div style={{ padding: 24, color: 'var(--ink-4)', fontSize: 12, textAlign: 'center' }}>Загрузка…</div>}>
          <VersionsPanel
            chapterId={chapterId}
            chapterTitle={chapterTitle}
            bookId={bookId}
            userId={userId}
            currentContent={currentContent ?? ''}
            isPro={isPro ?? false}
            onRestoreContent={onRestoreContent}
          />
          </Suspense>
        )}
        {activeTab === 'versions' && !chapterId && (
          <div style={{ padding: '24px 14px', color: 'var(--ink-4)', fontSize: 12, textAlign: 'center' }}>
            Выберите главу
          </div>
        )}
        {activeTab === 'notes' && (
          <>
            {showForm && (
              <div style={{ padding: '12px 14px 14px', borderBottom: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'nowrap', alignItems: 'center' }}>
                  {(['idea', 'question', 'todo', 'important'] as NoteKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFormKind(k)}
                      style={{
                        fontSize: 10.5, padding: '2.5px 7px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
                        border: `1px solid ${formKind === k ? KIND_COLORS[k] : 'var(--border)'}`,
                        background: formKind === k ? KIND_COLORS_SOFT[k] : 'transparent',
                        color: formKind === k ? KIND_COLORS[k] : 'var(--ink-3)',
                        transition: 'color 0.12s, border-color 0.12s, background 0.12s',
                      }}
                    >{labels[k]}</button>
                  ))}
                  <span style={{ width: 1, height: 12, background: 'var(--border)', flexShrink: 0, margin: '0 1px' }} />
                  <button
                    type="button"
                    onClick={() => setFormKind('custom')}
                    style={{
                      fontSize: 10.5, padding: '2.5px 7px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
                      border: `1px solid ${formKind === 'custom' ? 'var(--border-strong)' : 'var(--border)'}`,
                      background: formKind === 'custom' ? 'var(--surface-2)' : 'transparent',
                      color: formKind === 'custom' ? 'var(--ink)' : 'var(--ink-3)',
                      transition: 'color 0.12s, border-color 0.12s, background 0.12s',
                    }}
                  >{labels.custom}</button>
                </div>
                {formKind === 'custom' && (
                  <input
                    className="input"
                    placeholder="Название типа…"
                    value={formCustomLabel}
                    onChange={(e) => setFormCustomLabel(e.target.value)}
                    style={{ fontSize: 12, padding: '5px 10px' }}
                    maxLength={32}
                  />
                )}
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
                    onClick={() => { setShowForm(false); setFormText(''); setFormCustomLabel(''); setFormKind('idea'); }}
                  >Отмена</button>
                  <button
                    className="btn btn--primary"
                    style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={handleAdd}
                    disabled={saving || !formText.trim()}
                  >
                    {saving && <span className="btn-spinner" style={{ width: 10, height: 10 }} />}
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                  </button>
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
                <div style={{ display: 'flex', gap: 3, flexWrap: 'nowrap', alignItems: 'center' }}>
                  {(['idea', 'question', 'todo', 'important'] as NoteKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setEditKind(k)}
                      style={{
                        fontSize: 10.5, padding: '2.5px 7px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
                        border: `1px solid ${editKind === k ? KIND_COLORS[k] : 'var(--border)'}`,
                        background: editKind === k ? KIND_COLORS_SOFT[k] : 'transparent',
                        color: editKind === k ? KIND_COLORS[k] : 'var(--ink-3)',
                        transition: 'color 0.12s, border-color 0.12s, background 0.12s',
                      }}
                    >{labels[k]}</button>
                  ))}
                  <span style={{ width: 1, height: 12, background: 'var(--border)', flexShrink: 0, margin: '0 1px' }} />
                  <button
                    type="button"
                    onClick={() => setEditKind('custom')}
                    style={{
                      fontSize: 10.5, padding: '2.5px 7px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
                      border: `1px solid ${editKind === 'custom' ? 'var(--border-strong)' : 'var(--border)'}`,
                      background: editKind === 'custom' ? 'var(--surface-2)' : 'transparent',
                      color: editKind === 'custom' ? 'var(--ink)' : 'var(--ink-3)',
                      transition: 'color 0.12s, border-color 0.12s, background 0.12s',
                    }}
                  >{labels.custom}</button>
                </div>
                {editKind === 'custom' && (
                  <input
                    className="input"
                    placeholder="Название типа…"
                    value={editCustomLabel}
                    onChange={(e) => setEditCustomLabel(e.target.value)}
                    style={{ fontSize: 12, padding: '5px 10px' }}
                    maxLength={32}
                  />
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
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => setEditingId(null)}
                  >Отмена</button>
                  <button
                    className="btn btn--primary"
                    style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={handleUpdate}
                    disabled={saving || !editText.trim()}
                  >
                    {saving && <span className="btn-spinner" style={{ width: 10, height: 10 }} />}
                    {saving ? 'Сохраняем…' : 'Сохранить'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mn-head">
                  <span className="mn-label">{n.kind === 'custom' ? (n.custom_label || labels.custom) : labels[n.kind]}</span>
                  <span className="mn-time">{new Date(n.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                  <button
                    className="tb-btn"
                    onClick={() => startEdit(n)}
                    title="Редактировать заметку"
                    aria-label="Редактировать заметку"
                    style={{ opacity: 0.45, padding: '2px 4px', minWidth: 22 }}
                  ><Icon name="pencil" size={10} /></button>
                  <button
                    className="tb-btn"
                    onClick={() => requestDelete(n)}
                    title="Удалить заметку"
                    aria-label="Удалить заметку"
                    style={{ opacity: 0.45, fontSize: 13, lineHeight: 1, padding: '2px 5px', minWidth: 22 }}
                  >×</button>
                </div>
                <div className="mn-text">{n.text}</div>
              </>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        message={
          confirmDelete && confirmDelete.text.length > 200
            ? `Удалить заметку?\n\n«${confirmDelete.text.slice(0, 120)}…»\n\nЭто действие нельзя отменить.`
            : 'Удалить заметку?\nЭто действие нельзя отменить.'
        }
        onConfirm={() => {
          void handleDelete(confirmDelete!.id);
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </aside>
  );
}
