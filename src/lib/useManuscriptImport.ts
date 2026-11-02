import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useErrorState } from './useErrorState';
import { createBook, deleteBook, updateBook } from './books';
import { toUserMessage } from './errors';
import { createChaptersBulk } from './chapters';
import { uploadImportedImages } from './chapterImages';
import { QUERY_KEYS } from './queries';
import type { Book } from './supabase';
import {
  detectImportFormat,
  parseManuscript,
  PRO_IMPORT_FORMATS,
  type ParsedManuscript,
} from './importManuscript';
import {
  analyzeSplits,
  joinChapters,
  mergeChapterWithPrevious,
  splitChapterByCharOffset,
  splitChapterByParagraph,
  splitManuscript,
  type ImportedChapter,
  type SplitMode,
  type SplitOption,
} from './importSplit';

/** joins — индексы глав, приклеенных к предыдущей (см. joinChapters). */
type ImportState =
  | { kind: 'idle' }
  | { kind: 'parsing'; fileName: string }
  | {
      kind: 'preview';
      parsed: ParsedManuscript;
      options: SplitOption[];
      mode: SplitMode;
      joins: number[];
      customChapters?: ImportedChapter[];
    }
  | {
      kind: 'creating';
      parsed: ParsedManuscript;
      options: SplitOption[];
      mode: SplitMode;
      joins: number[];
      customChapters?: ImportedChapter[];
    };

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Импорт рукописи в новую книгу: файл → разбор → предпросмотр глав → createBook +
 * массовая вставка глав. Если главы не вставились — книга удаляется (без «пустых» книг).
 */
