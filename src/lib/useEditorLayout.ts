import { useResponsive } from './useResponsive';

type Mode = 'studio' | 'left' | 'right' | 'page';

interface EditorLayout {
  isMobile: boolean;
  isNarrow: boolean;
  isTablet: boolean;
  showLeft: boolean;
  showRight: boolean;
  isPage: boolean;
  cols: string;
  sheetWidth: number | string;
  sheetPad: string;
  wrapPad: string;
}

export function useEditorLayout(mode: Mode): EditorLayout {
  const { isMobile, isNarrow, isTablet, isWide } = useResponsive();
  const showLeft = !isMobile && (mode === 'studio' || mode === 'left');
  const showRight = !isMobile && ((mode === 'studio' && isWide) || mode === 'right');
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

  const sheetWidth = isMobile ? '100%' : isTablet ? (isPage ? 600 : 560) : (isPage ? 740 : 680);
  const sheetPad = isMobile
    ? '24px 20px 80px'
    : isTablet
    ? (isPage ? '48px 40px 80px' : '36px 32px 80px')
    : (isPage ? '64px 80px 80px' : '48px 64px 80px');
  const wrapPad = isMobile
    ? '16px 8px 0'
    : isTablet
    ? (isPage ? '32px 24px 0' : '24px 20px 0')
    : (isPage ? '48px 56px 0' : '36px 32px 0');

  return { isMobile, isNarrow, isTablet, showLeft, showRight, isPage, cols, sheetWidth, sheetPad, wrapPad };
}
