import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet, Decoration } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';

export const LT_KEY = new PluginKey<DecorationSet>('languageTool');

interface YaError {
  pos: number;
  len: number;
  word: string;
  s: string[];
}

async function fetchErrors(text: string, signal: AbortSignal): Promise<YaError[]> {
  try {
    const res = await fetch(
      'https://speller.yandex.net/services/spellservice.json/checkText',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text, lang: 'ru' }),
        signal,
      }
    );
    if (!res.ok) return [];
    return (await res.json()) as YaError[];
  } catch {
    return [];
  }
}

function buildTextMap(doc: PmNode): { plain: string; map: number[] } {
  let plain = '';
  const map: number[] = [];
  let prevEnd = -1;

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    if (prevEnd !== -1 && pos > prevEnd) {
      plain += '\n';
      map.push(-1);
    }
    for (let i = 0; i < node.text.length; i++) {
      plain += node.text[i];
      map.push(pos + i);
    }
    prevEnd = pos + node.text.length;
  });

  return { plain, map };
}

function makeDecorations(doc: PmNode, errors: YaError[]): DecorationSet {
  const { map } = buildTextMap(doc);
  const decos: Decoration[] = [];

  for (const { pos, len, word, s } of errors) {
    const end = pos + len - 1;
    if (end >= map.length) continue;
    const from = map[pos];
    const to = map[end];
    if (from < 0 || to < 0) continue;

    const suggestions = s.slice(0, 3).join(', ');
    const title = suggestions
      ? `Возможно, опечатка: «${word}». Варианты: ${suggestions}`
      : `Возможно, опечатка: «${word}»`;

    decos.push(
      Decoration.inline(from, to + 1, {
        class: 'lt-spell',
        title,
        'data-lt': s.slice(0, 5).join('|'),
      })
    );
  }

  return DecorationSet.create(doc, decos);
}

export const LanguageTool = Extension.create({
  name: 'languageTool',

  addProseMirrorPlugins() {
    let timer: ReturnType<typeof setTimeout> | null = null;

    return [
      new Plugin({
        key: LT_KEY,

        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const next = tr.getMeta(LT_KEY) as DecorationSet | undefined;
            if (next) return next;
            return tr.docChanged ? old.map(tr.mapping, tr.doc) : old;
          },
        },

        props: {
          decorations: (state) => LT_KEY.getState(state),
        },

        view: (editorView) => {
          let destroyed = false;
          let controller: AbortController | null = null;

          const run = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(async () => {
              controller?.abort();
              controller = new AbortController();
              const { doc } = editorView.state;
              const { plain } = buildTextMap(doc);
              if (!plain.trim()) return;

              const errors = await fetchErrors(plain, controller.signal);
              if (destroyed) return;

              const decos = makeDecorations(editorView.state.doc, errors);
              editorView.dispatch(editorView.state.tr.setMeta(LT_KEY, decos));
            }, 1500);
          };

          run();

          return {
            update(view, prev) {
              if (!view.state.doc.eq(prev.doc)) run();
            },
            destroy() {
              destroyed = true;
              if (timer) clearTimeout(timer);
              controller?.abort();
            },
          };
        },
      }),
    ];
  },
});
