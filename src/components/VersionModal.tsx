import { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { useQueryClient } from '@tanstack/react-query';
import { getVersionContent, createVersion, type ChapterVersionMeta } from '../lib/versions';
import { updateChapter, countWords } from '../lib/chapters';
import { ConfirmDialog } from './ConfirmDialog';
import { QUERY_KEYS } from '../lib/queries';

type WordDiff = { type: 'same' | 'added' | 'removed'; text: string };
type ParaDiff = { type: 'same'; text: string } | { type: 'changed'; parts: WordDiff[] } | { type: 'added'; text: string } | { type: 'removed'; text: string };

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractParas(html: string): string[] {
  return html.split(/<\/p>|<br\s*\/?>/).map(p => stripHtml(p)).filter(Boolean);
}

function lcsIndices(a: string[], b: string[]): [number, number][] {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const pairs: [number, number][] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { pairs.unshift([i - 1, j - 1]); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return pairs;
}

function diffWords(before: string, after: string): WordDiff[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  const pairs = lcsIndices(a, b);
  const result: WordDiff[] = [];
  let ai = 0, bi = 0, pi = 0;
  while (pi <= pairs.length) {
    const [na, nb] = pi < pairs.length ? pairs[pi] : [a.length, b.length];
    while (ai < na) { result.push({ type: 'removed', text: a[ai++] }); }
    while (bi < nb) { result.push({ type: 'added', text: b[bi++] }); }
    if (pi < pairs.length) { result.push({ type: 'same', text: a[na] }); ai = na + 1; bi = nb + 1; }
    pi++;
  }
  return result;
}

function computeDiff(snapHtml: string, curHtml: string): ParaDiff[] {
  const snapParas = extractParas(snapHtml);
  const curParas = extractParas(curHtml);
  const pairs = lcsIndices(snapParas, curParas);
  const result: ParaDiff[] = [];
  let si = 0, ci = 0, pi = 0;
  while (pi <= pairs.length) {
    const [ns, nc] = pi < pairs.length ? pairs[pi] : [snapParas.length, curParas.length];
    while (si < ns && ci < nc) {
      result.push({ type: 'changed', parts: diffWords(snapParas[si++], curParas[ci++]) });
    }
    while (si < ns) { result.push({ type: 'removed', text: snapParas[si++] }); }
    while (ci < nc) { result.push({ type: 'added', text: curParas[ci++] }); }
    if (pi < pairs.length) { result.push({ type: 'same', text: snapParas[ns] }); si = ns + 1; ci = nc + 1; }
    pi++;
  }
  return result;
}

interface VersionModalProps {
  version: ChapterVersionMeta;
  chapterId: string;
  bookId: string;
  userId: string;
  currentContent: string;
  isPro: boolean;
  onClose: () => void;
  onRestored: (content: string) => void;
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
  const [showDiff, setShowDiff] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const diff = useMemo(
    () => (!loading && content !== null ? computeDiff(content, currentContent) : null),
    [loading, content, currentContent],
  );

  const safeContent = useMemo(
    () => (content !== null ? DOMPurify.sanitize(content) : ''),
    [content],
  );

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
      onRestored(content);
      onClose();
    } catch {
      setRestoring(false);
    }
  }

  const label = version.label ?? formatDate(version.created_at);
  const meta = version.label
    ? `${formatDateFull(version.created_at)} · ${version.word_count ?? 0} сл.`
    : `${triggerLabel(version.trigger)} · ${version.word_count ?? 0} сл.`;
  const currentWords = countWords(currentContent);
  const delta = (version.word_count ?? 0) - currentWords;

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-4)' }}>{meta}</span>
                {delta !== 0 && (
                  <span style={{
                    font: '500 10px var(--font-mono)',
                    color: delta > 0 ? 'var(--accent)' : 'var(--danger, #c0392b)',
                    background: delta > 0 ? 'oklch(from var(--accent) l c h / 0.1)' : 'oklch(0.4 0.15 25 / 0.1)',
                    padding: '1px 6px', borderRadius: 4,
                  }}>
                    {delta > 0 ? '+' : ''}{delta} сл.
                  </span>
                )}
              </div>
            </div>
            <button className="tb-btn" onClick={onClose} style={{ color: 'var(--ink-3)' }}>✕</button>
          </div>

          <div style={{
            flex: 1, overflowY: 'auto',
            background: showDiff ? 'var(--bg)' : 'var(--paper)',
            padding: '24px 32px',
            fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.78,
            color: showDiff ? 'var(--ink)' : 'var(--paper-ink)',
          }}>
            {loading && (
              <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
                Загрузка…
              </span>
            )}
            {!loading && content !== null && !showDiff && (
              <div dangerouslySetInnerHTML={{ __html: safeContent }} />
            )}
            {!loading && showDiff && diff && (() => {
              const hasChanges = diff.some(p => p.type !== 'same');
              if (!hasChanges) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 0', color: 'var(--ink-4)' }}>
                    <span style={{ fontSize: 24 }}>≡</span>
                    <span style={{ font: '400 13px var(--font-ui)' }}>Текст совпадает с текущей версией</span>
                  </div>
                );
              }
              return (
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.78 }}>
                  {diff.map((part, i) => {
                    if (part.type === 'same') {
                      return <p key={i} style={{ margin: '0 0 0.75em', color: 'var(--ink-3)' }}>{part.text}</p>;
                    }
                    if (part.type === 'added') {
                      return (
                        <p key={i} style={{ margin: '0 0 0.75em', background: 'oklch(0.5 0.18 145 / 0.22)', borderRadius: 3, padding: '2px 6px' }}>
                          {part.text}
                        </p>
                      );
                    }
                    if (part.type === 'removed') {
                      return (
                        <p key={i} style={{ margin: '0 0 0.75em', background: 'oklch(0.5 0.18 25 / 0.18)', borderRadius: 3, padding: '2px 6px', textDecoration: 'line-through', color: 'var(--ink-3)' }}>
                          {part.text}
                        </p>
                      );
                    }
                    return (
                      <p key={i} style={{ margin: '0 0 0.75em' }}>
                        {part.parts.map((w, wi) => {
                          if (w.type === 'same') return <span key={wi}>{w.text} </span>;
                          if (w.type === 'added') return (
                            <mark key={wi} style={{ background: 'oklch(0.5 0.2 145 / 0.25)', color: 'inherit', borderRadius: 2, padding: '1px 2px' }}>{w.text} </mark>
                          );
                          return (
                            <del key={wi} style={{ background: 'oklch(0.5 0.2 25 / 0.2)', color: 'var(--ink-3)', textDecoration: 'line-through', borderRadius: 2, padding: '1px 2px' }}>{w.text} </del>
                          );
                        })}
                      </p>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div style={{
            padding: '12px 18px', borderTop: '1px solid var(--border-soft)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          }}>
            <button
              className="btn btn--ghost"
              style={{ fontSize: 12 }}
              onClick={() => setShowDiff(v => !v)}
              disabled={loading || !diff}
            >
              {showDiff ? 'Показать версию' : (() => {
                if (!diff) return 'Показать изменения';
                const n = diff.filter(p => p.type !== 'same').length;
                return n > 0 ? `Изменения · ${n}` : 'Показать изменения';
              })()}
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--ghost" onClick={onClose}>Отмена</button>
              <button
                className="btn btn--primary"
                onClick={() => setConfirm(true)}
                disabled={loading || restoring}
              >
                Восстановить
              </button>
            </div>
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
