import { useId } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * A large, very faint voice waveform that sits behind a section — the visual
 * echo of "Listen → Understand → Document".
 *
 * Deliberately decorative and cheap:
 *  - bar geometry is computed once at module load from a fixed set of sines, so
 *    the shape is identical for every visitor and never re-renders;
 *  - the pulse is a pure CSS transform animation (see `cs-wave` in index.css),
 *    so it stays on the compositor and costs nothing on the main thread;
 *  - a horizontal mask fades both edges out, and the height envelope peaks in
 *    the middle, so the wave reads as "louder in the centre".
 *
 * Opacity sits in the 16–24% band. Low enough that the copy sitting directly on
 * top of it stays comfortable to read, high enough that it reads as an actual
 * voice visualisation rather than a smudge. Nothing is painted in front of it:
 * the three steps float straight over the bars with no panel between.
 */

const BAR_COUNT = 72;
const VB_W = 1440;
const VB_H = 260;
const BAR_W = 9;
/** Padded window used on phones so `slice` exposes more of the wave. */
const MOBILE_VB_H = 900;

const BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const p = i / (BAR_COUNT - 1);

  // Louder in the middle, quieter at the ends — but only gently. A steeper
  // envelope left the outer two cards with almost nothing behind them, so the
  // wave has to stay full across all three.
  const envelope = 0.62 + 0.38 * Math.cos((p - 0.5) * Math.PI) ** 0.7;

  // Three detuned sines read as speech rather than a repeating pattern. The
  // spread is deliberately narrow: a wider one let the frames where all three
  // peak together tower over their neighbours and pull the eye off the copy,
  // which is the opposite of the soft band this is meant to be.
  const amplitude =
    0.63 + 0.13 * Math.sin(i * 0.55) + 0.1 * Math.sin(i * 0.23 + 1.3) + 0.07 * Math.sin(i * 1.07 + 0.6);

  const height = Math.max(16, VB_H * 0.78 * Math.min(1, Math.max(0.12, amplitude)) * envelope);

  return {
    x: p * (VB_W - BAR_W),
    y: (VB_H - height) / 2,
    height,
    // Negative delays start each bar mid-cycle, so nothing is ever in lockstep.
    delay: -((i * 0.47) % 7),
    duration: 7 + (i % 5) * 1.1,
  };
});

/**
 * Gradient + glow. Each viewBox variant gets its OWN ids: two SVGs carrying the
 * same `id` is invalid, and the second one then resolves its paint server and
 * filter to the copy inside the first — which is `display: none` at that
 * breakpoint. That left the desktop wave painting as a soft blurred haze with
 * no bars in it at all.
 */
function WaveDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2={VB_W} y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#c4b5fd" />
        <stop offset="30%" stopColor="#8b5cf6" />
        <stop offset="50%" stopColor="#4c1d95" />
        <stop offset="70%" stopColor="#7c3aed" />
        <stop offset="100%" stopColor="#c4b5fd" />
      </linearGradient>
      <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="10" />
      </filter>
    </defs>
  );
}

export default function WaveBackdrop({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();
  const uid = `csw${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const bars = (id: string, blurred: boolean) => (
    <g filter={blurred ? `url(#${id}-glow)` : undefined} opacity={blurred ? 0.85 : 1}>
      {BARS.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={bar.y}
          width={BAR_W}
          height={bar.height}
          rx={BAR_W / 2}
          fill={`url(#${id}-fill)`}
          style={
            reduced
              ? undefined
              : {
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: `cs-wave ${bar.duration}s ease-in-out ${bar.delay}s infinite`,
                }
          }
        />
      ))}
    </g>
  );

  return (
    <div
      aria-hidden="true"
      // Centred on its positioned parent (the card row), but `w-screen` so it
      // still runs edge to edge rather than being boxed by the container. A
      // percentage offset from the section top was fragile: it drifted into the
      // body copy whenever the paragraph wrapped to a different number of lines.
      // Mobile stacks the three cards into a tall column, so the wave fills that
      // whole column (inset-y-0) and runs behind all of them. From `sm` up the
      // cards sit in a row and the wave becomes a band centred on it.
      className={`pointer-events-none absolute inset-y-0 left-1/2 w-screen max-w-none -translate-x-1/2 select-none sm:inset-y-auto sm:top-1/2 sm:-translate-y-1/2 ${className}`}
      style={{
        // Fade both edges so the wave dissolves rather than being cropped.
        maskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
      }}
    >
      {/* Soft violet bloom under the loudest part of the wave */}
      <div
        className="absolute left-1/2 top-1/2 h-[240px] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80 blur-3xl sm:h-[320px]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(124,58,237,0.26) 0%, rgba(167,139,250,0.12) 45%, rgba(255,255,255,0) 72%)',
        }}
      />

      {/*
        Two viewBoxes, one drawing. `slice` scales to cover and crops, never
        stretches, so the bars keep their proportions at every width — but that
        also means a narrow, tall box exposes only a sliver of the wave. The
        mobile viewBox is therefore padded vertically (a 900-unit window around
        the same 260-unit band), which lets roughly three times as many bars
        through as the desktop box would at phone width. `none` was tried first
        and stretched the bars into scratchy hairlines.
      */}
      <svg
        viewBox={`0 ${(VB_H - MOBILE_VB_H) / 2} ${VB_W} ${MOBILE_VB_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full opacity-[0.16] sm:hidden"
      >
        <WaveDefs id={`${uid}m`} />
        {bars(`${uid}m`, true)}
        {bars(`${uid}m`, false)}
      </svg>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="hidden w-full sm:block sm:h-[250px] sm:opacity-[0.22] lg:h-[320px] lg:opacity-[0.24]"
      >
        <WaveDefs id={`${uid}d`} />
        {bars(`${uid}d`, true)}
        {bars(`${uid}d`, false)}
      </svg>
    </div>
  );
}
