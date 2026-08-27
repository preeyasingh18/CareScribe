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
  return (
    <section
      id="about"
      className="relative scroll-mt-24 overflow-hidden border-y border-slate-100 bg-slate-50/60 py-20 sm:py-28"
    >
      <WaveBackdrop />

      {/* Content sits above the backdrop; the cards are opaque so the wave
          never reads through their text. */}
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

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <Reveal key={pillar.title} delay={0.1 + i * 0.09}>
                <div className="group h-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-950/5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors duration-300 group-hover:bg-brand-600 group-hover:text-white">
                    <Icon size={22} strokeWidth={2.1} />
                  </div>
                  <h3 className="mt-5 text-lg font-bold tracking-tight text-brand-950">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{pillar.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
