import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from './RichEditor';
import { Icon } from './Icon';

type EditorMode = 'studio' | 'left' | 'right' | 'page';

interface ToolbarProps {
  editor: Editor | null;
  mode?: EditorMode;
  setMode?: (m: EditorMode) => void;
  variant?: 'studio' | 'pill';
  showModes?: boolean;
  isMobile?: boolean;
}

export function ModeSegment({ mode, setMode }: { mode: EditorMode; setMode: (m: EditorMode) => void }) {
  const opts: Array<[EditorMode, Parameters<typeof Icon>[0]['name'], string]> = [
    ['studio', 'layout', 'Фокус — обе боковые панели рядом с текстом'],
    ['left', 'panel', 'Структура — список глав, без правой панели'],
    ['right', 'note', 'Сплит — редактор и заметки рядом'],
    ['page', 'focus', 'Страница — чистый лист, без боковых панелей'],
  ];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, borderRadius: 8, background: 'var(--bg-deep)', border: '1px solid var(--border-soft)' }}>
      {opts.map(([k, icn, tip]) => (
        <button
          key={k}
          type="button"
          onClick={() => setMode(k)}
          title={tip}
          className={'tb-btn' + (mode === k ? ' tb-btn--on' : '')}
          style={{ height: 24, padding: '0 6px', borderRadius: 6, color: mode === k ? 'var(--ink)' : 'var(--ink-3)' }}
        >
          <Icon name={icn} size={14} />
        </button>
      ))}
    </div>
  );
}

const TEXT_COLORS: Array<{ label: string; value: string }> = [
  { label: 'Чёрный',          value: '#0f172a' },
  { label: 'Тёмно-серый',     value: '#374151' },
  { label: 'Серый',           value: '#6b7280' },
  { label: 'Светло-серый',    value: '#9ca3af' },
  { label: 'Бледно-серый',    value: '#d1d5db' },
  { label: 'Почти белый',     value: '#f9fafb' },
  { label: 'Тёмно-красный',   value: '#991b1b' },
  { label: 'Красный',         value: '#ef4444' },
  { label: 'Оранжевый',       value: '#f97316' },
  { label: 'Янтарный',        value: '#f59e0b' },
  { label: 'Лаймовый',        value: '#84cc16' },
  { label: 'Зелёный',         value: '#22c55e' },
  { label: 'Бирюзовый',       value: '#14b8a6' },
  { label: 'Голубой',         value: '#0ea5e9' },
  { label: 'Синий',           value: '#3b82f6' },
  { label: 'Индиго',          value: '#6366f1' },
  { label: 'Фиолетовый',      value: '#8b5cf6' },
  { label: 'Пурпурный',       value: '#a855f8' },
  { label: 'Фуксия',          value: '#d946ef' },
  { label: 'Розовый',         value: '#ec4899' },
  { label: 'Малиновый',       value: '#f43f5e' },
  { label: 'Алый',            value: '#e11d48' },
  { label: 'Коричневый',      value: '#92400e' },
  { label: 'Сланцевый',       value: '#475569' },
];

const HIGHLIGHT_COLORS: Array<{ label: string; value: string }> = [
  { label: 'Светло-красный',    value: '#fee2e2' },
  { label: 'Светло-оранжевый',  value: '#ffedd5' },
  { label: 'Светло-янтарный',   value: '#fef3c7' },
  { label: 'Светло-жёлтый',     value: '#fefce8' },
  { label: 'Светло-лаймовый',   value: '#f7fee7' },
  { label: 'Светло-зелёный',    value: '#dcfce7' },
  { label: 'Изумрудный',        value: '#d1fae5' },
  { label: 'Светло-бирюзовый',  value: '#ccfbf1' },
  { label: 'Светло-голубой',    value: '#cffafe' },
  { label: 'Светло-небесный',   value: '#e0f2fe' },
  { label: 'Светло-синий',      value: '#dbeafe' },
  { label: 'Светло-индиго',     value: '#e0e7ff' },
  { label: 'Светло-фиолетовый', value: '#ede9fe' },
  { label: 'Светло-пурпурный',  value: '#f3e8ff' },
  { label: 'Светло-сиреневый',  value: '#fae8ff' },
  { label: 'Светло-розовый',    value: '#fce7f3' },
  { label: 'Светло-малиновый',  value: '#ffe4e6' },
  { label: 'Светло-серый',      value: '#f1f5f9' },
  { label: 'Кораллово-розовый', value: '#fecaca' },
  { label: 'Медово-оранжевый',  value: '#fed7aa' },
  { label: 'Медово-жёлтый',     value: '#fde68a' },
  { label: 'Мятно-зелёный',     value: '#bbf7d0' },
  { label: 'Бирюзово-мятный',   value: '#a5f3fc' },
  { label: 'Лавандовый',        value: '#ddd6fe' },
];

