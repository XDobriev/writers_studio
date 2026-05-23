# Version History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить резервные копии глав для всех пользователей и полную историю именованных версий для Pro.

**Architecture:** Таблица `chapter_versions` хранит снимки HTML-контента главы. Снимки создаются по четырём триггерам (beforeunload, chapter_switch, timer, manual). Free хранит последние 10 авто-снимков; Pro хранит авто-снимки 30 дней + именованные вехи бессрочно. UI — вкладка в правой панели редактора.

**Tech Stack:** Supabase Postgres (RLS), React Query, TypeScript strict, CSS-классы проекта (`.rp`, `.mn`, `.btn`, `.chip`)

---

## File Map

| Файл | Действие |
|---|---|
| `supabase/migrations/0015_chapter_versions.sql` | создать |
| `src/lib/versions.ts` | создать |
| `src/lib/queries.ts` | изменить — добавить `QUERY_KEYS.chapterVersions` и `useChapterVersions` |
| `src/components/VersionModal.tsx` | создать |
| `src/components/VersionsPanel.tsx` | создать |
| `src/components/RightPanel.tsx` | изменить — добавить вкладку версий |
| `src/components/EditorHybrid.tsx` | изменить — пробросить `chapterId` в `RightPanel` |
| `src/pages/Editor.tsx` | изменить — триггеры снимков |

---

## Task 1: Миграция — таблица chapter_versions

**Files:**
- Create: `supabase/migrations/0015_chapter_versions.sql`

- [ ] **Шаг 1: Написать SQL-файл**

```sql
-- Авторская студия — снимки контента глав (резервные копии + история версий)

create table if not exists public.chapter_versions (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references public.chapters(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null,
  word_count  integer,
  label       text,    -- NULL = авто-снимок; строка = именованная веха (Pro)
  trigger     text not null
    check (trigger in ('beforeunload', 'chapter_switch', 'timer', 'manual')),
  created_at  timestamptz not null default now()
);

create index if not exists chapter_versions_chapter_created_idx
  on public.chapter_versions (chapter_id, created_at desc);

create index if not exists chapter_versions_chapter_label_idx
  on public.chapter_versions (chapter_id, label)
  where label is not null;

alter table public.chapter_versions enable row level security;

drop policy if exists "chapter_versions select own" on public.chapter_versions;
create policy "chapter_versions select own"
  on public.chapter_versions for select
  using (auth.uid() = user_id);

drop policy if exists "chapter_versions insert own" on public.chapter_versions;
create policy "chapter_versions insert own"
  on public.chapter_versions for insert
  with check (auth.uid() = user_id);

drop policy if exists "chapter_versions delete own" on public.chapter_versions;
create policy "chapter_versions delete own"
  on public.chapter_versions for delete
  using (auth.uid() = user_id);
```

- [ ] **Шаг 2: Применить через Supabase MCP**

Использовать инструмент `mcp__supabase__apply_migration` с параметром `name: "0015_chapter_versions"` и содержимым файла выше.

Ожидаемый результат: таблица `chapter_versions` создана, три RLS-политики активны.

- [ ] **Шаг 3: Проверить через Supabase MCP**

Использовать `mcp__supabase__list_tables` и убедиться что `chapter_versions` есть в списке.

- [ ] **Шаг 4: Коммит**

```bash
git add supabase/migrations/0015_chapter_versions.sql
git commit -m "feat: migration — chapter_versions table + RLS"
```

---

## Task 2: Data layer — src/lib/versions.ts

**Files:**
- Create: `src/lib/versions.ts`

- [ ] **Шаг 1: Создать файл с типами и CRUD**

