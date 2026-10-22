import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import {
  countWords,
  getChapterState,
  updateChapterMeta,
  type ChapterMeta,
  type ChapterPatch,
  type SaveState,
} from './chapters';
import { QUERY_KEYS } from './queries';
import { clearDraft, decideDraft, readDraft, writeDraft, type DraftDecision } from './chapterDrafts';
import { createVersion } from './versions';
import { listMatchableCharacters, syncBacklinks } from './crossrefs';

// Единое автосохранение глав для Editor / Focus / Split.
//
// Инварианты (каждый закрывает сценарий потери текста):
// - очередь патчей по id главы: смена главы не выбрасывает незаписанный патч старой;
// - один запрос в полёте: ответы не приходят «не по порядку» и не откатывают новый текст;
// - ответ сервера не пишется в кэш контента — источник правды для текста редактор;
//   в метаданные не мержатся поля, которые ещё ждут отправки (заголовок не «прыгает»);
// - оптимистичная блокировка по updated_at: если главу правили в другом окне/устройстве,
//   серверная версия сначала уходит в историю версий, потом пишется наша — ничего не теряется;
// - локальный черновик (chapterDrafts) до подтверждения сервером;
// - ошибки — повтор с нарастающей паузой и сразу при возвращении сети.

const DEBOUNCE_MS = 700;
const DRAFT_THROTTLE_MS = 800;
const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
// Суммарный лимит тел keepalive-запросов в браузере — 64 КиБ.
const KEEPALIVE_BUDGET = 60_000;

