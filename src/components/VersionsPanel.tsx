import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createVersion, deleteVersion, type ChapterVersionMeta } from '../lib/versions';
import { countWords } from '../lib/chapters';
import { useChapterVersions, QUERY_KEYS } from '../lib/queries';
import { VersionModal } from './VersionModal';

interface VersionsPanelProps {
  chapterId: string;
  bookId: string;
  userId: string;
  currentContent: string;
  isPro: boolean;
}

export function VersionsPanel({ chapterId, bookId, userId, currentContent, isPro }: VersionsPanelProps) {
  const queryClient = useQueryClient();
  const { data: versions = [], isLoading } = useChapterVersions(chapterId);
  const [selected, setSelected] = useState<ChapterVersionMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [showLabelForm, setShowLabelForm] = useState(false);

  const named = versions.filter((v) => v.label !== null);
  const auto = versions.filter((v) => v.label === null);
  const grouped = groupByDay(auto);

  async function handleSaveLabel() {
    if (!labelInput.trim()) return;
    setSaving(true);
    try {
      await createVersion(chapterId, userId, currentContent, countWords(currentContent), 'manual', isPro, labelInput.trim());
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(chapterId) });
      setLabelInput('');
      setShowLabelForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteVersion(id);
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(chapterId) });
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
      {isPro && named.length > 0 && (
        <>
          <SectionLabel>Именованные вехи</SectionLabel>
          {named.map((v) => (
            <VersionCard key={v.id} version={v} isPro={isPro} onOpen={setSelected} onDelete={handleDelete} />
          ))}
        </>
      )}

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

      {!isPro && (
        <div style={{
          border: '1px solid var(--border-soft)', borderRadius: 'var(--r-2)',
          padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5,
          marginTop: 4,
        }}>
          Хранятся последние 10 копий.<br />
          Именованные вехи и 30 дней истории —{' '}
          <span style={{ color: 'var(--accent)' }}>Pro</span>.
        </div>
      )}

      {isPro && !showLabelForm && (
        <button
          onClick={() => setShowLabelForm(true)}
          style={{
            marginTop: 4, width: '100%', height: 30,
            border: '1px dashed var(--border)', borderRadius: 'var(--r-2)',
            font: '400 12px var(--font-ui)', color: 'var(--ink-3)',
            background: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          + Сохранить текущую версию
        </button>
      )}

      {isPro && showLabelForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <input
            className="input"
            style={{ fontSize: 12, height: 32 }}
            placeholder="Название версии…"
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
              style={{ fontSize: 12 }}
              onClick={() => void handleSaveLabel()}
              disabled={saving || !labelInput.trim()}
            >
              Сохранить
            </button>
          </div>
        </div>
      )}

      {selected && (
        <VersionModal
          version={selected}
          chapterId={chapterId}
          bookId={bookId}
          userId={userId}
          currentContent={currentContent}
          isPro={isPro}
          onClose={() => setSelected(null)}
          onRestored={() => setSelected(null)}
        />
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '10px 0 4px',
      font: '500 9.5px var(--font-mono)',
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
  const chip = isNamed ? null : triggerChip(version.trigger);

  return (
    <div
      onClick={() => onOpen(version)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-2)', padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: 6,
        cursor: 'pointer',
        borderLeft: isNamed ? '2px solid var(--accent)' : undefined,
        paddingLeft: isNamed ? '11px' : undefined,
        transition: 'background 0.12s',
        marginBottom: 4,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: 12.5,
          color: isNamed ? 'var(--accent)' : 'var(--ink)',
          fontWeight: isNamed ? 500 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {chip && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              height: 18, padding: '0 7px', borderRadius: 999,
              border: '1px solid var(--border)',
              font: '400 10px var(--font-mono)', color: 'var(--ink-3)',
              whiteSpace: 'nowrap',
            }}>
              {chip}
            </span>
          )}
          {isPro && (
            <button
              title="Удалить"
              onClick={(e) => void onDelete(version.id, e)}
              style={{
                background: 'none', border: 'none', color: 'var(--ink-4)',
                cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div style={{ font: '400 10.5px var(--font-mono)', color: 'var(--ink-4)' }}>
        {version.word_count ?? 0} сл.{isNamed ? ` · ${formatDateShort(version.created_at)}` : ''}
      </div>
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

function triggerChip(t: string): string {
  const map: Record<string, string> = {
    beforeunload: 'при закрытии',
    chapter_switch: 'смена главы',
    timer: 'авто',
    manual: 'вручную',
  };
  return map[t] ?? t;
}
