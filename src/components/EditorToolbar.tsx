import { useEffect, useRef, useState } from 'react';
import type { Editor } from './RichEditor';
import { Icon } from './Icon';

export type EditorMode = 'studio' | 'left' | 'right' | 'page';

interface ToolbarProps {
  editor: Editor | null;
  mode?: EditorMode;
  setMode?: (m: EditorMode) => void;
  variant?: 'studio' | 'pill';
  showModes?: boolean;
  showExtras?: boolean;
}

const TEXT_COLORS: Array<{ label: string; value: string }> = [
  { label: 'По умолчанию', value: '' },
  { label: 'Чёрный', value: '#1a1a1a' },
  { label: 'Серый', value: '#5a5a5a' },
  { label: 'Красный', value: '#c43d3d' },
  { label: 'Оранжевый', value: '#d97706' },
  { label: 'Зелёный', value: '#2f9c4f' },
  { label: 'Голубой', value: '#2563eb' },
  { label: 'Фиолетовый', value: '#7c3aed' },
  { label: 'Розовый', value: '#db2777' },
];

const HIGHLIGHT_COLORS: Array<{ label: string; value: string }> = [
  { label: 'Снять', value: '' },
  { label: 'Жёлтый', value: '#fef3c7' },
  { label: 'Зелёный', value: '#d1fae5' },
  { label: 'Голубой', value: '#dbeafe' },
  { label: 'Розовый', value: '#fce7f3' },
  { label: 'Фиолетовый', value: '#ede9fe' },
  { label: 'Оранжевый', value: '#fed7aa' },
];

function btnCls(active: boolean) {
  return 'tb-btn' + (active ? ' tb-btn--on' : '');
}

function HeadingDropdown({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = editor?.isActive('heading', { level: 1 })
    ? 'Заголовок 1'
    : editor?.isActive('heading', { level: 2 })
    ? 'Заголовок 2'
    : editor?.isActive('heading', { level: 3 })
    ? 'Заголовок 3'
    : 'Обычный';

  const set = (action: () => void) => (ev: React.MouseEvent) => {
    ev.preventDefault();
    action();
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="tb-sel"
        title="Уровень текста"
        disabled={!editor}
        onMouseDown={(ev) => { ev.preventDefault(); setOpen((v) => !v); }}
      >
        {current} <Icon name="chevd" size={12} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
          background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 8,
          padding: 4, boxShadow: '0 12px 28px rgba(0,0,0,.35)',
          minWidth: 160, display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          <button
            type="button"
            className={btnCls(!editor?.isActive('heading'))}
            style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: 13 }}
            onMouseDown={set(() => editor?.chain().focus().setParagraph().run())}
          >Обычный текст</button>
          <button
            type="button"
            className={btnCls(!!editor?.isActive('heading', { level: 1 }))}
            style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: 17, fontWeight: 600, fontFamily: 'var(--font-serif)' }}
            onMouseDown={set(() => editor?.chain().focus().toggleHeading({ level: 1 }).run())}
          >Заголовок 1</button>
          <button
            type="button"
            className={btnCls(!!editor?.isActive('heading', { level: 2 }))}
            style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-serif)' }}
            onMouseDown={set(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
          >Заголовок 2</button>
          <button
            type="button"
            className={btnCls(!!editor?.isActive('heading', { level: 3 }))}
            style={{ justifyContent: 'flex-start', padding: '6px 10px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-serif)' }}
            onMouseDown={set(() => editor?.chain().focus().toggleHeading({ level: 3 }).run())}
          >Заголовок 3</button>
        </div>
      )}
    </div>
  );
}

interface ColorPopoverProps {
  editor: Editor | null;
  kind: 'text' | 'highlight';
}

