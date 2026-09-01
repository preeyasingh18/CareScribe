import {
  Mic,
  Bot,
  ClipboardList,
  Pill,
  Users,
  History,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Reveal } from '../motion';

/** Each card maps to something the dashboard actually does today. */
const FEATURES = [
  {
    icon: Mic,
    title: 'Real-Time Transcription',
    body: 'Speech becomes text as the consultation happens, in English or 10 Indian languages.',
  },
  {
    icon: Bot,
    title: 'AI Clinical Reports',
    body: 'The transcript is turned into a draft clinical note you review before saving.',
  },
  {
    icon: ClipboardList,
    title: 'Structured Documentation',
    body: 'Complaints, history, examination, assessment and plan, each in its own section.',
  },
  {
    icon: Pill,
    title: 'Prescription Generation',
    body: 'Medicines, strength, frequency and duration pulled straight from the conversation.',
  },
  {
    icon: Users,
    title: 'Patient Management',
    body: 'One record per patient, with every visit attached to it.',
  },
  {
    icon: History,
    title: 'Consultation History',
    body: 'Reopen any past session and compare it against the previous visit.',
  },
  {
    icon: Search,
    title: 'Searchable Transcripts',
    body: 'Find a session by patient or date without scrolling through a list.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Medical Data',
    body: 'Your information is securely stored with privacy and security in mind.',
  },
];

export default function Features() {
  return (
    <section id="features" className="scroll-mt-24 border-y border-slate-100 bg-slate-50/60 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              Features
            </span>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-brand-950 sm:text-4xl">
              Everything a consultation needs, in one place.
            </h2>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delay={0.04 + (i % 4) * 0.07}>
                <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-950/5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-all duration-300 group-hover:scale-105 group-hover:bg-brand-600 group-hover:text-white">
                    <Icon size={20} strokeWidth={2.1} />
                  </div>
                  <h3 className="mt-4 text-sm font-bold tracking-tight text-brand-950">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{feature.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
