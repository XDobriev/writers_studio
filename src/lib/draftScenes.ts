import { createRepository } from './repository';
import type { Tables } from './database.types';
import {
  countWords,
  createChapter,
  getChapterContent,
  reorderChapters,
  renumberChapters,
  updateChapter,
  type Chapter,
  type ChapterMeta,
} from './chapters';
import {
  formatChapterTitle,
  getChaptersNeedingRenumber,
  parseChapterTitle,
} from './chapterNumbering';

export type DraftScene = Tables<'draft_scenes'>;
export type DraftScenePatch = Partial<Pick<DraftScene, 'title' | 'content' | 'words' | 'position'>>;

export type DraftConvertPlacement =
  | { mode: 'start' }
  | { mode: 'end' }
  | { mode: 'after'; afterChapterId: string };

export type DraftInsertPosition = 'start' | 'end';

export interface DraftSceneActions {
  onSelectDraft?: (id: string) => void;
  onCreateDraft?: () => void;
  onDeleteDraft?: (id: string) => void;
  onConvertDraftToChapter?: (sceneId: string, placement: DraftConvertPlacement) => Promise<void> | void;
  onInsertDraftIntoChapter?: (sceneId: string, chapterId: string, position: DraftInsertPosition) => Promise<void> | void;
}

const repo = createRepository<DraftScene>(
  'draft_scenes',
  { title: 'Без названия', content: '', words: 0, position: 0 },
  [{ column: 'position', ascending: true }, { column: 'created_at', ascending: true }],
);

export function listDraftScenes(bookId: string): Promise<DraftScene[]> {
  return repo.list(bookId);
}

export function createDraftScene(
  bookId: string,
  userId: string,
  patch: DraftScenePatch = {},
): Promise<DraftScene> {
  const content = patch.content ?? '';
  const words = patch.words ?? countWords(content);
  return repo.create(bookId, userId, {
    ...patch,
    title: patch.title ?? 'Без названия',
    content,
    words,
    position: patch.position ?? 0,
  });
}

export function updateDraftScene(id: string, patch: DraftScenePatch): Promise<DraftScene> {
  const normalized: DraftScenePatch = { ...patch };
  if (normalized.content !== undefined && normalized.words === undefined) {
    normalized.words = countWords(normalized.content);
  }
  return repo.update(id, normalized);
}

export function deleteDraftScene(id: string): Promise<void> {
  return repo.delete(id);
}

function isEmptyHtmlContent(html: string): boolean {
  if (!html) return true;
  return html.replace(/<(p|div|br)\s*\/?>|<\/(p|div)>/gi, '').trim() === ''
    && countWords(html) === 0;
}

/**
 * Склеивает HTML существующей главы и черновика сцены (в начало или в конец)
 * без потери форматирования и без лишних пустых абзацев.
 */
export function mergeSceneIntoChapterContent(
  chapterHtml: string,
  sceneHtml: string,
  position: DraftInsertPosition,
): string {
  const chapterEmpty = isEmptyHtmlContent(chapterHtml);
  const sceneEmpty = isEmptyHtmlContent(sceneHtml);

  if (sceneEmpty && chapterEmpty) return '';
  if (sceneEmpty) return chapterHtml;
  if (chapterEmpty) return sceneHtml;

  const first = position === 'start' ? sceneHtml.trim() : chapterHtml.trim();
  const second = position === 'start' ? chapterHtml.trim() : sceneHtml.trim();

  const hasBlockBoundary = /<\/[a-z0-9]+>\s*$/i.test(first) || /^\s*<[a-z0-9]/i.test(second);
  return hasBlockBoundary ? `${first}${second}` : `${first}\n\n${second}`;
}

/**
 * Вычисляет целевой индекс вставки новой главы в массив глав книги.
 */
export function resolveConvertPosition(
  chapters: readonly Pick<ChapterMeta, 'id'>[],
  placement: DraftConvertPlacement,
): number {
  if (placement.mode === 'start') return 0;
  if (placement.mode === 'end') return chapters.length;
  const idx = chapters.findIndex((c) => c.id === placement.afterChapterId);
  return idx === -1 ? chapters.length : idx + 1;
}

/**
 * Вставляет метаданные созданной главы в нужную позицию и возвращает
 * перенумерованный список глав и патчи позиций для изменившихся строк.
 */
