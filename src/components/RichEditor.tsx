import { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';

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
