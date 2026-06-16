import { useState } from 'react';
import { useVersionMutations } from '../lib/useVersionMutations';
import { type ChapterVersionMeta } from '../lib/versions';
import { useChapterVersions } from '../lib/queries';
import { VersionModal } from './VersionModal';
import { ConfirmDialog } from './ConfirmDialog';
import { useErrorState } from '../lib/useErrorState';

interface VersionsPanelProps {
  chapterId: string;
  chapterTitle?: string;
  bookId: string;
  userId: string;
  currentContent: string;
  isPro: boolean;
  onRestoreContent?: (content: string) => void;
}

export function VersionsPanel({ chapterId, chapterTitle, bookId, userId, currentContent, isPro, onRestoreContent }: VersionsPanelProps) {
  const { error: versionError, setError: setVersionError, clearError: clearVersionError } = useErrorState();
  const { data: versions = [], isLoading } = useChapterVersions(chapterId);
  const { createNamed, remove } = useVersionMutations(chapterId, userId, isPro);
  const [selected, setSelected] = useState<ChapterVersionMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const named = versions.filter((v) => v.label !== null);
  const auto = versions.filter((v) => v.label === null);
  const grouped = groupByDay(auto);

  async function handleSaveLabel() {
    if (!labelInput.trim()) return;
    setSaving(true);
    try {
      await createNamed(currentContent, labelInput.trim());
      setLabelInput('');
      setShowLabelForm(false);
    } catch (e) {
      setVersionError(e instanceof Error ? e.message : 'Не удалось сохранить версию');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
  }

  async function handleDeleteConfirm() {
    if (!deletingId) return;
    const id = deletingId;
    setDeletingId(null);
    try {
      await remove(id);
    } catch (e) {
      setVersionError(e instanceof Error ? e.message : 'Не удалось удалить версию');
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: '24px 14px', color: 'var(--ink-4)', fontSize: 12, textAlign: 'center' }}>
        Загрузка…
      </div>
    );
  }

  return (
    <>
      {chapterTitle && (
        <div style={{
          padding: '8px 0 6px',
          font: '400 11.5px var(--font-ui)',
          color: 'var(--ink-3)',
          borderBottom: '1px solid var(--border-soft)',
          marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {chapterTitle || 'Без названия'}
        </div>
      )}

      {versionError && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8, padding: '5px 8px', borderRadius: 5, background: 'oklch(0.65 0.18 25 / 0.10)', border: '1px solid oklch(0.65 0.18 25 / 0.25)', color: 'var(--danger)', fontSize: 11 }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{versionError}</span>
          <button onClick={clearVersionError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13, lineHeight: 1, padding: '0 2px', flexShrink: 0 }} title="Закрыть" aria-label="Закрыть">×</button>
        </div>
      )}

      <>
        <SectionLabel>Именованные версии</SectionLabel>
        {isPro ? (
          named.length > 0 ? (
            named.map((v) => (
              <VersionCard key={v.id} version={v} isPro={isPro} onOpen={setSelected} onDelete={handleDelete} />
            ))
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.5, paddingBottom: 2 }}>
              Нажмите «+ Сохранить текущую версию», чтобы создать именованную версию.
            </div>
          )
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2 }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)', opacity: 0.55 }}>Именованные версии</span>
            <span className="chip chip--accent" style={{ fontSize: 10 }}>Pro</span>
          </div>
        )}
      </>

      {Object.entries(grouped).map(([day, dayVersions]) => (
        <div key={day}>
          <SectionLabel>{isPro && named.length > 0 ? `Авто-снимки · ${day.toLowerCase()}` : day}</SectionLabel>
          {dayVersions.map((v) => (
            <VersionCard key={v.id} version={v} isPro={isPro} onOpen={setSelected} onDelete={handleDelete} />
          ))}
        </div>
      ))}

      {versions.length === 0 && (
        <div style={{ padding: '24px 14px', color: 'var(--ink-4)', fontSize: 12, textAlign: 'center' }}>
          Нет сохранённых копий
        </div>
      )}

      <div style={{ font: '400 10.5px var(--font-mono)', color: 'var(--ink-4)', lineHeight: 1.6, marginTop: 8, textAlign: 'center' }}>
        {isPro ? 'Авто: каждые 30 мин · смена главы · закрытие' : 'Авто: каждые 2 ч · смена главы · закрытие'}
      </div>

      {!isPro && (
        <div style={{
          background: 'color-mix(in oklch, var(--accent) 5%, var(--surface))',
          border: '1px solid color-mix(in oklch, var(--accent) 20%, var(--border-soft))',
          borderRadius: 'var(--r-2)',
          padding: '10px 12px', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.55,
          marginTop: 8,
        }}>
          Хранятся последние 10 копий.<br />
          Именованные снимки и 30 дней истории —{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>Pro</span>.
        </div>
      )}

      {isPro && !showLabelForm && (
        <div className="vc-save-fade">
          <button
            onClick={() => setShowLabelForm(true)}
            style={{
              width: '100%', height: 30,
              border: '1px dashed var(--border)', borderRadius: 'var(--r-2)',
              font: '400 12px var(--font-ui)', color: 'var(--ink-3)',
              background: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            + Сохранить текущую версию
          </button>
        </div>
      )}

      {isPro && showLabelForm && (
        <div className="vc-save-fade" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            className="input"
            style={{ fontSize: 12, height: 32 }}
            placeholder="Название версии…"
            aria-label="Название версии"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSaveLabel();
              if (e.key === 'Escape') { setShowLabelForm(false); setLabelInput(''); }
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              className="btn btn--ghost"
              style={{ fontSize: 12 }}
              onClick={() => { setShowLabelForm(false); setLabelInput(''); }}
            >
              Отмена
            </button>
            <button
              className="btn btn--primary"
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
              onClick={() => void handleSaveLabel()}
              disabled={saving || !labelInput.trim()}
            >
              {saving && <span className="btn-spinner" style={{ width: 10, height: 10 }} />}
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      <VersionModal
        open={selected !== null}
        version={selected}
        chapterId={chapterId}
        bookId={bookId}
        userId={userId}
        currentContent={currentContent}
        isPro={isPro}
        onClose={() => setSelected(null)}
        onRestored={(restoredContent) => { onRestoreContent?.(restoredContent); setSelected(null); }}
      />

      <ConfirmDialog
        open={deletingId !== null}
        message="Снимок будет удалён без возможности восстановления."
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeletingId(null)}
      />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '10px 0 4px',
      font: '500 10.5px var(--font-mono)',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--ink-4)',
    }}>
      {children}
    </div>
  );
}

