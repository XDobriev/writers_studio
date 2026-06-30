import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet, Decoration } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import Hypher from 'hypher';
import russian from 'hyphenation.ru';

const h = new Hypher(russian);
const HYPH_KEY = new PluginKey<DecorationSet>('hyphenation');

// Переносим только русские слова от 4 символов — короче нет смысла
const WORD_RE = /[а-яёА-ЯЁ]{4,}/g;

function buildDecos(doc: PmNode): DecorationSet {
  const decos: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    WORD_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = WORD_RE.exec(text)) !== null) {
      const parts = h.hyphenate(match[0]);
      if (parts.length < 2) continue;

      let offset = 0;
      for (let i = 0; i < parts.length - 1; i++) {
        offset += parts[i].length;
        decos.push(
          Decoration.widget(
            pos + match.index + offset,
            () => document.createTextNode('­'),
            { side: -1, key: `shy:${pos}:${match.index}:${offset}` },
          ),
        );
      }
    }
  });

  return DecorationSet.create(doc, decos);
}

export const Hyphenation = Extension.create({
  name: 'hyphenation',

  addProseMirrorPlugins() {
    let timer: ReturnType<typeof setTimeout> | null = null;

    return [
      new Plugin({
        key: HYPH_KEY,

        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const next = tr.getMeta(HYPH_KEY) as DecorationSet | undefined;
            if (next !== undefined) return next;
            return tr.docChanged ? old.map(tr.mapping, tr.doc) : old;
          },
        },

        props: {
          decorations: (state) => HYPH_KEY.getState(state),
        },

        view: (view) => {
          let destroyed = false;

          const rebuild = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              if (destroyed) return;
              const decos = buildDecos(view.state.doc);
              view.dispatch(view.state.tr.setMeta(HYPH_KEY, decos));
            }, 300);
          };

          rebuild();

          return {
            update(v, prev) {
              if (!v.state.doc.eq(prev.doc)) rebuild();
            },
            destroy() {
              destroyed = true;
              if (timer) clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});
