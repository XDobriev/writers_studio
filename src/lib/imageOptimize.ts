// src/lib/imageOptimize.ts

export interface OptimizeOpts {
  maxSize: number;
  quality: number;
}

export const COVER_OPTS: OptimizeOpts  = { maxSize: 1200, quality: 0.90 };
export const AVATAR_OPTS: OptimizeOpts = { maxSize: 512,  quality: 0.85 };
export const MAP_BG_OPTS: OptimizeOpts = { maxSize: 2048, quality: 0.88 };

export async function optimizeImage(file: File, opts: OptimizeOpts): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const { width: origW, height: origH } = bitmap;

  const scale = Math.min(1, opts.maxSize / Math.max(origW, origH));
  const w = Math.round(origW * scale);
  const h = Math.round(origH * scale);

  const needsResize = scale < 1;
  const alreadySmall = file.type === 'image/webp' && file.size < 300_000;
  if (!needsResize && alreadySmall) {
    bitmap.close();
    return file;
  }

  let blob: Blob;

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    try {
      blob = await canvas.convertToBlob({ type: 'image/webp', quality: opts.quality });
    } catch {
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: opts.quality });
    }
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/webp',
        opts.quality,
      );
    }).catch(() => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob jpeg failed'))),
        'image/jpeg',
        opts.quality,
      );
    }));
  }

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.${ext}`, { type: blob.type });
}
