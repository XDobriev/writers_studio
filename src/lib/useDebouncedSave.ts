import { useCallback, useEffect, useRef } from 'react';

const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

// Отложенное сохранение сущностей (персонажи, локации, связи, события, замысел).
// Очередь по id: смена сущности не выбрасывает незаписанный патч предыдущей.
// Один запрос в полёте: ответы не приходят «не по порядку».
// Ошибка — патч возвращается в очередь, повтор с нарастающей паузой.
// pendingPatchRef/targetIdRef — патч и id последней правки, для keepalive (Plan).
export function useDebouncedSave<P extends object>(
  onFlush: (id: string, patch: P) => Promise<void>,
  delay = 700,
) {
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  const queueRef = useRef(new Map<string, P>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopRef = useRef<Promise<void> | null>(null);
  const failuresRef = useRef(0);
  const mountedRef = useRef(true);
  const pendingPatchRef = useRef<P | null>(null);
  const targetIdRef = useRef<string | null>(null);

  const syncMirror = useCallback(() => {
    const id = targetIdRef.current;
    pendingPatchRef.current = id ? queueRef.current.get(id) ?? null : null;
  }, []);

  const drain = useCallback(async () => {
    while (queueRef.current.size > 0) {
      const [id, patch] = queueRef.current.entries().next().value as [string, P];
      queueRef.current.delete(id);
      syncMirror();
      try {
        await onFlushRef.current(id, patch);
      } catch (e) {
        queueRef.current.set(id, { ...patch, ...(queueRef.current.get(id) ?? {}) });
        syncMirror();
        throw e;
      }
    }
  }, [syncMirror]);

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (loopRef.current) await loopRef.current.catch(() => {});
    if (queueRef.current.size === 0) return;
    const loop = drain();
    loopRef.current = loop;
    try {
      await loop;
      failuresRef.current = 0;
    } catch {
      failuresRef.current += 1;
      if (!mountedRef.current) return;
      const wait = RETRY_DELAYS_MS[Math.min(failuresRef.current - 1, RETRY_DELAYS_MS.length - 1)];
      if (!timerRef.current) timerRef.current = setTimeout(() => { void flush(); }, wait);
    } finally {
      if (loopRef.current === loop) loopRef.current = null;
    }
  }, [drain]);

  // Без id — сбросить всю очередь; с id — только патч этой сущности (удаление).
  const cancel = useCallback((id?: string) => {
    if (id !== undefined) {
      queueRef.current.delete(id);
      if (targetIdRef.current === id) targetIdRef.current = null;
      syncMirror();
      return;
    }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    queueRef.current.clear();
    pendingPatchRef.current = null;
    targetIdRef.current = null;
  }, [syncMirror]);

  const scheduleSave = useCallback((id: string, patch: P) => {
    // Смена сущности: незаписанный патч прежней отправляется сразу, а не ждёт таймер.
    const switched = targetIdRef.current !== null && targetIdRef.current !== id && queueRef.current.has(targetIdRef.current);
    targetIdRef.current = id;
    queueRef.current.set(id, { ...(queueRef.current.get(id) ?? {}), ...patch } as P);
    syncMirror();
    if (timerRef.current) clearTimeout(timerRef.current);
    const wait = failuresRef.current > 0
      ? RETRY_DELAYS_MS[Math.min(failuresRef.current - 1, RETRY_DELAYS_MS.length - 1)]
      : delay;
    timerRef.current = setTimeout(() => { void flush(); }, switched ? 0 : wait);
  }, [flush, delay, syncMirror]);

  useEffect(() => {
    mountedRef.current = true;
    const onOnline = () => { failuresRef.current = 0; void flush(); };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      void flush();
    };
  }, [flush]);

  return { scheduleSave, flush, cancel, pendingPatchRef, targetIdRef };
}
