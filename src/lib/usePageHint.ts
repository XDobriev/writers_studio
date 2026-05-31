import { useState, useEffect } from 'react';

export function usePageHint(isPage: boolean) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isPage && !localStorage.getItem('editor-page-hinted')) setVisible(true);
  }, [isPage]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      localStorage.setItem('editor-page-hinted', '1');
    }, 8000);
    return () => clearTimeout(t);
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem('editor-page-hinted', '1');
  };

  return { visible, dismiss };
}
