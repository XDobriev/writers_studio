import { ensureAuthReady, supabase } from './supabase';
import { optimizeImage, type OptimizeOpts } from './imageOptimize';
import { imageExtension, referencedImageIds, rewriteImportImages, type ImportImages } from './importImages';

const CHAPTER_IMAGES_BUCKET = 'chapter-images';

const CHAPTER_IMAGE_OPTS: OptimizeOpts = { maxSize: 1600, quality: 0.85 };
const UPLOAD_CONCURRENCY = 4;
/** Предохранитель от FB2/EPUB на сотни иллюстраций: остальные просто не переносятся. */
const MAX_IMPORT_IMAGES = 150;

/** Загружает картинку главы (после ресайза в WebP) и возвращает её public URL. */
async function uploadChapterImage(userId: string, bookId: string, file: File): Promise<string> {
  await ensureAuthReady();
  const optimized = await optimizeImage(file, CHAPTER_IMAGE_OPTS);
  const ext = imageExtension(optimized.type) ?? 'webp';
  const path = `${userId}/${bookId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(CHAPTER_IMAGES_BUCKET)
    .upload(path, optimized, { contentType: optimized.type });
  if (error) throw error;
  return supabase.storage.from(CHAPTER_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Заливает картинки, на которые ссылаются главы, и подставляет URL вместо меток импорта.
 * Не загрузившаяся картинка убирается из текста — импорт из-за неё не падает; `skipped` — сколько таких.
 */
export async function uploadImportedImages(
  userId: string,
  bookId: string,
  htmls: string[],
  images: ImportImages,
): Promise<{ htmls: string[]; skipped: number }> {
  const ids = [...new Set(htmls.flatMap(referencedImageIds))];
  if (!ids.length) return { htmls, skipped: 0 };
  const urlById = new Map<string, string>();
  const queue = ids.slice(0, MAX_IMPORT_IMAGES);
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const img = images.get(id);
      if (!img) continue;
      try {
        const file = new File([img.bytes as BlobPart], id, { type: img.mime });
        urlById.set(id, await uploadChapterImage(userId, bookId, file));
      } catch { /* картинка пропускается */ }
    }
  };
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));
  return { htmls: htmls.map((h) => rewriteImportImages(h, urlById)), skipped: ids.length - urlById.size };
}
