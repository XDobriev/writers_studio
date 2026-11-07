import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { ErrorBanner } from './ErrorBanner';
import { GenrePicker } from './GenrePicker';
import { CoverPicker, COVERS } from './CoverPicker';
import {
  SeriesTransferPicker,
  INITIAL_SERIES_TRANSFER,
  type SeriesTransferState,
} from './SeriesTransferPicker';
import { useEscapeToClose } from '../lib/useEscapeToClose';
import { trapTab, useModalFocus } from '../lib/useModalFocus';
import { overlayVariants, modalPanelVariants } from '../lib/motion';
import {
  LITERARY_FORMS,
  cloneSampleBook,
  createBookFromLiteraryForm,
  type LiteraryFormId,
} from '../lib/onboardingTemplates';
import type { Book } from '../lib/supabase';

export interface OnboardingForkModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  books?: Book[];
  onSelectImport: () => void;
  onSuccess: ((bookId: string) => void) | ((book: Book) => void);
  initialCover?: string;
  initialSeriesTransfer?: SeriesTransferState;
  onUploadCover?: (file: File) => Promise<string | null>;
}

export function OnboardingForkModal({
  isOpen,
  onClose,
  userId,
  books,
  onSelectImport,
  onSuccess,
  initialCover,
  initialSeriesTransfer,
  onUploadCover,
}: OnboardingForkModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'cards' | 'configure'>('cards');
  const [bookTitle, setBookTitle] = useState('');
  const [selectedForm, setSelectedForm] = useState<LiteraryFormId>('novel');
  const [targetWords, setTargetWords] = useState<number | null>(70000);
  const [genres, setGenres] = useState<string[]>([]);
  const [cover, setCover] = useState<string>(initialCover || COVERS[0]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [seriesTransfer, setSeriesTransfer] = useState<SeriesTransferState>(INITIAL_SERIES_TRANSFER);

  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prevIsOpenRef = useRef(false);
  const initialCoverRef = useRef(initialCover);
  initialCoverRef.current = initialCover;
  const initialSeriesTransferRef = useRef(initialSeriesTransfer);
  initialSeriesTransferRef.current = initialSeriesTransfer;

  // Сброс шага и формы только при открытии диалога (переходе isOpen в true)
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      setStep(initialSeriesTransferRef.current?.enabled ? 'configure' : 'cards');
      setError(null);
      setLoading(false);
      setLoadingAction(null);
      setBookTitle('');
      setSelectedForm('novel');
      setTargetWords(70000);
      setGenres([]);
      setCover(initialCoverRef.current || COVERS[0]);
      setUploadingCover(false);
      setSeriesTransfer(initialSeriesTransferRef.current || INITIAL_SERIES_TRANSFER);
    }
  }, [isOpen]);

  useEscapeToClose(isOpen, () => {
    if (!loading) onClose();
  });

  useModalFocus(isOpen, panelRef);

  // Автофокус на поле названия при переходе к шагу паспорта книги
  useEffect(() => {
    if (step === 'configure') {
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [step]);

  const handleCardKeyDown = (e: KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  // Сценарий 1: Импорт рукописи
  const handleImport = () => {
    if (loading) return;
    onClose();
    onSelectImport();
  };

  // Сценарий 2: Переход к паспорту новой книги
  const handleGoToConfigure = () => {
    if (loading) return;
    setError(null);
    setStep('configure');
  };

  // Загрузка пользовательской обложки
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

  // Сценарий 2 (финал): Создание книги по паспорту
  const handleCreateFromForm = async () => {
    const trimmedTitle = bookTitle.trim();
    if (!trimmedTitle) {
      setError('Пожалуйста, укажите название книги');
      titleInputRef.current?.focus();
      return;
    }
    if (!userId || loading) return;

    setLoading(true);
    setLoadingAction('Создаём книгу…');
    setError(null);

    try {
      const book = await createBookFromLiteraryForm(userId, {
        title: trimmedTitle,
        formId: selectedForm,
        targetWords: targetWords && targetWords > 0 ? targetWords : null,
        genres,
        cover,
        seriesTransfer: seriesTransfer.enabled ? seriesTransfer : undefined,
      });
      (onSuccess as (id: string) => void)(book.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать книгу');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  // Сценарий 3: Клонирование демо-книги
  const handleCloneSample = async () => {
    if (!userId || loading) return;
    setLoading(true);
    setLoadingAction('Клонируем роман «Город, которого нет»…');
    setError(null);

    try {
      const book = await cloneSampleBook(userId);
      (onSuccess as (id: string) => void)(book.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось клонировать демо-книгу');
    } finally {
      setLoading(false);
      setLoadingAction(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="presentation"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="modal-overlay"
          onClick={() => {
            if (!loading) onClose();
          }}
        >
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-fork-title"
          tabIndex={-1}
          variants={modalPanelVariants}
          className="modal-panel onboarding-fork-modal"
          style={{
            width: step === 'cards' ? 880 : 700,
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
              padding: '24px 28px 20px',
              borderBottom: '1px solid var(--border-soft)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              background: 'var(--surface)',
            }}
          >
            <div>
              {step === 'configure' && (
                <button
                  type="button"
                  onClick={() => setStep('cards')}
                  disabled={loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    margin: '0 0 8px 0',
                    font: '500 10.5px var(--font-mono)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Icon name="arrows" size={12} /> Назад к вариантам
                </button>
              )}
              <h2
                id="onboarding-fork-title"
                style={{
                  font: '600 22px var(--font-serif)',
                  letterSpacing: '-0.01em',
                  color: 'var(--ink)',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {step === 'cards' ? 'Как вы хотите начать?' : 'Паспорт новой книги'}
              </h2>
              <p
                style={{
                  font: '400 13px/1.5 var(--font-ui)',
                  color: 'var(--ink-3)',
                  margin: '6px 0 0 0',
                }}
              >
                {step === 'cards'
                  ? 'Выберите удобный формат старта — структуру и цели всегда можно изменить в любой момент.'
                  : 'Задайте название, литературную форму, жанры и обложку для старта работы.'}
              </p>
            </div>

            <button
              type="button"
              className="tb-btn"
              onClick={onClose}
              disabled={loading}
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
              padding: '24px 28px',
              maxHeight: 'calc(90vh - 120px)',
              overflowY: 'auto',
            }}
          >
            {error && <ErrorBanner message={error} style={{ marginBottom: 20 }} />}

            {step === 'cards' ? (
              /* ШАГ 1: 3 КАРТОЧКИ СТАРТА */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 16,
                }}
              >
                {/* Карточка 1: Импорт рукописи */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleImport}
                  onKeyDown={(e) => handleCardKeyDown(e, handleImport)}
                  className="fork-card"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 12,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'background var(--dur-fast), border-color var(--dur-fast)',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--ink)',
                      }}
                    >
                      <Icon name="download" size={18} />
                    </div>
                    <span
                      style={{
                        font: '500 10.5px var(--font-mono)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-3)',
                        background: 'var(--surface-2)',
                        padding: '3px 8px',
                        borderRadius: 999,
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      .DOCX · .TXT · .MD
                    </span>
                  </div>

                  <h3
                    style={{
                      font: '600 17px var(--font-serif)',
                      letterSpacing: '-0.01em',
                      color: 'var(--ink)',
                      margin: '0 0 8px 0',
                    }}
                  >
                    Импортировать готовую рукопись
                  </h3>

                  <p
                    style={{
                      font: '400 13px/1.55 var(--font-ui)',
                      color: 'var(--ink-2)',
                      margin: '0 0 20px 0',
                      flex: 1,
                    }}
                  >
                    Перенесите готовый черновик — студия автоматически разобьёт его на главы, посчитает объём и сохранит форматирование.
                  </p>

                  <div
                    style={{
                      font: '500 13px var(--font-ui)',
                      color: 'var(--ink-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Выбрать файл <Icon name="chev" size={12} />
                  </div>
                </div>

                {/* Карточка 2: Начать новую книгу (Акцентная) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleGoToConfigure}
                  onKeyDown={(e) => handleCardKeyDown(e, handleGoToConfigure)}
                  className="fork-card fork-card--highlighted"
                  style={{
                    background: 'var(--surface)',
                    border: '1.5px solid var(--accent)',
                    borderRadius: 12,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'background var(--dur-fast), border-color var(--dur-fast)',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: 'color-mix(in oklch, var(--accent) 15%, transparent)',
                        border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                      }}
                    >
                      <Icon name="feather" size={18} />
                    </div>
                    <span
                      style={{
                        font: '500 10.5px var(--font-mono)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--accent)',
                        background: 'color-mix(in oklch, var(--accent) 10%, transparent)',
                        padding: '3px 8px',
                        borderRadius: 999,
                        border: '1px solid color-mix(in oklch, var(--accent) 25%, transparent)',
                      }}
                    >
                      Рекомендуем
                    </span>
                  </div>

                  <h3
                    style={{
                      font: '600 17px var(--font-serif)',
                      letterSpacing: '-0.01em',
                      color: 'var(--ink)',
                      margin: '0 0 8px 0',
                    }}
                  >
                    Начать новую книгу
                  </h3>

                  <p
                    style={{
                      font: '400 13px/1.55 var(--font-ui)',
                      color: 'var(--ink-2)',
                      margin: '0 0 20px 0',
                      flex: 1,
                    }}
                  >
                    Выберите литературную форму (роман, повесть, рассказ) и задайте жанры, обложку и ориентир по объёму.
                  </p>

                  <div
                    style={{
                      font: '500 13px var(--font-ui)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Настроить паспорт книги <Icon name="chev" size={12} />
                  </div>
                </div>

                {/* Карточка 3: Изучить студию на примере романа */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleCloneSample}
                  onKeyDown={(e) => handleCardKeyDown(e, handleCloneSample)}
                  className="fork-card"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 12,
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'background var(--dur-fast), border-color var(--dur-fast)',
                    position: 'relative',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--ink)',
                      }}
                    >
                      <Icon name="sparkles" size={18} />
                    </div>
                    <span
                      style={{
                        font: '500 10.5px var(--font-mono)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--ink-3)',
                        background: 'var(--surface-2)',
                        padding: '3px 8px',
                        borderRadius: 999,
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      Демо-роман
                    </span>
                  </div>

                  <h3
                    style={{
                      font: '600 17px var(--font-serif)',
                      letterSpacing: '-0.01em',
                      color: 'var(--ink)',
                      margin: '0 0 8px 0',
                    }}
                  >
                    Изучить студию на романе
                  </h3>

                  <p
                    style={{
                      font: '400 13px/1.55 var(--font-ui)',
                      color: 'var(--ink-2)',
                      margin: '0 0 20px 0',
                      flex: 1,
                    }}
                  >
                    Клонируйте проект «Город, которого нет» с 10 главами, персонажами и картой. Лимит бесплатных книг не расходуется.
                  </p>

                  <div
                    style={{
                      font: '500 13px var(--font-ui)',
                      color: 'var(--ink-2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {loading ? 'Клонирование…' : 'Открыть демо-книгу'} <Icon name="chev" size={12} />
                  </div>
                </div>
              </div>
            ) : (
              /* ШАГ 2: ПАСПОРТ НОВОЙ КНИГИ */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {/* 1. Поле названия */}
                <div>
                  <label
                    htmlFor="fork-book-title"
                    className="label"
                    style={{ display: 'block', marginBottom: 8 }}
                  >
                    Название произведения <span style={{ color: 'var(--accent)' }}>*</span>
                  </label>
                  <input
                    id="fork-book-title"
                    ref={titleInputRef}
                    className="input"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && bookTitle.trim()) void handleCreateFromForm();
                    }}
                    placeholder="Например: Хроники северного архива"
                    maxLength={120}
                    disabled={loading}
                    autoFocus
                    required
                  />
                </div>

                {/* 2. Литературная форма */}
                <div>
                  <span className="label" style={{ display: 'block', marginBottom: 8 }}>
                    Литературная форма
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: 10,
                    }}
                  >
                    {LITERARY_FORMS.map((form) => {
                      const isSelected = selectedForm === form.id;
                      return (
                        <div
                          key={form.id}
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={0}
                          onClick={() => {
                            setSelectedForm(form.id);
                            setTargetWords(form.targetWords);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedForm(form.id);
                              setTargetWords(form.targetWords);
                            }
                          }}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 8,
                            background: isSelected
                              ? 'color-mix(in oklch, var(--accent) 8%, var(--surface))'
                              : 'var(--surface)',
                            border: isSelected
                              ? '1.5px solid var(--accent)'
                              : '1px solid var(--border-soft)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            transition: 'background var(--dur-hover), border-color var(--dur-hover)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: '50%',
                                  border: isSelected
                                    ? '5px solid var(--accent)'
                                    : '1.5px solid var(--border)',
                                  background: 'transparent',
                                  flexShrink: 0,
                                  transition: 'border-color var(--dur-hover)',
                                }}
                              />
                              <span
                                style={{
                                  font: '600 13px var(--font-ui)',
                                  color: 'var(--ink)',
                                }}
                              >
                                {form.title}
                              </span>
                            </div>
                            <span
                              style={{
                                font: '500 10.5px var(--font-mono)',
                                color: isSelected ? 'var(--accent)' : 'var(--ink-3)',
                                background: isSelected
                                  ? 'color-mix(in oklch, var(--accent) 12%, transparent)'
                                  : 'var(--surface-2)',
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}
                            >
                              {form.targetWords ? `${form.targetWords.toLocaleString('ru-RU')} слов` : 'без рамок'}
                            </span>
                          </div>
                          <div
                            style={{
                              font: '400 13px/1.45 var(--font-ui)',
                              color: 'var(--ink-2)',
                              paddingLeft: 24,
                            }}
                          >
                            {form.description}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Числовое поле «Цель по объёму книги (слов)» */}
                  <div style={{ marginTop: 12 }}>
                    <label
                      htmlFor="fork-target-words"
                      className="label"
                      style={{ display: 'block', marginBottom: 6 }}
                    >
                      Цель по объёму книги (слов)
                    </label>
                    <input
                      id="fork-target-words"
                      type="number"
                      min={0}
                      step={1000}
                      className="input"
                      value={targetWords ?? ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setTargetWords(val === '' ? null : Math.max(0, parseInt(val, 10) || 0));
                      }}
                      placeholder="например 70000 (необязательно)"
                      disabled={loading}
                    />
                  </div>

                  {/* Подсказка про драматургические схемы */}
                  <div
                    style={{
                      marginTop: 12,
                      padding: '12px 16px',
                      borderRadius: 8,
                      background: 'var(--surface)',
                      border: '1px solid var(--border-soft)',
                      font: '400 13px/1.5 var(--font-ui)',
                      color: 'var(--ink-2)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <span style={{ color: 'var(--accent-2)', marginTop: 2, flexShrink: 0 }}>
                      <Icon name="sparkles" size={14} />
                    </span>
                    <span>
                      Драматургические схемы (Save the Cat, Трёхактная арка, 7 точек) доступны внутри книги в разделе «Структура» — их можно подключить в любой момент как ориентиры для сцен.
                    </span>
                  </div>
                </div>

                {/* 3. Жанры */}
                <div>
                  <GenrePicker value={genres} onChange={setGenres} />
                </div>

                {/* 4. Обложка */}
                <div>
                  <CoverPicker
                    value={cover}
                    onChange={setCover}
                    uploading={uploadingCover}
                    onFileSelect={onUploadCover ? handleCoverFileSelect : undefined}
                  />
                </div>

                {/* 5. Продолжение серии */}
                {books && books.length > 0 && (
                  <div>
                    <SeriesTransferPicker
                      books={books}
                      value={seriesTransfer}
                      onChange={setSeriesTransfer}
                      disabled={loading}
                    />
                  </div>
                )}
              </div>
            )}
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
            <div className="fork-modal-footer-hint" style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)' }}>
              {loadingAction ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="btn-spinner"
                    style={{
                      width: 13,
                      height: 13,
                      borderColor: 'color-mix(in oklch, var(--accent) 30%, transparent)',
                      borderTopColor: 'var(--accent)',
                    }}
                  />
                  {loadingAction}
                </span>
              ) : step === 'configure' ? (
                'Книга будет создана с первой главой'
              ) : (
                'Не требует ввода карты'
              )}
            </div>

            <div className="fork-modal-footer-actions" style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onClose}
                disabled={loading}
                style={{ whiteSpace: 'nowrap' }}
              >
                Отмена
              </button>

              {step === 'configure' && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleCreateFromForm}
                  disabled={loading || !bookTitle.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                >
                  {loading ? 'Создание…' : 'Создать книгу и начать →'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
