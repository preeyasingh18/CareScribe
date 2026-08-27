import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Shared motion primitives for the landing page.
 *
 * Every helper here collapses to "no movement, just render" when the visitor
 * has asked for reduced motion — a medical product should never trap someone
 * behind an animation they cannot tolerate.
 */

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Fade + rise as the element scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className = '',
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: EASE_OUT }}
    >
      {children}
    </Tag>
  );
}

/** Stagger container — pair with <Reveal> children given increasing delays. */
export function useStaggerDelay(index: number, step = 0.07): number {
  const reduced = useReducedMotion();
  return reduced ? 0 : index * step;
}

/**
 * Counts from 0 to `to` the first time it scrolls into view.
 *
 * Deliberately plain: a raw IntersectionObserver plus requestAnimationFrame.
 * An earlier version drove this through motion's animate()/useInView and left
 * some of the counters frozen at 0 while their siblings finished — the numbers
 * are the one thing on this page a visitor reads as fact, so they get the
 * boring implementation that cannot silently no-op.
 */
export function CountUp({
  to,
  duration = 1.1,
  className = '',
  suffix = '',
}: {
  to: number;
  duration?: number;
  className?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced motion (or no observer support): show the real number at once.
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setValue(to);
      return;
    }

    let frame = 0;
    let startedAt = 0;

    const step = (now: number) => {
      if (!startedAt) startedAt = now;
      const t = Math.min((now - startedAt) / (duration * 1000), 1);
      // easeOutCubic — fast start, gentle settle
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(e => e.isIntersecting)) return;
        observer.disconnect();
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.2 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced, to, duration]);

  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  );
}

/** Gentle vertical float for hero ornaments. */
export function Float({
  children,
  amplitude = 8,
  duration = 5,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  amplitude?: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      animate={{ y: [-amplitude / 2, amplitude / 2, -amplitude / 2] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}
