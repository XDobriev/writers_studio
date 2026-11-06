import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
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
import { useEscapeToClose } from '../lib/useEscapeToClose';
import type { Book } from '../lib/supabase';
import type { ChapterMeta, ChapterActions } from '../lib/chapters';
import type { DraftScene, DraftSceneActions, DraftConvertPlacement, DraftInsertPosition } from '../lib/draftScenes';
import { ConfirmDialog } from './ConfirmDialog';
import { useWritingStats } from '../lib/useWritingStats';
import { useUserDisplay } from '../lib/useUserDisplay';
import { useAuth } from '../lib/auth';
import { useProfile, QUERY_KEYS, useCharacters } from '../lib/queries';
import { useCharacterHover } from '../lib/useCharacterHover';
import { useAutoResize } from '../lib/useAutoResize';
import { trapTab } from '../lib/useModalFocus';
const CharacterHoverCard = lazy(() => import('./CharacterHoverCard').then(m => ({ default: m.CharacterHoverCard })));
import { addWordToDictionary, type Profile } from '../lib/profiles';
import { plural } from '../lib/i18n';

import type { Character } from '../lib/characters';

type Mode = 'studio' | 'left' | 'right' | 'page';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ChapterSheetProps {
  chapter: ChapterMeta;
  content: string;
  contentReady?: boolean;
  onContentChange: (html: string) => void;
  onTitleChange: (title: string) => void;
  onEditor: (editor: Editor | null) => void;
  width: number | string;
  padding: string;
  userDictionary?: string[];
  onAddWord?: (word: string) => void;
  nextChapter?: ChapterMeta | null;
  onNextChapter?: () => void;
  characters?: Character[];
  highlightCharacters?: boolean;
  onMentionClick?: (characterId: string) => void;
}

interface ManuscriptSheetProps {
  id: string;
  title: string;
  titlePlaceholder?: string;
  titleAriaLabel?: string;
  content: string;
  contentReady?: boolean;
  contentPlaceholder?: string;
  contentKey?: string;
  onContentChange: (html: string) => void;
  onTitleChange: (title: string) => void;
  onEditor: (editor: Editor | null) => void;
  width: number | string;
  padding: string;
  userDictionary?: string[];
  onAddWord?: (word: string) => void;
  characters?: Character[];
  highlightCharacters?: boolean;
  onMentionClick?: (characterId: string) => void;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

function ManuscriptSheet({
  id,
  title,
  titlePlaceholder = 'Без названия',
  titleAriaLabel = 'Название главы',
  content,
  contentReady = true,
  contentPlaceholder = 'Начните писать главу…',
  contentKey,
  onContentChange,
  onTitleChange,
  onEditor,
  width,
  padding,
  userDictionary,
  onAddWord,
  characters,
  highlightCharacters,
  onMentionClick,
  headerSlot,
  footerSlot,
}: ManuscriptSheetProps) {
  const titleRef = useAutoResize(title);

  const handleSheetClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const mention = target?.closest<HTMLElement>('.char-mention-first, .char-mention-subsequent');
    if (!mention) return;

    const charId = mention.getAttribute('data-char-id');
    if (!charId) return;

    const isFirst = mention.classList.contains('char-mention-first');
    const isModifier = e.altKey || e.ctrlKey || e.metaKey;
    const rect = mention.getBoundingClientRect();
    const clickedIndicator = isFirst && (e.clientX - rect.left <= 18);

    if (isModifier || clickedIndicator) {
      e.preventDefault();
      e.stopPropagation();
      onMentionClick?.(charId);
    }
  };

  return (
    <div className="sheet" style={{ width, padding }} onClick={handleSheetClick}>
      {headerSlot}
      <textarea
        ref={titleRef}
        className="sheet-title"
        rows={1}
        value={title}
        onChange={(e) => onTitleChange(e.target.value.replace(/[\r\n]+/g, ' '))}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
        placeholder={titlePlaceholder}
        aria-label={titleAriaLabel}
        maxLength={200}
      />
      <RichEditor
        value={content}
        onChange={onContentChange}
        contentKey={contentKey ?? id}
        contentReady={contentReady}
        loadingTone="paper"
        placeholder={contentPlaceholder}
        className="sheet-body"
        style={{ minHeight: 300 }}
        onEditor={onEditor}
        userDictionary={userDictionary}
        onAddWord={onAddWord}
        characters={characters}
        highlightCharacters={highlightCharacters}
        onMentionClick={onMentionClick}
      />
      {footerSlot}
    </div>
  );
}

