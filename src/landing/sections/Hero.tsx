import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, PlayCircle } from 'lucide-react';
import HeroVisual from '../HeroVisual';
import { CountUp, EASE_OUT } from '../motion';
import { navigate, scrollToSection, SIGNUP_PATH } from '../../routing';

/**
 * Every number on this page is a real property of the product, not a marketing
 * invention: 18 = REPORT_SECTIONS.length, 11 = LANGUAGE_NAMES keys, 3 = the
 * TXT/PDF/DOCX export paths in utils/download.ts.
 */
const STATS = [
  { value: 18, suffix: '', label: 'Report sections' },
  { value: 11, suffix: '', label: 'Languages' },
  { value: 3, suffix: '', label: 'Export formats' },
];

export default function Hero({ animateIn }: { animateIn: boolean }) {
  const reduced = useReducedMotion();
  const rise = (delay: number) =>
    animateIn && !reduced
      ? { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: EASE_OUT } }
      : {};

  return (
    <section id="home" className="relative scroll-mt-24 overflow-hidden pt-[104px] pb-16 sm:pt-[128px] sm:pb-24">
      {/* Soft violet field behind the hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]"
        style={{
          background:
            'radial-gradient(60% 70% at 70% 20%, rgba(196,181,253,0.28) 0%, rgba(245,243,255,0.6) 40%, rgba(255,255,255,0) 75%)',
        }}
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        {/* Copy */}
        <div>
          <motion.div
            {...rise(0.05)}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            <span className="text-xs font-semibold tracking-wide text-brand-700">
              AI medical scribe for clinicians
            </span>
          </motion.div>

          <motion.h1
            {...rise(0.12)}
            className="text-4xl font-bold leading-[1.1] tracking-tight text-brand-950 sm:text-5xl lg:text-[3.4rem]"
          >
            Let CareScribe Handle the Notes.
            <br className="hidden sm:block" />{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              You Focus on the Patient.
            </span>
          </motion.h1>

          <motion.p {...rise(0.2)} className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            CareScribe AI listens to your consultation, converts conversations into accurate
            transcripts, and transforms them into structured clinical documentation — so doctors can
            spend less time documenting and more time caring for patients.
          </motion.p>

          <motion.div {...rise(0.28)} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => navigate(SIGNUP_PATH)}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-600/30"
            >
              Start Your Free Consultation
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              <PlayCircle size={17} />
              See How It Works
            </button>
          </motion.div>

          <motion.dl {...rise(0.36)} className="mt-12 flex flex-wrap gap-x-10 gap-y-5">
            {STATS.map(stat => (
              <div key={stat.label}>
                <dt className="text-2xl font-bold tracking-tight text-brand-950 sm:text-3xl">
                  <CountUp to={stat.value} suffix={stat.suffix} />
                </dt>
                <dd className="mt-0.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                  {stat.label}
                </dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* Visual */}
        <motion.div {...rise(0.22)} className="lg:pl-4">
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}
