import { useCallback, useEffect, useRef, useState } from 'react';
import type { Character } from './characters';
import { matchesAlias } from './characterMatching';

function findCharacterAtPoint(
  x: number,
  y: number,
  characters: Character[],
  editorEl: HTMLElement,
): Character | null {
  const range = document.caretRangeFromPoint(x, y);
  if (!range) return null;

  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  if (!editorEl.contains(node)) return null;

  const block =
    node.parentElement?.closest('p, h1, h2, h3, li') ?? node.parentElement;
  if (!block) return null;

  const fullText = block.textContent ?? '';

  // Cursor offset within the block text
  let cursorOffset = 0;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let current: Text | null;
  let found = false;
  while ((current = walker.nextNode() as Text | null)) {
    if (current === node) {
      cursorOffset += range.startOffset;
      found = true;
      break;
    }
    cursorOffset += current.length;
  }
  if (!found) return null;

  const isLetter = (i: number) => i >= 0 && i < fullText.length && /\p{L}/u.test(fullText[i]);

  // Extract the word under cursor (handle end-of-word position)
  const checkAt = isLetter(cursorOffset) ? cursorOffset : cursorOffset - 1;
  if (!isLetter(checkAt)) return null;

  let wordStart = checkAt;
  while (wordStart > 0 && isLetter(wordStart - 1)) wordStart--;
  let wordEnd = checkAt + 1;
  while (wordEnd < fullText.length && isLetter(wordEnd)) wordEnd++;

  const word = fullText.slice(wordStart, wordEnd);

  for (const char of characters) {
    const aliases = [char.name, ...(char.aliases ?? [])].filter(Boolean);
    aliases.sort((a, b) => b.length - a.length);
    if (aliases.some((alias) => matchesAlias(word, alias))) return char;
  }
  return null;
}

export interface HoverState {
  character: Character;
  x: number;
  y: number;
}

export function useCharacterHover(
  editorEl: HTMLElement | null,
  characters: Character[],
) {
  const [shown, setShown] = useState<HoverState | null>(null);
  const moveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardActiveRef = useRef(false);
  // Ref вместо dep в useEffect — не переустанавливает слушатель при каждом ре-рендере списка
  const charactersRef = useRef(characters);
  useEffect(() => { charactersRef.current = characters; }, [characters]);

  const dismissAll = useCallback(() => setShown(null), []);

  useEffect(() => {
    if (!editorEl) return;

    const handleMove = (e: MouseEvent) => {
      if (cardActiveRef.current) return;
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      moveTimerRef.current = setTimeout(() => {
        const c = findCharacterAtPoint(e.clientX, e.clientY, charactersRef.current, editorEl);
        setShown(c ? { character: c, x: e.clientX, y: e.clientY } : null);
      }, 500);
    };

    const handleLeave = () => {
      if (cardActiveRef.current) return;
      if (moveTimerRef.current) { clearTimeout(moveTimerRef.current); moveTimerRef.current = null; }
      dismissTimerRef.current = setTimeout(dismissAll, 300);
    };

    editorEl.addEventListener('mousemove', handleMove);
    editorEl.addEventListener('mouseleave', handleLeave);
    return () => {
      editorEl.removeEventListener('mousemove', handleMove);
      editorEl.removeEventListener('mouseleave', handleLeave);
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [editorEl, dismissAll]);

  const onCardEnter = useCallback(() => {
    cardActiveRef.current = true;
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const onCardLeave = useCallback(() => {
    cardActiveRef.current = false;
    dismissAll();
  }, [dismissAll]);

  return { shown, onCardEnter, onCardLeave };
}
