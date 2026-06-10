import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toastVariants } from '../lib/motion';
import { useGoalToast } from '../lib/useGoalToast';
import { useKeyboardShortcuts } from '../lib/useKeyboardShortcuts';
import { useMobileDrawers } from '../lib/useMobileDrawers';
import { usePageHint } from '../lib/usePageHint';
import { useQueryClient } from '@tanstack/react-query';
import { useEditorLayout } from '../lib/useEditorLayout';
import { Icon } from './Icon';
import { Sidebar, RailNav } from './Chrome';
import { StatusBar } from './StatusBar';
import { RightPanel } from './RightPanel';
import { SAMPLE_PROSE } from '../data/sample';
import { RichEditor, type Editor } from './RichEditor';
import { EditorToolbar, ModeSegment } from './EditorToolbar';
import type { Book } from '../lib/supabase';
import type { ChapterMeta, ChapterActions } from '../lib/chapters';
import { useWritingStats } from '../lib/useWritingStats';
import { useUserDisplay } from '../lib/useUserDisplay';
import { useAuth } from '../lib/auth';
import { useProfile, QUERY_KEYS, useCharacters } from '../lib/queries';
import { useCharacterHover } from '../lib/useCharacterHover';
import { CharacterHoverCard } from './CharacterHoverCard';
import { addWordToDictionary, type Profile } from '../lib/profiles';

type Mode = 'studio' | 'left' | 'right' | 'page';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ChapterSheetProps {
  chapter: ChapterMeta;
  content: string;
  onContentChange: (html: string) => void;
  onTitleChange: (title: string) => void;
  onEditor: (editor: Editor | null) => void;
  width: number | string;
  padding: string;
  userDictionary?: string[];
  onAddWord?: (word: string) => void;
}

import { plural } from '../lib/i18n';

