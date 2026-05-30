import { useCallback, useEffect, useRef } from 'react';

export function useDebouncedSave<P extends object>(
  onFlush: (id: string, patch: P) => Promise<void>,
  delay = 700,
) {
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<P | null>(null);
  const targetIdRef = useRef<string | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const patch = pendingPatchRef.current;
    const id = targetIdRef.current;
    if (!patch || !id) return;
    pendingPatchRef.current = null;
    try {
      await onFlushRef.current(id, patch);
    } catch {
      // merge: new changes (arrived during await) take precedence over stale patch
      pendingPatchRef.current = { ...patch, ...(pendingPatchRef.current ?? {}) } as P;
    }
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    pendingPatchRef.current = null;
    targetIdRef.current = null;
  }, []);

  const scheduleSave = useCallback((id: string, patch: P) => {
    targetIdRef.current = id;
    pendingPatchRef.current = { ...(pendingPatchRef.current ?? {}), ...patch } as P;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void flush(); }, delay);
  }, [flush, delay]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    void flush();
  }, [flush]);

  return { scheduleSave, flush, cancel, pendingPatchRef, targetIdRef };
}
