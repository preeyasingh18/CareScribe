import { useState } from 'react';
import { Mic, Brain, FileText } from 'lucide-react';
import { Reveal } from '../motion';
import WaveBackdrop from '../WaveBackdrop';

const PILLARS = [
  {
    icon: Mic,
    title: 'Listen',
    body: 'Capture the consultation through voice.',
  },
  {
    icon: Brain,
    title: 'Understand',
    body: 'AI processes the conversation and identifies clinically relevant information.',
  },
  {
    icon: FileText,
    title: 'Document',
    body: 'Generate structured reports and documentation automatically.',
  },
];

export default function About() {
  // Nothing is highlighted until the visitor picks a step, and the pick then
  // sticks until another one is chosen. Selection is the same on every device:
  // hover only previews it, so touch screens lose nothing.
  const [active, setActive] = useState<number | null>(null);

  return (
    <section
      id="about"
      className="relative scroll-mt-24 overflow-hidden border-y border-slate-100 bg-slate-50/60 py-20 sm:py-28"
    >
      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              About CareScribe
            </span>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-950 sm:text-4xl">
              Clinical Documentation, Reimagined.
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-5 text-base leading-relaxed text-slate-600">
              CareScribe is an AI-powered medical scribe designed to reduce the burden of clinical
              documentation. It captures consultation conversations, generates accurate transcripts,
              and helps doctors create structured clinical reports and prescriptions with minimal
              manual effort.
            </p>
          </Reveal>
        </div>

        {/* The waveform is the visual of this section: the three steps float
            straight over it with no panel of any kind between them and it. The
            wave lives inside this wrapper so it always tracks the steps rather
            than a fixed offset from the section top, which drifted into the
            copy above whenever the paragraph wrapped differently. */}
        <div className="relative mt-14 sm:mt-16">
          <WaveBackdrop />

          <div className="relative grid items-start gap-10 sm:grid-cols-3 sm:gap-5 lg:gap-10">
            {PILLARS.map((pillar, i) => {
              const Icon = pillar.icon;
              const isActive = active === i;
              return (
                <Reveal key={pillar.title} delay={0.1 + i * 0.09}>
                  <button
                    type="button"
                    aria-pressed={isActive}
                    data-active={isActive}
                    onClick={() => setActive(i)}
                    className="pillar-step flex w-full cursor-pointer flex-col items-center px-2 py-3 text-center sm:px-1 lg:px-3"
                  >
                    <span className="pillar-step-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-full">
                      <Icon size={24} strokeWidth={2} />
                    </span>
                    <span className="pillar-step-title mt-4 text-base font-bold tracking-tight sm:text-lg">
                      {pillar.title}
                    </span>
                    <span className="pillar-step-body mt-2 max-w-[34ch] text-sm leading-relaxed">
                      {pillar.body}
                    </span>
                  </button>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
