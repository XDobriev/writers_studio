import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { pageVariants } from '../lib/motion';

export function PageMotion({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.main
      variants={pageVariants}
      initial={prefersReducedMotion ? 'animate' : 'initial'}
      animate="animate"
      exit={prefersReducedMotion ? 'animate' : 'exit'}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.main>
  );
}
