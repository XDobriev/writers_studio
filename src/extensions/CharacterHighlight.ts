import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet, Decoration } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { Character } from '../lib/characters';
import { makeAliasPattern } from '../lib/characterMatching';
import { getCharacterColor } from '../lib/pov';

export const CHARACTER_HIGHLIGHT_KEY = new PluginKey<DecorationSet>('characterHighlight');

export interface CharacterHighlightOptions {
  getCharacters: () => Character[];
  getEnabled?: () => boolean;
  onMentionClick?: (characterId: string) => void;
}

interface Matcher {
  character: Character;
  alias: string;
  regex: RegExp;
  aliasLength: number;
}

interface CandidateMatch {
  character: Character;
  start: number;
  end: number;
  length: number;
  pmFrom: number;
  pmTo: number;
}

interface DocMatch {
  character: Character;
  pmFrom: number;
  pmTo: number;
  length: number;
}

/**
 * Чистая функция поиска упоминаний персонажей в ProseMirror документе.
 * Создаёт DecorationSet с view-only декорациями:
 * - Первое появление каждого персонажа в главе -> .char-mention-first
 * - Повторные появления -> .char-mention-subsequent
 * Оба класса содержат data-char-id, data-char-color и inline-стиль --char-color.
 */
export function findCharacterDecorations(doc: PmNode, characters: Character[]): DecorationSet {
  if (!characters || characters.length === 0) {
    return DecorationSet.empty;
  }

  // 1. Подготавливаем регулярные выражения для всех псевдонимов всех персонажей
  const matchers: Matcher[] = [];
  for (const char of characters) {
    if (!char.id) continue;
    const aliases = [char.name, ...(char.aliases ?? [])].filter(Boolean);
    const seenAliases = new Set<string>();

    for (const rawAlias of aliases) {
      const trimmed = rawAlias.trim();
      const lower = trimmed.toLowerCase();
      if (!trimmed || seenAliases.has(lower)) continue;
      seenAliases.add(lower);

      const pattern = makeAliasPattern(trimmed);
      if (!pattern) continue;

      try {
        const regex = new RegExp(pattern.source, 'giu');
        matchers.push({
          character: char,
          alias: trimmed,
          regex,
          aliasLength: trimmed.length,
        });
      } catch {
        // Пропускаем некорректный regex
      }
    }
  }

  if (matchers.length === 0) {
    return DecorationSet.empty;
  }

  // 2. Сканируем текстовые блоки документа (параграфы, заголовки и т.д.)
  const allDocMatches: DocMatch[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;

    let blockText = '';
    const pmPositions: number[] = [];

    node.descendants((child, childPos) => {
      if (child.isText && child.text) {
        const absPos = pos + 1 + childPos;
        for (let i = 0; i < child.text.length; i++) {
          blockText += child.text[i];
          pmPositions.push(absPos + i);
        }
      }
    });

    if (!blockText) return;

    // Ищем совпадения всех псевдонимов в текущем блоке
    const blockCandidates: CandidateMatch[] = [];

    for (const matcher of matchers) {
      matcher.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = matcher.regex.exec(blockText)) !== null) {
        const mStart = match.index;
        const mLength = match[0].length;
        const mEnd = mStart + mLength;

        if (mStart >= 0 && mEnd <= pmPositions.length) {
          blockCandidates.push({
            character: matcher.character,
            start: mStart,
            end: mEnd,
            length: mLength,
            pmFrom: pmPositions[mStart],
            pmTo: pmPositions[mEnd - 1] + 1,
          });
        }

        if (matcher.regex.lastIndex === mStart) {
          matcher.regex.lastIndex++;
        }
      }
    }

    if (blockCandidates.length === 0) return;

    // Разрешаем наложения в блоке: более длинные псевдонимы имеют приоритет
    blockCandidates.sort((a, b) => b.length - a.length || a.start - b.start);

    const occupied = new Uint8Array(blockText.length);
    const acceptedInBlock: DocMatch[] = [];

    for (const cand of blockCandidates) {
      let overlaps = false;
      for (let i = cand.start; i < cand.end; i++) {
        if (occupied[i]) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        for (let i = cand.start; i < cand.end; i++) {
          occupied[i] = 1;
        }
        acceptedInBlock.push({
          character: cand.character,
          pmFrom: cand.pmFrom,
          pmTo: cand.pmTo,
          length: cand.length,
        });
      }
    }

    allDocMatches.push(...acceptedInBlock);
  });

  if (allDocMatches.length === 0) {
    return DecorationSet.empty;
  }

  // 3. Сортируем все найденные вхождения по порядку в документе
  allDocMatches.sort((a, b) => a.pmFrom - b.pmFrom);

  // 4. Первое появление каждого персонажа в главе -> .char-mention-first,
  //    последующие появления -> .char-mention-subsequent
  const seenCharacterIds = new Set<string>();
  const decos: Decoration[] = [];

  for (const match of allDocMatches) {
    const isFirst = !seenCharacterIds.has(match.character.id);
    seenCharacterIds.add(match.character.id);

    const color = getCharacterColor(match.character.position ?? 0);
    const className = isFirst ? 'char-mention-first' : 'char-mention-subsequent';

    decos.push(
      Decoration.inline(match.pmFrom, match.pmTo, {
        class: className,
        'data-char-id': match.character.id,
        'data-char-color': color,
        style: `--char-color: ${color};`,
      })
    );
  }

  return DecorationSet.create(doc, decos);
}

