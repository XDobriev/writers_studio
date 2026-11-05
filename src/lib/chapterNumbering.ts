/**
 * Авторская студия — именованные главы вне сквозной нумерации (F-12).
 *
 * Поддерживает:
 * - Обычные нумерованные главы («Глава 1», «Глава 2. Тени прошлого»)
 * - Служебные главы вне сквозной нумерации:
 *   • Пролог («Пролог», «Пролог. Начало»)
 *   • Эпилог («Эпилог», «Эпилог. Спустя годы»)
 *   • Интерлюдия («Интерлюдия», «Интерлюдия. В замке»)
 *   • Служебные без номера («Предисловие», «Послесловие», «От автора», произвольные без номера)
 *
 * Служебные главы не инкрементируют счётчик regularNumber.
 * Первая глава после Пролога всегда остаётся полноценной «Главой 1».
 */

export type ChapterType = 'regular' | 'prologue' | 'epilogue' | 'interlude' | 'special';

export interface ParsedChapterTitle {
  type: ChapterType;
  /** Номер главы, если она обычная нумерованная («Глава N»), иначе null */
  number: number | null;
  /** Подзаголовок после разделителя (например, «Пробуждение» в «Глава 1. Пробуждение») */
  subtitle: string;
  /** Разделитель между номером/типом и подзаголовком (например, «. », «: », « — ») */
  separator: string;
  /** Исходное название */
  rawTitle: string;
}

export interface ChapterRankInfo {
  id: string;
  type: ChapterType;
  /** 1-based порядковый номер среди обычных глав (1, 2, 3...) или null для служебных */
  regularNumber: number | null;
  /** Строка для сайдбара и оглавления: "01", "02" или "—" для служебных */
  displayNumber: string;
  /** Лейбл для карточек (например, на Доске): "ГЛ. 01" или "ПРОЛОГ", "ЭПИЛОГ", "ИНТЕРЛЮДИЯ", "СЛУЖЕБНАЯ" */
  badgeLabel: string;
  /** Номер для интерактивного оглавления книги: "1.", "2." или "—" */
  tocNumber: string;
}

const PROLOGUE_RE = /^пролог(?:\s*([.:—–-])\s*(.*))?$/iu;
const PROLOGUE_ENG_RE = /^prologue(?:\s*([.:—–-])\s*(.*))?$/iu;

const EPILOGUE_RE = /^эпилог(?:\s*([.:—–-])\s*(.*))?$/iu;
const EPILOGUE_ENG_RE = /^epilogue(?:\s*([.:—–-])\s*(.*))?$/iu;

const INTERLUDE_RE = /^интерлюдия(?:\s*([.:—–-])\s*(.*))?$/iu;
const INTERLUDE_ENG_RE = /^interlude(?:\s*([.:—–-])\s*(.*))?$/iu;

const SPECIAL_KEYWORDS_RE =
  /^(?:предисловие|послесловие|введение|от автора|служебная(?: глава)?|preface|foreword|afterword|introduction)(?:\s*([.:—–-])\s*(.*))?$/iu;

const REGULAR_RE = /^(?:глава|часть|том|chapter|part)\s+(\d+)(?:\s*([.:—–-])\s*(.*))?$/iu;

/**
 * Парсит заголовок главы, определяя её тип, номер (если обычная) и подзаголовок.
 */
