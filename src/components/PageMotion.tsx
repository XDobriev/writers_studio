import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { pageVariants } from '../lib/motion';

export function PageMotion({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  );
}