export function buildChaptersAfterInsert(
  chapters: readonly ChapterMeta[],
  createdMeta: ChapterMeta,
  insertIndex: number,
): {
  nextChapters: ChapterMeta[];
  reorderUpdates: Array<{ id: string; position: number }>;
} {
  const clamped = Math.max(0, Math.min(insertIndex, chapters.length));
  const combined = [
    ...chapters.slice(0, clamped),
    createdMeta,
    ...chapters.slice(clamped),
  ];
  const nextChapters = combined.map((c, i) => ({ ...c, position: i }));
  const reorderUpdates = nextChapters
    .filter((_, i) => combined[i].position !== i)
    .map((c) => ({ id: c.id, position: c.position }));

  return { nextChapters, reorderUpdates };
}

const DEFAULT_SCENE_TITLE_RE =
  /^(?:сцена|scene|черновик|draft|глава|chapter)(?:\s*(?:№|#|[-–—:])?\s*\(?\d+\)?)?\.?$/iu;

/**
 * Проверяет, является ли заголовок сцены дефолтным/техническим
 * («Сцена 1», «Сцена № 1», «Сцена», «Черновик», «Draft 2», «Глава 1», пустой заголовок, «Без названия»).
 */
export function isDefaultDraftSceneTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const trimmed = title.trim();
  if (!trimmed || /^(?:без\s+названия|untitled)$/iu.test(trimmed)) return true;
  return DEFAULT_SCENE_TITLE_RE.test(trimmed);
}

/**
 * Вычисляет заголовок создаваемой главы при конвертации черновика сцены.
 * Если у сцены дефолтное название («Сцена 1», «Сцена», пустое и т.п.),
 * ей присваивается регулярный заголовок «Глава N» в соответствии с позицией вставки.
 * Если автор дал сцене собственное название (например, «Ночной побег»),
 * оно сохраняется.
 */
export function resolveConvertedChapterTitle(
  sceneTitle: string | null | undefined,
  chapters: readonly Pick<ChapterMeta, 'title'>[],
  insertIndex: number,
): string {
  const trimmed = (sceneTitle ?? '').trim();
  if (isDefaultDraftSceneTitle(trimmed)) {
    const clampedIndex = Math.max(0, Math.min(insertIndex, chapters.length));
    let priorRegularCount = 0;
    for (let i = 0; i < clampedIndex; i++) {
      if (parseChapterTitle(chapters[i].title).type === 'regular') {
        priorRegularCount += 1;
      }
    }
    const targetRank = priorRegularCount + 1;
    return formatChapterTitle('regular', targetRank);
  }
  return trimmed;
}

/**
 * Превращает черновик сцены в полноценную главу книги на выбранной позиции
 * (в начало, в конец или после выбранной главы) и удаляет исходный черновик.
 */
export async function convertDraftSceneToChapter(
  scene: DraftScene,
  chapters: readonly ChapterMeta[],
  placement: DraftConvertPlacement,
): Promise<{ chapter: Chapter; nextChapters: ChapterMeta[] }> {
  const insertIndex = resolveConvertPosition(chapters, placement);
  const title = resolveConvertedChapterTitle(scene.title, chapters, insertIndex);
  const words = countWords(scene.content);

  const created = await createChapter(scene.book_id, scene.user_id, {
    title,
    content: scene.content,
    words,
    position: insertIndex,
  });

  const { content: _c, ...createdMeta } = created;
  const { nextChapters, reorderUpdates } = buildChaptersAfterInsert(chapters, createdMeta, insertIndex);

  if (reorderUpdates.length > 0) {
    await reorderChapters(reorderUpdates);
  }

  const renumberUpdates = getChaptersNeedingRenumber(nextChapters);
  let finalChapters = nextChapters;
  if (renumberUpdates.length > 0) {
    await renumberChapters(renumberUpdates);
    const titleMap = new Map(renumberUpdates.map((u) => [u.id, u.title]));
    finalChapters = nextChapters.map((c) => (titleMap.has(c.id) ? { ...c, title: titleMap.get(c.id)! } : c));
  }

  await deleteDraftScene(scene.id);

  const finalTitle = finalChapters.find((c) => c.id === created.id)?.title ?? created.title;
  return {
    chapter: { ...created, position: insertIndex, title: finalTitle },
    nextChapters: finalChapters,
  };
}

/**
 * Вставляет текст черновика сцены в существующую главу (в начало или в конец),
 * обновляет счётчик слов главы и удаляет черновик.
 */
export async function insertDraftSceneIntoChapter(
  scene: DraftScene,
  targetChapterId: string,
  position: DraftInsertPosition,
): Promise<Chapter> {
  const current = await getChapterContent(targetChapterId);
  const mergedContent = mergeSceneIntoChapterContent(current.content, scene.content, position);
  const words = countWords(mergedContent);

  const updated = await updateChapter(targetChapterId, {
    content: mergedContent,
    words,
  });

  await deleteDraftScene(scene.id);
  return updated;
}