export const CharacterHighlight = Extension.create<CharacterHighlightOptions>({
  name: 'characterHighlight',

  addOptions() {
    return {
      getCharacters: () => [],
      getEnabled: () => true,
      onMentionClick: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { getCharacters, getEnabled, onMentionClick } = this.options;
    let timer: ReturnType<typeof setTimeout> | null = null;

    return [
      new Plugin({
        key: CHARACTER_HIGHLIGHT_KEY,

        state: {
          init: (_, state) => {
            if (getEnabled && !getEnabled()) return DecorationSet.empty;
            return findCharacterDecorations(state.doc, getCharacters());
          },
          apply(tr, old) {
            const next = tr.getMeta(CHARACTER_HIGHLIGHT_KEY) as DecorationSet | undefined;
            if (next) return next;
            if (tr.docChanged) {
              return old.map(tr.mapping, tr.doc);
            }
            return old;
          },
        },

        props: {
          decorations: (state) => CHARACTER_HIGHLIGHT_KEY.getState(state),

          handleClick: (_view, _pos, event) => {
            const target = event.target as HTMLElement | null;
            const mention = target?.closest<HTMLElement>('.char-mention-first, .char-mention-subsequent');
            if (!mention) return false;

            const charId = mention.getAttribute('data-char-id');
            if (!charId) return false;

            const isFirst = mention.classList.contains('char-mention-first');
            const isModifier = event.altKey || event.ctrlKey || event.metaKey;
            const rect = mention.getBoundingClientRect();
            // Клик по левой зоне индикатора бейджа (точка):
            const clickedIndicator = isFirst && (event.clientX - rect.left <= 18);

            if (isModifier || clickedIndicator) {
              event.preventDefault();
              event.stopPropagation();
              onMentionClick?.(charId);
              return true;
            }

            return false;
          },
        },

        view: (editorView) => {
          let destroyed = false;

          const run = (delay = 300) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              if (destroyed) return;
              if (getEnabled && !getEnabled()) {
                editorView.dispatch(editorView.state.tr.setMeta(CHARACTER_HIGHLIGHT_KEY, DecorationSet.empty));
                return;
              }
              const decos = findCharacterDecorations(editorView.state.doc, getCharacters());
              editorView.dispatch(editorView.state.tr.setMeta(CHARACTER_HIGHLIGHT_KEY, decos));
            }, delay);
          };

          run(0);

          return {
            update(view, prev) {
              if (!view.state.doc.eq(prev.doc)) {
                run(300);
              }
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
