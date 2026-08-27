import { ArrowRight } from 'lucide-react';
import { Reveal } from '../motion';
import Waveform from '../Waveform';
import { navigate, SIGNUP_PATH } from '../../routing';

export default function CtaBand() {
  return (
    <section className="px-5 pb-20 sm:px-8 sm:pb-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 px-7 py-14 text-center sm:px-14 sm:py-20">
            {/* Ambient light + waveform texture */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-brand-300/15 blur-3xl"
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 opacity-20">
              <Waveform bars={48} height={72} color="bg-brand-200" className="w-full" />
            </div>

            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                Spend More Time Caring. Less Time Documenting.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-brand-200 sm:text-base">
                Join doctors using AI to simplify clinical documentation and make every consultation
                more efficient.
              </p>
              <button
                type="button"
                onClick={() => navigate(SIGNUP_PATH)}
                className="group mt-9 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-brand-700 shadow-xl shadow-brand-950/20 transition-all hover:-translate-y-0.5 hover:bg-brand-50"
              >
                Get Started with CareScribe
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