function ColorPopover({ editor, kind }: ColorPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const palette = kind === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const icon = kind === 'text' ? 'color' : 'highlight';
  const title = kind === 'text' ? 'Цвет текста' : 'Выделение цветом';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const apply = (value: string) => (ev: React.MouseEvent) => {
    ev.preventDefault();
    if (!editor) return;
    if (kind === 'text') {
      if (value) editor.chain().focus().setColor(value).run();
      else editor.chain().focus().unsetColor().run();
    } else {
      if (value) editor.chain().focus().setHighlight({ color: value }).run();
      else editor.chain().focus().unsetHighlight().run();
    }
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="tb-btn"
        title={title}
        disabled={!editor}
        onMouseDown={(ev) => { ev.preventDefault(); setOpen((v) => !v); }}
      >
        <Icon name={icon} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
          background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 8,
          padding: 8, boxShadow: '0 12px 28px rgba(0,0,0,.35)',
          display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gap: 6, minWidth: 0,
        }}>
          {palette.map((c) => (
            <button
              key={c.value || 'unset'}
              type="button"
              title={c.label}
              onMouseDown={apply(c.value)}
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: '1px solid var(--border-soft)',
                background: c.value || 'transparent',
                position: 'relative', cursor: 'pointer',
              }}
            >
              {!c.value && (
                <span style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: 'var(--ink-3)', letterSpacing: 0,
                }}>×</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkButton({ editor }: { editor: Editor | null }) {
  const active = !!editor?.isActive('link');
  const onSet = (ev: React.MouseEvent) => {
    ev.preventDefault();
    if (!editor) return;
    const prev = (editor.getAttributes('link').href as string | undefined) ?? '';
    const url = window.prompt('Адрес ссылки (пусто = удалить):', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };
  return (
    <>
      <button
        type="button"
        title="Ссылка"
        className={btnCls(active)}
        disabled={!editor}
        onMouseDown={onSet}
      ><Icon name="link" /></button>
      <button
        type="button"
        title="Убрать ссылку"
        className="tb-btn"
        disabled={!editor || !active}
        onMouseDown={(ev) => { ev.preventDefault(); editor?.chain().focus().unsetLink().run(); }}
      ><Icon name="unlink" /></button>
    </>
  );
}

function ModeSegment({ mode, setMode }: { mode: EditorMode; setMode: (m: EditorMode) => void }) {
  const opts: Array<[EditorMode, Parameters<typeof Icon>[0]['name'], string, string]> = [
    ['studio', 'layout', 'Студия', 'Студия — обе боковые панели'],
    ['left', 'panel', 'Сайдбар', 'Только левый сайдбар с главами'],
    ['right', 'note', 'На полях', 'Только правая панель с заметками'],
    ['page', 'focus', 'Страница', 'Только страница, без панелей'],
  ];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)' }}>
      {opts.map(([k, icn, l, tip]) => (
        <button
          key={k}
          type="button"
          onClick={() => setMode(k)}
          title={tip}
          className={'tb-btn' + (mode === k ? ' tb-btn--on' : '')}
          style={{ height: 24, padding: '0 8px', borderRadius: 6, gap: 4, color: mode === k ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'nowrap' }}
        >
          <Icon name={icn} size={13} />
          <span style={{ fontSize: 11, letterSpacing: '0.01em' }}>{l}</span>
        </button>
      ))}
    </div>
  );
}