export function parseChapterTitle(title: string): ParsedChapterTitle {
  const t = (title ?? '').trim();

  // 1. Пролог
  const mPro = t.match(PROLOGUE_RE) || t.match(PROLOGUE_ENG_RE);
  if (mPro) {
    return {
      type: 'prologue',
      number: null,
      subtitle: (mPro[2] ?? '').trim(),
      separator: mPro[1] ?? '',
      rawTitle: t,
    };
  }

  // 2. Эпилог
  const mEpi = t.match(EPILOGUE_RE) || t.match(EPILOGUE_ENG_RE);
  if (mEpi) {
    return {
      type: 'epilogue',
      number: null,
      subtitle: (mEpi[2] ?? '').trim(),
      separator: mEpi[1] ?? '',
      rawTitle: t,
    };
  }

  // 3. Интерлюдия
  const mInt = t.match(INTERLUDE_RE) || t.match(INTERLUDE_ENG_RE);
  if (mInt) {
    return {
      type: 'interlude',
      number: null,
      subtitle: (mInt[2] ?? '').trim(),
      separator: mInt[1] ?? '',
      rawTitle: t,
    };
  }

  // 4. Обычная глава («Глава N», «Chapter N», «Глава N. Название»)
  const mReg = t.match(REGULAR_RE);
  if (mReg) {
    return {
      type: 'regular',
      number: parseInt(mReg[1], 10),
      subtitle: (mReg[3] ?? '').trim(),
      separator: mReg[2] ?? '',
      rawTitle: t,
    };
  }

  // 5. Известные ключевые слова служебных глав
  const mSpec = t.match(SPECIAL_KEYWORDS_RE);
  if (mSpec) {
    return {
      type: 'special',
      number: null,
      subtitle: (mSpec[2] ?? '').trim(),
      separator: mSpec[1] ?? '',
      rawTitle: t,
    };
  }

  // 6. Любое другое название без «Глава N» считается служебной главой без номера
  return {
    type: 'special',
    number: null,
    subtitle: '',
    separator: '',
    rawTitle: t,
  };
}

/**
 * Извлекает содержательный подзаголовок из названия главы.
 * Например:
 * - «Глава 1. Пробуждение» → «Пробуждение»
 * - «Пролог. Начало пути» → «Начало пути»
 * - «Пролог» → «»
 * - «Заметки на полях» → «Заметки на полях»
 */
export function extractSubtitle(title: string): string {
  const parsed = parseChapterTitle(title);
  if (parsed.subtitle) return parsed.subtitle;

  // Если это служебное название без префикса (например, «Заметки на полях»)
  if (parsed.type === 'special' && parsed.rawTitle) {
    // Если это не стандартная заглушка «Служебная глава» / «Без названия»
    if (
      !/^(?:служебная(?: глава)?|без названия|untitled)$/iu.test(parsed.rawTitle) &&
      !SPECIAL_KEYWORDS_RE.test(parsed.rawTitle)
    ) {
      return parsed.rawTitle;
    }
  }

  return '';
}

/**
 * Форматирует название главы по заданному типу, номеру (для regular) и подзаголовку.
 */
export function formatChapterTitle(type: ChapterType, rank: number, subtitle?: string): string {
  const sub = (subtitle ?? '').trim();
  switch (type) {
    case 'prologue':
      return sub ? `Пролог. ${sub}` : 'Пролог';
    case 'epilogue':
      return sub ? `Эпилог. ${sub}` : 'Эпилог';
    case 'interlude':
      return sub ? `Интерлюдия. ${sub}` : 'Интерлюдия';
    case 'special':
      return sub || 'Служебная глава';
    case 'regular':
    default:
      return sub ? `Глава ${rank}. ${sub}` : `Глава ${rank}`;
  }
}

/**
 * Рассчитывает сквозную нумерацию и метаданные отображения для всех глав книги.
 * Служебные главы (Пролог, Эпилог, Интерлюдия, Специальная) не получают regularNumber
 * и не увеличивают счётчик сквозной нумерации.
 */
