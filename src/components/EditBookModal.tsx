import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { ErrorBanner } from './ErrorBanner';
import { GenrePicker } from './GenrePicker';
import { CoverPicker, COVERS } from './CoverPicker';
import { useEscapeToClose } from '../lib/useEscapeToClose';
import { trapTab, useModalFocus } from '../lib/useModalFocus';
import { overlayVariants, modalPanelVariants } from '../lib/motion';
import type { Book } from '../lib/supabase';

export interface EditBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book | null;
  onSave: (patch: {
    title: string;
    author: string | null;
    genres: string[];
    goal: number;
    cover: string;
  }) => Promise<void>;
  onDelete?: () => void;
  onUploadCover?: (file: File) => Promise<string | null>;
}

export function EditBookModal({
  isOpen,
  onClose,
  book,
  onSave,
  onDelete,
  onUploadCover,
}: EditBookModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [goal, setGoal] = useState<number>(0);
  const [cover, setCover] = useState<string>(COVERS[0]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && !wasOpen && book) {
      setTitle(book.title || '');
      setAuthor(book.author || '');
      setGenres(book.genres ?? (book.genre ? [book.genre] : []));
      setGoal(book.goal || 0);
      setCover(book.cover || COVERS[0]);
      setError(null);
      setSaving(false);
      setUploadingCover(false);
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isOpen, book]);

  useEscapeToClose(isOpen, () => {
    if (!saving) onClose();
  });

  useModalFocus(isOpen, panelRef);

  if (!isOpen || !book) return null;

  const handleCoverFileSelect = async (file: File) => {
    if (!onUploadCover) return;
    setUploadingCover(true);
    setError(null);
    try {
      const url = await onUploadCover(file);
      if (url) {
        setCover(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить обложку');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Пожалуйста, укажите название книги');
      titleInputRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        title: trimmedTitle,
        author: author.trim() || null,
        genres,
        goal: Math.max(0, goal),
        cover,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        role="presentation"
        variants={overlayVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="modal-overlay"
        onClick={() => {
          if (!saving) onClose();
        }}
      >
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-book-modal-title"
          tabIndex={-1}
          variants={modalPanelVariants}
          className="modal-panel book-passport-modal"
          style={{
            width: 580,
            maxWidth: 'calc(100vw - 28px)',
            padding: 0,
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => trapTab(e)}
        >
          {/* Header */}
          <div
            className="fork-modal-header"
            style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid var(--border-soft)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              background: 'var(--surface)',
            }}
          >
            <div>
              <h2
                id="edit-book-modal-title"
                style={{
                  font: '600 20px var(--font-serif)',
                  letterSpacing: '-0.01em',
                  color: 'var(--ink)',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                Паспорт книги
              </h2>
              <p
                style={{
                  font: '400 13px/1.5 var(--font-ui)',
                  color: 'var(--ink-3)',
                  margin: '4px 0 0 0',
                }}
              >
                Редактирование параметров и метаданных произведения
              </p>
            </div>

            <button
              type="button"
              className="tb-btn"
              onClick={onClose}
              disabled={saving}
              aria-label="Закрыть"
              style={{ width: 32, height: 32, flexShrink: 0 }}
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          {/* Body */}
          <div
            className="fork-modal-body"
            style={{
              padding: '20px 24px',
              maxHeight: 'calc(90vh - 120px)',
              overflowY: 'auto',
            }}
          >
            {error && <ErrorBanner message={error} style={{ marginBottom: 16 }} />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Название */}
              <div>
                <label
                  htmlFor="edit-book-title"
                  className="label"
                >
                  Название произведения <span style={{ color: 'var(--accent)' }}>*</span>
                </label>
                <input
                  id="edit-book-title"
                  ref={titleInputRef}
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && title.trim()) void handleSave();
                  }}
                  maxLength={120}
                  disabled={saving}
                />
              </div>

              {/* Автор */}
              <div>
                <label htmlFor="edit-book-author" className="label">
                  Автор
                </label>
                <input
                  id="edit-book-author"
                  className="input"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Из профиля"
                  maxLength={120}
                  disabled={saving}
                />
              </div>

              {/* Цель по словам */}
              <div>
                <label htmlFor="edit-book-goal" className="label">
                  Цель по объёму книги (слов)
                </label>
                <input
                  id="edit-book-goal"
                  className="input"
                  type="number"
                  min={0}
                  step={1000}
                  value={goal || ''}
                  placeholder="например 70000 (необязательно)"
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setGoal(val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0));
                  }}
                  disabled={saving}
                />
                <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Рассказ 1–10 тыс. · Новелла 10–20 тыс. · Повесть 20–50 тыс. · Роман 50–120 тыс. · Эпос / сага 120–300 тыс. слов
                </div>
              </div>

              {/* Жанры */}
              <div>
                <GenrePicker value={genres} onChange={setGenres} />
              </div>

              {/* Обложка */}
              <div>
                <CoverPicker
                  value={cover}
                  onChange={setCover}
                  uploading={uploadingCover}
                  onFileSelect={onUploadCover ? handleCoverFileSelect : undefined}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="fork-modal-footer"
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-soft)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: 'var(--surface)',
            }}
          >
            <div>
              {onDelete && (
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  onClick={onDelete}
                  disabled={saving}
                >
                  Удалить книгу
                </button>
              )}
            </div>

            <div className="fork-modal-footer-actions" style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onClose}
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSave}
                disabled={saving || !title.trim()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {saving && <span className="btn-spinner" />}
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