export function EditorToolbar({ editor, mode, setMode, variant = 'studio', showModes = true, showExtras = true }: ToolbarProps) {
  const can = editor !== null;
  const run = (fn: (e: Editor) => void) => (ev: React.MouseEvent) => {
    ev.preventDefault();
    if (editor) fn(editor);
  };

  const wrapper = variant === 'pill' ? {
    position: 'absolute' as const, left: '50%', bottom: 24, transform: 'translateX(-50%)',
    display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' as const,
    background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 18,
    padding: '6px 10px', boxShadow: '0 8px 28px rgba(0,0,0,.35)', zIndex: 5,
    maxWidth: 'calc(100% - 48px)', justifyContent: 'center',
  } : undefined;

  return (
    <div className={variant === 'studio' ? 'tb tb--wrap' : undefined} style={wrapper}>
      <button
        type="button"
        title="Отменить (Ctrl+Z)"
        className="tb-btn"
        disabled={!can || !editor?.can().undo()}
        onMouseDown={run((e) => e.chain().focus().undo().run())}
      ><Icon name="undo" /></button>
      <button
        type="button"
        title="Повторить (Ctrl+Shift+Z)"
        className="tb-btn"
        disabled={!can || !editor?.can().redo()}
        onMouseDown={run((e) => e.chain().focus().redo().run())}
      ><Icon name="redo" /></button>
      <span className="tb-sep" />

      <HeadingDropdown editor={editor} />
      <span className="tb-sep" />

      <button
        type="button"
        title="Жирный (Ctrl+B)"
        className={btnCls(!!editor?.isActive('bold'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleBold().run())}
      ><Icon name="bold" /></button>
      <button
        type="button"
        title="Курсив (Ctrl+I)"
        className={btnCls(!!editor?.isActive('italic'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleItalic().run())}
      ><Icon name="italic" /></button>
      <button
        type="button"
        title="Подчёркнутый (Ctrl+U)"
        className={btnCls(!!editor?.isActive('underline'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleUnderline().run())}
      ><Icon name="underline" /></button>
      <button
        type="button"
        title="Зачёркнутый"
        className={btnCls(!!editor?.isActive('strike'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleStrike().run())}
      ><Icon name="strike" /></button>
      <button
        type="button"
        title="Очистить форматирование"
        className="tb-btn"
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().unsetAllMarks().clearNodes().run())}
      ><Icon name="clear" /></button>
      <span className="tb-sep" />

      <ColorPopover editor={editor} kind="text" />
      <ColorPopover editor={editor} kind="highlight" />
      <span className="tb-sep" />

      <button
        type="button"
        title="Надстрочный"
        className={btnCls(!!editor?.isActive('superscript'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleSuperscript().run())}
      ><Icon name="sup" /></button>
      <button
        type="button"
        title="Подстрочный"
        className={btnCls(!!editor?.isActive('subscript'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleSubscript().run())}
      ><Icon name="sub" /></button>
      <span className="tb-sep" />

      <button
        type="button"
        title="По левому краю"
        className={btnCls(!!editor?.isActive({ textAlign: 'left' }))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().setTextAlign('left').run())}
      ><Icon name="align" /></button>
      <button
        type="button"
        title="По центру"
        className={btnCls(!!editor?.isActive({ textAlign: 'center' }))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().setTextAlign('center').run())}
      ><Icon name="aligncenter" /></button>
      <button
        type="button"
        title="По правому краю"
        className={btnCls(!!editor?.isActive({ textAlign: 'right' }))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().setTextAlign('right').run())}
      ><Icon name="alignright" /></button>
      <button
        type="button"
        title="По ширине"
        className={btnCls(!!editor?.isActive({ textAlign: 'justify' }))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().setTextAlign('justify').run())}
      ><Icon name="alignjustify" /></button>
      <span className="tb-sep" />

      <button
        type="button"
        title="Маркированный список"
        className={btnCls(!!editor?.isActive('bulletList'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleBulletList().run())}
      ><Icon name="list" /></button>
      <button
        type="button"
        title="Нумерованный список"
        className={btnCls(!!editor?.isActive('orderedList'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleOrderedList().run())}
      ><Icon name="olist" /></button>
      <button
        type="button"
        title="Список задач"
        className={btnCls(!!editor?.isActive('taskList'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleTaskList().run())}
      ><Icon name="tasklist" /></button>
      <span className="tb-sep" />

      <button
        type="button"
        title="Цитата"
        className={btnCls(!!editor?.isActive('blockquote'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleBlockquote().run())}
      ><Icon name="quote" /></button>
      <button
        type="button"
        title="Инлайн-код"
        className={btnCls(!!editor?.isActive('code'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleCode().run())}
      ><Icon name="code" /></button>
      <button
        type="button"
        title="Блок кода"
        className={btnCls(!!editor?.isActive('codeBlock'))}
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().toggleCodeBlock().run())}
      ><Icon name="codeblock" /></button>
      <button
        type="button"
        title="Горизонтальная линия"
        className="tb-btn"
        disabled={!can}
        onMouseDown={run((e) => e.chain().focus().setHorizontalRule().run())}
      ><Icon name="hr" /></button>
      <span className="tb-sep" />

      <LinkButton editor={editor} />

      {showModes && mode && setMode && (
        <>
          <div className="tb-spacer" />
          <ModeSegment mode={mode} setMode={setMode} />
        </>
      )}

      {showExtras && (
        <>
          <span className="tb-sep" />
          <button type="button" className="tb-btn" disabled title="Голосовой ввод (скоро)"><Icon name="speak" size={15} /></button>
          <button type="button" className="tb-btn" disabled title="Таймер (скоро)"><Icon name="timer" size={15} /></button>
        </>
      )}
    </div>
  );
}
