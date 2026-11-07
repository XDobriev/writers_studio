import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { overlayVariants, modalPanelVariants } from '../lib/motion';
import { useEscapeToClose } from '../lib/useEscapeToClose';
import { trapTab, useModalFocus } from '../lib/useModalFocus';
import { Icon } from './Icon';
import type { ChapterMeta } from '../lib/chapters';
import type { DraftConvertPlacement, DraftInsertPosition } from '../lib/draftScenes';

export interface ConvertDraftModalProps {
  open: boolean;
  chapters: ChapterMeta[];
  onConfirm: (placement: DraftConvertPlacement) => void;
  onCancel: () => void;
}

export function ConvertDraftModal({
  open,
  chapters,
  onConfirm,
  onCancel,
}: ConvertDraftModalProps) {
  const [convertMode, setConvertMode] = useState<'end' | 'start' | 'after'>('end');
  const [afterChapterId, setAfterChapterId] = useState<string>(chapters[chapters.length - 1]?.id ?? '');
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setConvertMode('end');
      if (chapters.length > 0) {
        setAfterChapterId(chapters[chapters.length - 1].id);
      }
    }
  }, [open, chapters]);

  useEscapeToClose(open, onCancel);
  useModalFocus(open, panelRef, cancelRef);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'oklch(0 0 0 / 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal)',
          }}
          onClick={onCancel}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="convert-draft-modal-title"
            tabIndex={-1}
            variants={modalPanelVariants}
            className="draft-bridge-modal"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: 12,
              padding: '24px 28px',
              width: 440,
              maxWidth: 'calc(100vw - 32px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 24px 48px oklch(0 0 0 / 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={trapTab}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
                  <Icon name="book" size={16} />
                </span>
                <h3
                  id="convert-draft-modal-title"
                  style={{ font: '600 16px/1.3 var(--font-ui)', color: 'var(--ink)', margin: 0 }}
                >
                  Превратить сцену в главу
                </h3>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ padding: 4, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={onCancel}
                aria-label="Закрыть"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <p style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink-2)', margin: 0 }}>
              Сцена получит статус главы и сквозной номер в структуре книги. Выберите, где разместить новую главу:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ font: '500 12px var(--font-ui)', color: 'var(--ink-2)' }}>Позиция новой главы:</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  ['end', 'В конец книги'],
                  ['start', 'В начало книги'],
                  ...(chapters.length > 0 ? [['after', 'После выбранной главы'] as const] : []),
                ] as const).map(([m, lbl]) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={convertMode === m}
                    onClick={() => setConvertMode(m)}
                    className={`draft-scene-banner__seg-btn${convertMode === m ? ' draft-scene-banner__seg-btn--on' : ''}`}
                    style={{ flex: 1, minWidth: 100, textAlign: 'center' }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {convertMode === 'after' && chapters.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label htmlFor="convert-after-chapter" style={{ font: '500 11.5px var(--font-ui)', color: 'var(--ink-3)' }}>
                    После какой главы:
                  </label>
                  <select
                    id="convert-after-chapter"
                    aria-label="Выбрать главу, после которой вставить"
                    value={afterChapterId || chapters[chapters.length - 1].id}
                    onChange={(e) => setAfterChapterId(e.target.value)}
                    className="draft-scene-banner__select"
                    style={{ width: '100%' }}
                  >
                    {chapters.map((ch, idx) => (
                      <option key={ch.id} value={ch.id}>
                        После: {idx + 1}. {ch.title || 'Без названия'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button ref={cancelRef} type="button" onClick={onCancel} className="btn btn--ghost">
                Отмена
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  const validAfterId = chapters.some((c) => c.id === afterChapterId)
                    ? afterChapterId
                    : (chapters[chapters.length - 1]?.id ?? '');
                  const placement: DraftConvertPlacement =
                    convertMode === 'start'
                      ? { mode: 'start' }
                      : convertMode === 'after' && chapters.length > 0
                        ? { mode: 'after', afterChapterId: validAfterId }
                        : { mode: 'end' };
                  onConfirm(placement);
                }}
              >
                Превратить в главу
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface InsertDraftModalProps {
  open: boolean;
  chapters: ChapterMeta[];
  onConfirm: (targetChapterId: string, position: DraftInsertPosition) => void;
  onCancel: () => void;
}

export function InsertDraftModal({
  open,
  chapters,
  onConfirm,
  onCancel,
}: InsertDraftModalProps) {
  const [insertChapterId, setInsertChapterId] = useState<string>(chapters[0]?.id ?? '');
  const [insertPos, setInsertPos] = useState<DraftInsertPosition>('end');
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setInsertPos('end');
      if (chapters.length > 0) {
        setInsertChapterId(chapters[0].id);
      }
    }
  }, [open, chapters]);

  const isOpen = open && chapters.length > 0;
  useEscapeToClose(isOpen, onCancel);
  useModalFocus(isOpen, panelRef, cancelRef);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="presentation"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'oklch(0 0 0 / 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 'var(--z-modal)',
          }}
          onClick={onCancel}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="insert-draft-modal-title"
            tabIndex={-1}
            variants={modalPanelVariants}
            className="draft-bridge-modal"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: 12,
              padding: '24px 28px',
              width: 440,
              maxWidth: 'calc(100vw - 32px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 24px 48px oklch(0 0 0 / 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={trapTab}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
                  <Icon name="plus" size={16} />
                </span>
                <h3
                  id="insert-draft-modal-title"
                  style={{ font: '600 16px/1.3 var(--font-ui)', color: 'var(--ink)', margin: 0 }}
                >
                  Вставить в существующую главу
                </h3>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ padding: 4, width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={onCancel}
                aria-label="Закрыть"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <p style={{ font: '400 13px/1.5 var(--font-ui)', color: 'var(--ink-2)', margin: 0 }}>
              Текст черновика будет добавлен к содержимому выбранной главы книги.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="insert-target-chapter" style={{ font: '500 12px var(--font-ui)', color: 'var(--ink-2)' }}>
                Целевая глава:
              </label>
              <select
                id="insert-target-chapter"
                aria-label="Выбрать главу для вставки сцены"
                value={insertChapterId || chapters[0].id}
                onChange={(e) => setInsertChapterId(e.target.value)}
                className="draft-scene-banner__select"
                style={{ width: '100%' }}
              >
                {chapters.map((ch, idx) => (
                  <option key={ch.id} value={ch.id}>
                    {idx + 1}. {ch.title || 'Без названия'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ font: '500 12px var(--font-ui)', color: 'var(--ink-2)' }}>Куда добавить текст:</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {([
                  ['end', 'Дописать в конец'],
                  ['start', 'Вставить в начало'],
                ] as const).map(([pos, lbl]) => (
                  <button
                    key={pos}
                    type="button"
                    aria-pressed={insertPos === pos}
                    onClick={() => setInsertPos(pos)}
                    className={`draft-scene-banner__seg-btn${insertPos === pos ? ' draft-scene-banner__seg-btn--on' : ''}`}
                    style={{ flex: 1, textAlign: 'center' }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button ref={cancelRef} type="button" onClick={onCancel} className="btn btn--ghost">
                Отмена
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  const targetId = chapters.some((c) => c.id === insertChapterId)
                    ? insertChapterId
                    : (chapters[0]?.id ?? '');
                  onConfirm(targetId, insertPos);
                }}
              >
                Вставить в главу
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
