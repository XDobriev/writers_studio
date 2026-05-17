import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  hideDelay?: number;
  enabled?: boolean;
}

interface Result {
  visible: boolean;
  onKeyDown: () => void;
  containerHandlers: { onMouseMove: () => void };
  toolbarHandlers: { onMouseEnter: () => void; onMouseLeave: () => void };
}

export function useToolbarAutoHide({
  hideDelay = 2000,
  enabled = true,
}: Options = {}): Result {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringRef = useRef(false);

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (!enabled) return;
    cancelTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!isHoveringRef.current) setVisible(false);
    }, hideDelay);
  }, [enabled, hideDelay, cancelTimer]);

  const show = useCallback(() => {
    cancelTimer();
    setVisible(true);
  }, [cancelTimer]);

  const handleToolbarEnter = useCallback(() => {
    isHoveringRef.current = true;
    cancelTimer();
  }, [cancelTimer]);

  const handleToolbarLeave = useCallback(() => {
    isHoveringRef.current = false;
  }, []);

  // When disabled: cancel pending timer and restore visibility
  useEffect(() => {
    if (!enabled) {
      cancelTimer();
      setVisible(true);
    }
  }, [enabled, cancelTimer]);

  // Cleanup on unmount
  useEffect(() => cancelTimer, [cancelTimer]);

  return {
    visible,
    onKeyDown: scheduleHide,
    containerHandlers: { onMouseMove: show },
    toolbarHandlers: { onMouseEnter: handleToolbarEnter, onMouseLeave: handleToolbarLeave },
  };
}
