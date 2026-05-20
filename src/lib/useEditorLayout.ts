import { useWindowWidth } from './useWindowWidth';

type Mode = 'studio' | 'left' | 'right' | 'page';

interface EditorLayout {
  isMobile: boolean;
  showLeft: boolean;
  showRight: boolean;
  isPage: boolean;
  cols: string;
  sheetWidth: number | string;
  sheetPad: string;
}

export function useEditorLayout(mode: Mode): EditorLayout {
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const showLeft = !isMobile && (mode === 'studio' || mode === 'left');
  const showRight = (mode === 'studio' && windowWidth >= 1200) || mode === 'right';
  const isPage = mode === 'page';

  const cols = isPage
    ? (isMobile ? '1fr' : '56px 1fr')
    : showLeft && showRight
    ? '260px 1fr 320px'
    : showLeft
    ? '260px 1fr'
    : showRight
    ? '1fr 320px'
    : '1fr';

  const sheetWidth = isMobile ? '100%' : (isPage ? 740 : 680);
  const sheetPad = isMobile ? '24px 20px 80px' : (isPage ? '64px 80px 80px' : '48px 64px 80px');

  return { isMobile, showLeft, showRight, isPage, cols, sheetWidth, sheetPad };
}
