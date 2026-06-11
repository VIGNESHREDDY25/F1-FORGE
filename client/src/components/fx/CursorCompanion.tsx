import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/**
 * Cursor companion — a sleek "grad-buddy" orb wearing a graduation cap that
 * glides after the pointer with spring physics. Its pupils track the cursor
 * direction, it blinks and bobs while idle, and squishes on click.
 *
 * Performance notes: all motion is transform/opacity only (GPU composited),
 * the element is pointer-events-none + fixed, and a single pointermove
 * listener feeds two MotionValues. No React re-renders on cursor move.
 */
export default function CursorCompanion() {
  // Raw pointer position (drives the buddy's spring chase).
  const px = useMotionValue(-100);
  const py = useMotionValue(-100);

  // The buddy lags behind the cursor with a soft, friendly spring.
  const x = useSpring(px, { stiffness: 130, damping: 18, mass: 0.9 });
  const y = useSpring(py, { stiffness: 130, damping: 18, mass: 0.9 });

  // Eye tracking: offset from the buddy's *current* (sprung) position toward
  // the cursor, clamped to a small range so pupils stay inside the eyes.
  const eyeX = useTransform([px, x], ([cursor, self]: number[]) =>
    clamp((cursor - self) / 18, -2.4, 2.4),
  );
  const eyeY = useTransform([py, y], ([cursor, self]: number[]) =>
    clamp((cursor - self) / 18, -2.4, 2.4),
  );
  const eyeXs = useSpring(eyeX, { stiffness: 300, damping: 22 });
  const eyeYs = useSpring(eyeY, { stiffness: 300, damping: 22 });

  const [blink, setBlink] = useState(false);
  const [poke, setPoke] = useState(false);
  const seen = useRef(false);
  const [visible, setVisible] = useState(false);

  // Follow the cursor.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      px.set(e.clientX + 26); // sit just off the cursor's lower-right
      py.set(e.clientY + 26);
      if (!seen.current) {
        seen.current = true;
        setVisible(true);
      }
    };
    const down = () => {
      setPoke(true);
      window.setTimeout(() => setPoke(false), 220);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
    };
  }, [px, py]);

  // Natural, slightly random blinking.
  useEffect(() => {
    let t: number;
    const schedule = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 130);
        schedule();
      }, 2600 + Math.random() * 3200);
    };
    schedule();
    return () => window.clearTimeout(t);
  }, []);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[70]"
      style={{ x, y, translateX: '-50%', translateY: '-50%' }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.5 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      {/* Idle bob + click squish wrapper */}
      <motion.div
        animate={{
          y: [0, -3, 0],
          scaleX: poke ? 1.12 : 1,
          scaleY: poke ? 0.88 : 1,
        }}
        transition={{
          y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
          scaleX: { type: 'spring', stiffness: 500, damping: 18 },
          scaleY: { type: 'spring', stiffness: 500, damping: 18 },
        }}
      >
        <svg
          width="56"
          height="56"
          viewBox="0 0 56 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="f1buddyBody" cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="55%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#4f46e5" />
            </radialGradient>
            <linearGradient id="f1buddyCap" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <filter id="f1buddyShadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="2.4"
                floodColor="#1d4ed8"
                floodOpacity="0.35"
              />
            </filter>
          </defs>

          {/* Soft aura */}
          <circle cx="28" cy="33" r="17" fill="#3b82f6" opacity="0.18" />

          {/* Body */}
          <g filter="url(#f1buddyShadow)">
            <circle cx="28" cy="33" r="13.5" fill="url(#f1buddyBody)" />
          </g>
          {/* Glossy highlight */}
          <ellipse cx="23" cy="27.5" rx="4.6" ry="3.2" fill="#ffffff" opacity="0.35" />

          {/* Cheeks */}
          <circle cx="20.5" cy="35.5" r="2" fill="#f472b6" opacity="0.45" />
          <circle cx="35.5" cy="35.5" r="2" fill="#f472b6" opacity="0.45" />

          {/* Eyes (white) */}
          <ellipse cx="23.6" cy="32.4" rx="3.1" ry={blink ? 0.5 : 3.3} fill="#ffffff" />
          <ellipse cx="32.4" cy="32.4" rx="3.1" ry={blink ? 0.5 : 3.3} fill="#ffffff" />

          {/* Pupils — tracked via framer transform */}
          {!blink && (
            <motion.g style={{ x: eyeXs, y: eyeYs }}>
              <circle cx="23.6" cy="32.4" r="1.5" fill="#0f172a" />
              <circle cx="32.4" cy="32.4" r="1.5" fill="#0f172a" />
              <circle cx="24.1" cy="31.9" r="0.5" fill="#ffffff" />
              <circle cx="32.9" cy="31.9" r="0.5" fill="#ffffff" />
            </motion.g>
          )}

          {/* Smile */}
          <path
            d="M24.5 37.5 Q28 40.2 31.5 37.5"
            stroke="#0f172a"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />

          {/* Graduation cap */}
          <g>
            <path d="M28 13 L42 19 L28 25 L14 19 Z" fill="url(#f1buddyCap)" />
            <path d="M28 19.2 L42 19 L28 25 L14 19 Z" fill="#000000" opacity="0.25" />
            {/* board top sheen */}
            <path d="M28 13 L42 19 L28 22 L14 19 Z" fill="#334155" opacity="0.7" />
            {/* tassel */}
            <path
              d="M42 19 L42 24"
              stroke="#facc15"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <circle cx="42" cy="24.6" r="1.4" fill="#facc15" />
          </g>
        </svg>
      </motion.div>
    </motion.div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
