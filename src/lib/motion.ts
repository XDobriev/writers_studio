import type { Variants, Transition } from 'framer-motion';

const springModal: Transition  = { type: 'spring', stiffness: 420, damping: 28 };
const springCard: Transition   = { type: 'spring', stiffness: 400, damping: 25 };
const springDrop: Transition   = { type: 'spring', stiffness: 380, damping: 26 };
const springToast: Transition  = { type: 'spring', stiffness: 380, damping: 28 };
const springLanding: Transition = { type: 'spring', stiffness: 300, damping: 30 };

export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

export const modalPanelVariants: Variants = {
  initial: { opacity: 0, scale: 0.93, y: 16 },
  animate: { opacity: 1, scale: 1,    y: 0,  transition: springModal },
  exit:    { opacity: 0, scale: 0.96, y: 6,  transition: { duration: 0.15, ease: 'easeIn' } },
};

export const pageVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

export const toastVariants: Variants = {
  initial: { opacity: 0, y: 8,  scale: 0.96 },
  animate: { opacity: 1, y: 0,  scale: 1,    transition: springToast },
  exit:    { opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.14, ease: 'easeIn' } },
};

export const dropdownVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: -6 },
  animate: { opacity: 1, scale: 1,    y: 0,  transition: springDrop },
  exit:    { opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.12, ease: 'easeIn' } },
};

export const cardContainerVariants: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04 } },
};

export const cardItemVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 25, duration: 0.4 } },
};

export const cardHoverTransition: Transition = springCard;

export const heroContainerVariants: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
};

export const heroItemVariants: Variants = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0, transition: springLanding },
};

export const featTextVariants: Variants = {
  initial: { opacity: 0, x: -36 },
  animate: { opacity: 1, x: 0, transition: springLanding },
};

export const featMockVariants: Variants = {
  initial: { opacity: 0, x: 36 },
  animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 30, delay: 0.12 } },
};

export const featTextVariantsRev: Variants = {
  initial: { opacity: 0, x: 36 },
  animate: { opacity: 1, x: 0, transition: springLanding },
};

export const featMockVariantsRev: Variants = {
  initial: { opacity: 0, x: -36 },
  animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 30, delay: 0.12 } },
};

export const revealVariants: Variants = {
  initial: { opacity: 0, y: 44 },
  animate: { opacity: 1, y: 0, transition: springLanding },
};
