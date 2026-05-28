import { useEffect, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Icon } from './Icon';
import StarterKit from '@tiptap/starter-kit';
import { Extension, textInputRule } from '@tiptap/core';
import { BulletList } from '@tiptap/extension-bullet-list';
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
import { LanguageTool, LT_KEY } from '../extensions/LanguageTool';

export type { Editor };

// BulletList без InputRule: `- ` в начале строки не создаёт список.
// Явное создание через тулбар и горячие клавиши остаётся рабочим.
const BulletListNoAutoFormat = BulletList.extend({
  addInputRules() { return []; },
});

// `- ` (дефис + пробел) → `— ` везде в тексте.
// Дефис в словах (кому-то, из-за) пробелом не окружён — ложных срабатываний нет.
const EmDashRules = Extension.create({
  name: 'emDashRules',
  addInputRules() {
    return [textInputRule({ find: /- $/, replace: '— ' })];
  },
});

const TEXT_COLORS = [
  { label: 'По умолчанию', value: '',        bg: null      },
  { label: 'Красный',      value: '#ef4444', bg: '#ef4444' },
  { label: 'Оранжевый',    value: '#f97316', bg: '#f97316' },
  { label: 'Зелёный',      value: '#22c55e', bg: '#22c55e' },
  { label: 'Синий',        value: '#3b82f6', bg: '#3b82f6' },
  { label: 'Фиолетовый',   value: '#8b5cf6', bg: '#8b5cf6' },
  { label: 'Розовый',      value: '#ec4899', bg: '#ec4899' },
];

const FMT = [
  { name: 'bold',      icon: 'bold'      as const, label: 'Жирный' },
  { name: 'italic',    icon: 'italic'    as const, label: 'Курсив' },
  { name: 'underline', icon: 'underline' as const, label: 'Подчёркнутый' },
  { name: 'strike',    icon: 'strike'    as const, label: 'Зачёркнутый' },
];

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
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, underline: false, bulletList: false }),
      BulletListNoAutoFormat,
      EmDashRules,
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
      LanguageTool,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'tiptap',
        style: attributesStyle ?? 'outline:none;',
        spellcheck: 'false',
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

  // Контент может прийти позже, чем редактор смонтировался (гонка запросов при обновлении страницы).
  // Если editor.isEmpty && value уже есть — ставим контент без эмита onChange.
  useEffect(() => {
    if (!editor || editor.isDestroyed || !value || !editor.isEmpty) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const [spellPopup, setSpellPopup] = useState<{
    x: number; y: number; suggestions: string[]; from: number; to: number;
  } | null>(null);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handleClick = (e: MouseEvent) => {
      const span = (e.target as HTMLElement).closest('.lt-spell') as HTMLElement | null;
      if (!span) { setSpellPopup(null); return; }
      const suggestions = (span.dataset.lt ?? '').split('|').filter(Boolean);
      if (!suggestions.length) { setSpellPopup(null); return; }
      const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (!coords) return;
      const decoState = LT_KEY.getState(editor.view.state);
      if (!decoState) return;
      const found = decoState.find(coords.pos, coords.pos + 1);
      if (!found.length) return;
      const rect = span.getBoundingClientRect();
      setSpellPopup({ x: rect.left, y: rect.bottom + 6, suggestions, from: found[0].from, to: found[0].to });
    };
    dom.addEventListener('click', handleClick);
    return () => dom.removeEventListener('click', handleClick);
  }, [editor]);

  useEffect(() => {
    if (!spellPopup) return;
    const dismiss = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.spell-popup')) setSpellPopup(null);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [spellPopup]);

  const applySuggestion = (suggestion: string) => {
    if (!spellPopup || !editor) return;
    const { from, to } = spellPopup;
    editor.chain().focus().command(({ tr, state }) => {
      tr.replaceWith(from, to, state.schema.text(suggestion));
      // Маппируем существующие декорации через изменения транзакции
      // и удаляем только декорацию исправленного слова —
      // остальные подчёркивания остаются на месте без мерцания.
      const old = LT_KEY.getState(state);
      if (old) {
        const mapped = old.map(tr.mapping, tr.doc);
        const mFrom = tr.mapping.map(from, -1);
        const mTo   = tr.mapping.map(to,   1);
        const toRemove = mapped.find(mFrom, mTo);
        tr.setMeta(LT_KEY, toRemove.length ? mapped.remove(toRemove) : mapped);
      }
      return true;
    }).run();
    setSpellPopup(null);
  };

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
              {FMT.map(({ name, icon, label }) => (
                <button
                  key={name}
                  title={label}
                  className={'bubble-btn' + (editor.isActive(name) ? ' bubble-btn--on' : '')}
                  onMouseDown={e => { e.preventDefault(); runFmt(name); }}
                >
                  <Icon name={icon} size={14} />
                </button>
              ))}
              <button
                title="Очистить форматирование"
                className="bubble-btn"
                onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetAllMarks().clearNodes().run(); }}
              >
                <Icon name="clear" size={14} />
              </button>
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
      {spellPopup && (
        <div
          className="spell-popup"
          style={{ left: spellPopup.x, top: spellPopup.y }}
        >
          {spellPopup.suggestions.map(s => (
            <button
              key={s}
              className="spell-popup__item"
              onMouseDown={e => { e.preventDefault(); applySuggestion(s); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
