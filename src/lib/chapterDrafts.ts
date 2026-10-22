// Локальный журнал несохранённого текста глав (localStorage).
// Страховка от всего, что не дошло до сервера: закрытие вкладки, офлайн,
// keepalive-лимит 64 КБ, падение запроса после смены главы.
// `base` — updated_at главы на сервере, поверх которого набран черновик:
// совпадает при следующем открытии → черновик новее сервера и восстанавливается;
// не совпадает → главу правили где-то ещё, черновик уходит в историю версий.

const PREFIX = 'as-draft:';

export interface ChapterDraft {
  content: string;
  base: string | null;
  savedAt: number;
}

function isDraft(v: unknown): v is ChapterDraft {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return typeof d.content === 'string'
    && (d.base === null || typeof d.base === 'string')
    && typeof d.savedAt === 'number';
}

export function readDraft(chapterId: string): ChapterDraft | null {
  try {
    const raw = localStorage.getItem(PREFIX + chapterId);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDraft(chapterId: string, content: string, base: string | null): void {
  try {
    const draft: ChapterDraft = { content, base, savedAt: Date.now() };
    localStorage.setItem(PREFIX + chapterId, JSON.stringify(draft));
  } catch {
    // Квота или приватный режим: остаётся сетевое сохранение и keepalive.
  }
}

export function clearDraft(chapterId: string): void {
  try { localStorage.removeItem(PREFIX + chapterId); } catch { /* noop */ }
}

export type DraftDecision =
  | { kind: 'none' }
  | { kind: 'restore'; draft: ChapterDraft }
  | { kind: 'conflict'; draft: ChapterDraft };

export function decideDraft(
  draft: ChapterDraft | null,
  serverContent: string,
  serverUpdatedAt: string | null,
): DraftDecision {
  if (!draft || draft.content === serverContent) return { kind: 'none' };
  if (draft.base !== null && draft.base === serverUpdatedAt) return { kind: 'restore', draft };
  return { kind: 'conflict', draft };
}
