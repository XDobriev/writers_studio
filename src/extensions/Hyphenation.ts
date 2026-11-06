import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type Transaction, type EditorState } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform';
import { DecorationSet, Decoration } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import Hypher from 'hypher';
import russian from 'hyphenation.ru';
import type { Character } from '../lib/characters';
import { findCharacterMatches, CHARACTER_HIGHLIGHT_KEY } from './CharacterHighlight';

export interface ExclusionRange {
  from: number;
  to: number;
}

export interface HyphenationOptions {
  getCharacters?: () => Character[];
  getExclusions?: (doc: PmNode, state?: EditorState) => ExclusionRange[];
}

const h = new Hypher(russian);
export const HYPH_KEY = new PluginKey<DecorationSet>('hyphenation');

// Переносим только русские слова от 4 символов — короче нет смысла
const WORD_RE = /[а-яёА-ЯЁ]{4,}/g;

export function collectExclusions(
  doc: PmNode,
  state?: EditorState,
  options?: HyphenationOptions,
): ExclusionRange[] {
  const ranges: ExclusionRange[] = [];

  // 1. Из персонажей (опции плагина)
  if (options?.getCharacters) {
    try {
      const chars = options.getCharacters();
      if (chars && chars.length > 0) {
        const matches = findCharacterMatches(doc, chars);
        for (const m of matches) {
          ranges.push({ from: m.pmFrom, to: m.pmTo });
        }
      }
    } catch {
      // Игнорируем ошибки доступа
    }
  }

  // 2. Из кастомного колбэка исключений
  if (options?.getExclusions) {
    try {
      const custom = options.getExclusions(doc, state);
      if (custom && custom.length > 0) {
        ranges.push(...custom);
      }
    } catch {
      // Игнорируем ошибки
    }
  }

  // 3. Из стейта подсветки персонажей, если он доступен
  if (state) {
    try {
      const charDecos = CHARACTER_HIGHLIGHT_KEY.getState(state);
      if (charDecos) {
        const found = charDecos.find();
        for (const d of found) {
          ranges.push({ from: d.from, to: d.to });
        }
      }
    } catch {
      // Игнорируем ошибки доступа к незаинициализированному стейту
    }
  }

  return ranges;
}

export function mergeExclusions(ranges: ExclusionRange[]): ExclusionRange[] {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: ExclusionRange[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = merged[merged.length - 1];
    if (cur.from <= prev.to) {
      if (cur.to > prev.to) {
        prev.to = cur.to;
      }
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function isPositionExcluded(pos: number, exclusions: ExclusionRange[]): boolean {
  for (let i = 0; i < exclusions.length; i++) {
    const ex = exclusions[i];
    // Если точка вставки виджета мягкого переноса попадает внутрь диапазона упоминания:
    // мягкий перенос внутри слова разорвёт inline-декорацию на несколько <span>!
    if (pos >= ex.from && pos <= ex.to) {
      return true;
    }
  }
  return false;
}

export function isPositionExcludedFast(pos: number, sortedExclusions: ExclusionRange[]): boolean {
  let low = 0;
  let high = sortedExclusions.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const range = sortedExclusions[mid];
    if (pos < range.from) {
      high = mid - 1;
    } else if (pos > range.to) {
      low = mid + 1;
    } else {
      return true;
    }
  }
  return false;
}

export function buildHyphenationDecos(
  doc: PmNode,
  exclusions: ExclusionRange[] = [],
): DecorationSet {
  const decos: Decoration[] = [];
  const normalizedExclusions = mergeExclusions(exclusions);

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
        const hyphenPos = pos + match.index + offset;

        // Если точка переноса находится внутри диапазона персонажа/сущности, пропускаем
        if (isPositionExcludedFast(hyphenPos, normalizedExclusions)) {
          continue;
        }

        decos.push(
          Decoration.widget(
            hyphenPos,
            () => document.createTextNode('­'),
            { side: -1, key: `shy:${pos}:${match.index}:${offset}` },
          ),
        );
      }
    }
  });

  return DecorationSet.create(doc, decos);
}

// Документ заменён целиком (setContent при загрузке/смене главы), а не отредактирован.
function replacesWholeDoc(tr: Transaction): boolean {
  return tr.steps.some((s, i) =>
    s instanceof ReplaceStep && s.from === 0 && s.to === tr.docs[i].content.size);
}

export const Hyphenation = Extension.create<HyphenationOptions>({
  name: 'hyphenation',

  addOptions() {
    return {
      getCharacters: undefined,
      getExclusions: undefined,
    };
  },

  addProseMirrorPlugins() {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const options = this.options;

    return [
      new Plugin({
        key: HYPH_KEY,

        // Загруженный текст получает переносы сразу, в том же кадре: иначе он
        // отрисовывается без них, а через 300 мс все строки перестраиваются.
        // Debounce остаётся только для набора текста.
        state: {
          init: (_, state) => {
            const exclusions = collectExclusions(state.doc, state, options);
            return buildHyphenationDecos(state.doc, exclusions);
          },
          apply(tr, old, _, newState) {
            const next = tr.getMeta(HYPH_KEY) as DecorationSet | undefined;
            if (next !== undefined) return next;
            if (!tr.docChanged) return old;
            if (replacesWholeDoc(tr)) {
              const exclusions = collectExclusions(tr.doc, newState, options);
              return buildHyphenationDecos(tr.doc, exclusions);
            }
            return old.map(tr.mapping, tr.doc);
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
              const exclusions = collectExclusions(view.state.doc, view.state, options);
              const decos = buildHyphenationDecos(view.state.doc, exclusions);
              view.dispatch(view.state.tr.setMeta(HYPH_KEY, decos));
            }, 300);
          };

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
