import { useState, useEffect } from 'react';

interface DrawerControls {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export interface MobileDrawers {
  sidebar: DrawerControls;
  right: DrawerControls;
}

export function useMobileDrawers(isMobile: boolean): MobileDrawers {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
      setRightOpen(false);
    }
  }, [isMobile]);

  return {
    sidebar: {
      isOpen: sidebarOpen,
      open: () => setSidebarOpen(true),
      close: () => setSidebarOpen(false),
    },
    right: {
      isOpen: rightOpen,
      open: () => setRightOpen(true),
      close: () => setRightOpen(false),
    },
  };
}