interface DraftSceneBridgeBarProps {
  scene: DraftScene;
  chapters: ChapterMeta[];
  draftActions?: DraftSceneActions;
}

function DraftSceneBridgeBar({
  scene,
  chapters,
  draftActions,
}: DraftSceneBridgeBarProps) {
  const [bridgeAction, setBridgeAction] = useState<'convert' | 'insert' | null>(null);
  const [convertMode, setConvertMode] = useState<'end' | 'start' | 'after'>('end');
  const [afterChapterId, setAfterChapterId] = useState<string>(chapters[chapters.length - 1]?.id ?? '');
  const [insertChapterId, setInsertChapterId] = useState<string>(chapters[0]?.id ?? '');
  const [insertPos, setInsertPos] = useState<DraftInsertPosition>('end');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (chapters.length > 0) {
      setAfterChapterId((prev) => (prev && chapters.some((c) => c.id === prev) ? prev : chapters[chapters.length - 1].id));
      setInsertChapterId((prev) => (prev && chapters.some((c) => c.id === prev) ? prev : chapters[0].id));
    }
  }, [chapters]);

  return (
    <>
      <div className="draft-scene-banner">
        <div className="draft-scene-banner__meta">
          <span className="draft-scene-banner__icon">
            <Icon name="feather" size={14} />
          </span>
          <span className="draft-scene-banner__title">
            Свободная сцена
          </span>
          <span className="draft-scene-banner__chip">
            {scene.words.toLocaleString('ru-RU')} {plural(scene.words, 'слово', 'слова', 'слов')}
          </span>
        </div>

        <div className="draft-scene-banner__actions">
          {draftActions?.onConvertDraftToChapter && (
            <button
              type="button"
              className={bridgeAction === 'convert' ? 'btn btn--primary' : 'draft-scene-banner__btn'}
              style={{ fontSize: 12, padding: '4px 10px', height: 28 }}
              onClick={() => setBridgeAction((v) => (v === 'convert' ? null : 'convert'))}
            >
              Превратить в главу
            </button>
          )}
          {draftActions?.onInsertDraftIntoChapter && chapters.length > 0 && (
            <button
              type="button"
              className={bridgeAction === 'insert' ? 'btn btn--primary' : 'draft-scene-banner__btn'}
              style={{ fontSize: 12, padding: '4px 10px', height: 28 }}
              onClick={() => setBridgeAction((v) => (v === 'insert' ? null : 'insert'))}
            >
              Вставить в существующую главу
            </button>
          )}
          {draftActions?.onDeleteDraft && (
            <button
              type="button"
              className="draft-scene-banner__btn draft-scene-banner__btn--danger"
              style={{ fontSize: 12, padding: '4px 8px', height: 28 }}
              onClick={() => setConfirmDelete(true)}
              title="Удалить черновик"
              aria-label="Удалить черновик"
            >
              <Icon name="trash" size={13} /> Удалить
            </button>
          )}
        </div>
      </div>

      {bridgeAction === 'convert' && draftActions?.onConvertDraftToChapter && (
        <div className="draft-scene-banner__panel">
          <span style={{ font: '500 12px var(--font-ui)', color: 'var(--paper-ink-2)' }}>Позиция новой главы:</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              ['end', 'В конец'],
              ['start', 'В начало'],
              ...(chapters.length > 0 ? [['after', 'После выбранной главы'] as const] : []),
            ] as const).map(([m, lbl]) => (
              <button
                key={m}
                type="button"
                onClick={() => setConvertMode(m)}
                className={`draft-scene-banner__seg-btn${convertMode === m ? ' draft-scene-banner__seg-btn--on' : ''}`}
              >
                {lbl}
              </button>
            ))}
          </div>
          {convertMode === 'after' && chapters.length > 0 && (
            <select
              aria-label="Выбрать главу, после которой вставить"
              value={afterChapterId || chapters[chapters.length - 1].id}
              onChange={(e) => setAfterChapterId(e.target.value)}
              className="draft-scene-banner__select"
            >
              {chapters.map((ch, idx) => (
                <option key={ch.id} value={ch.id}>
                  После: {idx + 1}. {ch.title || 'Без названия'}
                </option>
              ))}
            </select>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn--primary"
              style={{ fontSize: 12, padding: '4px 12px', height: 28 }}
              onClick={() => {
                const placement: DraftConvertPlacement =
                  convertMode === 'start'
                    ? { mode: 'start' }
                    : convertMode === 'after' && chapters.length > 0
                      ? { mode: 'after', afterChapterId: afterChapterId || chapters[chapters.length - 1].id }
                      : { mode: 'end' };
                void draftActions.onConvertDraftToChapter?.(scene.id, placement);
                setBridgeAction(null);
              }}
            >
              Подтвердить перенос
            </button>
            <button
              type="button"
              className="draft-scene-banner__btn"
              style={{ fontSize: 12, padding: '4px 10px', height: 28 }}
              onClick={() => setBridgeAction(null)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {bridgeAction === 'insert' && draftActions?.onInsertDraftIntoChapter && chapters.length > 0 && (
        <div className="draft-scene-banner__panel">
          <span style={{ font: '500 12px var(--font-ui)', color: 'var(--paper-ink-2)' }}>Глава:</span>
          <select
            aria-label="Выбрать главу для вставки сцены"
            value={insertChapterId || chapters[0].id}
            onChange={(e) => setInsertChapterId(e.target.value)}
            className="draft-scene-banner__select"
          >
            {chapters.map((ch, idx) => (
              <option key={ch.id} value={ch.id}>
                {idx + 1}. {ch.title || 'Без названия'}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              ['end', 'Дописать в конец'],
              ['start', 'Вставить в начало'],
            ] as const).map(([pos, lbl]) => (
              <button
                key={pos}
                type="button"
                onClick={() => setInsertPos(pos)}
                className={`draft-scene-banner__seg-btn${insertPos === pos ? ' draft-scene-banner__seg-btn--on' : ''}`}
              >
                {lbl}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn--primary"
              style={{ fontSize: 12, padding: '4px 12px', height: 28 }}
              onClick={() => {
                const targetId = insertChapterId || chapters[0].id;
                void draftActions.onInsertDraftIntoChapter?.(scene.id, targetId, insertPos);
                setBridgeAction(null);
              }}
            >
              Подтвердить вставку
            </button>
            <button
              type="button"
              className="draft-scene-banner__btn"
              style={{ fontSize: 12, padding: '4px 10px', height: 28 }}
              onClick={() => setBridgeAction(null)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        message="Свободная сцена и её текст будут удалены без возможности восстановления."
        confirmLabel="Удалить черновик"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          draftActions?.onDeleteDraft?.(scene.id);
        }}
      />
    </>
  );
}

function ChapterSheet({
  chapter,
  content,
  contentReady,
  onContentChange,
  onTitleChange,
  onEditor,
  width,
  padding,
  userDictionary,
  onAddWord,
  nextChapter,
  onNextChapter,
  characters,
  highlightCharacters,
  onMentionClick,
}: ChapterSheetProps) {
  const footerSlot = contentReady !== false && nextChapter && onNextChapter ? (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
      <button type="button" className="btn btn--ghost" onClick={onNextChapter}>
        Следующая глава: {nextChapter.title || 'Без названия'} <Icon name="chev" size={14} />
      </button>
    </div>
  ) : undefined;

  return (
    <ManuscriptSheet
      id={chapter.id}
      title={chapter.title}
      titlePlaceholder="Без названия"
      titleAriaLabel="Название главы"
      content={content}
      contentReady={contentReady}
      contentPlaceholder="Начните писать главу…"
      contentKey={chapter.id}
      onContentChange={onContentChange}
      onTitleChange={onTitleChange}
      onEditor={onEditor}
      width={width}
      padding={padding}
      userDictionary={userDictionary}
      onAddWord={onAddWord}
      characters={characters}
      highlightCharacters={highlightCharacters}
      onMentionClick={onMentionClick}
      footerSlot={footerSlot}
    />
  );
}

interface DraftSceneSheetProps {
  scene: DraftScene;
  chapters: ChapterMeta[];
  onContentChange: (html: string) => void;
  onTitleChange: (title: string) => void;
  onEditor: (editor: Editor | null) => void;
  width: number | string;
  padding: string;
  userDictionary?: string[];
  onAddWord?: (word: string) => void;
  characters?: Character[];
  highlightCharacters?: boolean;
  onMentionClick?: (characterId: string) => void;
  draftActions?: DraftSceneActions;
}

function DraftSceneSheet({
  scene,
  chapters,
  onContentChange,
  onTitleChange,
  onEditor,
  width,
  padding,
  userDictionary,
  onAddWord,
  characters,
  highlightCharacters,
  onMentionClick,
  draftActions,
}: DraftSceneSheetProps) {
  const headerSlot = (
    <DraftSceneBridgeBar
      scene={scene}
      chapters={chapters}
      draftActions={draftActions}
    />
  );

  return (
    <ManuscriptSheet
      id={scene.id}
      title={scene.title}
      titlePlaceholder="Название сцены или фрагмента"
      titleAriaLabel="Название черновика"
      content={scene.content}
      contentReady={true}
      contentPlaceholder="Набросайте сцену, диалог или мысль вне структуры глав…"
      contentKey={`draft-${scene.id}`}
      onContentChange={onContentChange}
      onTitleChange={onTitleChange}
      onEditor={onEditor}
      width={width}
      padding={padding}
      userDictionary={userDictionary}
      onAddWord={onAddWord}
      characters={characters}
      highlightCharacters={highlightCharacters}
      onMentionClick={onMentionClick}
      headerSlot={headerSlot}
    />
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
  activeContentReady?: boolean;
  onContentChange?: (html: string) => void;
  onTitleChange?: (title: string) => void;
  draftScenes?: DraftScene[];
  activeDraft?: DraftScene | null;
  draftActions?: DraftSceneActions;
  onDraftContentChange?: (html: string) => void;
  onDraftTitleChange?: (title: string) => void;
  onGoalChange?: (goal: number) => void;
  saveState?: SaveState;
  savedAt?: Date | null;
  /** Вызывается по Ctrl+S — принудительный flush debounce */
  onSave?: () => void;
  /** Отменить pending-автосейв перед восстановлением версии (защита от затирания) */
  onBeforeRestore?: () => void | Promise<void>;
  onRebase?: (chapterId: string, updatedAt: string) => void;
  versionToast?: boolean;
  /** Демо-режим на /demo: скрывает share (данные не сохраняются). */
  demo?: boolean;
}

export function EditorHybrid({
  defaultMode = 'studio',
  book,
  chapters,
  activeChapter,
  activeContent = '',
  activeContentReady = true,
  chapterActions,
  onContentChange,
  onTitleChange,
  draftScenes,
  activeDraft = null,
  draftActions,
  onDraftContentChange,
  onDraftTitleChange,
  onGoalChange,
  saveState = 'idle',
  savedAt = null,
  onSave,
  onBeforeRestore,
  onRebase,
  versionToast = false,
  demo = false,
}: EditorHybridProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [focusMode, setFocusMode] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  // Незавершённая CSS-анимация (fill-mode: both) держит transform отличным от
  // none даже в покое — это создаёт containing block и клипует position:fixed
  // потомков (модалки/дропдауны) шириной панели. Снимаем animation после входа.
  const [rightPanelEntered, setRightPanelEntered] = useState(false);
  const restoreContent = useCallback((content: string) => {
    editor?.commands.setContent(content, { emitUpdate: false });
  }, [editor]);
  const { isMobile, showLeft, showRight, isPage, cols, sheetWidth, sheetPad, wrapPad } = useEditorLayout(mode);
  const { sidebar, right } = useMobileDrawers(isMobile);
  const mobileSidebarPanelRef = useRef<HTMLDivElement>(null);
  const mobileRightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!right.isOpen) setRightPanelEntered(false);
  }, [right.isOpen]);

  // Мобильные drawer-ы (сайдбар/заметки) ниже дублируют разметку
  // MobileSidebarDrawer.tsx инлайново (см. CLAUDE.md sibling audit), но без
  // её a11y-кита — добавляем Escape + focus + Tab-трап здесь же, не трогая
  // сами Sidebar/RightPanel и не вынося в общий компонент (разный набор
  // пропов у sidebar vs right панели, вынос — отдельная задача).
  useEffect(() => {
    if (!sidebar.isOpen && !right.isOpen) return;
    const panel = sidebar.isOpen ? mobileSidebarPanelRef.current : mobileRightPanelRef.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    panel?.focus();
    return () => { prevFocus?.focus(); };
  }, [sidebar.isOpen, right.isOpen, sidebar, right]);
  useEscapeToClose(sidebar.isOpen || right.isOpen, () => {
    if (sidebar.isOpen) sidebar.close();
    if (right.isOpen) right.close();
  });

  const trapTabIn = (panelRef: React.RefObject<HTMLDivElement>) => (e: React.KeyboardEvent<HTMLElement>) => trapTab(e, panelRef.current);
  const isReal = Boolean(chapters);
  const nextChapter = (() => {
    if (!chapters || !activeChapter) return null;
    const idx = chapters.findIndex((c) => c.id === activeChapter.id);
    return idx !== -1 && idx < chapters.length - 1 ? chapters[idx + 1] : null;
  })();
  const writingStats = useWritingStats(book?.id, book?.imported_words ?? 0);
  const { refetch: refetchStats } = writingStats;
  const { plan } = useUserDisplay();
  const isPro = plan === 'pro' || plan === 'lifetime';

  const { data: characters = [] } = useCharacters(book?.id);
  const [focusedChar, setFocusedChar] = useState<{ id: string; ts: number } | null>(null);

  const handleFocusCharacter = useCallback((charId: string) => {
    if (isMobile) {
      right.open();
    } else if (!showRight) {
      setMode('right');
    }
    setFocusedChar({ id: charId, ts: Date.now() });
  }, [isMobile, right, showRight, setMode]);

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

  const { showNoteForm, resetShowNoteForm } = useKeyboardShortcuts({
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
  const { toast: goalToast } = useGoalToast({ todayWords: writingStats.todayWords, dailyGoal, isLoading: writingStats.isLoading });

  return (
    <div className="as" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: cols, overflow: 'hidden' }}>
      {isPage && !isMobile && <RailNav active="editor" bookId={book?.id} style={{ position: 'relative', height: '100%' }} />}

      {showLeft && (
        <div style={{ animation: 'fade-in 0.15s cubic-bezier(0.22, 1, 0.36, 1) both', display: 'contents' }}>
          <Sidebar
            book={book}
            chapters={chapters}
            activeChapterId={activeDraft ? null : (activeChapter?.id ?? null)}
            chapterActions={chapterActions}
            draftScenes={draftScenes}
            activeDraftId={activeDraft?.id ?? null}
            draftActions={draftActions}
            demo={demo}
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
            {(activeDraft || activeChapter) && (
              <span style={{ font: '500 13px var(--font-serif)', color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(activeDraft ? activeDraft.title : activeChapter?.title) || 'Без названия'}
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
            activeDraft ? (
              <DraftSceneSheet
                scene={activeDraft}
                chapters={chapters ?? []}
                onContentChange={(html) => onDraftContentChange?.(html)}
                onTitleChange={(title) => onDraftTitleChange?.(title)}
                onEditor={setEditor}
                width={sheetWidth}
                padding={sheetPad}
                userDictionary={userDictionary}
                onAddWord={handleAddWord}
                characters={characters}
                highlightCharacters={!focusMode}
                onMentionClick={handleFocusCharacter}
                draftActions={draftActions}
              />
            ) : activeChapter ? (
              <ChapterSheet
                chapter={activeChapter}
                content={activeContent}
                contentReady={activeContentReady}
                onContentChange={(html) => onContentChange?.(html)}
                onTitleChange={(title) => onTitleChange?.(title)}
                onEditor={setEditor}
                width={sheetWidth}
                padding={sheetPad}
                userDictionary={userDictionary}
                onAddWord={handleAddWord}
                nextChapter={nextChapter}
                onNextChapter={nextChapter ? () => chapterActions?.onSelectChapter?.(nextChapter.id) : undefined}
                characters={characters}
                highlightCharacters={!focusMode}
                onMentionClick={handleFocusCharacter}
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
            onBeforeRestore={onBeforeRestore}
            onRebase={onRebase}
            showNoteForm={showNoteForm}
            onNoteFormClose={resetShowNoteForm}
            demo={demo}
            focusedCharacterId={focusedChar?.id}
            focusedCharacterTs={focusedChar?.ts}
            isDraft={Boolean(activeDraft)}
            draftId={activeDraft?.id}
          />
        </div>
      )}
      </div>

      {!isPage && (
        isReal ? (
          <StatusBar
            words={activeDraft ? activeDraft.words : (activeChapter?.words ?? 0)}
            chars={(activeDraft ? activeDraft.content : activeContent).replace(/<[^>]+>/g, '').length}
            statusLabel={saveLabel(saveState, savedAt)}
            saveState={saveState}
            todayWords={writingStats.todayWords}
            goalWords={book?.daily_goal ?? 1000}
            streak={writingStats.streak}
            bookTitle={book?.title}
            totalWords={chapters?.reduce((sum, c) => sum + (c.words ?? 0), 0)}
            onGoalChange={onGoalChange}
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode(f => !f)}
          />
        ) : (
          <StatusBar />
        )
      )}

      {isMobile && sidebar.isOpen && (
        <>
          <div
            role="presentation"
            onClick={sidebar.close}
            style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', zIndex: 'calc(var(--z-drawer) - 1)' }}
          />
          <div
            ref={mobileSidebarPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Навигация"
            tabIndex={-1}
            onKeyDown={trapTabIn(mobileSidebarPanelRef)}
            className="as"
            style={{ position: 'fixed', top: 0, left: 0, width: 280, height: '100%', zIndex: 'var(--z-drawer)', boxShadow: '4px 0 32px oklch(0.05 0.01 50 / 0.35)', outline: 'none' }}
          >
            <Sidebar
              book={book}
              chapters={chapters}
              activeChapterId={activeDraft ? null : (activeChapter?.id ?? null)}
              chapterActions={chapterActions ? {
                ...chapterActions,
                onSelectChapter: (id) => { chapterActions.onSelectChapter?.(id); sidebar.close(); },
              } : undefined}
              draftScenes={draftScenes}
              activeDraftId={activeDraft?.id ?? null}
              draftActions={draftActions ? {
                ...draftActions,
                onSelectDraft: (id) => { draftActions.onSelectDraft?.(id); sidebar.close(); },
              } : undefined}
              demo={demo}
            />
          </div>
        </>
      )}

      {isMobile && right.isOpen && (
        <>
          <div
            role="presentation"
            onClick={right.close}
            style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', zIndex: 'calc(var(--z-drawer) - 1)' }}
          />
          <div
            ref={mobileRightPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Заметки и версии"
            tabIndex={-1}
            onKeyDown={trapTabIn(mobileRightPanelRef)}
            onAnimationEnd={() => setRightPanelEntered(true)}
            style={{ position: 'fixed', top: 0, right: 0, width: 300, maxWidth: '90vw', height: '100%', zIndex: 'var(--z-drawer)', boxShadow: '-4px 0 32px oklch(0.05 0.01 50 / 0.35)', animation: rightPanelEntered ? 'none' : 'panel-enter-right 0.22s cubic-bezier(0.22, 1, 0.36, 1) both', outline: 'none' }}
          >
            <RightPanel
              bookId={book?.id}
              chapterId={activeChapter?.id}
              chapterTitle={activeChapter?.title}
              userId={activeChapter?.user_id}
              currentContent={activeContent}
              isPro={isPro}
              onRestoreContent={restoreContent}
              onBeforeRestore={onBeforeRestore}
              onRebase={onRebase}
              showNoteForm={showNoteForm}
              onNoteFormClose={resetShowNoteForm}
              demo={demo}
              focusedCharacterId={focusedChar?.id}
              focusedCharacterTs={focusedChar?.ts}
              isDraft={Boolean(activeDraft)}
              draftId={activeDraft?.id}
            />
          </div>
        </>
      )}

      {hoveredChar && book?.id && (
        <Suspense fallback={null}>
          <CharacterHoverCard
            state={hoveredChar}
            bookId={book.id}
            onMouseEnter={onCardEnter}
            onMouseLeave={onCardLeave}
          />
        </Suspense>
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
              bottom: 'calc(52px + env(safe-area-inset-bottom, 0px))',
              right: 20,
              zIndex: 'var(--z-drawer)',
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
              bottom: goalToast ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : 'calc(52px + env(safe-area-inset-bottom, 0px))',
              right: 20,
              zIndex: 'var(--z-drawer)',
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
