import { plural, pluralDays, fmtNumber } from './i18n';

export type ProgressCardTheme = 'dark' | 'paper';
export type ProgressCardFormat = 'story' | 'square';

export interface ProgressCardData {
  bookTitle?: string;
  todayWords: number;
  streak?: number;
  totalWords?: number;
  goalWords?: number;
  date?: Date;
}

export interface ProgressCardOptions {
  theme?: ProgressCardTheme;
  format?: ProgressCardFormat;
}

const DIMENSIONS: Record<ProgressCardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

function formatDateRu(date: Date): string {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Разбивает текст на строки с учётом максимальной ширины в Canvas.
 */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${currentLine} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      if (lines.length === maxLines - 1) {
        // Последняя доступная строка: добавляем оставшиеся слова и обрезаем многоточием при превышении
        const remaining = words.slice(i).join(' ');
        let last = remaining;
        while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
          last = last.slice(0, -1).trimEnd();
        }
        lines.push(`${last}…`);
        return lines;
      }
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Безопасный полифилл скругленного прямоугольника для Canvas2D
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/**
 * Отрисовывает аккуратный книжный символ-логотип на Canvas
 */
function drawBookEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  if (typeof ctx.save === 'function') ctx.save();
  if (typeof ctx.translate === 'function') ctx.translate(cx, cy);
  const s = size / 24;
  if (typeof ctx.scale === 'function') ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Разворот книги
  if (typeof ctx.beginPath === 'function') ctx.beginPath();
  // Левая страница
  if (typeof ctx.moveTo === 'function') ctx.moveTo(0, 7);
  if (typeof ctx.bezierCurveTo === 'function') {
    ctx.bezierCurveTo(-3, 5, -7, 5, -11, 6);
    if (typeof ctx.lineTo === 'function') ctx.lineTo(-11, -6);
    ctx.bezierCurveTo(-7, -7, -3, -7, 0, -4);
    // Правая страница
    ctx.bezierCurveTo(3, -7, 7, -7, 11, -6);
    if (typeof ctx.lineTo === 'function') ctx.lineTo(11, 6);
    ctx.bezierCurveTo(7, 5, 3, 5, 0, 7);
  }
  if (typeof ctx.stroke === 'function') ctx.stroke();

  // Корешок
  if (typeof ctx.beginPath === 'function') ctx.beginPath();
  if (typeof ctx.moveTo === 'function') ctx.moveTo(0, -4);
  if (typeof ctx.lineTo === 'function') ctx.lineTo(0, 7);
  if (typeof ctx.stroke === 'function') ctx.stroke();

  if (typeof ctx.restore === 'function') ctx.restore();
}

/**
 * Отрисовывает аккуратные угловые книжные засечки для рамки
 */
function drawOrnamentalCorners(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  len: number,
  color: string,
) {
  if (typeof ctx.save === 'function') ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'square';

  // 4 уголка
  if (typeof ctx.beginPath === 'function') {
    ctx.beginPath();
    ctx.moveTo(x + len, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + len);
    if (typeof ctx.stroke === 'function') ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - len, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + len);
    if (typeof ctx.stroke === 'function') ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y + h - len);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + len, y + h);
    if (typeof ctx.stroke === 'function') ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + w - len, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - len);
    if (typeof ctx.stroke === 'function') ctx.stroke();
  }

  if (typeof ctx.restore === 'function') ctx.restore();
}

/**
 * Отрисовывает брендовую шеринг-карточку прогресса на Canvas
 */
