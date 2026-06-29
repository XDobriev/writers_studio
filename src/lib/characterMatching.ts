/**
 * Единая логика сопоставления токена с именем/псевдонимом персонажа.
 * Используется в useCharacterHover (one word vs alias) и в crossrefs (full text search).
 *
 * Стратегия:
 * - Нормализация: lowercase + ё→е
 * - Для коротких псевдонимов (< 5 символов): точное совпадение
 * - Для длинных (≥ 5 символов): совпадение по стему (первые len-2 символа) + до 4 доп. символов
 *   Это покрывает основные падежные окончания русских имён.
 */

function normalizeAlias(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е');
}

/**
 * Проверяет, соответствует ли один токен (слово) псевдониму персонажа.
 * Используется в hover-карточке для слова под курсором.
 */
export function matchesAlias(token: string, alias: string): boolean {
  const trimmed = alias.trim();
  if (trimmed.length < 2) return false;
  const normAlias = normalizeAlias(trimmed);
  const normToken = normalizeAlias(token);
  if (normToken === normAlias) return true;
  if (normAlias.length >= 5) {
    const stem = normAlias.slice(0, normAlias.length - 2);
    return normToken.startsWith(stem) && normToken.length - stem.length <= 4;
  }
  return false;
}

/**
 * Строит RegExp для поиска псевдонима в произвольном тексте.
 * Учитывает Unicode-границы слов (кириллица не поддерживается \b).
 * Для длинных псевдонимов матчит по стему + падежные окончания (как matchesAlias).
 * Используется в crossrefs для сканирования текста глав.
 * Возвращает null для слишком коротких/пустых псевдонимов.
 */
export function makeAliasPattern(alias: string): RegExp | null {
  const trimmed = alias.trim();
  if (trimmed.length < 2) return null;
  const normalized = normalizeAlias(trimmed);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = '(?<![\\p{L}\\p{N}_])';
  const end = '(?![\\p{L}\\p{N}_])';
  try {
    if (normalized.length >= 5) {
      // stem = первые (length-2) символа; совпадаем с до 4 дополнительных символов
      const stem = escaped.slice(0, escaped.length - 2);
      return new RegExp(`${boundary}${stem}[\\p{L}]{0,4}${end}`, 'vi');
    }
    return new RegExp(`${boundary}${escaped}${end}`, 'vi');
  } catch {
    return null;
  }
}
