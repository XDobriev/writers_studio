import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, type Book } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import { recordWritingProgress } from './books';
import { todayLocalISODate } from './dates';
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
import { updateDraftScene, type DraftScene, type DraftScenePatch } from './draftScenes';

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
  const confirmedWordsRef = useRef(new Map<string, number>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const failuresRef = useRef(0);
  const tokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const pendingDraftRef = useRef(new Map<string, DraftScenePatch>());
  const inFlightDraftRef = useRef<{ id: string; patch: DraftScenePatch } | null>(null);
  const confirmedDraftWordsRef = useRef(new Map<string, number>());
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftLoopRef = useRef<Promise<void> | null>(null);
  const draftFailuresRef = useRef(0);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<SaveState>('idle');
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
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

  const scheduleLocalDraft = useCallback((id: string) => {
    if (draftTimersRef.current.has(id)) return;
    draftTimersRef.current.set(id, setTimeout(() => {
      draftTimersRef.current.delete(id);
      persistDraft(id);
    }, DRAFT_THROTTLE_MS));
  }, [persistDraft]);

  const mergeMetaFromServer = useCallback((meta: ChapterMeta) => {
    const b = meta.book_id || ctxRef.current.bookId;
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

  const runBacklinks = useCallback(async (id: string, content: string, bookIdOverride?: string) => {
    const b = bookIdOverride || ctxRef.current.bookId;
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
    const { userId: uId } = ctxRef.current;
    if (uId && server.content && server.content !== patch.content) {
      await createVersion(id, uId, server.content, countWords(server.content), 'manual',
        `Из другого окна · ${timeLabel(new Date())}`);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(id) });
    }
    setNotice('Эту главу меняли в другом окне или на другом устройстве. Их версия сохранена в «Версиях», в главе — ваш текст.');
    return updateChapterMeta(id, patch);
  }, [persistDraft, queryClient]);

  const syncBookWordsCache = useCallback((b: string) => {
    const chaptersList = queryClient.getQueryData<ChapterMeta[]>(QUERY_KEYS.chapters(b));
    if (chaptersList) {
      const totalWords = chaptersList.reduce((sum, c) => sum + (c.words ?? 0), 0);
      queryClient.setQueryData<Book>(QUERY_KEYS.book(b), (prev) =>
        prev ? { ...prev, words: totalWords } : prev,
      );
      const uId = ctxRef.current.userId;
      if (uId) {
        queryClient.setQueryData<Book[]>(QUERY_KEYS.books(uId), (prev) =>
          prev ? prev.map((bk) => (bk.id === b ? { ...bk, words: totalWords } : bk)) : prev,
        );
      }
    } else {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.book(b) });
      void queryClient.invalidateQueries({ queryKey: ['books'] });
    }
  }, [queryClient]);

  const sendOne = useCallback(async (id: string, patch: ChapterPatch) => {
    const guarded = patch.content !== undefined;
    let meta = await updateChapterMeta(id, patch, guarded ? baseOf(id) : undefined);
    if (!meta && guarded) meta = await resolveConflict(id, patch);
    if (!meta) return;
    baseRef.current.set(id, meta.updated_at);
    mergeMetaFromServer(meta);
    const b = meta.book_id || ctxRef.current.bookId;
    if (patch.content !== undefined || patch.words !== undefined) {
      const prevWords = confirmedWordsRef.current.get(id) ?? meta.words;
      const delta = meta.words - prevWords;
      if (delta !== 0 && b) {
        try {
          await recordWritingProgress({
            bookId: b,
            date: todayLocalISODate(),
            docKind: 'chapter',
            docId: id,
            delta,
          });
          confirmedWordsRef.current.set(id, meta.words);
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.writingSnapshots(b) });
        } catch {
          // Статистика некритична для сохранности текста; confirmedWordsRef остаётся
          // на прежнем уровне, чтобы следующее сохранение догнало дельту.
        }
      } else {
        confirmedWordsRef.current.set(id, meta.words);
      }
      if (b) syncBookWordsCache(b);
    }
    if (patch.content !== undefined) {
      const newer = pendingRef.current.get(id)?.content;
      if (newer === undefined) clearDraft(id);
      else writeDraft(id, newer, meta.updated_at);
      void runBacklinks(id, patch.content, b).catch(() => { /* бэклинки некритичны */ });
    }
  }, [baseOf, mergeMetaFromServer, queryClient, resolveConflict, runBacklinks, syncBookWordsCache]);

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
    if ((patch.content !== undefined || patch.words !== undefined) && !confirmedWordsRef.current.has(id)) {
      // Если контент главы уже в кэше, считаем базу актуальным countWords по исходному HTML:
      // старые главы в БД могли быть посчитаны багованным countWords (мягкие переносы, инлайн-теги,
      // склейка при импорте) — так первая правка не даст ложного скачка или отрицательной дельты.
      const cachedContent = queryClient.getQueryData<{ id: string; content: string }>(QUERY_KEYS.chapterContent(id));
      const currentWords = cachedContent ? countWords(cachedContent.content) : metaOf(id)?.words;
      if (currentWords !== undefined) confirmedWordsRef.current.set(id, currentWords);
    }
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
    if (patch.content !== undefined) scheduleLocalDraft(id);
    setSaveState('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    const delay = failuresRef.current > 0 ? RETRY_DELAYS_MS[Math.min(failuresRef.current - 1, RETRY_DELAYS_MS.length - 1)] : DEBOUNCE_MS;
    timerRef.current = setTimeout(() => { void flush(); }, delay);
  }, [queryClient, metaOf, scheduleLocalDraft, flush]);

  const scheduleContent = useCallback((id: string, html: string) => {
    schedule(id, { content: html, words: countWords(html) });
  }, [schedule]);

  // Перед восстановлением версии или удалением главы: выбросить незаписанный патч
  // и дождаться запроса в полёте — иначе он долетит после restore/delete.
  const discard = useCallback(async (id: string, discardAll = false) => {
    const p = pendingRef.current.get(id);
    if (p) {
      if (discardAll) {
        pendingRef.current.delete(id);
      } else {
        const { content: _c, words: _w, ...rest } = p;
        if (Object.keys(rest).length > 0) pendingRef.current.set(id, rest);
        else pendingRef.current.delete(id);
      }
    }
    if (loopRef.current) await loopRef.current.catch(() => {});
    clearDraft(id);
    baseRef.current.delete(id);
    confirmedWordsRef.current.delete(id);
  }, []);

  // Глава записана мимо очереди (восстановление версии, вставка черновика):
  // новая точка отсчёта для блокировки и для дельты слов.
  const rebase = useCallback((id: string, updatedAt: string, words?: number) => {
    baseRef.current.set(id, updatedAt);
    if (words !== undefined) confirmedWordsRef.current.set(id, words);
    else confirmedWordsRef.current.delete(id);
  }, []);

  const hasUnsaved = useCallback(
    () => pendingRef.current.size > 0 || inFlightRef.current !== null,
    [],
  );

  // Автосохранение черновиков свободных сцен (draft_scenes)
  const drainDraft = useCallback(async () => {
    while (pendingDraftRef.current.size > 0) {
      const [id, patch] = pendingDraftRef.current.entries().next().value as [string, DraftScenePatch];
      pendingDraftRef.current.delete(id);
      inFlightDraftRef.current = { id, patch };
      if (mountedRef.current) setDraftSaveState('saving');
      try {
        const updated = await updateDraftScene(id, patch);
        const b = updated.book_id || ctxRef.current.bookId;
        if (b) {
          const waiting = pendingDraftRef.current.get(id) ?? {};
          const safe: Partial<DraftScene> = { ...updated };
          for (const key of Object.keys(waiting) as (keyof DraftScenePatch)[]) {
            delete safe[key];
          }
          queryClient.setQueryData<DraftScene[]>(QUERY_KEYS.draftScenes(b), (prev) =>
            prev ? prev.map((d) => (d.id === id ? { ...d, ...safe } : d)) : prev,
          );
        }
        if (patch.content !== undefined || patch.words !== undefined) {
          const newWords = updated.words ?? patch.words ?? (patch.content !== undefined ? countWords(patch.content) : 0);
          const prevWords = confirmedDraftWordsRef.current.get(id) ?? newWords;
          const delta = newWords - prevWords;
          if (delta !== 0 && b) {
            try {
              await recordWritingProgress({
                bookId: b,
                date: todayLocalISODate(),
                docKind: 'draft',
                docId: id,
                delta,
              });
              confirmedDraftWordsRef.current.set(id, newWords);
              void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.writingSnapshots(b) });
            } catch {
              // Статистика некритична для сохранности черновика; следующая запись догонит дельту.
            }
          } else {
            confirmedDraftWordsRef.current.set(id, newWords);
          }
        }
        draftFailuresRef.current = 0;
      } catch (e) {
        const newer = pendingDraftRef.current.get(id);
        pendingDraftRef.current.set(id, { ...patch, ...(newer ?? {}) });
        throw e;
      } finally {
        inFlightDraftRef.current = null;
      }
    }
  }, [queryClient]);

  const flushDraft = useCallback(async (): Promise<void> => {
    if (draftTimerRef.current) { clearTimeout(draftTimerRef.current); draftTimerRef.current = null; }
    if (draftLoopRef.current) {
      await draftLoopRef.current.catch(() => {});
      if (pendingDraftRef.current.size === 0) return;
    }
    if (pendingDraftRef.current.size === 0) return;
    const loop = drainDraft();
    draftLoopRef.current = loop;
    try {
      await loop;
      if (mountedRef.current && pendingDraftRef.current.size === 0) {
        setDraftSaveState('saved');
        setDraftSavedAt(new Date());
      }
    } catch {
      draftFailuresRef.current += 1;
      if (!mountedRef.current) return;
      setDraftSaveState('error');
      const delay = RETRY_DELAYS_MS[Math.min(draftFailuresRef.current - 1, RETRY_DELAYS_MS.length - 1)];
      if (!draftTimerRef.current) draftTimerRef.current = setTimeout(() => { void flushDraft(); }, delay);
    } finally {
      if (draftLoopRef.current === loop) draftLoopRef.current = null;
    }
  }, [drainDraft]);

  const scheduleDraft = useCallback((id: string, patch: DraftScenePatch) => {
    const b = ctxRef.current.bookId;
    if (b && (patch.content !== undefined || patch.words !== undefined) && !confirmedDraftWordsRef.current.has(id)) {
      const existing = queryClient.getQueryData<DraftScene[]>(QUERY_KEYS.draftScenes(b))?.find((d) => d.id === id);
      if (existing) {
        const currentWords = typeof existing.content === 'string' ? countWords(existing.content) : existing.words;
        confirmedDraftWordsRef.current.set(id, currentWords);
      }
    }
    if (b) {
      queryClient.setQueryData<DraftScene[]>(QUERY_KEYS.draftScenes(b), (prev) =>
        prev ? prev.map((d) => (d.id === id ? { ...d, ...patch } : d)) : prev,
      );
    }
    pendingDraftRef.current.set(id, { ...(pendingDraftRef.current.get(id) ?? {}), ...patch });
    setDraftSaveState('saving');
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    const delay = draftFailuresRef.current > 0
      ? RETRY_DELAYS_MS[Math.min(draftFailuresRef.current - 1, RETRY_DELAYS_MS.length - 1)]
      : DEBOUNCE_MS;
    draftTimerRef.current = setTimeout(() => { void flushDraft(); }, delay);
  }, [queryClient, flushDraft]);

  const cancelDraft = useCallback((id?: string) => {
    if (id !== undefined) {
      pendingDraftRef.current.delete(id);
      confirmedDraftWordsRef.current.delete(id);
      if (pendingDraftRef.current.size === 0 && draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
        draftTimerRef.current = null;
      }
      return;
    }
    if (draftTimerRef.current) { clearTimeout(draftTimerRef.current); draftTimerRef.current = null; }
    pendingDraftRef.current.clear();
    confirmedDraftWordsRef.current.clear();
  }, []);

  const hasUnsavedDraft = useCallback(
    () => pendingDraftRef.current.size > 0 || inFlightDraftRef.current !== null,
    [],
  );

  useEffect(() => {
    const onOnline = () => {
      failuresRef.current = 0;
      draftFailuresRef.current = 0;
      void flush();
      void flushDraft();
    };
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return;
      for (const id of pendingRef.current.keys()) persistDraft(id);
      if (inFlightRef.current) persistDraft(inFlightRef.current.id);
      void flush();
      void flushDraft();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const items: { id: string; patch: ChapterPatch }[] = [];
      if (inFlightRef.current) items.push(inFlightRef.current);
      for (const [id, patch] of pendingRef.current) items.push({ id, patch });

      const draftItems: { id: string; patch: DraftScenePatch }[] = [];
      if (inFlightDraftRef.current) draftItems.push(inFlightDraftRef.current);
      for (const [id, patch] of pendingDraftRef.current) draftItems.push({ id, patch });

      if (items.length === 0 && draftItems.length === 0) return;
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

        for (const { id, patch } of draftItems) {
          const body = JSON.stringify(patch);
          if (body.length * 2 > budget) continue;
          budget -= body.length * 2;
          void fetch(`${SUPABASE_URL}/rest/v1/draft_scenes?id=eq.${id}`, {
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
    // Отправляем неподтверждённую дельту слов только на pagehide (реальный уход/перезагрузка,
    // никогда при отмене диалога beforeunload) — исключает и потерю прогресса, и двойной учёт.
    const onPageHide = () => {
      const token = tokenRef.current;
      if (!token) return;
      const latestChapters = new Map<string, ChapterPatch>();
      if (inFlightRef.current) latestChapters.set(inFlightRef.current.id, inFlightRef.current.patch);
      for (const [id, patch] of pendingRef.current) {
        latestChapters.set(id, { ...(latestChapters.get(id) ?? {}), ...patch });
      }
      const latestDrafts = new Map<string, DraftScenePatch>();
      if (inFlightDraftRef.current) latestDrafts.set(inFlightDraftRef.current.id, inFlightDraftRef.current.patch);
      for (const [id, patch] of pendingDraftRef.current) {
        latestDrafts.set(id, { ...(latestDrafts.get(id) ?? {}), ...patch });
      }
      if (latestChapters.size === 0 && latestDrafts.size === 0) return;

      const date = todayLocalISODate();
      const sendProgressKeepalive = (bookIdForDoc: string, docKind: 'chapter' | 'draft', docId: string, delta: number) => {
        void fetch(`${SUPABASE_URL}/rest/v1/rpc/record_writing_progress`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            p_book_id: bookIdForDoc,
            p_date: date,
            p_doc_kind: docKind,
            p_doc_id: docId,
            p_delta: delta,
          }),
          keepalive: true,
        }).catch(() => {});
      };

      for (const [id, patch] of latestChapters) {
        if (patch.content === undefined && patch.words === undefined) continue;
        const targetWords = patch.words ?? countWords(patch.content ?? '');
        const prevWords = confirmedWordsRef.current.get(id);
        const b = metaOf(id)?.book_id || ctxRef.current.bookId;
        if (prevWords === undefined || !b) continue;
        const delta = targetWords - prevWords;
        if (delta === 0) continue;
        confirmedWordsRef.current.set(id, targetWords);
        sendProgressKeepalive(b, 'chapter', id, delta);
      }

      const fallbackBookId = ctxRef.current.bookId;
      const cachedDrafts = fallbackBookId
        ? queryClient.getQueryData<DraftScene[]>(QUERY_KEYS.draftScenes(fallbackBookId))
        : undefined;
      for (const [id, patch] of latestDrafts) {
        if (patch.content === undefined && patch.words === undefined) continue;
        const targetWords = patch.words ?? countWords(patch.content ?? '');
        const prevWords = confirmedDraftWordsRef.current.get(id);
        const b = cachedDrafts?.find((d) => d.id === id)?.book_id || fallbackBookId;
        if (prevWords === undefined || !b) continue;
        const delta = targetWords - prevWords;
        if (delta === 0) continue;
        confirmedDraftWordsRef.current.set(id, targetWords);
        sendProgressKeepalive(b, 'draft', id, delta);
      }
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flush, flushDraft, persistDraft, baseOf, metaOf, queryClient]);

  useEffect(() => {
    mountedRef.current = true;
    const draftTimers = draftTimersRef.current;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (draftTimerRef.current) { clearTimeout(draftTimerRef.current); draftTimerRef.current = null; }
      for (const id of draftTimers.keys()) persistDraft(id);
      // Уход со страницы: дописать очередь. Если сеть упала — текст в черновике,
      // восстановится при следующем открытии главы.
      void flush();
      void flushDraft();
    };
  }, [flush, flushDraft, persistDraft]);

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
    // Черновики сцен
    scheduleDraft,
    flushDraft,
    cancelDraft,
    hasUnsavedDraft,
    draftSaveState,
    draftSavedAt,
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
  const { userId } = ctx;
  useEffect(() => {
    if (!chapterId || !decision || handledRef.current === chapterId) return;
    handledRef.current = chapterId;
    if (decision.kind === 'restore') {
      const html = decision.draft.content;
      schedule(chapterId, { content: html, words: countWords(html) });
      setNotice(`Восстановлен текст, который не успел сохраниться (${timeLabel(new Date(decision.draft.savedAt))}).`);
    } else if (decision.kind === 'conflict' && userId) {
      const html = decision.draft.content;
      void createVersion(chapterId, userId, html, countWords(html), 'manual',
        `Несохранённый черновик · ${timeLabel(new Date(decision.draft.savedAt))}`)
        .then(() => {
          const currentDraft = readDraft(chapterId);
          if (currentDraft
            && currentDraft.content === decision.draft.content
            && currentDraft.base === decision.draft.base
            && currentDraft.savedAt === decision.draft.savedAt) {
            clearDraft(chapterId);
          }
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chapterVersions(chapterId) });
          setNotice('Найден несохранённый текст, но глава с тех пор менялась. Он сохранён в «Версиях» главы.');
        })
        .catch(() => { /* черновик остаётся — повторим при следующем открытии */ });
    }
  }, [chapterId, decision, schedule, setNotice, userId, queryClient]);

  if (!loaded || !decision) return { content: serverData?.content ?? '', ready: false };
  if (decision.kind === 'restore' && handledRef.current !== chapterId) {
    return { content: decision.draft.content, ready: true };
  }
  return { content: serverData.content, ready: true };
}
