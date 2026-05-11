import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Sidebar, RightPanel, StatusBar } from './Chrome';
import { SAMPLE_PROSE } from '../data/sample';
import type { Book } from '../lib/supabase';
import type { Chapter } from '../lib/chapters';

type Mode = 'studio' | 'left' | 'right' | 'page';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface ModeSegmentProps {
  mode: Mode;
  setMode: (m: Mode) => void;
}

function ModeSegment({ mode, setMode }: ModeSegmentProps) {
  const opts: Array<[Mode, Parameters<typeof Icon>[0]['name'], string]> = [
    ['studio', 'layout', 'Студия'],
    ['left', 'panel', 'Сайдбар'],
    ['right', 'note', 'На полях'],
    ['page', 'focus', 'Страница'],
  ];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)' }}>
      {opts.map(([k, icn, l]) => (
        <button
          key={k}
          onClick={() => setMode(k)}
          className={'tb-btn' + (mode === k ? ' tb-btn--on' : '')}
          style={{ height: 24, padding: '0 8px', borderRadius: 6, gap: 4, color: mode === k ? 'var(--ink)' : 'var(--ink-3)' }}
        >
          <Icon name={icn} size={13} />
          <span style={{ fontSize: 11, letterSpacing: '0.01em' }}>{l}</span>
        </button>
      ))}
    </div>
  );
}

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

function StudioToolbar({ mode, setMode }: ModeSegmentProps) {
  return (
    <div className="tb">
      <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}><Icon name="bold" /></button>
      <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}><Icon name="italic" /></button>
      <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}><Icon name="underline" /></button>
      <span className="tb-sep" />
      <button className="tb-sel" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'H2'); }}>Заголовок 2 <Icon name="chevd" size={12} /></button>
      <span className="tb-sep" />
      <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}><Icon name="list" /></button>
      <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'BLOCKQUOTE'); }}><Icon name="quote" /></button>
      <button className="tb-btn"><Icon name="link" /></button>
      <span className="tb-sep" />
      <button className="tb-btn tb-btn--on"><Icon name="track" size={15} /> Правки</button>
      <div className="tb-spacer" />
      <ModeSegment mode={mode} setMode={setMode} />
      <span className="tb-sep" />
      <button className="tb-btn"><Icon name="speak" size={15} /></button>
      <button className="tb-btn"><Icon name="timer" size={15} /></button>
      <button className="tb-btn"><Icon name="download" size={15} /> Экспорт</button>
    </div>
  );
}

interface PageHeaderProps extends ModeSegmentProps {
  bookTitle?: string;
  chapterTitle?: string;
  chapterIndex?: number;
  status?: Chapter['status'];
  words?: number;
}

const STATUS_LABEL: Record<Chapter['status'], string> = {
  draft: 'черновик',
  progress: 'в работе',
  done: 'готово',
};

function PageHeader({ mode, setMode, bookTitle, chapterTitle, chapterIndex, status, words }: PageHeaderProps) {
  return (
    <div style={{ height: 54, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 12, borderBottom: '1px solid var(--border-soft)', background: 'var(--bg)' }}>
      <span style={{ font: '400 12px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{bookTitle ?? 'Книга'}</span>
      <span style={{ color: 'var(--ink-4)' }}>›</span>
      <span style={{ font: '500 13px var(--font-serif)', color: 'var(--ink)' }}>
        {chapterIndex != null && `${String(chapterIndex + 1).padStart(2, '0')}. `}{chapterTitle ?? 'Без главы'}
      </span>
      <div style={{ flex: 1 }} />
      {status && <span className="chip">{STATUS_LABEL[status]} · {(words ?? 0).toLocaleString('ru')} сл</span>}
      <span style={{ width: 1, height: 18, background: 'var(--border-soft)', margin: '0 4px' }} />
      <ModeSegment mode={mode} setMode={setMode} />
    </div>
  );
}

function FloatingPill() {
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 2,
      background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 999,
      padding: '4px 6px', boxShadow: '0 8px 28px rgba(0,0,0,.35)', zIndex: 5,
    }}>
      <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}><Icon name="bold" /></button>
      <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}><Icon name="italic" /></button>
      <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}><Icon name="underline" /></button>
      <span className="tb-sep" />
      <button className="tb-sel" style={{ padding: '0 12px' }} onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'H2'); }}>H2 <Icon name="chevd" size={12} /></button>
      <span className="tb-sep" />
      <button className="tb-btn" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'BLOCKQUOTE'); }}><Icon name="quote" /></button>
      <button className="tb-btn"><Icon name="link" /></button>
      <button className="tb-btn"><Icon name="color" /></button>
      <span className="tb-sep" />
      <button className="tb-btn tb-btn--on" style={{ color: 'var(--accent)' }}><Icon name="track" size={15} /></button>
      <button className="tb-btn"><Icon name="sparkles" size={15} /></button>
      <span className="tb-sep" />
      <button className="tb-btn"><Icon name="speak" size={15} /></button>
      <button className="tb-btn"><Icon name="timer" size={15} /></button>
    </div>
  );
}

