import type { ReactNode } from 'react';

export { Sidebar, SidebarFoot, SidebarNav } from './Sidebar';
export { RailNav } from './RailNav';

interface WithModeProps {
  children: ReactNode;
}

export function WithMode({ children }: WithModeProps) {
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
