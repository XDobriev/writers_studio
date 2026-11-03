import { useState, useRef, useEffect, useCallback } from 'react';
import { useEscapeToClose } from '../lib/useEscapeToClose';
import { trapTab, useModalFocus } from '../lib/useModalFocus';
import {
  renderProgressCard,
  copyCanvasToClipboard,
  downloadCanvasImage,
  getProgressCardShareText,
  type ProgressCardData,
  type ProgressCardTheme,
  type ProgressCardFormat,
} from '../lib/progressCard';

export interface ShareProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ProgressCardData;
}

export function ShareProgressModal({ isOpen, onClose, data }: ShareProgressModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [theme, setTheme] = useState<ProgressCardTheme>('dark');
  const [format, setFormat] = useState<ProgressCardFormat>('story');
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [canShareFile, setCanShareFile] = useState(false);

  useEscapeToClose(isOpen, onClose);
  useModalFocus(isOpen, panelRef);

  // Отрисовка на Canvas при изменении настроек или данных
  const updateCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    renderProgressCard(canvasRef.current, data, { theme, format });
  }, [data, theme, format]);

  useEffect(() => {
    if (!isOpen) return;
    // Даем микротик для монтирования DOM-элемента canvas
    const timer = setTimeout(updateCanvas, 10);
    return () => clearTimeout(timer);
  }, [isOpen, updateCanvas]);

  // Проверка поддержки Web Share API с файлами
  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
      try {
        const testFile = new File([''], 'test.png', { type: 'image/png' });
        setCanShareFile(navigator.canShare({ files: [testFile] }));
      } catch {
        setCanShareFile(false);
      }
    }
  }, []);

  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    const ok = await copyCanvasToClipboard(canvasRef.current);
    if (ok) {
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } else {
      // Фоллбэк: если буфер не принял PNG напрямую (например в Firefox без флага), скачиваем
      downloadCanvasImage(canvasRef.current, `progress-${format}-${theme}.png`);
    }
  };

  const handleDownloadImage = () => {
    if (!canvasRef.current) return;
    const safeTitle = (data.bookTitle ?? 'progress')
      .toLowerCase()
      .replace(/[^a-zа-я0-9_-]/gi, '_')
      .slice(0, 30);
    downloadCanvasImage(canvasRef.current, `${safeTitle}-progress-${format}.png`);
  };

  const handleCopyText = async () => {
    const text = getProgressCardShareText(data);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // Игнорируем ошибку буфера
    }
  };

  const handleNativeShare = async () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const file = new File([blob], 'avtorstudio-progress.png', { type: 'image/png' });
        const text = getProgressCardShareText(data);
        if (navigator.share) {
          await navigator.share({
            files: [file],
            title: 'Мой прогресс в Авторской студии',
            text,
          });
        }
      } catch {
        // Пользователь отменил шеринг или он не удался
      }
    }, 'image/png');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Поделиться прогрессом"
        tabIndex={-1}
        className="modal-panel"
        style={{ width: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => trapTab(e)}
      >
        {/* Шапка модалки */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ font: '600 22px var(--font-serif)', margin: 0, color: 'var(--ink)' }}>
              Карточка прогресса
            </h2>
            <p style={{ margin: '4px 0 0', font: '400 13px var(--font-ui)', color: 'var(--ink-3)' }}>
              Красивая карточка с плашкой «Написано без ИИ» для сторис и чатов
            </p>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            aria-label="Закрыть окно"
            style={{ padding: '4px 8px', font: '18px/1 var(--font-ui)', color: 'var(--ink-3)', minHeight: 'auto' }}
          >
            ✕
          </button>
        </div>

        {/* Переключатели формата и темы */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          {/* Формат */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface-2)', padding: 3, borderRadius: 8, border: '1px solid var(--border-soft)' }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setFormat('story')}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                borderRadius: 6,
                background: format === 'story' ? 'var(--surface)' : 'transparent',
                color: format === 'story' ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: format === 'story' ? '0 1px 4px oklch(0 0 0 / 0.1)' : 'none',
                minHeight: 'auto',
              }}
            >
              📱 Сторис 9:16
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setFormat('square')}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                borderRadius: 6,
                background: format === 'square' ? 'var(--surface)' : 'transparent',
                color: format === 'square' ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: format === 'square' ? '0 1px 4px oklch(0 0 0 / 0.1)' : 'none',
                minHeight: 'auto',
              }}
            >
              🖼 Квадрат 1:1
            </button>
          </div>

          {/* Тема */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface-2)', padding: 3, borderRadius: 8, border: '1px solid var(--border-soft)' }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setTheme('dark')}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                borderRadius: 6,
                background: theme === 'dark' ? 'var(--surface)' : 'transparent',
                color: theme === 'dark' ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: theme === 'dark' ? '0 1px 4px oklch(0 0 0 / 0.1)' : 'none',
                minHeight: 'auto',
              }}
            >
              🌑 Тёмная
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setTheme('paper')}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                borderRadius: 6,
                background: theme === 'paper' ? 'var(--surface)' : 'transparent',
                color: theme === 'paper' ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: theme === 'paper' ? '0 1px 4px oklch(0 0 0 / 0.1)' : 'none',
                minHeight: 'auto',
              }}
            >
              📜 Пергамент
            </button>
          </div>
        </div>

        {/* Интерактивное превью карточки (Canvas) */}
        <div
          style={{
            flex: 1,
            minHeight: 280,
            maxHeight: 420,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-deep)',
            borderRadius: 12,
            border: '1px solid var(--border-soft)',
            padding: 12,
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              maxHeight: 390,
              maxWidth: '100%',
              height: 'auto',
              borderRadius: 8,
              boxShadow: '0 8px 32px oklch(0 0 0 / 0.35)',
              display: 'block',
            }}
          />
        </div>

        {/* Сопровождающий текст для соцсетей */}
        <div style={{ marginTop: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ font: '500 11px var(--font-mono)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Текст к публикации
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleCopyText}
              style={{ padding: '2px 6px', fontSize: 11, minHeight: 'auto', color: copiedText ? 'var(--ok)' : 'var(--ink-3)' }}
            >
              {copiedText ? '✓ Скопировано' : 'Скопировать текст'}
            </button>
          </div>
          <div
            style={{
              font: '400 12px/1.4 var(--font-ui)',
              color: 'var(--ink-2)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-soft)',
              borderRadius: 6,
              padding: '6px 10px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {getProgressCardShareText(data)}
          </div>
        </div>

        {/* Действия внизу */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
          {canShareFile && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleNativeShare}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Поделиться
            </button>
          )}

          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleCopyImage}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            {copiedImage ? 'Скопировано! ✓' : 'Скопировать картинку'}
          </button>

          <button
            type="button"
            className="btn btn--primary"
            onClick={handleDownloadImage}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Скачать PNG
          </button>
        </div>
      </div>
    </div>
  );
}
