import { motion, useReducedMotion } from 'motion/react';
import BrandLogo from '../components/BrandLogo';

/**
 * Shown while the session check is in flight.
 *
 * Deliberately quiet — a mark and a breathing underline, no spinner. The point
 * is to occupy the gap without implying "something is loading forever", and to
 * stop either the dashboard or the login screen from flashing before we know
 * which one the visitor is entitled to.
 */
export default function AuthLoading() {
  const reduced = useReducedMotion();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-[420px] w-[420px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(124,58,237,0.10) 0%, rgba(167,139,250,0.05) 45%, rgba(255,255,255,0) 70%)',
        }}
      />

      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <BrandLogo size={64} priority />
      </motion.div>

      <div className="relative mt-6 text-lg font-bold tracking-tight">
        <span className="text-brand-950">Care</span>
        <span className="text-brand-600">Scribe</span>
        <span className="ml-1 align-top text-[10px] font-semibold text-brand-400">AI</span>
      </div>

      {/* Indeterminate progress rail — a track with a violet sweep. */}
      <div className="relative mt-5 h-[3px] w-32 overflow-hidden rounded-full bg-brand-100">
        <motion.div
          className="h-full w-1/2 rounded-full bg-brand-500"
          animate={reduced ? { x: 0 } : { x: ['-100%', '200%'] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <span className="sr-only">Checking your session…</span>
    </div>
  );
}
