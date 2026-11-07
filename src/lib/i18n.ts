export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function pluralDays(n: number): string {
  return plural(n, 'день', 'дня', 'дней');
}

// Форматирует число с пробелами-разделителями тысяч (ru): 12345 → "12 345".
export function fmtNumber(n: number): string {
  return n.toLocaleString('ru-RU').replace(/,/g, ' ');
}

/**
 * Издательские метрики объема книги:
 * - 1 авторский лист (а. л.) = 40 000 знаков с пробелами (~6 000 слов).
 * - 1 авторская страница (авт. стр.) = 1 800 знаков с пробелами (~270 слов).
 *
 * Возвращает:
 * - sheets: краткое число с единицей для главного значения карточки (напр., "0,1 а. л.", "10,9 а. л.")
 * - pages: полное название с правильным склонением для подзаголовка (напр., "2 авторские страницы", "242 авторские страницы")
 * - summary: объединенная строка (напр., "0,1 а. л. · 2 авторские страницы")
 */
export function formatAuthorMetrics(
  words: number
): { sheets: string; pages: string; summary: string } {
  if (words <= 0) {
    return {
      sheets: '0\u00A0а.\u00A0л.',
      pages: '0\u00A0авторских страниц',
      summary: '0\u00A0а.\u00A0л. · 0\u00A0авторских страниц',
    };
  }

  const sheetVal = (words / 6000).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const sheets = words < 600
    ? '<\u00A00,1\u00A0а.\u00A0л.'
    : `${sheetVal}\u00A0а.\u00A0л.`;

  const pagesNum = Math.round(words / 270);
  const pages = pagesNum === 0
    ? '<\u00A01\u00A0авторской страницы'
    : `${fmtNumber(pagesNum)}\u00A0${plural(pagesNum, 'авторская страница', 'авторские страницы', 'авторских страниц')}`;

  return {
    sheets,
    pages,
    summary: `${sheets} · ${pages}`,
  };
}
