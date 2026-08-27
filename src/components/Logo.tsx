import { useId } from 'react';

interface LogoProps {
  /** When provided, the logo renders as a clickable button (e.g. back to dashboard). */
  onClick?: () => void;
  /** Extra classes for the outer element (e.g. responsive visibility). */
  className?: string;
  /** Use the light wordmark + light mark on dark surfaces (e.g. the sidebar). */
  light?: boolean;
  /** Render the "LISTENS · TRANSCRIBES · CARES" strapline under the wordmark. */
  tagline?: boolean;
  /** Mark size in px. */
  size?: number;
}

interface MarkProps {
  size?: number;
  className?: string;
  /** Light cut for dark surfaces — the full-colour mark's deep violets vanish on brand-950. */
  light?: boolean;
  /** Force a cut instead of picking one from `size`. */
  variant?: 'full' | 'compact';
}

/**
 * The approved mark is the C + microphone, so that is what every caller gets by
 * default at every size. The older detailed lockup (note, cross, transcript
 * lines, stethoscope) is still drawn below and can be requested explicitly with
 * variant="full", but nothing in the app does — size alone must never silently
 * switch which logo is rendered.
 */
const DEFAULT_VARIANT: 'full' | 'compact' = 'compact';

/**
 * The CareScribe brand mark, traced from the master logo: an open violet "C"
 * ring wrapped around a clinical note (medical cross + transcript lines +
 * waveform), a microphone over it, and a stethoscope chest-piece holding a
 * heart.
 *
 * This is the single source of truth — every page/header must use <Logo/> so
 * the mark, wordmark, size, weight, spacing and colors stay identical
 * everywhere. `public/logo.svg` holds a byte-equivalent standalone copy of the
 * full cut for use outside React.
 */