function btnCls(active: boolean) {
  return 'tb-btn' + (active ? ' tb-btn--on' : '');
}

function PortalDropdown({
  anchor,
  onClose,
  children,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const posY = spaceBelow < 240
    ? { bottom: window.innerHeight - rect.top + 4 }
    : { top: rect.bottom + 4 };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        !ref.current?.contains(e.target as Node) &&
        !anchor.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', ...posY, left: rect.left, zIndex: 1000 }}
      onMouseDown={(e) => { e.preventDefault(); e.nativeEvent.stopPropagation(); }}
    >
      {children}
    </div>,
    document.body
  );
}

function HeadingDropdown({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const current = editor?.isActive('heading', { level: 1 })
    ? 'H1'
    : editor?.isActive('heading', { level: 2 })
    ? 'H2'
    : editor?.isActive('heading', { level: 3 })
    ? 'H3'
    : '¶';

  const set = (action: () => void) => (ev: React.MouseEvent) => {
    ev.preventDefault();
    action();
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="tb-sel"
        title="Уровень текста"
        disabled={!editor}
        onMouseDown={(ev) => { ev.preventDefault(); setOpen((v) => !v); }}
      >
        {current} <Icon name="chevd" size={12} />
      </button>
      {open && btnRef.current && (
        <PortalDropdown anchor={btnRef.current} onClose={() => setOpen(false)}>
          <div style={{
            background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 8,
            padding: 4, boxShadow: '0 12px 28px oklch(0.05 0.01 50 / 0.35)',
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
        </PortalDropdown>
      )}
    </>
  );
}

interface ColorPopoverProps {
  editor: Editor | null;
  kind: 'text' | 'highlight';
}

function ColorPopover({ editor, kind }: ColorPopoverProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const palette = kind === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const icon = kind === 'text' ? 'color' : 'highlight';
  const title = kind === 'text' ? 'Цвет текста' : 'Выделение цветом';

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
    <>
      <button
        ref={btnRef}
        type="button"
        className="tb-btn"
        title={title}
        disabled={!editor}
        onMouseDown={(ev) => { ev.preventDefault(); setOpen((v) => !v); }}
      >
        <Icon name={icon} />
      </button>
      {open && btnRef.current && (
        <PortalDropdown anchor={btnRef.current} onClose={() => setOpen(false)}>
          <div style={{
            background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 8,
            padding: 8, boxShadow: '0 12px 28px oklch(0.05 0.01 50 / 0.35)',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <button
              type="button"
              title={kind === 'text' ? 'По умолчанию' : 'Снять выделение'}
              onMouseDown={apply('')}
              style={{
                height: 22, borderRadius: 5, padding: '0 8px',
                border: '1px solid var(--border-soft)',
                background: 'transparent', cursor: 'pointer',
                fontSize: 11, color: 'var(--ink-3)',
              }}
            >
              {kind === 'text' ? 'По умолчанию' : 'Снять выделение'}
            </button>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(6, 22px)', gap: 4,
            }}>
              {palette.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onMouseDown={apply(c.value)}
                  style={{
                    width: 22, height: 22, borderRadius: 5,
                    border: '1px solid oklch(0 0 0 / 0.15)',
                    background: c.value,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        </PortalDropdown>
      )}
    </>
  );
}

function LinkPopover({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const active = !!editor?.isActive('link');

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        !popoverRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const toggleOpen = (ev: React.MouseEvent) => {
    ev.preventDefault();
    const current = (editor?.getAttributes('link').href as string | undefined) ?? '';
    setUrl(current);
    setOpen(v => !v);
  };

  const apply = () => {
    if (!editor) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setOpen(false);
  };

  const remove = (ev: React.MouseEvent) => {
    ev.preventDefault();
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    setOpen(false);
  };

  const openHref = (ev: React.MouseEvent) => {
    ev.preventDefault();
    const href = editor?.getAttributes('link').href as string | undefined;
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };

  const rect = btnRef.current?.getBoundingClientRect();
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 200;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Ссылка"
        className={btnCls(active)}
        disabled={!editor}
        onMouseDown={toggleOpen}
      ><Icon name="link" /></button>
      {open && rect && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            ...(spaceBelow < 180
              ? { bottom: window.innerHeight - rect.top + 4 }
              : { top: rect.bottom + 4 }
            ),
            left: rect.left, zIndex: 1000,
            background: 'var(--bg-deep)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 10, boxShadow: '0 12px 28px oklch(0.05 0.01 50 / 0.35)',
            minWidth: 280, display: 'flex', flexDirection: 'column', gap: 6,
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); apply(); }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="https://..."
            className="input"
            style={{ width: '100%', fontSize: 13, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); apply(); }}
              style={{
                flex: 1, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 500,
              }}
            >Применить</button>
            {active && (
              <button
                type="button"
                title="Открыть ссылку"
                onMouseDown={openHref}
                style={{
                  width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-soft)',
                  background: 'transparent', cursor: 'pointer', color: 'var(--ink-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              ><Icon name="eye" size={13} /></button>
            )}
            {active && (
              <button
                type="button"
                title="Убрать ссылку"
                onMouseDown={remove}
                style={{
                  width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-soft)',
                  background: 'transparent', cursor: 'pointer', color: 'var(--ink-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              ><Icon name="unlink" size={13} /></button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function EditorToolbar({ editor, mode, setMode, variant = 'studio', showModes = true, isMobile = false }: ToolbarProps) {
  const can = editor !== null;
  const run = (fn: (e: Editor) => void) => (ev: React.MouseEvent) => {
    ev.preventDefault();
    if (editor) fn(editor);
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, []);

  const buttons = (
    <>
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
      {!isMobile && (
        <>
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
        </>
      )}
      <span className="tb-sep" />

      <ColorPopover editor={editor} kind="text" />
      {!isMobile && <ColorPopover editor={editor} kind="highlight" />}
      <span className="tb-sep" />

      {!isMobile && (
        <>
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
        </>
      )}

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
      <span className="tb-sep" />

      {!isMobile && (
        <>
          <button
            type="button"
            title="Цитата"
            className={btnCls(!!editor?.isActive('blockquote'))}
            disabled={!can}
            onMouseDown={run((e) => e.chain().focus().toggleBlockquote().run())}
          ><Icon name="quote" /></button>
          <button
            type="button"
            title="Горизонтальная линия"
            className="tb-btn"
            disabled={!can}
            onMouseDown={run((e) => e.chain().focus().setHorizontalRule().run())}
          ><Icon name="hr" /></button>
          <span className="tb-sep" />
        </>
      )}

      <LinkPopover editor={editor} />
    </>
  );

  if (variant === 'studio') {
    return (
      <div style={{
        height: 44, flexShrink: 0,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex', alignItems: 'center',
        position: 'relative',
      }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: isMobile ? 'flex-start' : 'center', minWidth: 0, overflow: 'visible' }}>
          <div ref={scrollRef} className="tb" style={{ width: isMobile ? '100%' : 680, maxWidth: '100%', flex: 'none', height: '100%', background: 'transparent', borderBottom: 'none' } as React.CSSProperties}>
            {buttons}
          </div>
        </div>
        {showModes && mode && setMode && (
          <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
            <ModeSegment mode={mode} setMode={setMode} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap',
      background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 18,
      padding: '6px 10px', boxShadow: '0 8px 28px oklch(0.05 0.01 50 / 0.35)',
      maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none',
    } as React.CSSProperties}>
      {buttons}
    </div>
  );
}
