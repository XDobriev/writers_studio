import { useCallback, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { htmlToText } from '../lib/htmlUtils';
import { plural } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useResponsive } from '../lib/useResponsive';
import { useErrorState } from '../lib/useErrorState';
import { useDebouncedSave } from '../lib/useDebouncedSave';
import { useBeforeUnloadSave } from '../lib/useBeforeUnloadSave';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, useBook, useChapters, useBookPlan } from '../lib/queries';
import { ensureBookPlan, updateBookPlan, type BookPlan } from '../lib/bookPlans';
import { usePlanOutline } from '../lib/usePlanOutline';
import { WithMode, Sidebar } from '../components/Chrome';
import { MobileSidebarDrawer } from '../components/MobileSidebarDrawer';
import { RichEditor, type Editor } from '../components/RichEditor';
import { EditorToolbar } from '../components/EditorToolbar';
import { PlanOutline } from '../components/PlanOutline';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';

// Плейсхолдер, а не шаблон: спрашивает, а не предписывает. Исчезает при первом
// символе, содержимым документа не является — в БД пусто, в экспорт не идёт.
const PLAN_PLACEHOLDER = [
  'О чём эта книга в одном предложении?',
  'Чего герой хочет — и что стоит у него на пути?',
  'Что он потеряет, если проиграет?',
  'С чего всё началось в твоей голове?',
].join('\n');

export default function Plan() {
  const { id: bookId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isMobile, isWide } = useResponsive();
  const queryClient = useQueryClient();

  const [sbOpen, setSbOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { items: outline, scrollTo, activeIndex } = usePlanOutline(editor);

  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const { data: plan, error: planError } = useBookPlan(bookId);
  const { error: saveError, setError, clearError } = useErrorState();
  const queryError = (bookError ?? chaptersError ?? planError)?.message ?? null;

  const planReady = plan !== undefined;

  const writePlanCache = useCallback((row: BookPlan) => {
    if (bookId) queryClient.setQueryData<BookPlan | null>(QUERY_KEYS.bookPlan(bookId), row);
  }, [bookId, queryClient]);

  const { scheduleSave, pendingPatchRef, targetIdRef } = useDebouncedSave<{ content: string }>(
    async (id, patch) => {
      try {
        writePlanCache(await updateBookPlan(id, patch.content));
        clearError();
        setSaveState('saved');
      } catch (e) {
        setError(e instanceof Error ? e : 'Не удалось сохранить замысел');
        setSaveState('error');
        throw e;
      }
    },
    700,
  );

  // Объём замысла для чипа в шапке: слова из plain-text контента + число разделов
  // из оглавления. Как «· N сл» в Структуре — консистентно с сестринскими страницами.
  const planWords = useMemo(() => {
    const text = htmlToText(plan?.content ?? '');
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }, [plan?.content]);

  useBeforeUnloadSave(pendingPatchRef, targetIdRef, undefined, 'book_plans');

  // Строка замысла заводится при первой правке, а не при заходе на страницу:
  // открыть и уйти не должно оставлять пустых записей. Промис кэшируется —
  // серия быстрых нажатий ждёт один и тот же INSERT, а не плодит их.
  const planIdRef = useRef<string | null>(null);
  const ensuringRef = useRef<Promise<string> | null>(null);
  planIdRef.current = plan?.id ?? planIdRef.current;

  const ensurePlanId = useCallback((): Promise<string> => {
    if (planIdRef.current) return Promise.resolve(planIdRef.current);
    if (!ensuringRef.current) {
      ensuringRef.current = ensureBookPlan(bookId!, user!.id)
        .then((row) => {
          planIdRef.current = row.id;
          writePlanCache(row);
          return row.id;
        })
        .catch((e) => {
          ensuringRef.current = null;
          throw e;
        });
    }
    return ensuringRef.current;
  }, [bookId, user, writePlanCache]);

  const onContentChange = useCallback((html: string) => {
    if (!bookId || !user) return;
    setSaveState('saving');
    // Порядок правок сохраняется: после первого резолва промис уже закэширован,
    // а до него все .then висят на одном промисе и срабатывают в порядке подписки.
    void ensurePlanId()
      .then((id) => scheduleSave(id, { content: html }))
      .catch((e) => { setError(e instanceof Error ? e : 'Не удалось сохранить замысел'); setSaveState('error'); });
  }, [bookId, user, ensurePlanId, scheduleSave, setError]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (bookError && (bookError as { code?: string }).code === 'NOT_FOUND') {
    return <Navigate to="/books" replace />;
  }

  if (queryError) {
    return (
      <div className="as page-fill--error">
        <div style={{ color: 'var(--danger)' }}>Ошибка: {queryError}</div>
        <a href={`/books/${bookId}`} style={{ color: 'var(--accent)', fontSize: 13 }}>← К книге</a>
      </div>
    );
  }

  if (!book || !chapters || !planReady) {
    return (
      <div className="as page-fill--center">
        <div className="page-spinner" />
      </div>
    );
  }

  const showAside = isWide && outline.length > 0;

  return (
    <WithMode>
      <div className="as as-app as-app--no-right" style={{ height: '100%', gridTemplateColumns: isMobile ? '1fr' : undefined }}>
        {!isMobile && (
          <Sidebar book={book} chapters={chapters} subtitle="замысел" />
        )}
        <main className="as-main" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div className="tb" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isMobile && (
                <button type="button" className="tb-btn" onClick={() => setSbOpen(true)} title="Навигация" aria-label="Навигация" style={{ flexShrink: 0 }}>
                  <Icon name="panel" size={16} />
                </button>
              )}
              <span style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)' }}>Замысел</span>
              {!isMobile && planWords > 0 && (
                <span className="chip">
                  {planWords.toLocaleString('ru')} сл
                  {outline.length > 0 && ` · ${outline.length} ${plural(outline.length, 'раздел', 'раздела', 'разделов')}`}
                </span>
              )}
            </div>
            {saveState !== 'idle' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '400 12px var(--font-ui)', color: 'var(--ink-3)', flexShrink: 0 }}>
                <span className="status-dot" style={{ background: saveState === 'error' ? 'var(--danger)' : saveState === 'saving' ? 'var(--accent-2)' : 'var(--ok)' }} />
                {saveState === 'saving' ? 'Сохранение…' : saveState === 'error' ? 'Не сохранено' : 'Сохранено'}
              </span>
            )}
          </div>

          <EditorToolbar editor={editor} variant="studio" showModes={false} isMobile={isMobile} />

          {saveError && (
            <div style={{ flexShrink: 0, padding: '12px 24px 0' }}>
              <ErrorBanner message={saveError} onDismiss={clearError} size="sm" />
            </div>
          )}

          {!isWide && <PlanOutline items={outline} onSelect={scrollTo} activeIndex={activeIndex} variant="collapsed" />}

          <div className="plan-wrap">
            <div className="plan-sheet sheet">
              <RichEditor
                value={plan?.content ?? ''}
                onChange={onContentChange}
                contentKey={bookId}
                contentReady={planReady}
                placeholder={PLAN_PLACEHOLDER}
                className="plan-editor sheet-body"
                style={{ minHeight: 360 }}
                onEditor={setEditor}
              />
            </div>
            {showAside && <PlanOutline items={outline} onSelect={scrollTo} activeIndex={activeIndex} variant="aside" />}
          </div>
        </main>
      </div>

      <MobileSidebarDrawer
        open={sbOpen}
        onClose={() => setSbOpen(false)}
        book={book}
        chapters={chapters}
        subtitle="замысел"
      />
    </WithMode>
  );
}