export function LogoMark({ size = 36, className = '', light = false, variant }: MarkProps) {
  // Gradient ids must be unique per instance, otherwise a second mark on the
  // page silently re-uses the first one's defs.
  const uid = useId().replace(/:/g, '');
  const ringId = `cs-ring-${uid}`;
  const micId = `cs-mic-${uid}`;

  const cut = variant ?? DEFAULT_VARIANT;

  // On dark surfaces the mark is redrawn in lavender/white; the full-colour
  // ring bottoms out at brand-900, which is invisible against a brand-950 rail.
  const ringStops = light
    ? ['#c4b5fd', '#ddd6fe', '#ffffff']
    : ['#4c1d95', '#7c3aed', '#a78bfa'];
  const ink = light ? '#ffffff' : '#2e1065';

  const common = {
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    fill: 'none' as const,
    role: 'img' as const,
    'aria-label': 'CareScribe',
    className,
  };

  const ringGradient = (
    <linearGradient id={ringId} x1="10" y1="50" x2="48" y2="12" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor={ringStops[0]} />
      <stop offset="55%" stopColor={ringStops[1]} />
      <stop offset="100%" stopColor={ringStops[2]} />
    </linearGradient>
  );

  if (cut === 'compact') {
    return (
      <svg {...common}>
        <defs>{ringGradient}</defs>
        {/* open "C" */}
        <path
          d="M44.23 20.19A17 17 0 1 0 44.23 43.81"
          stroke={`url(#${ringId})`}
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* microphone */}
        <rect x="28.5" y="20" width="7" height="13" rx="3.5" fill={light ? '#ffffff' : '#7c3aed'} />
        <g stroke={ink} strokeWidth="2.6" strokeLinecap="round">
          <path d="M25.5 30.5A6.5 6.5 0 0 0 38.5 30.5" />
          <path d="M32 37V42" />
          <path d="M27 42h10" />
        </g>
      </svg>
    );
  }

  return (
    <svg {...common}>
      <defs>
        {ringGradient}
        <linearGradient id={micId} x1="42" y1="26" x2="42" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={light ? '#ffffff' : '#9b7bf7'} />
          <stop offset="100%" stopColor={light ? '#c4b5fd' : '#6d28d9'} />
        </linearGradient>
      </defs>

      {/* The open "C" — gap on the right, where the note and stethoscope sit */}
      <path
        d="M42.12 18.29A19 19 0 1 0 42.12 43.71"
        stroke={`url(#${ringId})`}
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* Clinical note with a folded corner */}
      <path
        d="M27 15h13.5l6 6v21.5A2.5 2.5 0 0 1 44 45H27a2.5 2.5 0 0 1-2.5-2.5v-25A2.5 2.5 0 0 1 27 15Z"
        fill="#ede9fe"
      />
      <path d="M40.5 15l6 6h-4a2 2 0 0 1-2-2v-4Z" fill="#c4b5fd" />

      {/* Medical cross */}
      <rect x="29.4" y="18.3" width="3.2" height="8.4" rx="1.2" fill="#7c3aed" />
      <rect x="26.8" y="20.9" width="8.4" height="3.2" rx="1.2" fill="#7c3aed" />

      {/* Transcript lines */}
      <rect x="26.8" y="29.5" width="16" height="1.9" rx="0.95" fill="#a78bfa" />
      <rect x="26.8" y="33.5" width="12.5" height="1.9" rx="0.95" fill="#a78bfa" />

      {/* Waveform */}
      <rect x="26.8" y="38" width="1.3" height="4" rx="0.65" fill="#7c3aed" />
      <rect x="29.5" y="36" width="1.3" height="8" rx="0.65" fill="#7c3aed" />
      <rect x="32.2" y="35" width="1.3" height="10" rx="0.65" fill="#7c3aed" />
      <rect x="34.9" y="37.25" width="1.3" height="5.5" rx="0.65" fill="#7c3aed" />

      {/* Microphone */}
      <rect x="38.5" y="26" width="7" height="13" rx="3.5" fill={`url(#${micId})`} />
      <g stroke={ink} strokeWidth="2.4" strokeLinecap="round">
        <path d="M36 34.5A6 6 0 0 0 48 34.5" />
        <path d="M42 40.5V46" />
        <path d="M37.5 46h9" />
        {/* Stethoscope tubing into the chest piece */}
        <path d="M48 34.5c3.5 0 5-2 5-4.3" />
      </g>

      {/* Stethoscope chest piece with heart */}
      <circle cx="53" cy="24" r="6.2" fill={light ? '#2e1065' : '#ffffff'} stroke={ink} strokeWidth="2.4" />
      <path
        d="M53 27.1c-3.2-2.05-3.8-3.2-3.8-4.35a2.15 2.15 0 0 1 3.8-1.3 2.15 2.15 0 0 1 3.8 1.3c0 1.15-.6 2.3-3.8 4.35Z"
        fill={light ? '#c4b5fd' : '#7c3aed'}
      />
    </svg>
  );
}

export default function Logo({
  onClick,
  className = '',
  light = false,
  tagline = false,
  size = 38,
}: LogoProps) {
  const inner = (
    <>
      <LogoMark size={size} light={light} className="flex-shrink-0" />
      <div className="flex flex-col leading-none">
        <span className="font-bold text-xl tracking-tight">
          <span className={light ? 'text-white' : 'text-brand-950'}>Care</span>
          <span className={light ? 'text-brand-300' : 'text-brand-600'}>Scribe</span>
          <span className={`ml-1 align-top text-xs font-semibold ${light ? 'text-brand-400' : 'text-brand-400'}`}>
            AI
          </span>
        </span>
        {tagline && (
          <span
            // Sized to clear the 256px sidebar rail on one line — the strapline
            // reads as a rule under the wordmark, so a wrap breaks the lockup.
            className={`mt-1.5 whitespace-nowrap text-[8px] font-semibold uppercase tracking-[0.08em] ${
              light ? 'text-brand-400' : 'text-brand-500'
            }`}
          >
            Listens · Transcribes · Cares
          </span>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-2.5 cursor-pointer transition-opacity hover:opacity-80 ${className}`}
      >
        {inner}
      </button>
    );
  }

  return <div className={`flex items-center gap-2.5 ${className}`}>{inner}</div>;
}