export function computeChapterRanks(
  chapters: ReadonlyArray<{ id: string; title: string }>,
): Map<string, ChapterRankInfo> {
  const map = new Map<string, ChapterRankInfo>();
  let regularRank = 0;

  for (const c of chapters) {
    const parsed = parseChapterTitle(c.title);
    if (parsed.type === 'regular') {
      regularRank += 1;
      map.set(c.id, {
        id: c.id,
        type: 'regular',
        regularNumber: regularRank,
        displayNumber: String(regularRank).padStart(2, '0'),
        badgeLabel: `ГЛ. ${String(regularRank).padStart(2, '0')}`,
        tocNumber: `${regularRank}.`,
      });
    } else {
      let badgeLabel = 'СЛУЖЕБНАЯ';
      if (parsed.type === 'prologue') badgeLabel = 'ПРОЛОГ';
      else if (parsed.type === 'epilogue') badgeLabel = 'ЭПИЛОГ';
      else if (parsed.type === 'interlude') badgeLabel = 'ИНТЕРЛЮДИЯ';

      map.set(c.id, {
        id: c.id,
        type: parsed.type,
        regularNumber: null,
        displayNumber: '—',
        badgeLabel,
        tocNumber: '—',
      });
    }
  }

  return map;
}

/**
 * Определяет заголовок для новой главы.
 * Учитывает только существующие нумерованные обычные главы.
 * Например:
 * - при наличии только Пролога возвращает «Глава 1»
 * - при наличии Пролога и Главы 1 возвращает «Глава 2»
 */
export function getNextChapterTitle(chapters: ReadonlyArray<{ title: string }>): string {
  let maxNum = 0;
  for (const c of chapters) {
    const parsed = parseChapterTitle(c.title);
    if (parsed.type === 'regular' && parsed.number !== null) {
      if (parsed.number > maxNum) maxNum = parsed.number;
    }
  }
  return `Глава ${maxNum + 1}`;
}

export interface ChapterRowEntity {
  id: string;
  title: string;
  book_id: string;
  user_id: string;
  [key: string]: unknown;
}

/**
 * Пересчитывает заголовки всех глав книги при смене типа одной из глав.
 * Возвращает список только тех глав, заголовок которых действительно изменился.
 */
export function recalculateBookChapterTitles<T extends ChapterRowEntity>(
  chapters: ReadonlyArray<T>,
  targetChapterId: string,
  newType: ChapterType,
): {
  updates: Array<{ id: string; title: string; book_id: string; user_id: string }>;
  nextChapters: T[];
} {
  const updates: Array<{ id: string; title: string; book_id: string; user_id: string }> = [];
  const nextChapters: T[] = [];
  let regularRank = 0;

  for (const c of chapters) {
    const isTarget = c.id === targetChapterId;
    const currentType = isTarget ? newType : parseChapterTitle(c.title).type;
    let nextTitle = c.title;

    if (currentType === 'regular') {
      regularRank += 1;
      const subtitle = extractSubtitle(c.title);
      nextTitle = formatChapterTitle('regular', regularRank, subtitle);
    } else if (isTarget) {
      const subtitle = extractSubtitle(c.title);
      nextTitle = formatChapterTitle(newType, 0, subtitle);
    }

    if (nextTitle !== c.title) {
      updates.push({
        id: c.id,
        title: nextTitle,
        book_id: c.book_id,
        user_id: c.user_id,
      });
    }

    nextChapters.push({
      ...c,
      title: nextTitle,
    });
  }

  return { updates, nextChapters };
}

/**
 * Находит регулярные главы, номера которых рассинхронизированы со сквозной нумерацией
 * (например, после удаления главы или вставки Пролога без автообновления).
 */
export function getChaptersNeedingRenumber<T extends ChapterRowEntity>(
  chapters: ReadonlyArray<T>,
): Array<{ id: string; title: string; book_id: string; user_id: string }> {
  const updates: Array<{ id: string; title: string; book_id: string; user_id: string }> = [];
  let regularRank = 0;

  for (const c of chapters) {
    const parsed = parseChapterTitle(c.title);
    if (parsed.type === 'regular') {
      regularRank += 1;
      const expectedTitle = formatChapterTitle('regular', regularRank, parsed.subtitle);
      if (expectedTitle !== c.title) {
        updates.push({
          id: c.id,
          title: expectedTitle,
          book_id: c.book_id,
          user_id: c.user_id,
        });
      }
    }
  }

  return updates;
}
