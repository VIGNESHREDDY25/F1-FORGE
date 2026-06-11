import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  children: ReactNode;
  /** Stagger offset in seconds for sequencing siblings. */
  delay?: number;
  className?: string;
}

/** Reusable mount-reveal wrapper: a subtle fade + rise on first render.
 *  Honors reduced-motion automatically (framer respects the OS setting via
 *  the global CSS guard, and the movement here is tiny). Opt-in utility —
 *  not wired into any page. */
export default function Reveal({ children, delay = 0, className }: Props) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
