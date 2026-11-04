import { supabase, type Book } from './supabase';
import { createBook } from './books';
import { createChaptersBulk } from './chapters';
import { COVERS } from '../components/CoverPicker';
import { NOVEL, SAMPLE_PROSE } from '../data/sample';

export interface StoryTemplateChapter {
  title: string;
  synopsis: string;
  content?: string;
  words?: number;
}

export interface StoryTemplate {
  id: 'blank' | 'three-act' | 'hero-journey';
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  chapters: StoryTemplateChapter[];
}

export interface GentleGoal {
  id: '300w' | '500w' | '10kch' | 'free';
  label: string;
  sub: string;
  words: number;
}

export const STORY_TEMPLATES: StoryTemplate[] = [
  {
    id: 'blank',
    title: 'Чистый лист',
    subtitle: '1 глава для свободного старта',
    description: 'Никаких рамок и подсказок: вы сами определяете ритм, структуру и форму повествования.',
    badge: 'Свободное письмо',
    chapters: [
      {
        title: 'Глава 1',
        synopsis: '',
        content: '',
        words: 0,
      },
    ],
  },
  {
    id: 'three-act',
    title: 'Трёхактная структура',
    subtitle: '7 глав · 3 классических акта',
    description: 'Золотой стандарт мировой драматургии: завязка, нарастающий кризис и развязка.',
    badge: 'Классика',
    chapters: [
      {
        title: 'Глава 1: Обычный мир и завязка',
        synopsis: 'Экспозиция героя в привычной обстановке и инцидент, разрушающий привычный порядок.',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 2: Первый поворотный пункт',
        synopsis: 'Герой принимает вызов и делает необратимый шаг в неизведанное (финал Акта I).',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 3: Испытания и союзники',
        synopsis: 'Погружение в новые обстоятельства, появление соратников и первые преграды.',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 4: Центральный кризис (Медиана)',
        synopsis: 'Переломная точка: мнимая победа или тяжёлое поражение, повышающее ставки до предела.',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 5: Тёмная ночь души',
        synopsis: 'Крах прежних планов, потеря надежды и обретение истинного мотива (финал Акта II).',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 6: Кульминация',
        synopsis: 'Главная битва, столкновение с антагонистом и проверка выученного урока (Акт III).',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 7: Развязка и новый порядок',
        synopsis: 'Возвращение в преображённый мир, последствия победы и новое равновесие.',
        content: '',
        words: 0,
      },
    ],
  },
  {
    id: 'hero-journey',
    title: 'Путь героя',
    subtitle: '9 глав · Мономиф Кэмпбелла',
    description: 'Архетипическое путешествие преображения: от первого зова до возвращения с эликсиром.',
    badge: 'Мономиф',
    chapters: [
      {
        title: 'Глава 1: Обычный мир',
        synopsis: 'Жизнь протагониста до приключения и ощущение скрытого неблагополучия.',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 2: Зов к странствиям',
        synopsis: 'Событие или вестник, призывающий героя покинуть зону безопасности.',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 3: Встреча с наставником и порог',
        synopsis: 'Появление учителя, получение артефакта или знания; пересечение черты невозврата.',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 4: Испытания, друзья и враги',
        synopsis: 'Освоение законов нового мира, проверка на прочность и проверка верности союзников.',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 5: Приближение к пещере',
        synopsis: 'Подготовка к столкновению в самом опасном логове и преодоление внутренних сомнений.',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 6: Главное испытание (Смерть и возрождение)',
        synopsis: 'Момент смертельной опасности, символическая смерть старой личности и перерождение.',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 7: Награда (Захват меча)',
        synopsis: 'Обретение заветной цели: знания, лекарства или источника внутренней силы.',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 8: Дорога назад',
        synopsis: 'Погоня, цена победы и необходимость доставить награду в покинутый мир.',
        content: '',
        words: 0,
      },
      {
        title: 'Глава 9: Возвращение с эликсиром',
        synopsis: 'Герой исцеляет свой мир и обретает гармонию в новом статусе.',
        content: '',
        words: 0,
      },
    ],
  },
];

export const GENTLE_GOALS: GentleGoal[] = [
  { id: '300w', label: '300 слов', sub: 'быстрый старт каждый день', words: 300 },
  { id: '500w', label: '500 слов', sub: 'комфортный темп автора', words: 500 },
  { id: '10kch', label: '10 000 знаков', sub: 'первая сцена (~1 600 слов)', words: 1600 },
  { id: 'free', label: 'Без цели', sub: 'писать свободно и без давления', words: 0 },
];

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
 * Создаёт новую книгу из шаблона сюжета с заданной щадящей целью.
 */
export async function createBookFromTemplate(
  userId: string,
  input: {
    title?: string;
    templateId: StoryTemplate['id'];
    goalWords: number;
    cover?: string;
  },
): Promise<Book> {
  const template = STORY_TEMPLATES.find((t) => t.id === input.templateId) ?? STORY_TEMPLATES[0];
  const title = (input.title?.trim() || template.title);
  const cover = input.cover || COVERS[0];

  const book = await createBook({
    user_id: userId,
    title,
    genre: null,
    genres: [],
    goal: Math.max(0, input.goalWords),
    words: 0,
    cover,
  });

  const chaptersToCreate = template.chapters.map((ch, i) => ({
    title: ch.title,
    content: ch.content ?? '',
    words: ch.words ?? 0,
    synopsis: ch.synopsis ?? '',
    position: i,
  }));

  await createChaptersBulk(book.id, userId, chaptersToCreate);

  return book;
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
