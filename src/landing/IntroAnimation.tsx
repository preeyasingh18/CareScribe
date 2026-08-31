import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import BrandLogo, { LOGO_PART_C_SRC, LOGO_PART_MIC_SRC } from '../components/BrandLogo';
import { EASE_OUT } from './motion';

/**
 * The opening sequence: the C flies in from the left, the microphone from the
 * right, they meet to form the mark, it holds, then it travels to the navbar.
 *
 * How the logo is never distorted
 * -------------------------------
 * The artwork is never redrawn, re-pathed or morphed. The two entering pieces
 * are separate files carrying the SAME paths at the SAME viewBox as the whole
 * mark — split by ELEMENT, so each piece is a complete shape:
 *
 *     left  = logo-part-c.svg    → the whole, continuous "C"
 *     right = logo-part-mic.svg  → the microphone, and no arc at all
 *
 * Nothing is clipped. An earlier version sliced a single image with a vertical
 * clip-path, which cut the ring into a left arc plus two orphaned top/bottom
 * right fragments — leaving a partial C on both sides. Because both files share
 * the mark's coordinate system, once they settle at x = 0 they overlay into the
 * artwork exactly. A cross-fade then hands over to a single complete <img> so
 * the flight moves ONE element.
 *
 * Only `x`, `opacity` and a uniform `scale` are ever animated, and only on the
 * wrappers. No path animation, no scaleX/scaleY, no rotation, no skew.
 *
 * Timeline (ms), matching the approved spec:
 *      0 -  900  C enters from the left, microphone from the right
 *    900 - 1100  aligned; halves cross-fade into the single complete mark
 *   1100 - 2300  held centred, with a subtle glow pulse behind the whole mark
 *   2300 - 3000  the complete mark translates + scales to the navbar slot
 *   3000         overlay unmounts, navbar logo takes over
 */

const ASSEMBLED_AT = 900;
const FLIGHT_AT = 2300;
const DONE_AT = 3000;

/** Reduced motion: show the finished mark centred, briefly, then hand off. */
const REDUCED_HOLD_MS = 800;

interface Props {
  /** Where the navbar logo sits, so the flight lands exactly on it. */
  targetRect: DOMRect | null;
  onFinished: () => void;
}

export default function IntroAnimation({ targetRect, onFinished }: Props) {
  const reduced = useReducedMotion();
  const markRef = useRef<HTMLDivElement>(null);
  const [assembled, setAssembled] = useState(false);
  const [flight, setFlight] = useState<{ x: number; y: number; scale: number } | null>(null);

  // How far off-screen the halves start. Measured from the viewport so the
  // pieces are genuinely outside it on a phone and on a wide desktop alike.
  const [entryOffset, setEntryOffset] = useState(() =>
    typeof window === 'undefined' ? 600 : window.innerWidth / 2 + 220,
  );

  useEffect(() => {
    const onResize = () => setEntryOffset(window.innerWidth / 2 + 220);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Root re-measures the navbar slot after layout settles, handing down a NEW
  // DOMRect each time. Keeping it in a ref instead of a timer dependency stops
  // that second measurement from tearing down and restarting the whole
  // timeline — which silently pushed every step later than the spec.
  const targetRef = useRef(targetRect);
  useEffect(() => {
    targetRef.current = targetRect;
  }, [targetRect]);

  const startFlight = () => {
    const from = markRef.current?.getBoundingClientRect();
    const target = targetRef.current;
    if (from && target && from.width > 0) {
      setFlight({
        x: target.left + target.width / 2 - (from.left + from.width / 2),
        y: target.top + target.height / 2 - (from.top + from.height / 2),
        // Both boxes are square, so this scale can only ever be uniform.
        scale: target.width / from.width,
      });
    } else {
      // No measurable target (navbar not laid out yet) — settle in place rather
      // than fly to nowhere.
      setFlight({ x: 0, y: 0, scale: 0.92 });
    }
  };

  useEffect(() => {
    if (reduced) {
      // No entrance: the complete mark is already on screen. Hold, then hand off.
      const timers = [
        window.setTimeout(startFlight, REDUCED_HOLD_MS),
        window.setTimeout(onFinished, REDUCED_HOLD_MS + 500),
      ];
      return () => timers.forEach(window.clearTimeout);
    }

    const timers = [
      window.setTimeout(() => setAssembled(true), ASSEMBLED_AT),
      window.setTimeout(startFlight, FLIGHT_AT),
      window.setTimeout(onFinished, DONE_AT),
    ];
    return () => timers.forEach(window.clearTimeout);
    // startFlight reads the target from a ref, so it is deliberately not a dep:
    // the timeline must run exactly once, start to finish.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, onFinished]);

  const flying = flight !== null;
  const complete = reduced || assembled;

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-white"
      initial={{ opacity: 1 }}
      animate={{ opacity: flying ? 0 : 1 }}
      transition={{ duration: 0.4, delay: flying ? 0.3 : 0, ease: 'easeInOut' }}
    >
      {/* Ambient wash — a sibling of the mark, never an ancestor, so it cannot
          drag the artwork into its own transforms. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute h-[min(520px,120vw)] w-[min(520px,120vw)] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(124,58,237,0.15) 0%, rgba(167,139,250,0.07) 45%, rgba(255,255,255,0) 70%)',
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: flying ? 0 : 1, scale: 1 }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
      />

      {/* Glow pulse during the hold. Also a sibling — the mark itself never
          pulses, and neither piece of it pulses independently. */}
      {complete && !flying && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full bg-brand-400/25 blur-2xl"
          style={{ width: 'min(190px, 46vw)', height: 'min(190px, 46vw)' }}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={reduced ? { opacity: 0.5, scale: 1 } : { opacity: [0.2, 0.7, 0.35, 0.7], scale: [0.94, 1.05, 0.99, 1.05] }}
          transition={{ duration: 2.2, ease: 'easeInOut', times: [0, 0.3, 0.65, 1] }}
        />
      )}

      {/*
        THE MARK. Responsive box; the flight scale is derived from its measured
        width, so it lands on the navbar correctly at any viewport size.
      */}
      <motion.div
        ref={markRef}
        className="relative z-10"
        style={{ width: 'clamp(104px, 34vw, 150px)', height: 'clamp(104px, 34vw, 150px)' }}
        animate={flight ? { x: flight.x, y: flight.y, scale: flight.scale } : { x: 0, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      >
        {/* ── The two entering pieces: one artwork, two crops ── */}
        {!reduced && (
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: assembled ? 0 : 1 }}
            transition={{ duration: 0.2, ease: 'linear' }}
          >
            {/* the complete C — in from the left */}
            <motion.img
              src={LOGO_PART_C_SRC}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute inset-0 h-full w-full select-none"
              initial={{ x: -entryOffset }}
              animate={{ x: 0 }}
              transition={{ duration: 0.85, ease: EASE_OUT }}
            />
            {/* the microphone only — in from the right, a beat behind */}
            <motion.img
              src={LOGO_PART_MIC_SRC}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute inset-0 h-full w-full select-none"
              initial={{ x: entryOffset }}
              animate={{ x: 0 }}
              transition={{ duration: 0.85, delay: 0.08, ease: EASE_OUT }}
            />
          </motion.div>
        )}

        {/* ── The complete, untouched artwork ── */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: complete ? 1 : 0 }}
          transition={{ duration: 0.2, ease: 'linear' }}
        >
          <BrandLogo size={150} className="h-full w-full" priority />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