interface ChapterSheetProps {
  chapter: Chapter;
  onContentChange: (html: string) => void;
  onTitleChange: (title: string) => void;
  width: number;
  padding: string;
}

function ChapterSheet({ chapter, onContentChange, onTitleChange, width, padding }: ChapterSheetProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!bodyRef.current) return;
    if (bodyRef.current.innerHTML !== chapter.content) {
      bodyRef.current.innerHTML = chapter.content || '<p><br/></p>';
    }
  }, [chapter.id]);

  return (
    <div className="sheet" style={{ width, padding }}>
      <input
        className="sheet-title"
        value={chapter.title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Без названия"
        style={{
          width: '100%', background: 'transparent', border: 'none', outline: 'none',
          font: '600 30px var(--font-serif)', letterSpacing: '-0.012em', color: 'var(--ink)',
          padding: 0, marginBottom: 22,
        }}
      />
      <div
        ref={bodyRef}
        className="sheet-body"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={(e) => onContentChange((e.currentTarget as HTMLDivElement).innerHTML)}
        style={{ outline: 'none', minHeight: 300 }}
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
  chapters?: Chapter[];
  activeChapter?: Chapter | null;
  bookHref?: string;
  onSelectChapter?: (id: string) => void;
  onCreateChapter?: () => void;
  onContentChange?: (html: string) => void;
  onTitleChange?: (title: string) => void;
  saveState?: SaveState;
  savedAt?: Date | null;
}

export function EditorHybrid({
  defaultMode = 'studio',
  book,
  chapters,
  activeChapter,
  bookHref,
  onSelectChapter,
  onCreateChapter,
  onContentChange,
  onTitleChange,
  saveState = 'idle',
  savedAt = null,
}: EditorHybridProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const showLeft = mode === 'studio' || mode === 'left';
  const showRight = mode === 'studio' || mode === 'right';
  const isPage = mode === 'page';
  const isReal = Boolean(chapters);

  const cols = isPage
    ? '1fr'
    : showLeft && showRight
    ? '260px 1fr 320px'
    : showLeft
    ? '260px 1fr'
    : showRight
    ? '1fr 320px'
    : '1fr';

  const sheetWidth = isPage ? 740 : 680;
  const sheetPad = isPage ? '64px 80px 80px' : '48px 64px 80px';

  const chapterIndex = isReal && activeChapter
    ? chapters!.findIndex((c) => c.id === activeChapter.id)
    : -1;

  return (
    <div className="as" style={{ height: '100%', display: 'grid', gridTemplateColumns: cols, background: 'var(--bg)', position: 'relative', transition: 'grid-template-columns 220ms cubic-bezier(.2,.7,.3,1)' }}>
      {showLeft && (
        <Sidebar
          active={1}
          book={book}
          chapters={chapters}
          activeChapterId={activeChapter?.id ?? null}
          onSelectChapter={onSelectChapter}
          onCreateChapter={onCreateChapter}
          bookHref={bookHref}
        />
      )}

      <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
        {isPage ? (
          <PageHeader
            mode={mode}
            setMode={setMode}
            bookTitle={book?.title}
            chapterTitle={activeChapter?.title}
            chapterIndex={chapterIndex >= 0 ? chapterIndex : undefined}
            status={activeChapter?.status}
            words={activeChapter?.words}
          />
        ) : (
          <StudioToolbar mode={mode} setMode={setMode} />
        )}

        <div className="sheet-wrap" style={{ padding: isPage ? '48px 56px 110px' : '36px 32px 0' }}>
          {isReal ? (
            activeChapter ? (
              <ChapterSheet
                chapter={activeChapter}
                onContentChange={(html) => onContentChange?.(html)}
                onTitleChange={(title) => onTitleChange?.(title)}
                width={sheetWidth}
                padding={sheetPad}
              />
            ) : (
              <div className="sheet" style={{ width: sheetWidth, padding: sheetPad, color: 'var(--ink-3)', textAlign: 'center' }}>
                <div style={{ font: '500 18px var(--font-serif)', color: 'var(--ink-2)', marginBottom: 8 }}>Глав пока нет.</div>
                <div style={{ marginBottom: 18, fontSize: 13 }}>Создайте первую главу — она появится в боковой панели.</div>
                <button className="btn btn--primary" onClick={onCreateChapter}>
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
              chars={(activeChapter?.content ?? '').replace(/<[^>]+>/g, '').length}
              statusLabel={saveLabel(saveState, savedAt)}
            />
          ) : (
            <StatusBar />
          )
        )}
        {isPage && <FloatingPill />}
      </main>

      {showRight && <RightPanel tab="margins" />}
    </div>
  );
}
