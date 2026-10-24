import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useErrorState } from './useErrorState';
import { createBook, deleteBook, updateBook } from './books';
import { toUserMessage } from './errors';
import { createChaptersBulk } from './chapters';
import { QUERY_KEYS } from './queries';
import type { Book } from './supabase';
import {
  detectImportFormat,
  parseManuscript,
  PRO_IMPORT_FORMATS,
  type ParsedManuscript,
} from './importManuscript';
import { analyzeSplits, joinChapters, splitManuscript, type SplitMode, type SplitOption } from './importSplit';

/** joins — индексы глав, приклеенных к предыдущей (см. joinChapters). */
type ImportState =
  | { kind: 'idle' }
  | { kind: 'parsing'; fileName: string }
  | { kind: 'preview'; parsed: ParsedManuscript; options: SplitOption[]; mode: SplitMode; joins: number[] }
  | { kind: 'creating'; parsed: ParsedManuscript; options: SplitOption[]; mode: SplitMode; joins: number[] };

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
    setState((s) => (s.kind === 'preview' ? { ...s, mode, joins: [] } : s));
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
  // Разбивка не пересчитывается на каждую склейку: на больших рукописях это сотни мс.
  const split = useMemo(
    () => (parsed && mode ? splitManuscript(parsed.units, mode, parsed.title) : []),
    [parsed, mode],
  );
  const chapters = useMemo(() => joinChapters(split, new Set(joins)), [split, joins]);

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
      const created = await createChaptersBulk(
        book.id,
        userId,
        chapters.map((c) => ({ title: c.title, content: c.html, words: c.words })),
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

  return { state, title, setTitle, chapters, error, clearError, loadFile, setMode, joinWithPrevious, unjoin, create, reset };
}