export function renderProgressCard(
  canvas: HTMLCanvasElement,
  data: ProgressCardData,
  options: ProgressCardOptions = {},
): void {
  const theme = options.theme ?? 'dark';
  const format = options.format ?? 'story';
  const { width, height } = DIMENSIONS[format];

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isDark = theme === 'dark';
  const isStory = format === 'story';

  // Цветовая схема
  const colors = isDark
    ? {
        bgStart: '#191715',
        bgEnd: '#0d0c0b',
        glow: 'rgba(217, 155, 67, 0.07)',
        frameBorder: 'rgba(255, 255, 255, 0.08)',
        cardBg: 'rgba(255, 255, 255, 0.035)',
        cardBorder: 'rgba(255, 255, 255, 0.07)',
        accent: '#e5a953',
        accentSoft: 'rgba(229, 169, 83, 0.16)',
        ink: '#f4efe6',
        inkSecondary: '#a39888',
        inkMuted: '#6d6455',
        badgeBg: 'rgba(229, 169, 83, 0.1)',
        badgeBorder: 'rgba(229, 169, 83, 0.3)',
      }
    : {
        bgStart: '#faf6ee',
        bgEnd: '#f1e8d9',
        glow: 'rgba(179, 107, 39, 0.06)',
        frameBorder: 'rgba(60, 40, 20, 0.09)',
        cardBg: 'rgba(255, 255, 255, 0.75)',
        cardBorder: 'rgba(60, 40, 20, 0.08)',
        accent: '#b26524',
        accentSoft: 'rgba(178, 101, 36, 0.14)',
        ink: '#26201a',
        inkSecondary: '#635547',
        inkMuted: '#948473',
        badgeBg: 'rgba(178, 101, 36, 0.08)',
        badgeBorder: 'rgba(178, 101, 36, 0.25)',
      };

  // 1. Фон
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, colors.bgStart);
  bgGrad.addColorStop(1, colors.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Световой акцент сверху
  const glowGrad = ctx.createRadialGradient(
    width / 2,
    isStory ? 400 : 300,
    50,
    width / 2,
    isStory ? 400 : 300,
    width * 0.75,
  );
  glowGrad.addColorStop(0, colors.glow);
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Внешняя тонкая рамка и декоративные книжные уголки
  const margin = isStory ? 54 : 44;
  drawRoundedRect(ctx, margin, margin, width - margin * 2, height - margin * 2, 28);
  ctx.strokeStyle = colors.frameBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const innerMargin = margin + 14;
  drawOrnamentalCorners(
    ctx,
    innerMargin,
    innerMargin,
    width - innerMargin * 2,
    height - innerMargin * 2,
    isStory ? 22 : 18,
    colors.accentSoft,
  );

  // 3. Шапка: Брендинг, книжная эмблема и дата
  const emblemY = isStory ? 108 : 74;
  drawBookEmblem(ctx, width / 2, emblemY, isStory ? 34 : 28, colors.accent);

  const topY = isStory ? 152 : 110;
  ctx.textAlign = 'center';

  // Название студии (разрядка)
  ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
  ctx.fillStyle = colors.accent;
  ctx.letterSpacing = '0.22em';
  ctx.fillText('А В Т О Р С К А Я   С Т У Д И Я', width / 2, topY);
  ctx.letterSpacing = '0px';

  // Дата
  const dateStr = formatDateRu(data.date ?? new Date());
  ctx.font = '400 20px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
  ctx.fillStyle = colors.inkMuted;
  ctx.fillText(dateStr, width / 2, topY + 40);

  // 4. Название книги
  const bookTitle = (data.bookTitle ?? 'Моя книга').trim();
  const bookY = isStory ? 300 : 200;

  ctx.font = '500 18px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
  ctx.fillStyle = colors.inkSecondary;
  ctx.letterSpacing = '0.12em';
  ctx.fillText('РУКОПИСЬ', width / 2, bookY);
  ctx.letterSpacing = '0px';

  ctx.font = '600 44px "Source Serif 4 Variable", "Source Serif 4", Georgia, serif';
  ctx.fillStyle = colors.ink;
  const bookLines = wrapLines(ctx, `«${bookTitle}»`, width - margin * 4, 2);
  let curBookY = bookY + 54;
  for (const line of bookLines) {
    ctx.fillText(line, width / 2, curBookY);
    curBookY += 56;
  }

  // 5. Главный блок — прогресс за сегодня
  const mainCardY = isStory ? 510 : 360;
  const mainCardH = isStory ? 480 : 330;
  const cardMargin = margin + 30;
  const cardW = width - cardMargin * 2;

  // Фон главной карточки
  drawRoundedRect(ctx, cardMargin, mainCardY, cardW, mainCardH, 24);
  ctx.fillStyle = colors.cardBg;
  ctx.fill();
  ctx.strokeStyle = colors.cardBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Подпись блока
  ctx.font = '600 19px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
  ctx.fillStyle = colors.accent;
  ctx.letterSpacing = '0.14em';
  ctx.fillText('ПРОГРЕСС ЗА ДЕНЬ', width / 2, mainCardY + (isStory ? 75 : 55));
  ctx.letterSpacing = '0px';

  // Главное число: +X слов
  const wordsNum = data.todayWords;
  const wordsPrefix = wordsNum > 0 ? `+${fmtNumber(wordsNum)}` : `${fmtNumber(wordsNum)}`;
  ctx.font = '700 108px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
  ctx.fillStyle = colors.ink;
  ctx.fillText(wordsPrefix, width / 2, mainCardY + (isStory ? 200 : 155));

  // Подпись к числу
  const wordsLabel = plural(Math.abs(wordsNum), 'слово написано', 'слова написано', 'слов написано');
  ctx.font = '500 26px "Source Serif 4 Variable", "Source Serif 4", Georgia, serif';
  ctx.fillStyle = colors.inkSecondary;
  ctx.fillText(wordsLabel, width / 2, mainCardY + (isStory ? 255 : 200));

  // Прогресс-бар цели дня (если есть)
  if (data.goalWords && data.goalWords > 0) {
    const goal = data.goalWords;
    const progress = Math.min(1, Math.max(0, wordsNum / goal));
    const percent = Math.round((wordsNum / goal) * 100);

    const barW = cardW - 120;
    const barH = 12;
    const barX = (width - barW) / 2;
    const barY = mainCardY + (isStory ? 350 : 255);

    // Подложка бара
    drawRoundedRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fillStyle = colors.accentSoft;
    ctx.fill();

    // Заполнение бара
    if (progress > 0) {
      drawRoundedRect(ctx, barX, barY, Math.max(barH, barW * progress), barH, barH / 2);
      ctx.fillStyle = colors.accent;
      ctx.fill();
    }

    // Текст цели
    ctx.font = '400 20px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
    ctx.fillStyle = colors.inkMuted;
    ctx.fillText(
      `Цель: ${fmtNumber(wordsNum)} / ${fmtNumber(goal)} ${plural(goal, 'слово', 'слова', 'слов')} (${percent}%)`,
      width / 2,
      barY + 42,
    );
  }

  // 6. Карточки дополнительных метрик (Серия и Всего в рукописи)
  const statsY = isStory ? 1040 : 725;
  const statCardH = isStory ? 220 : 150;
  const statGap = 24;
  const statW = (cardW - statGap) / 2;

  // Карточка 1: Серия дней
  const stat1X = cardMargin;
  drawRoundedRect(ctx, stat1X, statsY, statW, statCardH, 20);
  ctx.fillStyle = colors.cardBg;
  ctx.fill();
  ctx.strokeStyle = colors.cardBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  const streakDays = data.streak ?? 0;
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
  ctx.fillStyle = colors.inkMuted;
  ctx.letterSpacing = '0.08em';
  ctx.fillText('СЕРИЯ ДНЕЙ', stat1X + statW / 2, statsY + (isStory ? 55 : 40));
  ctx.letterSpacing = '0px';

  ctx.font = '700 48px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
  ctx.fillStyle = colors.accent;
  ctx.fillText(
    streakDays > 0 ? `${streakDays}` : '—',
    stat1X + statW / 2,
    statsY + (isStory ? 125 : 90),
  );

  ctx.font = '400 19px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
  ctx.fillStyle = colors.inkSecondary;
  ctx.fillText(
    streakDays > 0 ? pluralDays(streakDays) : 'без упрёков',
    stat1X + statW / 2,
    statsY + (isStory ? 168 : 122),
  );

  // Карточка 2: Всего в рукописи
  const stat2X = cardMargin + statW + statGap;
  drawRoundedRect(ctx, stat2X, statsY, statW, statCardH, 20);
  ctx.fillStyle = colors.cardBg;
  ctx.fill();
  ctx.strokeStyle = colors.cardBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
  ctx.fillStyle = colors.inkMuted;
  ctx.letterSpacing = '0.08em';
  ctx.fillText('ВСЕГО В РУКОПИСИ', stat2X + statW / 2, statsY + (isStory ? 55 : 40));
  ctx.letterSpacing = '0px';

  const totalWords = data.totalWords ?? 0;
  ctx.font = '700 48px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
  ctx.fillStyle = colors.ink;
  ctx.fillText(
    fmtNumber(totalWords),
    stat2X + statW / 2,
    statsY + (isStory ? 125 : 90),
  );

  ctx.font = '400 19px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
  ctx.fillStyle = colors.inkSecondary;
  ctx.fillText(
    plural(totalWords, 'слово', 'слова', 'слов'),
    stat2X + statW / 2,
    statsY + (isStory ? 168 : 122),
  );

  // 7. Нижний блок — ВИРАЛЬНАЯ ПЛАШКА «Написано без ИИ»
  const footerCardH = isStory ? 280 : 110;
  const footerY = isStory ? 1490 : 900;

  drawRoundedRect(ctx, cardMargin, footerY, cardW, footerCardH, 20);
  ctx.fillStyle = colors.badgeBg;
  ctx.fill();
  ctx.strokeStyle = colors.badgeBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (isStory) {
    // В сторис вертикальный отступ больше:
    // Бейдж «100% живой текст»
    ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
    ctx.fillStyle = colors.accent;
    ctx.letterSpacing = '0.12em';
    ctx.fillText('ЧИСТОЕ ТВОРЧЕСТВО', width / 2, footerY + 65);
    ctx.letterSpacing = '0px';

    // Главный виральный тезис
    ctx.font = '700 36px "Source Serif 4 Variable", "Source Serif 4", Georgia, serif';
    ctx.fillStyle = colors.ink;
    ctx.fillText('Написано без ИИ', width / 2, footerY + 125);

    // Название студии и сайт
    ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
    ctx.fillStyle = colors.accent;
    ctx.fillText('в Авторской студии · avtorstudio.com', width / 2, footerY + 175);

    // Тонкий девиз
    ctx.font = '400 19px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
    ctx.fillStyle = colors.inkMuted;
    ctx.fillText('Инструмент для писателей без алгоритмов и подсказок', width / 2, footerY + 225);
  } else {
    // В квадратном формате компактно:
    ctx.font = '700 26px "Source Serif 4 Variable", "Source Serif 4", Georgia, serif';
    ctx.fillStyle = colors.ink;
    ctx.fillText('Написано без ИИ', width / 2, footerY + 45);

    ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "IBM Plex Sans", sans-serif';
    ctx.fillStyle = colors.accent;
    ctx.fillText('в Авторской студии · avtorstudio.com', width / 2, footerY + 80);
  }
}

