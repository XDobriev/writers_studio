import { useState, useEffect, useRef } from 'react';
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
}

function ChapterSheet({ chapter, content, onContentChange, onTitleChange, onEditor, width, padding }: ChapterSheetProps) {
  return (
    <div className="sheet" style={{ width, padding }}>
      <input
        className="sheet-title"
        value={chapter.title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Без названия"
        aria-label="Название главы"
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
      />
    </div>
  );
}


function formatTime(d: Date): string {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function saveLabel(state: SaveState, savedAt: Date | null): string {
  if (state === 'saving') return 'Сохранение…';
  if (state === 'error') return 'Ошибка сохранения';
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
  bookHref?: string;
  chapterActions?: ChapterActions;
  onContentChange?: (html: string) => void;
  onTitleChange?: (title: string) => void;
  onGoalChange?: (goal: number) => void;
  saveState?: SaveState;
  savedAt?: Date | null;
}

export function EditorHybrid({
  defaultMode = 'studio',
  book,
  chapters,
  activeChapter,
  activeContent = '',
  bookHref,
  chapterActions,
  onContentChange,
  onTitleChange,
  onGoalChange,
  saveState = 'idle',
  savedAt = null,
}: EditorHybridProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const { isMobile, showLeft, showRight, isPage, cols, sheetWidth, sheetPad } = useEditorLayout(mode);
  const isReal = Boolean(chapters);
  const writingStats = useWritingStats(book?.id);
  const { plan, planLoaded } = useUserDisplay();
  const isPro = plan === 'pro' || plan === 'lifetime';

  const prevSaveState = useRef<SaveState>(saveState);
  useEffect(() => {
    if (prevSaveState.current !== 'saved' && saveState === 'saved') {
      writingStats.refetch();
    }
    prevSaveState.current = saveState;
  }, [saveState, writingStats.refetch]);

  useEffect(() => {
    if (!isMobile) setShowMobileSidebar(false);
  }, [isMobile]);


  return (
    <div className="as" style={{ height: '100%', overflow: 'hidden', display: 'grid', gridTemplateColumns: cols, background: 'var(--bg)', position: 'relative', transition: 'none' }}>
      {isPage && !isMobile && <RailNav active="editor" bookId={book?.id} style={{ position: 'relative', height: '100%' }} />}

      {showLeft && (
        <Sidebar
          book={book}
          chapters={chapters}
          activeChapterId={activeChapter?.id ?? null}
          chapterActions={chapterActions}
          bookHref={bookHref}
        />
      )}

      <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
        {isMobile && !isPage && (
          <div style={{ display: 'flex', alignItems: 'center', height: 44, padding: '0 12px', gap: 8, borderBottom: '1px solid var(--border-soft)', background: 'var(--bg)', flexShrink: 0 }}>
            <button
              type="button"
              className="tb-btn"
              onClick={() => setShowMobileSidebar(true)}
              title="Главы"
              style={{ flexShrink: 0 }}
            >
              <Icon name="panel" size={16} />
            </button>
            {activeChapter && (
              <span style={{ font: '500 13px var(--font-serif)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeChapter.title || 'Без названия'}
              </span>
            )}
          </div>
        )}
        {isPage ? (
          <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg)' }}>
            <ModeSegment mode={mode} setMode={setMode} />
          </div>
        ) : (
          <EditorToolbar editor={editor} mode={mode} setMode={setMode} variant="studio" showModes={!isMobile} />
        )}

        <div className="sheet-wrap" style={{ padding: isMobile ? '16px 8px 0' : (isPage ? '48px 56px 0' : '36px 32px 0') }}>
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
              todayWords={writingStats.todayWords}
              goalWords={book?.daily_goal ?? 1000}
              streak={writingStats.streak}
              onGoalChange={onGoalChange}
            />
          ) : (
            <StatusBar />
          )
        )}
      </main>

      {showRight && (
        <RightPanel
          bookId={book?.id}
          chapterId={activeChapter?.id}
          chapterTitle={activeChapter?.title}
          userId={activeChapter?.user_id}
          currentContent={activeContent}
          isPro={isPro}
          planLoaded={planLoaded}
        />
      )}

      {isMobile && showMobileSidebar && (
        <>
          <div
            role="presentation"
            onClick={() => setShowMobileSidebar(false)}
            style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', zIndex: 40 }}
          />
          <div style={{ position: 'fixed', top: 0, left: 0, width: 280, height: '100%', zIndex: 41, boxShadow: '4px 0 32px oklch(0.05 0.01 50 / 0.35)' }}>
            <Sidebar
              book={book}
              chapters={chapters}
              activeChapterId={activeChapter?.id ?? null}
              chapterActions={chapterActions ? {
                ...chapterActions,
                onSelectChapter: (id) => { chapterActions.onSelectChapter?.(id); setShowMobileSidebar(false); },
              } : undefined}
              bookHref={bookHref}
            />
          </div>
        </>
      )}
    </div>
  );
}
