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
      // Возврат патча только если глава не сменилась за время запроса.
      // Иначе патч принадлежит старой главе — подмешивать его в патч новой нельзя
      // (это записало бы чужой контент). Падший патч старой главы теряется,
      // но его страхует beforeunload-keepalive при закрытии вкладки.
      if (targetIdRef.current === id) {
        pendingPatchRef.current = { ...patch, ...(pendingPatchRef.current ?? {}) } as P;
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => { void flush(); }, delay);
        }
      }
    }
  }, [delay]);

  const cancel = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    pendingPatchRef.current = null;
    targetIdRef.current = null;
  }, []);

  const scheduleSave = useCallback((id: string, patch: P) => {
    // Смена главы при незаписанном патче: сбросить старый патч немедленно,
    // не подмешивая его в патч новой главы (защита от записи чужого контента).
    if (pendingPatchRef.current && targetIdRef.current && targetIdRef.current !== id) {
      void flush();
    }
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