/**
 * Копирует изображение Canvas в буфер обмена пользователя (PNG)
 */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      try {
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          resolve(true);
        } else {
          resolve(false);
        }
      } catch {
        resolve(false);
      }
    }, 'image/png');
  });
}

/**
 * Скачивает изображение Canvas в виде локального файла PNG
 */
export function downloadCanvasImage(
  canvas: HTMLCanvasElement,
  filename = 'avtorstudio-progress.png',
): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

/**
 * Генерирует сопровождающий текст для шеринга в Telegram, VK или писательские чаты
 */
export function getProgressCardShareText(data: ProgressCardData): string {
  const title = (data.bookTitle ?? 'книгу').trim();
  const words = data.todayWords;
  const wordsStr = `${words > 0 ? `+${fmtNumber(words)}` : fmtNumber(words)} ${plural(Math.abs(words), 'слово', 'слова', 'слов')}`;
  const streakPart = data.streak && data.streak > 0 ? ` · серия ${data.streak} ${pluralDays(data.streak)}` : '';
  const totalPart = data.totalWords && data.totalWords > 0 ? ` (всего в рукописи ${fmtNumber(data.totalWords)})` : '';

  return `Пишу «${title}». Сегодня: ${wordsStr}${streakPart}${totalPart}.\n\nНаписано без ИИ в Авторской студии: https://avtorstudio.com`;
}