function VersionCard({ version, isPro, onOpen, onDelete }: {
  version: ChapterVersionMeta;
  isPro: boolean;
  onOpen: (v: ChapterVersionMeta) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const isNamed = version.label !== null;
  const title = version.label ?? formatTime(version.created_at);
  const chip = isNamed ? null : triggerChip(version.trigger, isPro);

  return (
    <div className={`version-card${isNamed ? ' version-card--named' : ''}`}>
      <button
        aria-label={`Открыть версию: ${title}`}
        onClick={() => onOpen(version)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(version); } }}
        style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, minWidth: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12,
            color: isNamed ? 'var(--accent)' : 'var(--ink)',
            fontWeight: isNamed ? 500 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {title}
          </span>
          {chip && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', flexShrink: 0,
              height: 16, padding: '0 6px', borderRadius: 999,
              border: '1px solid var(--border)',
              font: '400 10.5px var(--font-mono)', color: 'var(--ink-4)',
              whiteSpace: 'nowrap',
            }}>
              {chip}
            </span>
          )}
        </div>
        <div style={{ font: '400 11.5px var(--font-mono)', color: 'var(--ink-3)' }}>
          {version.word_count ?? 0} сл.{isNamed ? ` · ${formatDateShort(version.created_at)}` : ''}
        </div>
      </button>
      {isPro && (
        <div className="vc-actions">
          <button
            title="Удалить"
            aria-label="Удалить версию"
            onClick={(e) => void onDelete(version.id, e)}
            style={{
              background: 'none', border: 'none', color: 'var(--ink-4)',
              cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1, flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function groupByDay(versions: ChapterVersionMeta[]): Record<string, ChapterVersionMeta[]> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const result: Record<string, ChapterVersionMeta[]> = {};
  for (const v of versions) {
    const d = new Date(v.created_at);
    let key: string;
    if (d.toDateString() === now.toDateString()) key = 'Сегодня';
    else if (d.toDateString() === yesterday.toDateString()) key = 'Вчера';
    else key = d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
    if (!result[key]) result[key] = [];
    result[key].push(v);
  }
  return result;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function triggerChip(t: string, isPro: boolean): string {
  const map: Record<string, string> = {
    beforeunload: 'при закрытии',
    chapter_switch: 'смена главы',
    timer: isPro ? 'каждые 30 мин' : 'каждые 2 ч',
    manual: 'вручную',
  };
  return map[t] ?? 'авто';
}
