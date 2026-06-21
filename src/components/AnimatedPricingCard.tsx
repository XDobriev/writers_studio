import type { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface AnimatedPricingCardProps {
  children: ReactNode;
  featured?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export function AnimatedPricingCard({ children, featured = false, className = '', style, onClick }: AnimatedPricingCardProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ y: prefersReducedMotion ? 0 : (featured ? -6 : 0) }}
      whileHover={prefersReducedMotion ? {} : {
        y: featured ? -10 : -6,
        scale: 1.02,
        boxShadow: '0 0 28px color-mix(in oklch, var(--accent) 20%, transparent), 0 12px 28px oklch(0 0 0 / 0.4)',
      }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 26 }}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
    >
      {children}
    </motion.div>
  );
}
