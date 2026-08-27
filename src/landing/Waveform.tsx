import { motion, useReducedMotion } from 'motion/react';

/**
 * Animated voice waveform — the visual shorthand for "CareScribe is listening".
 * Bar heights come from a fixed pattern rather than randomness so the shape is
 * stable across re-renders and identical for every visitor.
 */
const PATTERN = [0.35, 0.6, 0.9, 0.5, 0.75, 1, 0.45, 0.8, 0.55, 0.95, 0.4, 0.7, 0.85, 0.5, 0.65, 0.3];

export default function Waveform({
  bars = PATTERN.length,
  className = '',
  color = 'bg-brand-500',
  height = 40,
  animated = true,
}: {
  bars?: number;
  className?: string;
  color?: string;
  height?: number;
  animated?: boolean;
}) {
  const reduced = useReducedMotion();
  const live = animated && !reduced;

  return (
    <div
      className={`flex items-center justify-center gap-[3px] ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: bars }, (_, i) => {
        const peak = PATTERN[i % PATTERN.length];
        return (
          <motion.span
            key={i}
            className={`w-[3px] rounded-full ${color}`}
            style={{ height: `${peak * 100}%` }}
            animate={live ? { scaleY: [0.35, 1, 0.55, 0.9, 0.35] } : undefined}
            transition={
              live
                ? {
                    duration: 1.6 + (i % 4) * 0.22,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.045,
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