function ChapterSheet({ chapter, content, onContentChange, onTitleChange, onEditor, width, padding, userDictionary, onAddWord }: ChapterSheetProps) {
  return (
    <div className="sheet" style={{ width, padding }}>
      <input
        className="sheet-title"
        value={chapter.title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Без названия"
        aria-label="Название главы"
        maxLength={200}
        style={{
          width: '100%', background: 'transparent', border: 'none', outline: 'none',
          font: '600 30px var(--font-serif)', letterSpacing: '-0.012em', color: 'var(--paper-ink)',
          padding: 0, marginBottom: 22,
        }}
      />
      <RichEditor
        value={content}
        onChange={onContentChange}
        contentKey={chapter.id}
        placeholder="Начните писать главу…"
        className="sheet-body"
        style={{ minHeight: 300 }}
        onEditor={onEditor}
        userDictionary={userDictionary}
        onAddWord={onAddWord}
      />
    </div>
  );
}


function formatTime(d: Date): string {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function saveLabel(state: SaveState, savedAt: Date | null): string {
  if (state === 'saving') return 'Сохранение…';
  if (state === 'error') return 'Нет соединения · текст в памяти';
  if (state === 'saved' && savedAt) return `Сохранено · ${formatTime(savedAt)}`;
  if (savedAt) return `Сохранено · ${formatTime(savedAt)}`;
  return 'Готов к работе';
}

interface EditorHybridProps {
  defaultMode?: Mode;
  book?: Book | null;
  chapters?: ChapterMeta[];
  activeChapter?: ChapterMeta | null;
  activeContent?: string;
  chapterActions?: ChapterActions;
  onContentChange?: (html: string) => void;
  onTitleChange?: (title: string) => void;
  onGoalChange?: (goal: number) => void;
  saveState?: SaveState;
  savedAt?: Date | null;
  /** Вызывается по Ctrl+S — принудительный flush debounce */
  onSave?: () => void;
  versionToast?: boolean;
}

export function EditorHybrid({
  defaultMode = 'studio',
  book,
  chapters,
  activeChapter,
  activeContent = '',
  chapterActions,
  onContentChange,
  onTitleChange,
  onGoalChange,
  saveState = 'idle',
  savedAt = null,
  onSave,
  versionToast = false,
}: EditorHybridProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [focusMode, setFocusMode] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const restoreContent = useCallback((content: string) => {
    editor?.commands.setContent(content, { emitUpdate: false });
  }, [editor]);
  const { isMobile, showLeft, showRight, isPage, cols, sheetWidth, sheetPad, wrapPad } = useEditorLayout(mode);
  const { sidebar, right } = useMobileDrawers(isMobile);
  const isReal = Boolean(chapters);
  const writingStats = useWritingStats(book?.id);
  const { refetch: refetchStats } = writingStats;
  const { plan } = useUserDisplay();
  const isPro = plan === 'pro' || plan === 'lifetime';

  const { data: characters = [] } = useCharacters(book?.id);
  const editorDom = editor ? (editor.view.dom as HTMLElement) : null;
  const { shown: hoveredChar, onCardEnter, onCardLeave } = useCharacterHover(
    focusMode || isPage ? null : editorDom,
    characters,
  );

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const userDictionary = profile?.user_dictionary ?? [];

  const handleAddWord = useCallback(async (word: string) => {
    if (!user) return;
    const w = word.toLowerCase();
    queryClient.setQueryData(QUERY_KEYS.profile(user.id), (old: Profile | null | undefined) => {
      if (!old) return old;
      const dict = old.user_dictionary ?? [];
      if (dict.includes(w)) return old;
      return { ...old, user_dictionary: [...dict, w] };
    });
    await addWordToDictionary(user.id, w);
  }, [user, queryClient]);

  const { openNoteAt } = useKeyboardShortcuts({
    onSave,
    chapterActions,
    chapters,
    activeChapter,
    isMobile,
    isReal,
    setMode,
    openMobileRight: right.open,
  });

  const prevSaveState = useRef<SaveState>(saveState);
  useEffect(() => {
    if (prevSaveState.current !== 'saved' && saveState === 'saved') {
      refetchStats();
    }
    prevSaveState.current = saveState;
  }, [saveState, refetchStats]);

  useEffect(() => {
    if (saveState !== 'error' || !onSave) return;
    window.addEventListener('online', onSave);
    return () => window.removeEventListener('online', onSave);
  }, [saveState, onSave]);

  const { visible: showPageHint, dismiss: dismissPageHint } = usePageHint(isPage);

  const dailyGoal = book?.daily_goal ?? 0;
  const { toast: goalToast } = useGoalToast({ todayWords: writingStats.todayWords, dailyGoal });

  return (
    <div className="as" style={{ height: '100%', overflow: 'hidden', display: 'grid', gridTemplateColumns: cols, background: 'var(--bg)', position: 'relative' }}>
      {isPage && !isMobile && <RailNav active="editor" bookId={book?.id} style={{ position: 'relative', height: '100%' }} />}

      {showLeft && (
        <div style={{ animation: 'fade-in 0.15s cubic-bezier(0.22, 1, 0.36, 1) both', display: 'contents' }}>
          <Sidebar
            book={book}
            chapters={chapters}
            activeChapterId={activeChapter?.id ?? null}
            chapterActions={chapterActions}
          />
        </div>
      )}

      <main className={focusMode ? 'focus-mode' : undefined} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
        {isMobile && !isPage && (
          <div style={{ display: 'flex', alignItems: 'center', height: 44, padding: '0 12px', gap: 8, borderBottom: '1px solid var(--border-soft)', background: 'var(--bg)', flexShrink: 0 }}>
            <button
              type="button"
              className="tb-btn"
              onClick={sidebar.open}
              title="Главы"
              aria-label="Главы"
              style={{ flexShrink: 0 }}
            >
              <Icon name="panel" size={16} />
            </button>
            {activeChapter && (
              <span style={{ font: '500 13px var(--font-serif)', color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeChapter.title || 'Без названия'}
              </span>
            )}
            {isReal && (
              <button
                type="button"
                className={'tb-btn' + (right.isOpen ? ' tb-btn--on' : '')}
                onClick={() => right.isOpen ? right.close() : right.open()}
                title="Заметки и версии"
                aria-label="Заметки и версии"
                style={{ flexShrink: 0 }}
              >
                <Icon name="note" size={16} />
              </button>
            )}
            <button
              type="button"
              className="tb-btn"
              onClick={() => setMode('page')}
              title="Страница — чистый лист"
              aria-label="Страница — чистый лист"
              style={{ flexShrink: 0 }}
            >
              <Icon name="focus" size={16} />
            </button>
          </div>
        )}
        {isPage ? (
          isMobile ? (
            <div style={{ display: 'flex', alignItems: 'center', height: 44, padding: '0 12px', gap: 8, borderBottom: '1px solid var(--border-soft)', background: 'var(--bg)', flexShrink: 0 }}>
              <button
                type="button"
                className="tb-btn"
                onClick={sidebar.open}
                title="Главы"
                aria-label="Главы"
                style={{ flexShrink: 0 }}
              >
                <Icon name="panel" size={16} />
              </button>
              {activeChapter && (
                <span style={{ font: '500 13px var(--font-serif)', color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeChapter.title || 'Без названия'}
                </span>
              )}
              <button
                type="button"
                className="tb-btn tb-btn--on"
                onClick={() => setMode('studio')}
                title="Выйти из режима страницы"
                aria-label="Выйти из режима страницы"
                style={{ flexShrink: 0 }}
              >
                <Icon name="focus" size={16} />
              </button>
            </div>
          ) : (
            <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg)' }}>
              <ModeSegment mode={mode} setMode={setMode} />
            </div>
          )
        ) : (
          <EditorToolbar editor={editor} mode={mode} setMode={setMode} variant="studio" showModes={!isMobile} isMobile={isMobile} />
        )}

        {showPageHint && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '7px 20px',
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', flex: 1 }}>
              Страница — чистый лист без панелей. Для структуры и заметок переключитесь в другой режим.
            </span>
            <button
              onClick={dismissPageHint}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                font: '500 12px var(--font-ui)',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              Понятно
            </button>
          </div>
        )}

        <div className="sheet-wrap" style={{ padding: wrapPad }}>
          {isReal ? (
            activeChapter ? (
              <ChapterSheet
                chapter={activeChapter}
                content={activeContent}
                onContentChange={(html) => onContentChange?.(html)}
                onTitleChange={(title) => onTitleChange?.(title)}
                onEditor={setEditor}
                width={sheetWidth}
                padding={sheetPad}
                userDictionary={userDictionary}
                onAddWord={handleAddWord}
              />
            ) : (
              <div className="sheet" style={{ width: sheetWidth, padding: sheetPad, color: 'var(--ink-3)', textAlign: 'center' }}>
                <div style={{ font: '500 18px var(--font-serif)', color: 'var(--ink-2)', marginBottom: 8 }}>Глав пока нет.</div>
                <div style={{ marginBottom: 18, fontSize: 13 }}>Создайте первую главу — она появится в боковой панели.</div>
                <button className="btn btn--primary" onClick={chapterActions?.onCreateChapter}>
                  <Icon name="plus" size={14} /> Новая глава
                </button>
              </div>
            )
          ) : (
            <div className="sheet" style={{ width: sheetWidth, padding: sheetPad }} dangerouslySetInnerHTML={{ __html: SAMPLE_PROSE }} />
          )}
        </div>

        {!isPage && (
          isReal ? (
            <StatusBar
              words={activeChapter?.words ?? 0}
              chars={activeContent.replace(/<[^>]+>/g, '').length}
              statusLabel={saveLabel(saveState, savedAt)}
              saveState={saveState}
              todayWords={writingStats.todayWords}
              goalWords={book?.daily_goal ?? 1000}
              streak={writingStats.streak}
              onGoalChange={onGoalChange}
              focusMode={focusMode}
              onToggleFocusMode={() => setFocusMode(f => !f)}
            />
          ) : (
            <StatusBar />
          )
        )}
      </main>

      {showRight && (
        <div style={{ animation: 'fade-in 0.15s cubic-bezier(0.22, 1, 0.36, 1) both', display: 'contents' }}>
          <RightPanel
            bookId={book?.id}
            chapterId={activeChapter?.id}
            chapterTitle={activeChapter?.title}
            userId={activeChapter?.user_id}
            currentContent={activeContent}
            isPro={isPro}
            onRestoreContent={restoreContent}
            openNoteAt={openNoteAt}
          />
        </div>
      )}

      {isMobile && sidebar.isOpen && (
        <>
          <div
            role="presentation"
            onClick={sidebar.close}
            style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', zIndex: 40 }}
          />
          <div className="as" style={{ position: 'fixed', top: 0, left: 0, width: 280, height: '100%', zIndex: 41, boxShadow: '4px 0 32px oklch(0.05 0.01 50 / 0.35)' }}>
            <Sidebar
              book={book}
              chapters={chapters}
              activeChapterId={activeChapter?.id ?? null}
              chapterActions={chapterActions ? {
                ...chapterActions,
                onSelectChapter: (id) => { chapterActions.onSelectChapter?.(id); sidebar.close(); },
              } : undefined}
            />
          </div>
        </>
      )}

      {isMobile && right.isOpen && (
        <>
          <div
            role="presentation"
            onClick={right.close}
            style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', zIndex: 40 }}
          />
          <div style={{ position: 'fixed', top: 0, right: 0, width: 300, maxWidth: '90vw', height: '100%', zIndex: 41, boxShadow: '-4px 0 32px oklch(0.05 0.01 50 / 0.35)', animation: 'panel-enter-right 0.22s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
            <RightPanel
              bookId={book?.id}
              chapterId={activeChapter?.id}
              chapterTitle={activeChapter?.title}
              userId={activeChapter?.user_id}
              currentContent={activeContent}
              isPro={isPro}
              onRestoreContent={restoreContent}
              openNoteAt={openNoteAt}
            />
          </div>
        </>
      )}

      {hoveredChar && book?.id && (
        <CharacterHoverCard
          state={hoveredChar}
          bookId={book.id}
          onMouseEnter={onCardEnter}
          onMouseLeave={onCardLeave}
        />
      )}

      <AnimatePresence>
        {goalToast && (
          <motion.div
            variants={toastVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              position: 'fixed',
              bottom: 52,
              right: 20,
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: '0 8px 24px oklch(0 0 0 / 0.35)',
              font: '400 13px var(--font-ui)',
              color: 'var(--ink)',
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: 16 }}>{goalToast === 'exceeded' ? '💪' : '🎉'}</span>
            <span>
              {goalToast === 'exceeded'
                ? `Превысил цель! +${writingStats.todayWords.toLocaleString('ru')} ${plural(writingStats.todayWords, 'слово', 'слова', 'слов')} сегодня`
                : `Цель дня достигнута! +${writingStats.todayWords.toLocaleString('ru')} ${plural(writingStats.todayWords, 'слово', 'слова', 'слов')}`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {versionToast && (
          <motion.div
            variants={toastVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              position: 'fixed',
              bottom: goalToast ? 100 : 52,
              right: 20,
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: '0 8px 24px oklch(0 0 0 / 0.35)',
              font: '400 12px var(--font-ui)',
              color: 'var(--ink-3)',
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: 13, opacity: 0.7 }}>◷</span>
            <span>Снимок сохранён</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
