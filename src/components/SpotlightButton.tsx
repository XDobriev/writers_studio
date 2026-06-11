import { useRef } from 'react';
import { motion } from 'framer-motion';

interface SpotlightButtonProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function SpotlightButton({ children, className = '', style, onClick }: SpotlightButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    btn.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
    btn.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
  };

  return (
    <motion.button
      ref={btnRef}
      className={`spotlight-btn ${className}`}
      style={style}
      onMouseMove={handleMouseMove}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
