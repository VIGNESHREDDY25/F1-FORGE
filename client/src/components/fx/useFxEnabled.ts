import { useEffect, useState } from 'react';

const STORAGE_KEY = 'f1forge:companion';

/** Detects whether premium pointer FX (cursor companion + glow) should run.
 *  Disabled for: touch-only devices, reduced-motion users, and when the user
 *  has explicitly toggled the companion off (persisted in localStorage). */
export function useFxEnabled() {
  // Capability gate: a real pointer device + motion allowed.
  const [supported, setSupported] = useState(false);
  // User preference (persisted). Defaults ON.
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const finePointer = window.matchMedia('(pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const evaluate = () => {
      setSupported(finePointer.matches && !reducedMotion.matches);
    };
    evaluate();

    finePointer.addEventListener?.('change', evaluate);
    reducedMotion.addEventListener?.('change', evaluate);
    return () => {
      finePointer.removeEventListener?.('change', evaluate);
      reducedMotion.removeEventListener?.('change', evaluate);
    };
  }, []);

  const setEnabledPersisted = (value: boolean) => {
    setEnabled(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
    } catch {
      /* ignore quota / privacy-mode failures */
    }
  };

  return {
    /** Device/OS allows the effect at all. */
    supported,
    /** User wants it on (and persisted). */
    enabled,
    /** Effects should actually render right now. */
    active: supported && enabled,
    setEnabled: setEnabledPersisted,
  };
}
