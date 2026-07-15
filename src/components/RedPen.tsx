import type { ReactNode } from 'react';

// Kırmızı Kalem — the app's one bold gesture (§11.5). Two variants drawn as
// slightly irregular hand-drawn paths; stroke-dashoffset draw-in runs once
// per mount (400ms) and is neutralized globally by prefers-reduced-motion.
// Never use outside the spec'd spots: over-budget totals, negative
// safe-to-spend (circle); pisman amounts (strike).

const PATHS = {
  circle:
    'M 12 22 C 14 9, 40 3, 58 5 C 80 7, 97 12, 96 21 C 95 31, 70 37, 46 36 C 25 35, 5 31, 7 22 C 8 16, 14 12, 22 10',
  strike: 'M 4 24 C 28 19, 62 22, 96 16',
} as const;

export function RedPen(props: {
  variant: 'circle' | 'strike';
  children: ReactNode;
}) {
  return (
    <span className="relative inline-block">
      {props.children}
      <svg
        aria-hidden
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className={`pointer-events-none absolute overflow-visible ${
          props.variant === 'circle'
            ? '-inset-x-2.5 -inset-y-1.5 h-[calc(100%+12px)] w-[calc(100%+20px)] -rotate-2'
            : 'inset-x-0 inset-y-0 h-full w-full rotate-1'
        }`}
      >
        <path
          d={PATHS[props.variant]}
          pathLength={100}
          fill="none"
          stroke="var(--redpen)"
          strokeWidth={2.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="redpen-draw"
        />
      </svg>
    </span>
  );
}
