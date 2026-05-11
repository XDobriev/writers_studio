import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
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

  return <EditorContent editor={editor} className={className} style={style} />;
}
