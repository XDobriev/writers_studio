import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { ErrorBanner } from './ErrorBanner';
import { useEscapeToClose } from '../lib/useEscapeToClose';
import { trapTab, useModalFocus } from '../lib/useModalFocus';
import { overlayVariants, modalPanelVariants } from '../lib/motion';
import {
  STORY_TEMPLATES,
  GENTLE_GOALS,
  cloneSampleBook,
  createBookFromTemplate,
  type StoryTemplate,
  type GentleGoal,
} from '../lib/onboardingTemplates';
import type { Book } from '../lib/supabase';

interface OnboardingForkModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | undefined;
  onSelectImport: () => void;
  onSuccess: (book: Book) => void;
}

export function OnboardingForkModal({
  isOpen,
  onClose,
  userId,
  onSelectImport,
  onSuccess,
}: OnboardingForkModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'cards' | 'configure'>('cards');
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplate['id']>('three-act');
  const [selectedGoal, setSelectedGoal] = useState<GentleGoal['id']>('500w');
  const [bookTitle, setBookTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Сброс шага и ошибок при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      setStep('cards');
      setError(null);
      setLoading(false);
      setLoadingAction(null);
      setBookTitle('');
      setSelectedTemplate('three-act');
      setSelectedGoal('500w');
    }
  }, [isOpen]);

  useEscapeToClose(isOpen, () => {
    if (!loading) onClose();
  });

  useModalFocus(isOpen, panelRef);

  // Фокус на инпут заголовка при переходе к шагу конфигурации
  useEffect(() => {
    if (step === 'configure') {
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [step]);

  if (!isOpen) return null;

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

  // Сценарий 2: Переход к настройке новой книги
  const handleGoToConfigure = () => {
    if (loading) return;
    setError(null);
    setStep('configure');
  };

  // Сценарий 2 (финал): Создание книги по выбранному шаблону и цели
  const handleCreateFromTemplate = async () => {
    if (!userId || loading) return;
    setLoading(true);
    setLoadingAction('Создаём книгу…');
    setError(null);

    try {
      const goalObj = GENTLE_GOALS.find((g) => g.id === selectedGoal);
      const book = await createBookFromTemplate(userId, {
        title: bookTitle,
        templateId: selectedTemplate,
        goalWords: goalObj?.words ?? 0,
      });
      onSuccess(book);
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
      onSuccess(book);
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
          className="modal-panel"
          style={{
            width: step === 'cards' ? 880 : 640,
            maxWidth: 'calc(100vw - 28px)',
            padding: 0,
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => trapTab(e)}
        >
          {/* Header */}
          <div
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
                    font: '500 12px var(--font-mono)',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Icon name="chev" size={12} /> Назад к вариантам
                </button>
              )}
              <h2
                id="onboarding-fork-title"
                style={{
                  font: '600 24px var(--font-serif)',
                  letterSpacing: '-0.012em',
                  color: 'var(--ink)',
                  margin: 0,
                  lineHeight: 1.25,
                }}
              >
                {step === 'cards' ? 'Как вы хотите начать?' : 'Настройка новой книги'}
              </h2>
              <p
                style={{
                  font: '400 13.5px/1.5 var(--font-ui)',
                  color: 'var(--ink-3)',
                  margin: '6px 0 0 0',
                }}
              >
                {step === 'cards'
                  ? 'Выберите удобный формат старта — структуру и цели всегда можно изменить в любой момент.'
                  : 'Задайте название, выберите сюжетный каркас и щадящую планку для быстрого старта.'}
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
              <Icon name="moremenu" size={16} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '24px 28px', maxHeight: 'calc(80vh - 120px)', overflowY: 'auto' }}>
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
                    padding: '22px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
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
                      font: '500 12.5px var(--font-ui)',
                      color: 'var(--accent)',
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
                    padding: '22px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
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
                    Пишите с чистого листа или используйте проверенный каркас сюжета («Трёхактная структура», «Путь героя») со щадящей целью.
                  </p>

                  <div
                    style={{
                      font: '500 12.5px var(--font-ui)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Выбрать структуру <Icon name="chev" size={12} />
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
                    padding: '22px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
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
                      font: '500 12.5px var(--font-ui)',
                      color: 'var(--accent)',
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
              /* ШАГ 2: КОНФИГУРАЦИЯ СТРУКТУРЫ И ЦЕЛИ */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* 1. Поле названия */}
                <div>
                  <label
                    htmlFor="fork-book-title"
                    className="label"
                    style={{ display: 'block', marginBottom: 8 }}
                  >
                    Название произведения
                  </label>
                  <input
                    id="fork-book-title"
                    ref={titleInputRef}
                    className="input"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCreateFromTemplate();
                    }}
                    placeholder="Например: Хроники северного архива (можно изменить позже)"
                    maxLength={120}
                    disabled={loading}
                  />
                </div>

                {/* 2. Выбор шаблона структуры */}
                <div>
                  <span className="label" style={{ display: 'block', marginBottom: 8 }}>
                    Сюжетная структура
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {STORY_TEMPLATES.map((tmpl) => {
                      const isSelected = selectedTemplate === tmpl.id;
                      return (
                        <div
                          key={tmpl.id}
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={0}
                          onClick={() => setSelectedTemplate(tmpl.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedTemplate(tmpl.id);
                            }
                          }}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 8,
                            background: isSelected
                              ? 'color-mix(in oklch, var(--accent) 8%, var(--surface))'
                              : 'var(--surface)',
                            border: isSelected
                              ? '1.5px solid var(--accent)'
                              : '1px solid var(--border-soft)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                border: isSelected
                                  ? '5px solid var(--accent)'
                                  : '1.5px solid var(--border)',
                                background: 'transparent',
                                flexShrink: 0,
                                transition: 'border 0.12s ease',
                              }}
                            />
                            <div>
                              <div
                                style={{
                                  font: '600 14px var(--font-ui)',
                                  color: 'var(--ink)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                {tmpl.title}
                                <span
                                  style={{
                                    font: '400 12px var(--font-ui)',
                                    color: 'var(--ink-3)',
                                  }}
                                >
                                  ({tmpl.subtitle})
                                </span>
                              </div>
                              <div
                                style={{
                                  font: '400 12px var(--font-ui)',
                                  color: 'var(--ink-2)',
                                  marginTop: 2,
                                }}
                              >
                                {tmpl.description}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Щадящая писательская цель */}
                <div>
                  <span className="label" style={{ display: 'block', marginBottom: 8 }}>
                    Щадящая цель старта
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: 8,
                    }}
                  >
                    {GENTLE_GOALS.map((g) => {
                      const isSelected = selectedGoal === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setSelectedGoal(g.id)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: isSelected
                              ? 'color-mix(in oklch, var(--accent) 12%, var(--surface))'
                              : 'var(--surface)',
                            border: isSelected
                              ? '1.5px solid var(--accent)'
                              : '1px solid var(--border-soft)',
                            color: isSelected ? 'var(--accent)' : 'var(--ink)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <div style={{ font: '600 13px var(--font-mono)' }}>{g.label}</div>
                          <div
                            style={{
                              font: '400 11px var(--font-ui)',
                              color: 'var(--ink-3)',
                              marginTop: 2,
                            }}
                          >
                            {g.sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 28px',
              borderTop: '1px solid var(--border-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface)',
            }}
          >
            <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)' }}>
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
                'Главы будут созданы автоматически с подсказками'
              ) : (
                'Не требует ввода карты'
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onClose}
                disabled={loading}
              >
                Отмена
              </button>

              {step === 'configure' && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleCreateFromTemplate}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {loading ? 'Создание…' : 'Создать книгу и начать →'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
