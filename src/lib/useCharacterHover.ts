import { useCallback, useEffect, useRef, useState } from 'react';
import type { Character } from './characters';

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

  const lower = fullText.toLowerCase();

  for (const char of characters) {
    const aliases = [char.name, ...(char.aliases ?? [])].filter(Boolean);
    aliases.sort((a, b) => b.length - a.length); // longest first

    for (const alias of aliases) {
      const t = alias.trim();
      if (t.length < 2) continue;
      const al = t.toLowerCase();
      let i = 0;
      while (i <= lower.length - al.length) {
        const pos = lower.indexOf(al, i);
        if (pos === -1) break;
        const bBefore = pos === 0 || !/[\p{L}\p{N}_]/u.test(fullText[pos - 1]);
        const bAfter =
          pos + t.length >= fullText.length ||
          !/[\p{L}\p{N}_]/u.test(fullText[pos + t.length]);
        if (
          bBefore &&
          bAfter &&
          cursorOffset >= pos &&
          cursorOffset <= pos + t.length
        ) {
          return char;
        }
        i = pos + 1;
      }
    }
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

  const dismissAll = useCallback(() => setShown(null), []);

  useEffect(() => {
    if (!editorEl || !characters.length) return;

    const handleMove = (e: MouseEvent) => {
      if (cardActiveRef.current) return;
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
      moveTimerRef.current = setTimeout(() => {
        const c = findCharacterAtPoint(e.clientX, e.clientY, characters, editorEl);
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
  }, [editorEl, characters, dismissAll]);

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
