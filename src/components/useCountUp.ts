import { useEffect, useRef, useState } from 'react';

/**
 * Counts from 0 to `target` once per mount (600ms ease-out, §11.6).
 * Jumps straight to the value under prefers-reduced-motion. Later target
 * changes (live-query updates) apply instantly — the show runs only once.
 */
export function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current) {
      setValue(target);
      return;
    }
    animated.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return value;
}
