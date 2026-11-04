import { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toastVariants } from '../lib/motion';

export interface GlobalSaveHandlerProps {
  timeoutMs?: number;
}

/**
 * Глобальный обработчик Ctrl+S / ⌘S на уровне приложения.
 * Перехватывает системный диалог браузера «Сохранить страницу как HTML»
 * на любой странице студии (Дашборд, Заметки, Персонажи, Хронология, Карта, План и др.)
 * и выводит подтверждающий тост автосохранения.
 */
export function GlobalSaveHandler({ timeoutMs = 2000 }: GlobalSaveHandlerProps = {}) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'info' | 'error'>('info');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMsRef = useRef(timeoutMs);
  useEffect(() => { timeoutMsRef.current = timeoutMs; }, [timeoutMs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && (/mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent));
      const mod = isMac ? e.metaKey : e.ctrlKey;
      const isKeyS = e.code === 'KeyS' || e.key?.toLowerCase() === 's' || e.key?.toLowerCase() === 'ы';

      if (!mod || !isKeyS || e.shiftKey || e.altKey) return;

      // Всегда предотвращаем открытие системного окна «Сохранить страницу как HTML»
      e.preventDefault();

      if (timerRef.current) clearTimeout(timerRef.current);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        setToastType('error');
        setToastMessage('Нет подключения к интернету');
      } else {
        setToastType('info');
        setToastMessage('Все изменения сохранены');
      }
      timerRef.current = setTimeout(() => {
        setToastMessage(null);
      }, timeoutMsRef.current);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {toastMessage && (
        <motion.div
          role="status"
          className={`toast ${toastType === 'error' ? 'toast--error' : 'toast--info'}`}
          variants={toastVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ zIndex: 'var(--z-toast)' }}
        >
          {toastMessage}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
