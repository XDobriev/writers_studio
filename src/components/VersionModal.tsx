import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getVersionContent, createVersion, type ChapterVersionMeta } from '../lib/versions';
import { updateChapter, countWords } from '../lib/chapters';
import { ConfirmDialog } from './ConfirmDialog';
import { QUERY_KEYS } from '../lib/queries';

interface VersionModalProps {
  version: ChapterVersionMeta;
  chapterId: string;
  bookId: string;
  userId: string;
  currentContent: string;
  isPro: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export function VersionModal({
  version,
  chapterId,
  bookId,
  userId,
  currentContent,
  isPro,
  onClose,
  onRestored,
}: VersionModalProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getVersionContent(version.id)
      .then(setContent)
      .finally(() => setLoading(false));
  }, [version.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleRestore() {
    if (!content) return;
    setRestoring(true);
    try {
      // Снимок текущего контента как точка отмены
      await createVersion(chapterId, userId, currentContent, countWords(currentContent), 'manual', isPro);
      await updateChapter(chapterId, { content, words: countWords(content) });
      queryClient.setQueryData<{ id: string; content: string }>(
        QUERY_KEYS.chapterContent(chapterId),
        { id: chapterId, content },
      );
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(chapterId) });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapters(bookId) });
      onRestored();
      onClose();
    } catch {
      setRestoring(false);
    }
  }

  const label = version.label ?? formatDate(version.created_at);
  const meta = version.label
    ? `${formatDateFull(version.created_at)} · ${version.word_count ?? 0} сл.`
    : `${triggerLabel(version.trigger)} · ${version.word_count ?? 0} сл.`;

  return (
    <>
      <div
        ref={overlayRef}
        role="presentation"
        style={{
          position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}
        onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      >
        <div
          role="dialog"
          aria-modal="true"
          style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-3)', width: 560, maxHeight: '72vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px oklch(0 0 0 / 0.5)',
          }}
        >
          <div style={{
            padding: '16px 18px', borderBottom: '1px solid var(--border-soft)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{label}</div>
              <div style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)', marginTop: 2 }}>{meta}</div>
            </div>
            <button className="tb-btn" onClick={onClose} style={{ color: 'var(--ink-3)' }}>✕</button>
          </div>

          <div style={{
            flex: 1, overflowY: 'auto',
            background: 'var(--paper)',
            padding: '24px 32px',
            fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.78,
            color: 'var(--paper-ink)',
          }}>
            {loading && (
              <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
                Загрузка…
              </span>
            )}
            {!loading && content !== null && (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            )}
          </div>

          <div style={{
            padding: '12px 18px', borderTop: '1px solid var(--border-soft)',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>
            <button className="btn btn--ghost" onClick={onClose}>Отмена</button>
            <button
              className="btn btn--primary"
              onClick={() => setConfirm(true)}
              disabled={loading || restoring}
            >
              Восстановить эту версию
            </button>
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          message={`Текущий текст главы будет заменён версией «${label}». Это действие нельзя отменить.`}
          onConfirm={() => { setConfirm(false); void handleRestore(); }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Сегодня, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Вчера, ${time}`;
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' }) + `, ${time}`;
}

function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
}

function triggerLabel(t: string): string {
  const map: Record<string, string> = {
    beforeunload: 'при закрытии вкладки',
    chapter_switch: 'смена главы',
    timer: 'авто',
    manual: 'вручную',
  };
  return map[t] ?? t;
}
