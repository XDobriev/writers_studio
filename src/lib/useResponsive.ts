import { useState, useEffect } from 'react';

export const BREAKPOINTS = {
  NARROW: 480,
  MOBILE: 768,
  TABLET: 1024,
  WIDE: 1200,
} as const;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function useResponsive() {
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.MOBILE - 1}px)`);
  const isTablet = useMediaQuery(`(max-width: ${BREAKPOINTS.TABLET - 1}px)`);
  const isNarrow = useMediaQuery(`(max-width: ${BREAKPOINTS.NARROW - 1}px)`);
  const isWide = useMediaQuery(`(min-width: ${BREAKPOINTS.WIDE}px)`);
  return { isMobile, isTablet, isNarrow, isWide };
}
