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
 * Opacity is kept in the 6–11% band: present enough to feel intentional, far
 * too faint to compete with the text sitting on top of it.
 */

const BAR_COUNT = 72;
const VB_W = 1440;
const VB_H = 260;
const BAR_W = 9;

const BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const p = i / (BAR_COUNT - 1);

  // Louder in the middle, silent at both ends.
  const envelope = Math.cos((p - 0.5) * Math.PI) ** 1.35;

  // Three detuned sines read as speech rather than a repeating pattern.
  const amplitude =
    0.42 + 0.26 * Math.sin(i * 0.55) + 0.18 * Math.sin(i * 0.23 + 1.3) + 0.12 * Math.sin(i * 1.07 + 0.6);

  const height = Math.max(14, VB_H * 0.92 * Math.min(1, Math.max(0.1, amplitude)) * envelope);

  return {
    x: p * (VB_W - BAR_W),
    y: (VB_H - height) / 2,
    height,
    // Negative delays start each bar mid-cycle, so nothing is ever in lockstep.
    delay: -((i * 0.47) % 7),
    duration: 7 + (i % 5) * 1.1,
  };
});

export default function WaveBackdrop({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();

  const bars = (blurred: boolean) => (
    <g filter={blurred ? 'url(#cs-wave-glow)' : undefined} opacity={blurred ? 0.85 : 1}>
      {BARS.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={bar.y}
          width={BAR_W}
          height={bar.height}
          rx={BAR_W / 2}
          fill="url(#cs-wave-fill)"
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
      className={`pointer-events-none absolute inset-x-0 top-[52%] -translate-y-1/2 select-none ${className}`}
      style={{
        // Fade both edges so the wave dissolves rather than being cropped.
        maskImage: 'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0%, black 22%, black 78%, transparent 100%)',
      }}
    >
      {/* Soft violet bloom under the loudest part of the wave */}
      <div
        className="absolute left-1/2 top-1/2 h-[220px] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl sm:h-[300px]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(124,58,237,0.22) 0%, rgba(167,139,250,0.10) 45%, rgba(255,255,255,0) 72%)',
        }}
      />

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-[150px] w-full opacity-[0.07] sm:h-[230px] sm:opacity-[0.10] lg:h-[300px] lg:opacity-[0.11]"
      >
        <defs>
          <linearGradient id="cs-wave-fill" x1="0" y1="0" x2={VB_W} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="30%" stopColor="#8b5cf6" />
            <stop offset="50%" stopColor="#4c1d95" />
            <stop offset="70%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#c4b5fd" />
          </linearGradient>
          <filter id="cs-wave-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        {/* Blurred copy first — this is the glow the crisp bars sit inside. */}
        {bars(true)}
        {bars(false)}
      </svg>
    </div>
  );
}
