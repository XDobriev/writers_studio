// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getProgressCardShareText,
  renderProgressCard,
  copyCanvasToClipboard,
  downloadCanvasImage,
  type ProgressCardData,
} from './progressCard';
import { fmtNumber } from './i18n';

describe('progressCard', () => {
  describe('getProgressCardShareText', () => {
    it('формирует полный текст публикации при всех переданных полях', () => {
      const data: ProgressCardData = {
        bookTitle: 'Северный ветер',
        todayWords: 1250,
        streak: 5,
        totalWords: 45000,
        goalWords: 1000,
      };

      const text = getProgressCardShareText(data);
      expect(text).toContain('«Северный ветер»');
      expect(text).toContain(`+${fmtNumber(1250)} слов`);
      expect(text).toContain('серия 5 дней');
      expect(text).toContain(`всего в рукописи ${fmtNumber(45000)}`);
      expect(text).toContain('Написано без ИИ в Авторской студии: https://avtorstudio.com');
    });

    it('корректно склоняет слова и дни', () => {
      const data1: ProgressCardData = {
        bookTitle: 'Один',
        todayWords: 1,
        streak: 1,
      };
      const text1 = getProgressCardShareText(data1);
      expect(text1).toContain('+1 слово');
      expect(text1).toContain('серия 1 день');

      const data2: ProgressCardData = {
        bookTitle: 'Два',
        todayWords: 2,
        streak: 2,
      };
      const text2 = getProgressCardShareText(data2);
      expect(text2).toContain('+2 слова');
      expect(text2).toContain('серия 2 дня');
    });

    it('обрабатывает случай без названия и без серии', () => {
      const data: ProgressCardData = {
        todayWords: 0,
      };
      const text = getProgressCardShareText(data);
      expect(text).toContain('«книгу»');
      expect(text).toContain('0 слов');
      expect(text).not.toContain('серия');
      expect(text).not.toContain('всего в рукописи');
    });
  });

  describe('renderProgressCard', () => {
    let mockContext: Record<string, any>;
    let mockCanvas: HTMLCanvasElement;

    beforeEach(() => {
      mockContext = {
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        arcTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        roundRect: vi.fn(),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
      };

      mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn((type: string) => (type === '2d' ? mockContext : null)),
      } as unknown as HTMLCanvasElement;
    });

    it('устанавливает размеры 1080x1920 для формата story', () => {
      renderProgressCard(mockCanvas, { todayWords: 500 }, { format: 'story' });
      expect(mockCanvas.width).toBe(1080);
      expect(mockCanvas.height).toBe(1920);
      expect(mockContext.fillText).toHaveBeenCalled();
    });

    it('устанавливает размеры 1080x1080 для формата square', () => {
      renderProgressCard(mockCanvas, { todayWords: 500 }, { format: 'square' });
      expect(mockCanvas.width).toBe(1080);
      expect(mockCanvas.height).toBe(1080);
      expect(mockContext.fillText).toHaveBeenCalled();
    });

    it('отрисовывает карточку в светлой теме paper без ошибок', () => {
      renderProgressCard(
        mockCanvas,
        {
          bookTitle: 'Бумажная книга',
          todayWords: 750,
          streak: 3,
          totalWords: 12000,
          goalWords: 1000,
        },
        { theme: 'paper', format: 'story' },
      );
      expect(mockContext.fillRect).toHaveBeenCalled();
      expect(mockContext.fillText).toHaveBeenCalled();
    });
  });

  describe('copyCanvasToClipboard и downloadCanvasImage', () => {
    it('копирует blob в буфер обмена при наличии API', async () => {
      const mockBlob = new Blob(['test'], { type: 'image/png' });
      const mockCanvas = {
        toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(mockBlob)),
      } as unknown as HTMLCanvasElement;

      const writeMock = vi.fn().mockResolvedValue(undefined);
      class MockClipboardItem {
        data: Record<string, any>;
        constructor(data: Record<string, any>) {
          this.data = data;
        }
      }
      vi.stubGlobal('ClipboardItem', MockClipboardItem);
      Object.defineProperty(navigator, 'clipboard', {
        value: { write: writeMock },
        configurable: true,
      });

      const res = await copyCanvasToClipboard(mockCanvas);
      expect(res).toBe(true);
      expect(writeMock).toHaveBeenCalled();
    });

    it('вызывает скачивание PNG файла через ссылку', () => {
      const mockBlob = new Blob(['test'], { type: 'image/png' });
      const mockCanvas = {
        toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(mockBlob)),
      } as unknown as HTMLCanvasElement;

      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      downloadCanvasImage(mockCanvas, 'test-card.png');
      expect(mockCanvas.toBlob).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });
});