export function useManuscriptImport({ userId, isPro, cover, onNeedUpgrade }: {
  userId: string | undefined;
  isPro: boolean;
  cover: string;
  onNeedUpgrade: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { error, setError, clearError } = useErrorState();
  const [state, setState] = useState<ImportState>({ kind: 'idle' });
  const [title, setTitle] = useState('');
  const runId = useRef(0);

  const loadFile = useCallback(async (file: File) => {
    clearError();
    const format = detectImportFormat(file.name);
    if (format && PRO_IMPORT_FORMATS.includes(format) && !isPro) {
      onNeedUpgrade();
      return;
    }
    const id = ++runId.current;
    setState({ kind: 'parsing', fileName: file.name });
    try {
      const data = await file.arrayBuffer();
      const parsed = await parseManuscript(data, file.name);
      await yieldToMain();
      const { options, defaultMode } = analyzeSplits(parsed.units, parsed.title);
      if (id !== runId.current) return;
      setTitle(parsed.title);
      setState({ kind: 'preview', parsed, options, mode: defaultMode, joins: [] });
    } catch (e) {
      if (id !== runId.current) return;
      setState({ kind: 'idle' });
      setError(e instanceof Error ? e : 'Не удалось прочитать файл');
    }
  }, [clearError, isPro, onNeedUpgrade, setError]);

  const setMode = useCallback((mode: SplitMode) => {
    setState((s) => (s.kind === 'preview' ? { ...s, mode, joins: [], customChapters: undefined } : s));
  }, []);

  const joinWithPrevious = useCallback((index: number) => {
    setState((s) => (s.kind === 'preview' ? { ...s, joins: [...s.joins, index] } : s));
  }, []);

  /** Разъединить склейку first..last: главы снова идут по отдельности. */
  const unjoin = useCallback((first: number, last: number) => {
    setState((s) => (s.kind === 'preview' ? { ...s, joins: s.joins.filter((j) => j <= first || j > last) } : s));
  }, []);

  const loaded = state.kind === 'preview' || state.kind === 'creating' ? state : null;
  const parsed = loaded?.parsed;
  const mode = loaded?.mode;
  const joins = loaded?.joins;
  const custom = loaded?.customChapters;

  // Разбивка не пересчитывается на каждую склейку: на больших рукописях это сотни мс.
  const split = useMemo(
    () => (parsed && mode ? splitManuscript(parsed.units, mode, parsed.title) : []),
    [parsed, mode],
  );
  const baseChapters = useMemo(() => joinChapters(split, new Set(joins)), [split, joins]);
  const chapters: ImportedChapter[] = custom ?? baseChapters;

  const mergeWithPrevious = useCallback((index: number) => {
    setState((s) => {
      if (s.kind !== 'preview') return s;
      const currentList: ImportedChapter[] = s.customChapters ?? joinChapters(
        s.parsed && s.mode ? splitManuscript(s.parsed.units, s.mode, s.parsed.title) : [],
        new Set(s.joins),
      );
      const next = mergeChapterWithPrevious(currentList, index);
      return { ...s, customChapters: next };
    });
  }, []);

  const splitChapterAtParagraph = useCallback((chapterIndex: number, paragraphIndex: number, newTitle?: string) => {
    setState((s) => {
      if (s.kind !== 'preview') return s;
      const currentList: ImportedChapter[] = s.customChapters ?? joinChapters(
        s.parsed && s.mode ? splitManuscript(s.parsed.units, s.mode, s.parsed.title) : [],
        new Set(s.joins),
      );
      if (chapterIndex < 0 || chapterIndex >= currentList.length) return s;
      try {
        const [p1, p2] = splitChapterByParagraph(currentList[chapterIndex], paragraphIndex, newTitle);
        const next = [
          ...currentList.slice(0, chapterIndex),
          p1,
          p2,
          ...currentList.slice(chapterIndex + 1),
        ];
        return { ...s, customChapters: next };
      } catch {
        return s;
      }
    });
  }, []);

  const splitChapterAtOffset = useCallback((chapterIndex: number, charOffset: number, newTitle?: string) => {
    setState((s) => {
      if (s.kind !== 'preview') return s;
      const currentList: ImportedChapter[] = s.customChapters ?? joinChapters(
        s.parsed && s.mode ? splitManuscript(s.parsed.units, s.mode, s.parsed.title) : [],
        new Set(s.joins),
      );
      if (chapterIndex < 0 || chapterIndex >= currentList.length) return s;
      try {
        const [p1, p2] = splitChapterByCharOffset(currentList[chapterIndex], charOffset, newTitle);
        const next = [
          ...currentList.slice(0, chapterIndex),
          p1,
          p2,
          ...currentList.slice(chapterIndex + 1),
        ];
        return { ...s, customChapters: next };
      } catch {
        return s;
      }
    });
  }, []);

  const reset = useCallback(() => {
    runId.current++;
    setState({ kind: 'idle' });
    setTitle('');
    clearError();
  }, [clearError]);

  const create = useCallback(async () => {
    if (state.kind !== 'preview' || !userId || !chapters.length) return;
    const bookTitle = title.trim() || state.parsed.title;
    setState({ ...state, kind: 'creating' });
    clearError();
    let book: Book | null = null;
    try {
      book = await createBook({
        user_id: userId,
        title: bookTitle.slice(0, 120),
        genre: null,
        genres: [],
        goal: 0,
        words: 0,
        cover,
        author: state.parsed.author,
      });
      const { htmls } = await uploadImportedImages(userId, book.id, chapters.map((c) => c.html), state.parsed.images);
      const created = await createChaptersBulk(
        book.id,
        userId,
        chapters.map((c, i) => ({ title: c.title, content: htmls[i], words: c.words })),
      );
      const words = chapters.reduce((s, c) => s + c.words, 0);
      // Импортированный текст — точка отсчёта статистики, а не «написано сегодня».
      // Некритично: при ошибке книга уже создана, страдает только тепловая карта.
      await updateBook(book.id, { imported_words: words }).catch(() => undefined);
      const created0 = created[0];
      queryClient.setQueryData<Book[]>(QUERY_KEYS.books(userId), (prev) => [{ ...book!, words }, ...(prev ?? [])]);
      navigate(`/books/${book.id}/editor${created0 ? `?chapter=${created0.id}` : ''}`);
    } catch (e) {
      // Атомарность: книга без глав никому не нужна и съедает лимит Free.
      if (book) await deleteBook(book.id).catch(() => undefined);
      setState({ ...state, kind: 'preview' });
      setError(`Не удалось создать книгу. ${toUserMessage(e)}`);
    }
  }, [state, userId, chapters, title, cover, clearError, setError, queryClient, navigate]);

  return {
    state,
    title,
    setTitle,
    chapters,
    error,
    clearError,
    loadFile,
    setMode,
    joinWithPrevious,
    unjoin,
    mergeWithPrevious,
    splitChapterAtParagraph,
    splitChapterAtOffset,
    create,
    reset,
  };
}
