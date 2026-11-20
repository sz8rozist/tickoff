import { useEffect, useState } from 'react';

/**
 * Egy számlálót léptet görgetéskor, átméretezéskor és időnként (elrendezés-változások miatt), hogy a
 * dokumentumhoz igazított elemek (jelölések, kiemelő keret) pozíciója újraszámolódjon.
 */
export function useTick(enabled: boolean): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const bump = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setTick((t) => t + 1);
      });
    };
    window.addEventListener('scroll', bump, true);
    window.addEventListener('resize', bump);
    const timer = window.setInterval(bump, 800);
    return () => {
      window.removeEventListener('scroll', bump, true);
      window.removeEventListener('resize', bump);
      window.clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);

  return tick;
}
