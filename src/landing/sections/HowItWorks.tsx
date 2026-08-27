import { motion, useReducedMotion } from 'motion/react';
import { MousePointerClick, Ear, Sparkles, CheckCircle2 } from 'lucide-react';
import { Reveal, EASE_OUT } from '../motion';

const STEPS = [
  {
    icon: MousePointerClick,
    title: 'Start Consultation',
    body: 'Doctor starts a consultation with one click.',
  },
  {
    icon: Ear,
    title: 'CareScribe Listens',
    body: 'The consultation is captured and converted into a transcript.',
  },
  {
    icon: Sparkles,
    title: 'AI Generates Documentation',
    body: 'CareScribe organizes the conversation into clinically useful information.',
  },
  {
    icon: CheckCircle2,
    title: 'Review & Save',
    body: 'Doctor reviews the generated report and saves it to the patient record.',
  },
];

export default function HowItWorks() {
  const reduced = useReducedMotion();

  return (
    <section id="how-it-works" className="scroll-mt-24 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              How It Works
            </span>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-950 sm:text-4xl">
              From spoken visit to signed note, in four steps.
            </h2>
          </Reveal>
        </div>

        <div className="relative mt-16">
          {/* Connecting rail — draws itself once the section scrolls in */}
          <div
            aria-hidden="true"
            className="absolute left-8 top-8 hidden h-px w-[calc(100%-4rem)] bg-slate-200 lg:block"
          />
          <motion.div
            aria-hidden="true"
            className="absolute left-8 top-8 hidden h-px w-[calc(100%-4rem)] origin-left bg-gradient-to-r from-brand-600 via-brand-500 to-brand-300 lg:block"
            initial={reduced ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-120px' }}
            transition={{ duration: 1.1, ease: EASE_OUT }}
          />

          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.title} delay={0.12 + i * 0.12} as="li">
                  <div className="relative">
                    <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-100 bg-white text-brand-600 shadow-sm">
                      <Icon size={24} strokeWidth={2} />
                      <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-6 text-base font-bold tracking-tight text-brand-950">
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-slate-600">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
