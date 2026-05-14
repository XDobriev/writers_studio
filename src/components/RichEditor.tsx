import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
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

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Ссылка', prev ?? 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  }

  return (
    <>
      {editor && (
        <BubbleMenu editor={editor}>
          <div className="bubble-menu">
            <button
              className={'bubble-btn' + (editor.isActive('bold') ? ' bubble-btn--on' : '')}
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
            >B</button>
            <button
              className={'bubble-btn' + (editor.isActive('italic') ? ' bubble-btn--on' : '')}
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
              style={{ fontStyle: 'italic' }}
            >I</button>
            <button
              className={'bubble-btn' + (editor.isActive('underline') ? ' bubble-btn--on' : '')}
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
              style={{ textDecoration: 'underline' }}
            >U</button>
            <button
              className={'bubble-btn' + (editor.isActive('strike') ? ' bubble-btn--on' : '')}
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
              style={{ textDecoration: 'line-through' }}
            >S</button>
            <div className="bubble-sep" />
            <button
              className={'bubble-btn' + (editor.isActive('code') ? ' bubble-btn--on' : '')}
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }}
              style={{ fontFamily: 'monospace', fontSize: 11 }}
            >{'{}'}</button>
            <button
              className={'bubble-btn' + (editor.isActive('link') ? ' bubble-btn--on' : '')}
              onMouseDown={e => { e.preventDefault(); setLink(); }}
            >↗</button>
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} className={className} style={style} />
    </>
  );
}
