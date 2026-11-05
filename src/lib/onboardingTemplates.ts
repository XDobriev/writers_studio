import { supabase, type Book } from './supabase';
import { createBook, createBookWithSeriesTransfer } from './books';
import { createChaptersBulk } from './chapters';
import type { SeriesTransferState } from '../components/SeriesTransferPicker';
import { COVERS } from '../components/CoverPicker';
import { NOVEL, SAMPLE_PROSE } from '../data/sample';

export type LiteraryFormId = 'novel' | 'novella' | 'short_story' | 'free';

export interface LiteraryForm {
  id: LiteraryFormId;
  title: string;
  subtitle: string;
  description: string;
  targetWords: number | null;
}

export const LITERARY_FORMS: readonly LiteraryForm[] = [
  {
    id: 'novel',
    title: 'Роман',
    subtitle: 'Стандарт большой прозы',
    description: 'Стартует с первой главы. Главы нумеруются по ходу повествования.',
    targetWords: 70000,
  },
  {
    id: 'novella',
    title: 'Повесть',
    subtitle: 'Компактная история',
    description: 'Компактная история с единым сюжетным фокусом без лишних делений.',
    targetWords: 30000,
  },
  {
    id: 'short_story',
    title: 'Рассказ',
    subtitle: 'Малая форма',
    description: 'Единая сцена или короткий сюжет на один вечер чтения.',
    targetWords: 5000,
  },
  {
    id: 'free',
    title: 'Свободный объём',
    subtitle: 'Чистый лист',
    description: 'Никаких рамок, подсказок и предписаний — пишите полностью свободно.',
    targetWords: null,
  },
];

export interface CreateBookFromFormOptions {
  title: string;
  formId: string;
  targetWords?: number | null;
  genres?: string[];
  cover?: string;
  seriesTransfer?: SeriesTransferState;
}

export async function createBookFromLiteraryForm(
  userId: string,
  options: CreateBookFromFormOptions,
): Promise<Book> {
  const title = options.title.trim();
  const targetWords = options.targetWords ?? null;
  const genres = options.genres;
  const cover = options.cover;

  let book: Book;

  if (options.seriesTransfer?.enabled) {
    book = await createBookWithSeriesTransfer(
      {
        title,
        user_id: userId,
        genres,
        target_words: targetWords,
        cover,
      },
      options.seriesTransfer,
    );
  } else {
    book = await createBook({
      title,
      user_id: userId,
      genres,
      target_words: targetWords,
      cover,
    });
  }

  await createChaptersBulk([
    {
      book_id: book.id,
      title: 'Глава 1',
      order_index: 0,
      content_json: '',
      word_count: 0,
    },
  ]);

  return book;
}

export const SAMPLE_BOOK_TITLE = 'Город, которого нет';
export const SAMPLE_BOOK_AUTHOR = 'Анна Корвин';
export const SAMPLE_BOOK_TAG = 'Демо-книга';

/**
 * Проверяет, является ли книга демо-проектом ("Город, которого нет"),
 * не расходующим бесплатный лимит книг.
 */
export function isSampleBook(book: Book | null | undefined): boolean {
  if (!book) return false;
  if (book.genres?.includes(SAMPLE_BOOK_TAG)) return true;
  if (book.title === SAMPLE_BOOK_TITLE && book.author === SAMPLE_BOOK_AUTHOR) return true;
  try {
    return localStorage.getItem(`sample_book_${book.id}`) === 'true';
  } catch {
    return false;
  }
}

/**
 * Клонирует роман «Город, которого нет» в аккаунт автора без расхода
 * бесплатного лимита (is_sample).
 */
export async function cloneSampleBook(userId: string): Promise<Book> {
  // 1. Создание книги со специальным тегом
  const book = await createBook({
    user_id: userId,
    title: SAMPLE_BOOK_TITLE,
    author: SAMPLE_BOOK_AUTHOR,
    genre: NOVEL.genre,
    genres: [NOVEL.genre, SAMPLE_BOOK_TAG],
    goal: 90000,
    words: NOVEL.chapters.reduce((sum, c) => sum + c.words, 0),
    cover: COVERS[1] ?? COVERS[0],
  });

  // 2. Добавление 10 глав романа (1-я глава с полным текстом SAMPLE_PROSE)
  const chaptersToCreate = NOVEL.chapters.map((c, i) => ({
    title: c.title,
    content: i === 0 ? SAMPLE_PROSE : '',
    words: c.words,
    position: i,
    synopsis: i === 0 ? 'Картограф Иней Ворон узнаёт об исчезновении северного города Корны.' : '',
  }));
  await createChaptersBulk(book.id, userId, chaptersToCreate);

  // 3. Персонажи (3 ключевых персонажа — соблюдаем Free limit <= 3)
  const charactersToCreate = [
    {
      book_id: book.id,
      user_id: userId,
      name: 'Иней Ворон',
      role: 'protagonist' as const,
      age: 31,
      quote: '«Город, которого нет», — мысленно повторила она, и эти слова легли в её память как мокрое железо в снег.',
      backstory: 'Картограф ордена Тереи. Получила приказ восстановить карту исчезнувшего города Корны.',
      appearance: 'Худая, в тёмном шерстяном плаще картографа с серебряной пряжкой.',
      personality: 'Сдержанная, наблюдательная, склонна к методичной работе с деталями.',
      position: 0,
    },
    {
      book_id: book.id,
      user_id: userId,
      name: 'Стен Кальм',
      role: 'secondary' as const,
      age: 64,
      quote: 'Карты лгут чаще, чем люди, потому что людям верят меньше.',
      backstory: 'Хранитель архива Тереи. Знает всё о старых экспедициях.',
      appearance: 'Седой, сухощавый, пальцы испачканы железо-галловыми чернилами.',
      personality: 'Ворчливый, осторожный, преданный архиву.',
      position: 1,
    },
    {
      book_id: book.id,
      user_id: userId,
      name: 'Лето Маркис',
      role: 'secondary' as const,
      age: 38,
      quote: 'Тракт не любит тех, кто смотрит назад.',
      backstory: 'Наёмник, встреченный в трактире «Серая Цапля». Бывал в Корне до катастрофы.',
      appearance: 'Шрам через левую бровь, потрёпанная кольчуга, спокойный тяжёлый взгляд.',
      personality: 'Прагматичный, молчаливый, надёжный в бою.',
      position: 2,
    },
  ];
  await supabase.from('characters').insert(charactersToCreate);

  // 4. Локации
  const locationsToCreate = NOVEL.locations.map((loc, i) => ({
    book_id: book.id,
    user_id: userId,
    name: loc.name,
    type: loc.type,
    description: loc.note,
    position: i,
    x: 140 + (i % 3) * 200,
    y: 120 + Math.floor(i / 3) * 160,
  }));
  await supabase.from('locations').insert(locationsToCreate);

  // 5. События хронологии (7 событий — соблюдаем Free limit <= 10)
  const timelineToCreate = NOVEL.timeline.map((t, i) => ({
    book_id: book.id,
    user_id: userId,
    era: t.era,
    title: t.title,
    type: t.type,
    description: '',
    position: i,
  }));
  await supabase.from('timeline_events').insert(timelineToCreate);

  // 6. Запоминаем ID демо-книги в localStorage для мгновенной проверки
  try {
    localStorage.setItem(`sample_book_${book.id}`, 'true');
  } catch {
    // игнорируем ошибку при ограничениях браузера
  }

  return book;
}

