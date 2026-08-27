import { motion, useReducedMotion } from 'motion/react';
import { X, Check, ArrowRight } from 'lucide-react';
import { Reveal, EASE_OUT } from '../motion';

const WITHOUT = [
  'Manually typing notes',
  'Looking away from the patient',
  'Time-consuming documentation',
  'Repetitive administrative work',
  'End-of-day paperwork',
];

const WITH = [
  'Focus on the patient',
  'Automatic transcription',
  'AI-generated documentation',
  'Faster consultations',
  'Organized patient records',
];

export default function BeforeAfter() {
  const reduced = useReducedMotion();

  const item = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, x: -12 },
          whileInView: { opacity: 1, x: 0 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.45, delay: 0.15 + i * 0.08, ease: EASE_OUT },
        };

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              The difference
            </span>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-950 sm:text-4xl">
              The same consultation, two very different days.
            </h2>
          </Reveal>
        </div>

        <div className="relative mt-14 grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-4">
          {/* Without */}
          <Reveal>
            <div className="h-full rounded-2xl border border-slate-200 bg-slate-50 p-7">
              <h3 className="text-lg font-bold tracking-tight text-slate-700">Without CareScribe</h3>
              <ul className="mt-6 space-y-3.5">
                {WITHOUT.map((line, i) => (
                  <motion.li key={line} {...item(i)} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                      <X size={12} strokeWidth={3} />
                    </span>
                    <span className="text-sm text-slate-600">{line}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Transition arrow */}
          <Reveal delay={0.2}>
            <div className="flex items-center justify-center lg:px-2">
              <motion.div
                className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/25"
                animate={reduced ? undefined : { y: [0, -5, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <ArrowRight size={20} className="rotate-90 lg:rotate-0" />
              </motion.div>
            </div>
          </Reveal>

          {/* With */}
          <Reveal delay={0.1}>
            <div className="relative h-full overflow-hidden rounded-2xl border border-brand-200 bg-white p-7 shadow-lg shadow-brand-950/5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-100/70 blur-2xl"
              />
              <h3 className="relative text-lg font-bold tracking-tight text-brand-700">
                With CareScribe
              </h3>
              <ul className="relative mt-6 space-y-3.5">
                {WITH.map((line, i) => (
                  <motion.li key={line} {...item(i)} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="text-sm font-medium text-slate-700">{line}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
