import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useEscapeToClose } from '../lib/useEscapeToClose';
import { trapTab, useModalFocus } from '../lib/useModalFocus';
import { useManuscriptImport } from '../lib/useManuscriptImport';
import { IMPORT_ACCEPT } from '../lib/importManuscript';
import type { SplitMode } from '../lib/importSplit';
import { plural } from '../lib/i18n';
import { ErrorBanner } from './ErrorBanner';

const MODE_LABELS: Record<SplitMode, string> = {
  headings: 'По заголовкам',
  pattern: 'По «Глава N»',
  single: 'Одной главой',
};

/**
 * Импорт рукописи в новую книгу: выбор файла → предпросмотр глав (название книги,
 * способ разбивки, склейка соседних глав) → «Создать книгу». Логика — useManuscriptImport.
 */
export function ImportManuscriptModal({ isOpen, onClose, userId, isPro, cover, onNeedUpgrade }: {
  isOpen: boolean;
  onClose: () => void;
  userId: string | undefined;
  isPro: boolean;
  /** Цвет обложки новой книги. */
  cover: string;
  onNeedUpgrade: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const imp = useManuscriptImport({ userId, isPro, cover, onNeedUpgrade });
  const { state, reset } = imp;
  const busy = state.kind === 'parsing' || state.kind === 'creating';

  const close = () => {
    if (state.kind === 'creating') return;
    reset();
    onClose();
  };

  useEscapeToClose(isOpen, close);
  useModalFocus(isOpen, panelRef);

  useEffect(() => {
    if (isOpen) panelRef.current?.focus();
  }, [isOpen, state.kind]);

  if (!isOpen) return null;

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void imp.loadFile(file);
  };

  const totalWords = imp.chapters.reduce((s, c) => s + c.words, 0);

  return (
    <div className="modal-overlay" style={{ zIndex: 50 }} onClick={close}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Импорт рукописи"
        tabIndex={-1}
        className="modal-panel"
        style={{ width: 560 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => trapTab(e)}
      >
        <h2 style={{ font: '600 22px var(--font-serif)' }}>Импорт рукописи</h2>

        {imp.error && <ErrorBanner message={imp.error} onDismiss={imp.clearError} size="sm" />}

        {state.kind === 'idle' && (
          <label
            className={isDragOver ? 'import-drop import-drop--over' : 'import-drop'}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={onDrop}
          >
            <input
              type="file"
              accept={IMPORT_ACCEPT}
              className="import-drop__input"
              aria-label="Выбрать файл рукописи"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void imp.loadFile(file);
              }}
            />
            <span className="import-drop__title">Перетащите файл сюда или нажмите, чтобы выбрать</span>
            <span className="import-drop__hint">DOCX, TXT, Markdown — бесплатно · FB2, EPUB — Pro · до 20 МБ</span>
            <span className="import-drop__hint">Главы найдём по заголовкам или строкам «Глава 1», перед созданием покажем список</span>
          </label>
        )}

        {state.kind === 'parsing' && (
          <div className="import-status" role="status">
            <span className="btn-spinner" /> Читаем «{state.fileName}»…
          </div>
        )}

        {(state.kind === 'preview' || state.kind === 'creating') && (
          <>
            <div>
              <label htmlFor="import-title" className="label">Название книги</label>
              <input
                id="import-title"
                className="input"
                value={imp.title}
                maxLength={120}
                disabled={state.kind === 'creating'}
                onChange={(e) => imp.setTitle(e.target.value)}
              />
              {state.parsed.author && <div className="input-hint">Автор: {state.parsed.author}</div>}
            </div>

            <div>
              <div className="label" id="import-mode-label">Разбивка на главы</div>
              <div className="import-modes" role="radiogroup" aria-labelledby="import-mode-label">
                {state.options.map((o) => (
                  <button
                    key={o.mode}
                    type="button"
                    role="radio"
                    aria-checked={state.mode === o.mode}
                    className="import-mode"
                    disabled={state.kind === 'creating' || (o.mode !== 'single' && o.count < 2)}
                    onClick={() => imp.setMode(o.mode)}
                  >
                    {MODE_LABELS[o.mode]}
                    <span className="import-mode__count">
                      {o.mode !== 'single' && o.count < 2 ? 'не найдено' : o.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="import-summary" style={{ marginBottom: 8 }}>
                {imp.chapters.length} {plural(imp.chapters.length, 'глава', 'главы', 'глав')} · {totalWords.toLocaleString('ru-RU')} {plural(totalWords, 'слово', 'слова', 'слов')}
              </div>
              <ol className="import-chapters" aria-label="Найденные главы">
                {imp.chapters.map((c, i) => (
                  <li key={c.first} className="import-chapter-row">
                    <span className="import-chapter-row__num">{i + 1}</span>
                    <span className="import-chapter-row__title" title={c.title}>
                      {c.title}
                      {c.last > c.first && <span className="import-chapter-row__joined"> + {c.last - c.first}</span>}
                    </span>
                    <span className="import-chapter-row__words">{c.words.toLocaleString('ru-RU')}</span>
                    <span className="import-chapter-row__acts">
                      {c.last > c.first && (
                        <button
                          type="button"
                          className="import-chapter-row__act"
                          disabled={state.kind === 'creating'}
                          aria-label={`Разъединить главу «${c.title}»`}
                          onClick={() => imp.unjoin(c.first, c.last)}
                        >
                          Разъединить
                        </button>
                      )}
                      {i > 0 && (
                        <button
                          type="button"
                          className="import-chapter-row__act"
                          disabled={state.kind === 'creating'}
                          aria-label={`Склеить «${c.title}» с предыдущей главой`}
                          title="Склеить с предыдущей главой"
                          onClick={() => imp.joinWithPrevious(c.first)}
                        >
                          ↑ Склеить
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {state.kind === 'preview' && (
            <button type="button" className="btn btn--ghost" onClick={reset}>Другой файл</button>
          )}
          <button type="button" className="btn btn--ghost" onClick={close} disabled={state.kind === 'creating'}>Отмена</button>
          {(state.kind === 'preview' || state.kind === 'creating') && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void imp.create()}
              disabled={busy || !imp.chapters.length || !imp.title.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {state.kind === 'creating' && <span className="btn-spinner" />}
              {state.kind === 'creating' ? 'Создаём…' : 'Создать книгу'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
