import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Icon } from './Icon';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';

export type { Editor };

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  contentKey: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  attributesStyle?: string;
  onEditor?: (editor: Editor | null) => void;
}

export function RichEditor({
  value,
  onChange,
  contentKey,
  placeholder,
  className,
  style,
  attributesStyle,
  onEditor,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Subscript,
      Superscript,
      Placeholder.configure({ placeholder: placeholder ?? 'Начните писать…' }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'tiptap',
        style: attributesStyle ?? 'outline:none;',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  }, [contentKey]);

  useEffect(() => {
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  const TEXT_COLORS = [
    { label: 'По умолчанию', value: '',        bg: null      },
    { label: 'Красный',      value: '#ef4444', bg: '#ef4444' },
    { label: 'Оранжевый',    value: '#f97316', bg: '#f97316' },
    { label: 'Зелёный',      value: '#22c55e', bg: '#22c55e' },
    { label: 'Синий',        value: '#3b82f6', bg: '#3b82f6' },
    { label: 'Фиолетовый',   value: '#8b5cf6', bg: '#8b5cf6' },
    { label: 'Розовый',      value: '#ec4899', bg: '#ec4899' },
  ];

  function applyColor(value: string) {
    if (!editor) return;
    if (value === '') {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(value).run();
    }
  }

  const activeColor = editor
    ? (editor.getAttributes('textStyle').color as string | undefined) ?? null
    : null;

  const fmt = [
    { name: 'bold',      icon: 'bold'      as const, label: 'Жирный' },
    { name: 'italic',    icon: 'italic'    as const, label: 'Курсив' },
    { name: 'underline', icon: 'underline' as const, label: 'Подчёркнутый' },
    { name: 'strike',    icon: 'strike'    as const, label: 'Зачёркнутый' },
  ];

  function runFmt(name: string) {
    if (!editor) return;
    const chain = editor.chain().focus();
    if (name === 'bold')      chain.toggleBold().run();
    else if (name === 'italic')    chain.toggleItalic().run();
    else if (name === 'underline') chain.toggleUnderline().run();
    else if (name === 'strike')    chain.toggleStrike().run();
  }

  return (
    <>
      {editor && (
        <BubbleMenu editor={editor}>
          <div className="bubble-menu">
            <div className="bubble-fmt">
              {fmt.map(({ name, icon, label }) => (
                <button
                  key={name}
                  title={label}
                  className={'bubble-btn' + (editor.isActive(name) ? ' bubble-btn--on' : '')}
                  onMouseDown={e => { e.preventDefault(); runFmt(name); }}
                >
                  <Icon name={icon} size={14} />
                </button>
              ))}
            </div>
            <div className="bubble-sep" />
            <div className="bubble-colors">
              {TEXT_COLORS.map(({ label, value, bg }) => {
                const isOn = value === '' ? activeColor === null : activeColor === value;
                return (
                  <button
                    key={label}
                    title={label}
                    className={'bubble-color' + (isOn ? ' bubble-color--on' : '') + (bg === null ? ' bubble-color--clear' : '')}
                    style={bg ? { background: bg } : undefined}
                    onMouseDown={e => { e.preventDefault(); applyColor(value); }}
                  >
                    {bg === null && <span style={{ fontSize: 10, color: 'oklch(72% 0 0)', lineHeight: 1 }}>×</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} className={className} style={style} />
    </>
  );
}
