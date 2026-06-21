import { useEffect, type ReactNode } from 'react';
import type { Book } from '../lib/supabase';
import type { ChapterMeta, ChapterActions } from '../lib/chapters';
import { Sidebar } from './Sidebar';

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
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.45)', zIndex: 40 }}
      />
      <div
        className="as"
        style={{
          position: 'fixed', top: 0, left: 0, width: 280, height: '100%',
          zIndex: 41, boxShadow: '4px 0 32px oklch(0.05 0.01 50 / 0.35)',
          animation: 'panel-enter-left 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
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
