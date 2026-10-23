import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Book } from '../lib/supabase';
import type { ChapterMeta, ChapterActions } from '../lib/chapters';
import { Sidebar } from './Sidebar';
import { trapTab } from '../lib/useModalFocus';

interface MobileSidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  book?: Book | null;
  subtitle?: string;
  chapters?: ChapterMeta[];
  activeChapterId?: string | null;
  chapterActions?: ChapterActions;
  children?: ReactNode;
}

export function MobileSidebarDrawer({
  open,
  onClose,
  book,
  subtitle,
  chapters,
  activeChapterId,
  chapterActions,
  children,
}: MobileSidebarDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  // Незавершённая CSS-анимация (fill-mode: both) держит transform отличным от
  // none даже в состоянии покоя — это создаёт containing block и клипует
  // position:fixed потомков (например, SettingsModal) шириной панели.
  // Снимаем animation после входа, чтобы transform схлопнулся обратно в none.
  const [entered, setEntered] = useState(false);

  // Keep ref current without adding onClose to effect deps
  useEffect(() => { onCloseRef.current = onClose; });

  // Escape key — dep only [open], stable via onCloseRef
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Save focus on open, restore on close
  useEffect(() => {
    if (open) {
      prevFocusRef.current = document.activeElement as HTMLElement;
      panelRef.current?.focus();
    } else {
      prevFocusRef.current?.focus();
      prevFocusRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', zIndex: 'calc(var(--z-drawer) - 1)' }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Навигация"
        tabIndex={-1}
        className="as"
        onKeyDown={(e) => {
          trapTab(e);
        }}
        onAnimationEnd={() => setEntered(true)}
        style={{
          position: 'fixed', top: 0, left: 0, width: 280, height: '100%',
          zIndex: 'var(--z-drawer)', boxShadow: '4px 0 32px oklch(0.05 0.01 50 / 0.35)',
          animation: entered ? 'none' : 'panel-enter-left 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
          outline: 'none',
        }}
      >
        <Sidebar
          book={book}
          subtitle={subtitle}
          chapters={chapters}
          activeChapterId={activeChapterId}
          chapterActions={chapterActions}
        >
          {children}
        </Sidebar>
      </div>
    </>
  );
}
