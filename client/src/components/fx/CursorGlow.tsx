import { useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

/** A soft radial highlight that trails the pointer. Transform-only, GPU
 *  composited, and pointer-events-none so it never interferes with clicks. */
export default function CursorGlow() {
  const x = useMotionValue(-200);
  const y = useMotionValue(-200);

  // Lazy spring so the glow lags slightly behind the raw cursor.
  const sx = useSpring(x, { stiffness: 220, damping: 30, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 220, damping: 30, mass: 0.6 });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [x, y]);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[60] h-[420px] w-[420px] rounded-full
                 mix-blend-multiply dark:mix-blend-screen"
      style={{
        x: sx,
        y: sy,
        translateX: '-50%',
        translateY: '-50%',
        background:
          'radial-gradient(circle, rgba(37,99,235,0.10) 0%, rgba(99,102,241,0.06) 35%, transparent 70%)',
      }}
    />
  );
}