```ts
import { supabase } from './supabase';

export type VersionTrigger = 'beforeunload' | 'chapter_switch' | 'timer' | 'manual';

export interface ChapterVersionMeta {
  id: string;
  chapter_id: string;
  user_id: string;
  word_count: number | null;
  label: string | null;
  trigger: VersionTrigger;
  created_at: string;
}

export async function listVersions(chapterId: string): Promise<ChapterVersionMeta[]> {
  const { data, error } = await supabase
    .from('chapter_versions')
    .select('id, chapter_id, user_id, word_count, label, trigger, created_at')
    .eq('chapter_id', chapterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ChapterVersionMeta[];
}

export async function getVersionContent(id: string): Promise<string> {
  const { data, error } = await supabase
    .from('chapter_versions')
    .select('content')
    .eq('id', id)
    .single();
  if (error) throw error;
  return (data as { content: string }).content;
}

export async function createVersion(
  chapterId: string,
  userId: string,
  content: string,
  wordCount: number,
  trigger: VersionTrigger,
  isPro: boolean,
  label?: string,
): Promise<void> {
  // Пропускаем если контент не изменился с последнего снимка
  const { data: last } = await supabase
    .from('chapter_versions')
    .select('content')
    .eq('chapter_id', chapterId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last && (last as { content: string }).content === content) return;

  const { error } = await supabase.from('chapter_versions').insert({
    chapter_id: chapterId,
    user_id: userId,
    content,
    word_count: wordCount,
    trigger,
    label: label ?? null,
  });
  if (error) throw error;

  await pruneVersions(chapterId, isPro);
}

async function pruneVersions(chapterId: string, isPro: boolean): Promise<void> {
  if (isPro) {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('chapter_versions')
      .delete()
      .eq('chapter_id', chapterId)
      .is('label', null)
      .lt('created_at', cutoff);
  } else {
    const { data: autoSnaps } = await supabase
      .from('chapter_versions')
      .select('id')
      .eq('chapter_id', chapterId)
      .is('label', null)
      .order('created_at', { ascending: false });
    if (autoSnaps && autoSnaps.length > 10) {
      const toDelete = (autoSnaps as { id: string }[]).slice(10).map((s) => s.id);
      await supabase.from('chapter_versions').delete().in('id', toDelete);
    }
  }
}

export async function deleteVersion(id: string): Promise<void> {
  const { error } = await supabase.from('chapter_versions').delete().eq('id', id);
  if (error) throw error;
}

// Используется в beforeunload — fetch с keepalive, обычный supabase-клиент не успевает завершиться
export function createVersionKeepAlive(
  chapterId: string,
  userId: string,
  content: string,
  wordCount: number,
  supabaseUrl: string,
  anonKey: string,
  token: string,
): void {
  void fetch(`${supabaseUrl}/rest/v1/chapter_versions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      chapter_id: chapterId,
      user_id: userId,
      content,
      word_count: wordCount,
      trigger: 'beforeunload',
      label: null,
    }),
    keepalive: true,
  });
}
```

- [ ] **Шаг 2: Проверить типы**

```bash
npm run typecheck
```

Ожидаемый результат: 0 ошибок.

- [ ] **Шаг 3: Коммит**

```bash
git add src/lib/versions.ts
git commit -m "feat: versions.ts — CRUD для chapter_versions"
```

---

## Task 3: React Query hook — useChapterVersions

**Files:**
- Modify: `src/lib/queries.ts`

- [ ] **Шаг 1: Добавить импорт в начало файла**

В `src/lib/queries.ts` добавить в блок импортов:

```ts
import { listVersions, type ChapterVersionMeta } from './versions';
```

- [ ] **Шаг 2: Добавить ключ в QUERY_KEYS**

В объект `QUERY_KEYS` добавить строку:

```ts
chapterVersions: (chapterId: string) => ['chapter-versions', chapterId] as const,
```

- [ ] **Шаг 3: Добавить хук в конец файла**

```ts
export function useChapterVersions(chapterId: string | undefined) {
  return useQuery<ChapterVersionMeta[]>({
    queryKey: chapterId ? QUERY_KEYS.chapterVersions(chapterId) : ['chapter-versions', null],
    queryFn: () => listVersions(chapterId!),
    enabled: !!chapterId,
    staleTime: 30_000,
  });
}
```

- [ ] **Шаг 4: Проверить типы**

```bash
npm run typecheck
```

Ожидаемый результат: 0 ошибок.

- [ ] **Шаг 5: Коммит**

```bash
git add src/lib/queries.ts
git commit -m "feat: useChapterVersions hook в queries.ts"
```

---

## Task 4: VersionModal — просмотр и восстановление версии

**Files:**
- Create: `src/components/VersionModal.tsx`

- [ ] **Шаг 1: Создать компонент**

```tsx
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
        { id: chapterId, content }
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
            {loading && <span style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>Загрузка…</span>}
            {!loading && content && (
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
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Сегодня, ${time}`;
  if (isYesterday) return `Вчера, ${time}`;
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
```

- [ ] **Шаг 2: Проверить типы**

```bash
npm run typecheck
```

Ожидаемый результат: 0 ошибок. Если `ConfirmDialog` импортировался с `onConfirm` → `danger`-styled кнопкой — это ок, текст кнопки «Удалить» не идеален, но ConfirmDialog не принимает кастомный текст кнопки на данный момент; принять как есть.

- [ ] **Шаг 3: Коммит**

```bash
git add src/components/VersionModal.tsx
git commit -m "feat: VersionModal — просмотр и восстановление версии главы"
```

---

## Task 5: VersionsPanel — список версий

**Files:**
- Create: `src/components/VersionsPanel.tsx`

- [ ] **Шаг 1: Создать компонент**

```tsx
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
    return <div style={{ padding: '24px 14px', color: 'var(--ink-4)', fontSize: 12, textAlign: 'center' }}>Загрузка…</div>;
  }

  return (
    <>
      {isPro && named.length > 0 && (
        <>
          <div style={{ padding: '10px 4px 4px', font: '500 9.5px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>
            Именованные вехи
          </div>
          {named.map((v) => (
            <VersionCard key={v.id} version={v} isPro={isPro} onOpen={setSelected} onDelete={handleDelete} />
          ))}
        </>
      )}

      {Object.entries(grouped).map(([day, dayVersions]) => (
        <div key={day}>
          <div style={{ padding: '10px 4px 4px', font: '500 9.5px var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>
            {day}
          </div>
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
          Именованные вехи и 30 дней истории — <span style={{ color: 'var(--accent)' }}>Pro</span>.
        </div>
      )}

      {isPro && !showLabelForm && (
        <button
          onClick={() => setShowLabelForm(true)}
          style={{
            marginTop: 4, width: '100%', height: 30,
            border: '1px dashed var(--border)', borderRadius: 'var(--r-2)',
            font: '400 12px var(--font-ui)', color: 'var(--ink-3)',
            background: 'none', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 6,
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
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveLabel(); if (e.key === 'Escape') { setShowLabelForm(false); setLabelInput(''); } }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn--ghost" style={{ fontSize: 12 }} onClick={() => { setShowLabelForm(false); setLabelInput(''); }}>Отмена</button>
            <button className="btn btn--primary" style={{ fontSize: 12 }} onClick={() => void handleSaveLabel()} disabled={saving || !labelInput.trim()}>Сохранить</button>
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

function VersionCard({ version, isPro, onOpen, onDelete }: {
  version: ChapterVersionMeta;
  isPro: boolean;
  onOpen: (v: ChapterVersionMeta) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const isNamed = version.label !== null;
  const title = version.label ?? formatTime(version.created_at);
  const trigger = isNamed ? null : triggerChip(version.trigger);

  return (
    <div
      onClick={() => onOpen(version)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border-soft)',
        borderRadius: 'var(--r-2)', padding: '9px 11px',
        display: 'flex', flexDirection: 'column', gap: 4,
        position: 'relative', cursor: 'pointer',
        borderLeft: isNamed ? '2px solid var(--accent)' : undefined,
        paddingLeft: isNamed ? 10 : undefined,
        transition: 'background 0.12s, border-color 0.12s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12.5, color: isNamed ? 'var(--accent)' : 'var(--ink)', fontWeight: isNamed ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {trigger && (
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 7px', borderRadius: 999, border: '1px solid var(--border)', font: '400 10px var(--font-mono)', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
              {trigger}
            </span>
          )}
          {isPro && (
            <button
              title="Удалить"
              onClick={(e) => void onDelete(version.id, e)}
              style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
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
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
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
```

- [ ] **Шаг 2: Проверить типы**

```bash
npm run typecheck
```

Ожидаемый результат: 0 ошибок.

- [ ] **Шаг 3: Коммит**

```bash
git add src/components/VersionsPanel.tsx
git commit -m "feat: VersionsPanel — список версий с группировкой по дате"
```

---

## Task 6: RightPanel — добавить вкладку версий

**Files:**
- Modify: `src/components/RightPanel.tsx`

- [ ] **Шаг 1: Обновить пропсы и добавить импорты**

В начало `src/components/RightPanel.tsx` добавить импорт:

```ts
import { VersionsPanel } from './VersionsPanel';
```

Изменить интерфейс пропсов:

```ts
interface RightPanelProps {
  bookId?: string;
  chapterId?: string;
  userId?: string;
  currentContent?: string;
  isPro?: boolean;
}
```

- [ ] **Шаг 2: Добавить состояние активной вкладки**

Внутри функции `RightPanel`, после существующих `useState`-деклараций:

```ts
const [activeTab, setActiveTab] = useState<'notes' | 'versions'>('notes');
```

- [ ] **Шаг 3: Обновить `.rp-head` — добавить вторую вкладку**

Найти блок `<div className="rp-head">` и заменить его содержимое:

```tsx
<div className="rp-head">
  <button
    className={'rp-tab' + (activeTab === 'notes' ? ' rp-tab--on' : '')}
    onClick={() => setActiveTab('notes')}
  >
    Заметки
  </button>
  <button
    className={'rp-tab' + (activeTab === 'versions' ? ' rp-tab--on' : '')}
    onClick={() => setActiveTab('versions')}
  >
    {isPro ? 'История версий' : 'Резервные копии'}
  </button>
  <span style={{ flex: 1 }} />
  {activeTab === 'notes' && (
    <button className="tb-btn" onClick={() => setShowForm((v) => !v)} title="Добавить заметку" aria-label="Добавить заметку">
      <Icon name="plus" size={14} />
    </button>
  )}
</div>
```

- [ ] **Шаг 4: Добавить рендер VersionsPanel внутри `.rp-body`**

После закрытия блока `{notes.map(...)}` и перед `</div>` закрывающим `.rp-body` добавить условный рендер для вкладки версий. Вместо этого — обернуть текущее содержимое `.rp-body` в условие, и добавить ветку `versions`:

Найти `<div className="rp-body">` и его содержимое. Обернуть существующее содержимое:

```tsx
<div className="rp-body">
  {activeTab === 'notes' && (
    <>
      {/* ... всё существующее содержимое notes ... */}
    </>
  )}
  {activeTab === 'versions' && chapterId && bookId && userId !== undefined && (
    <VersionsPanel
      chapterId={chapterId}
      bookId={bookId}
      userId={userId}
      currentContent={currentContent ?? ''}
      isPro={isPro ?? false}
    />
  )}
  {activeTab === 'versions' && !chapterId && (
    <div style={{ padding: '24px 14px', color: 'var(--ink-4)', fontSize: 12, textAlign: 'center' }}>
      Выберите главу
    </div>
  )}
</div>
```

- [ ] **Шаг 5: Проверить типы**

```bash
npm run typecheck
```

Ожидаемый результат: 0 ошибок.

- [ ] **Шаг 6: Коммит**

```bash
git add src/components/RightPanel.tsx
git commit -m "feat: RightPanel — вкладки Заметки / Резервные копии"
```

---

## Task 7: EditorHybrid — передать chapterId и isPro в RightPanel

**Files:**
- Modify: `src/components/EditorHybrid.tsx`

- [ ] **Шаг 1: Найти импорт useUserDisplay и добавить если отсутствует**

Проверить, есть ли `useUserDisplay` в `EditorHybrid.tsx`:

```bash
grep -n "useUserDisplay" src/components/EditorHybrid.tsx
```

Если нет — добавить в импорты:

```ts
import { useUserDisplay } from '../lib/useUserDisplay';
```

- [ ] **Шаг 2: Вызвать useUserDisplay внутри компонента**

В теле основного компонента `EditorHybrid` добавить:

```ts
const { plan } = useUserDisplay();
const isPro = plan === 'pro' || plan === 'lifetime';
```

- [ ] **Шаг 3: Обновить пропсы RightPanel**

Найти строку:

```tsx
{showRight && <RightPanel bookId={book?.id} />}
```

Заменить на:

```tsx
{showRight && (
  <RightPanel
    bookId={book?.id}
    chapterId={activeChapter?.id}
    userId={activeChapter?.user_id}
    currentContent={activeContent}
    isPro={isPro}
  />
)}
```

- [ ] **Шаг 4: Проверить типы**

```bash
npm run typecheck
```

Ожидаемый результат: 0 ошибок.

- [ ] **Шаг 5: Коммит**

```bash
git add src/components/EditorHybrid.tsx
git commit -m "feat: EditorHybrid — пробросить chapterId и isPro в RightPanel"
```

---

## Task 8: Editor.tsx — триггеры создания снимков

**Files:**
- Modify: `src/pages/Editor.tsx`

- [ ] **Шаг 1: Добавить импорты**

В `src/pages/Editor.tsx` добавить в блок импортов:

```ts
import { createVersion, createVersionKeepAlive } from '../lib/versions';
import { useUserDisplay } from '../lib/useUserDisplay';
```

- [ ] **Шаг 2: Добавить рефы для плана и текущего контента**

После строки `const sessionTokenRef = useRef<string | null>(null);` добавить:

```ts
const currentContentRef = useRef<string>('');
const planRef = useRef<string>('free');
```

- [ ] **Шаг 3: Получить plan и синхронизировать planRef**

После блока `const { user } = useAuth();` добавить:

```ts
const { plan } = useUserDisplay();
```

После существующего `useEffect` для `sessionTokenRef` (тот что слушает `onAuthStateChange`) добавить:

```ts
useEffect(() => { planRef.current = plan; }, [plan]);
```

- [ ] **Шаг 4: Синхронизировать currentContentRef при смене главы**

После `const activeContent = chapterContentData?.content ?? '';` добавить:

```ts
useEffect(() => { currentContentRef.current = activeContent; }, [activeContent]);
```

- [ ] **Шаг 5: Обновить onContentChange — синхронизировать currentContentRef**

Найти `const onContentChange = useCallback((html: string) => {` и добавить первой строкой тела:

```ts
currentContentRef.current = html;
```

Итоговый вид:

```ts
const onContentChange = useCallback((html: string) => {
  currentContentRef.current = html;
  if (!activeChapter) return;
  scheduleSave(activeChapter.id, { content: html, words: countWords(html) });
}, [activeChapter, scheduleSave]);
```

- [ ] **Шаг 6: Добавить снимок в beforeunload handler**

Найти функцию `handleBeforeUnload` внутри `useEffect`. После существующего `void fetch(...)` для сохранения контента главы добавить:

```ts
const content = currentContentRef.current;
const currentPlan = planRef.current;
const isPro = currentPlan === 'pro' || currentPlan === 'lifetime';
if (content && id && user?.id && token) {
  createVersionKeepAlive(id, user.id, content, 0, supabaseUrl, anonKey, token);
}
```

Примечание: `word_count: 0` — в beforeunload нет времени считать слова синхронно; БД допускает null/0.

- [ ] **Шаг 7: Добавить снимок при chapter_switch**

Найти существующий `useEffect` с `lastActiveIdRef`:

```ts
useEffect(() => {
  const newId = activeChapter?.id ?? null;
  if (lastActiveIdRef.current && lastActiveIdRef.current !== newId) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void flush();
  }
  lastActiveIdRef.current = newId;
}, [activeChapter, flush]);
```

Заменить на:

```ts
useEffect(() => {
  const newId = activeChapter?.id ?? null;
  const prevId = lastActiveIdRef.current;
  if (prevId && prevId !== newId) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void flush();
    const content = currentContentRef.current;
    const isPro = planRef.current === 'pro' || planRef.current === 'lifetime';
    if (content && user?.id) {
      void createVersion(prevId, user.id, content, countWords(content), 'chapter_switch', isPro);
    }
  }
  lastActiveIdRef.current = newId;
}, [activeChapter, flush, user]);
```

- [ ] **Шаг 8: Добавить таймерный триггер**

После блока `useEffect` с `beforeunload` добавить:

```ts
useEffect(() => {
  const isPro = planRef.current === 'pro' || planRef.current === 'lifetime';
  const intervalMs = isPro ? 30 * 60 * 1000 : 2 * 60 * 60 * 1000;

  const timerId = setInterval(() => {
    const chapterId = targetIdRef.current;
    const content = currentContentRef.current;
    const currentIsPro = planRef.current === 'pro' || planRef.current === 'lifetime';
    if (chapterId && content && user?.id) {
      void createVersion(chapterId, user.id, content, countWords(content), 'timer', currentIsPro);
    }
  }, intervalMs);

  return () => clearInterval(timerId);
}, [user]);
```

- [ ] **Шаг 9: Проверить типы**

```bash
npm run typecheck
```

Ожидаемый результат: 0 ошибок.

- [ ] **Шаг 10: Запустить dev-сервер и проверить вручную**

```bash
npm run dev
```

Проверить golden path:
1. Открыть книгу → главу → редактор.
2. Написать текст, подождать автосохранения.
3. Открыть правую панель → вкладка «Резервные копии».
4. Переключиться на другую главу — должен создаться снимок.
5. Вернуться, кликнуть снимок — открывается модал с текстом.
6. Нажать «Восстановить» → подтвердить → текст восстановлен.

- [ ] **Шаг 11: Коммит**

```bash
git add src/pages/Editor.tsx
git commit -m "feat: Editor — триггеры снимков (beforeunload, chapter_switch, timer)"
```

---

## Self-Review

**Покрытие спека:**

| Требование | Задача |
|---|---|
| Таблица chapter_versions + RLS | Task 1 |
| listVersions, createVersion, deleteVersion | Task 2 |
| createVersionKeepAlive | Task 2 |
| Pruning Free (10 снимков) | Task 2 — pruneVersions |
| Pruning Pro (30 дней) | Task 2 — pruneVersions |
| useChapterVersions hook | Task 3 |
| Модал просмотра + восстановления | Task 4 |
| Список версий, группировка, именованные вехи | Task 5 |
| Кнопка «Сохранить текущую версию» (Pro) | Task 5 |
| Вкладка в правой панели | Task 6 |
| Upsell-баннер для Free | Task 5 |
| Проброс chapterId/isPro в RightPanel | Task 7 |
| Триггер beforeunload | Task 8 |
| Триггер chapter_switch | Task 8 |
| Триггер timer (2ч Free / 30мин Pro) | Task 8 |
| Триггер manual (Pro) | Task 5 |
| Восстановление создаёт снимок | Task 4 — handleRestore |
| Защита от дублей | Task 2 — createVersion |

**Граничные случаи из спека:**
- ✅ Смена плана: pruning применяется при следующей записи
- ✅ Глава удалена: ON DELETE CASCADE в миграции
- ✅ Офлайн/beforeunload: ошибка тихая, keepalive best-effort
- ✅ Восстановление → снимок текущей версии создаётся в handleRestore
