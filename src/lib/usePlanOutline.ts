import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '../components/RichEditor';

export interface PlanOutlineItem {
  level: number;
  text: string;
}

// Заголовки, которые умеет ставить тулбар (StarterKit: levels [1,2,3]).
const HEADING_SELECTOR = 'h1, h2, h3';

function sameItems(a: PlanOutlineItem[], b: PlanOutlineItem[]): boolean {
  return a.length === b.length
    && a.every((x, i) => x.level === b[i].level && x.text === b[i].text);
}

/**
 * Оглавление замысла: заголовки документа в порядке следования + прыжок к разделу.
 * Единственное, что есть сверх редактора, — и оно не требует от автора новой работы:
 * он и так пишет заголовками.
 *
 * `scrollTo` адресует заголовок по индексу, а не по id: порядок `doc.descendants`
 * совпадает с порядком тех же узлов в DOM, поэтому расставлять якоря в контенте
 * (и хранить их в БД) не нужно.
 */
export function usePlanOutline(editor: Editor | null) {
  const [items, setItems] = useState<PlanOutlineItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!editor) { setItems([]); return; }
    const rebuild = () => {
      const next: PlanOutlineItem[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'heading') {
          next.push({ level: node.attrs.level as number, text: node.textContent.trim() });
        }
      });
      // 'update' летит на каждый символ — без сравнения оглавление перерисовывалось бы
      // при наборе любого абзаца, а не только при правке заголовков.
      setItems((prev) => (sameItems(prev, next) ? prev : next));
    };
    rebuild();
    editor.on('update', rebuild);
    return () => { editor.off('update', rebuild); };
  }, [editor]);

  // Scroll-spy: подсвечиваем раздел, чей заголовок последним прошёл верх области
  // прокрутки. Слушаем сам скролл-контейнер (.plan-wrap — предок редактора),
  // rAF гасит частоту событий скролла. Адресация по индексу совпадает со scrollTo.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom as HTMLElement;
    const scroller = dom.closest('.plan-wrap') as HTMLElement | null;
    if (!scroller) return;
    let raf = 0;
    const recompute = () => {
      raf = 0;
      const headings = dom.querySelectorAll(HEADING_SELECTOR);
      const threshold = scroller.getBoundingClientRect().top + 96;
      let idx = 0;
      headings.forEach((h, i) => {
        if (h.getBoundingClientRect().top <= threshold) idx = i;
      });
      setActiveIndex(idx);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(recompute); };
    recompute();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [editor, items]);

  const scrollTo = useCallback((index: number) => {
    if (!editor || editor.isDestroyed) return;
    const headings = editor.view.dom.querySelectorAll(HEADING_SELECTOR);
    headings[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editor]);

  return { items, scrollTo, activeIndex };
}