const timeLabel = (d: Date) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function useChapterAutosave({
  bookId,
  userId,
  isPro,
}: {
  bookId: string | undefined;
  userId: string | undefined;
  isPro: boolean;
}) {
  const queryClient = useQueryClient();
  const ctxRef = useRef({ bookId, userId, isPro });
  ctxRef.current = { bookId, userId, isPro };

  const pendingRef = useRef(new Map<string, ChapterPatch>());
  const inFlightRef = useRef<{ id: string; patch: ChapterPatch } | null>(null);
  const loopRef = useRef<Promise<void> | null>(null);
  const baseRef = useRef(new Map<string, string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const failuresRef = useRef(0);
  const tokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) tokenRef.current = data.session?.access_token ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      tokenRef.current = session?.access_token ?? null;
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  const metaOf = useCallback((id: string): ChapterMeta | undefined => {
    const b = ctxRef.current.bookId;
    if (!b) return undefined;
    return queryClient.getQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(b))?.find((c) => c.id === id);
  }, [queryClient]);

  const baseOf = useCallback((id: string): string | null => {
    return baseRef.current.get(id) ?? metaOf(id)?.updated_at ?? null;
  }, [metaOf]);

  const persistDraft = useCallback((id: string) => {
    const t = draftTimersRef.current.get(id);
    if (t) { clearTimeout(t); draftTimersRef.current.delete(id); }
    const content = pendingRef.current.get(id)?.content
      ?? (inFlightRef.current?.id === id ? inFlightRef.current.patch.content : undefined);
    if (content !== undefined) writeDraft(id, content, baseOf(id));
  }, [baseOf]);

  const scheduleDraft = useCallback((id: string) => {
    if (draftTimersRef.current.has(id)) return;
    draftTimersRef.current.set(id, setTimeout(() => {
      draftTimersRef.current.delete(id);
      persistDraft(id);
    }, DRAFT_THROTTLE_MS));
  }, [persistDraft]);

  const mergeMetaFromServer = useCallback((meta: ChapterMeta) => {
    const b = ctxRef.current.bookId;
    if (!b) return;
    const waiting = pendingRef.current.get(meta.id) ?? {};
    const safe: Partial<ChapterMeta> = { ...meta };
    for (const key of Object.keys(waiting) as (keyof ChapterPatch)[]) {
      if (key !== 'content') delete safe[key];
    }
    queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(b), (prev) =>
      prev ? prev.map((c) => (c.id === meta.id ? { ...c, ...safe } : c)) : prev,
    );
  }, [queryClient]);

  const runBacklinks = useCallback(async (id: string, content: string) => {
    const b = ctxRef.current.bookId;
    if (!b) return;
    const characters = await queryClient.fetchQuery({
      queryKey: QUERY_KEYS.matchableCharacters(b),
      queryFn: () => listMatchableCharacters(b),
      staleTime: 60_000,
    });
    if (characters.length === 0) return;
    await syncBacklinks(id, b, content, characters);
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterCharactersAll() });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterMembers(id) });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterPovMap(b) });
  }, [queryClient]);

  // Конфликт: глава изменилась на сервере с момента загрузки.
  // Серверный текст сохраняем именованной версией, затем пишем свой без условия.
  const resolveConflict = useCallback(async (id: string, patch: ChapterPatch): Promise<ChapterMeta | null> => {
    const server = await getChapterState(id);
    if (!server) {
      // Глава удалена в другом окне: писать некуда, текст остаётся в локальном черновике.
      persistDraft(id);
      setNotice('Глава удалена в другом окне. Несохранённый текст остался в черновике этого браузера.');
      return null;
    }
    const { userId: uId, isPro: pro } = ctxRef.current;
    if (uId && server.content && server.content !== patch.content) {
      await createVersion(id, uId, server.content, countWords(server.content), 'manual', pro,
        `Из другого окна · ${timeLabel(new Date())}`);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(id) });
    }
    setNotice('Эту главу меняли в другом окне или на другом устройстве. Их версия сохранена в «Версиях», в главе — ваш текст.');
    return updateChapterMeta(id, patch);
  }, [persistDraft, queryClient]);

  const sendOne = useCallback(async (id: string, patch: ChapterPatch) => {
    const guarded = patch.content !== undefined;
    let meta = await updateChapterMeta(id, patch, guarded ? baseOf(id) : undefined);
    if (!meta && guarded) meta = await resolveConflict(id, patch);
    if (!meta) return;
    baseRef.current.set(id, meta.updated_at);
    mergeMetaFromServer(meta);
    if (patch.content !== undefined) {
      const newer = pendingRef.current.get(id)?.content;
      if (newer === undefined) clearDraft(id);
      else writeDraft(id, newer, meta.updated_at);
      void runBacklinks(id, patch.content).catch(() => { /* бэклинки некритичны */ });
    }
  }, [baseOf, mergeMetaFromServer, resolveConflict, runBacklinks]);

  const drain = useCallback(async () => {
    while (pendingRef.current.size > 0) {
      const [id, patch] = pendingRef.current.entries().next().value as [string, ChapterPatch];
      pendingRef.current.delete(id);
      inFlightRef.current = { id, patch };
      if (mountedRef.current) setSaveState('saving');
      try {
        await sendOne(id, patch);
        failuresRef.current = 0;
      } catch (e) {
        // Вернуть патч в очередь, не затирая то, что напечатали за время запроса.
        const newer = pendingRef.current.get(id);
        pendingRef.current.set(id, { ...patch, ...(newer ?? {}) });
        persistDraft(id);
        throw e;
      } finally {
        inFlightRef.current = null;
      }
    }
  }, [sendOne, persistDraft]);

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (loopRef.current) {
      await loopRef.current.catch(() => {});
      if (pendingRef.current.size === 0) return;
    }
    if (pendingRef.current.size === 0) return;
    const loop = drain();
    loopRef.current = loop;
    try {
      await loop;
      if (mountedRef.current && pendingRef.current.size === 0) {
        setSaveState('saved');
        setSavedAt(new Date());
      }
    } catch {
      failuresRef.current += 1;
      // После ухода со страницы не ретраим вечно: текст уже в локальном черновике.
      if (!mountedRef.current) return;
      setSaveState('error');
      const delay = RETRY_DELAYS_MS[Math.min(failuresRef.current - 1, RETRY_DELAYS_MS.length - 1)];
      if (!timerRef.current) timerRef.current = setTimeout(() => { void flush(); }, delay);
    } finally {
      if (loopRef.current === loop) loopRef.current = null;
    }
  }, [drain]);

  const schedule = useCallback((id: string, patch: ChapterPatch) => {
    const b = ctxRef.current.bookId;
    if (b) {
      const { content: _c, ...metaPatch } = patch;
      if (Object.keys(metaPatch).length > 0) {
        queryClient.setQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(b), (prev) =>
          prev ? prev.map((c) => (c.id === id ? { ...c, ...metaPatch } : c)) : prev,
        );
      }
    }
    if (patch.content !== undefined) {
      queryClient.setQueryData<{ id: string; content: string }>(
        QUERY_KEYS.chapterContent(id),
        { id, content: patch.content },
      );
    }
    if (!baseRef.current.has(id)) {
      const known = metaOf(id)?.updated_at;
      if (known) baseRef.current.set(id, known);
    }
    pendingRef.current.set(id, { ...(pendingRef.current.get(id) ?? {}), ...patch });
    if (patch.content !== undefined) scheduleDraft(id);
    setSaveState('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = failuresRef.current > 0 ? RETRY_DELAYS_MS[Math.min(failuresRef.current - 1, RETRY_DELAYS_MS.length - 1)] : DEBOUNCE_MS;
    timerRef.current = setTimeout(() => { void flush(); }, delay);
  }, [queryClient, metaOf, scheduleDraft, flush]);

  const scheduleContent = useCallback((id: string, html: string) => {
    schedule(id, { content: html, words: countWords(html) });
  }, [schedule]);

  // Перед восстановлением версии: выбросить незаписанный текст главы и дождаться
  // запроса в полёте — иначе он долетит после restore и перезапишет версию.
  const discard = useCallback(async (id: string) => {
    const p = pendingRef.current.get(id);
    if (p) {
      const { content: _c, words: _w, ...rest } = p;
      if (Object.keys(rest).length > 0) pendingRef.current.set(id, rest);
      else pendingRef.current.delete(id);
    }
    if (loopRef.current) await loopRef.current.catch(() => {});
    clearDraft(id);
    baseRef.current.delete(id);
  }, []);

  // Глава записана мимо очереди (восстановление версии): новая точка отсчёта для блокировки.
  const rebase = useCallback((id: string, updatedAt: string) => {
    baseRef.current.set(id, updatedAt);
  }, []);

  const hasUnsaved = useCallback(
    () => pendingRef.current.size > 0 || inFlightRef.current !== null,
    [],
  );

  useEffect(() => {
    const onOnline = () => {
      failuresRef.current = 0;
      void flush();
    };
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return;
      for (const id of pendingRef.current.keys()) persistDraft(id);
      if (inFlightRef.current) persistDraft(inFlightRef.current.id);
      void flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const items: { id: string; patch: ChapterPatch }[] = [];
      if (inFlightRef.current) items.push(inFlightRef.current);
      for (const [id, patch] of pendingRef.current) items.push({ id, patch });
      if (items.length === 0) return;
      for (const { id } of items) persistDraft(id);
      const token = tokenRef.current;
      let budget = KEEPALIVE_BUDGET;
      if (token) {
        for (const { id, patch } of items) {
          const body = JSON.stringify(patch);
          if (body.length * 2 > budget) continue;
          budget -= body.length * 2;
          const base = patch.content !== undefined ? baseOf(id) : null;
          const filter = base ? `&updated_at=eq.${encodeURIComponent(base)}` : '';
          void fetch(`${SUPABASE_URL}/rest/v1/chapters?id=eq.${id}${filter}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
              Prefer: 'return=minimal',
            },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      }
      // Нативный диалог «Покинуть сайт?»: текст ещё не подтверждён сервером.
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [flush, persistDraft, baseOf]);

  useEffect(() => {
    mountedRef.current = true;
    const draftTimers = draftTimersRef.current;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      for (const id of draftTimers.keys()) persistDraft(id);
      // Уход со страницы: дописать очередь. Если сеть упала — текст в черновике,
      // восстановится при следующем открытии главы.
      void flush();
    };
  }, [flush, persistDraft]);

  return {
    schedule,
    scheduleContent,
    flush,
    discard,
    rebase,
    hasUnsaved,
    saveState,
    savedAt,
    notice,
    clearNotice: useCallback(() => setNotice(null), []),
    setNotice,
  };
}

export type ChapterAutosave = ReturnType<typeof useChapterAutosave>;

// Текст главы для посева в редактор с учётом локального черновика.
// Решение принимается один раз на открытие главы (до посева), побочные эффекты — после.
export function useRecoveredChapterContent(
  chapterId: string | null | undefined,
  serverData: { id: string; content: string } | undefined,
  serverUpdatedAt: string | null | undefined,
  autosave: Pick<ChapterAutosave, 'schedule' | 'setNotice'>,
  ctx: { userId: string | undefined; isPro: boolean },
): { content: string; ready: boolean } {
  const queryClient = useQueryClient();
  const loaded = !!chapterId && serverData?.id === chapterId;
  const decisionRef = useRef<{ id: string; decision: DraftDecision } | null>(null);

  if (loaded && decisionRef.current?.id !== chapterId) {
    decisionRef.current = {
      id: chapterId,
      decision: decideDraft(readDraft(chapterId), serverData.content, serverUpdatedAt ?? null),
    };
  }
  const decision = loaded && decisionRef.current?.id === chapterId ? decisionRef.current.decision : null;

  const handledRef = useRef<string | null>(null);
  const { schedule, setNotice } = autosave;
  const { userId, isPro } = ctx;
  useEffect(() => {
    if (!chapterId || !decision || handledRef.current === chapterId) return;
    handledRef.current = chapterId;
    if (decision.kind === 'restore') {
      const html = decision.draft.content;
      schedule(chapterId, { content: html, words: countWords(html) });
      setNotice(`Восстановлен текст, который не успел сохраниться (${timeLabel(new Date(decision.draft.savedAt))}).`);
    } else if (decision.kind === 'conflict' && userId) {
      const html = decision.draft.content;
      void createVersion(chapterId, userId, html, countWords(html), 'manual', isPro,
        `Несохранённый черновик · ${timeLabel(new Date(decision.draft.savedAt))}`)
        .then(() => {
          clearDraft(chapterId);
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(chapterId) });
          setNotice('Найден несохранённый текст, но глава с тех пор менялась. Он сохранён в «Версиях» главы.');
        })
        .catch(() => { /* черновик остаётся — повторим при следующем открытии */ });
    }
  }, [chapterId, decision, schedule, setNotice, userId, isPro, queryClient]);

  if (!loaded || !decision) return { content: serverData?.content ?? '', ready: false };
  if (decision.kind === 'restore' && handledRef.current !== chapterId) {
    return { content: decision.draft.content, ready: true };
  }
  return { content: serverData.content, ready: true };
}
