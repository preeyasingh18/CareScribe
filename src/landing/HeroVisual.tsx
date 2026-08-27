import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Mic, AudioLines, Sparkles, FileText, Check } from 'lucide-react';
import Waveform from './Waveform';
import { Float, EASE_OUT } from './motion';

/**
 * The hero's product visual: the CareScribe pipeline running on a loop —
 * consultation captured, waveform transcribed, AI structuring it, clinical
 * report produced. Abstract on purpose; no stock photography, no fake UI
 * screenshot claiming to be the real dashboard.
 */

const STAGES = [
  { icon: Mic, label: 'Consultation', caption: 'Recording the visit' },
  { icon: AudioLines, label: 'Transcript', caption: 'Speech to text, verbatim' },
  { icon: Sparkles, label: 'AI Processing', caption: 'Finding the clinical facts' },
  { icon: FileText, label: 'Clinical Report', caption: '18 structured sections' },
] as const;

const STAGE_MS = 1900;

export default function HeroVisual() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(reduced ? STAGES.length - 1 : 0);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setActive(i => (i + 1) % STAGES.length), STAGE_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div className="relative">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 -z-10 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(circle at 60% 40%, rgba(167,139,250,0.35) 0%, rgba(196,181,253,0.12) 45%, rgba(255,255,255,0) 70%)',
        }}
      />

      <Float amplitude={10} duration={7}>
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-xl shadow-brand-950/5 backdrop-blur-sm sm:p-6">
          {/* Live capture strip */}
          <div className="mb-5 flex items-center gap-3 rounded-2xl bg-brand-950 px-4 py-3.5">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              {!reduced && (
                <motion.span
                  className="absolute inline-flex h-full w-full rounded-full bg-red-400"
                  animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">
              Listening
            </span>
            <Waveform bars={22} height={26} color="bg-brand-400" className="ml-auto" />
          </div>

          {/* Pipeline */}
          <ol className="relative space-y-1">
            {/* Connecting rail */}
            <span
              aria-hidden="true"
              className="absolute left-[19px] top-6 bottom-6 w-px bg-slate-200"
            />
            <motion.span
              aria-hidden="true"
              className="absolute left-[19px] top-6 w-px origin-top bg-brand-500"
              style={{ bottom: 24 }}
              animate={{ scaleY: (active + 1) / STAGES.length }}
              transition={{ duration: 0.55, ease: EASE_OUT }}
            />

            {STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const done = i < active;
              const current = i === active;
              return (
                <li key={stage.label} className="relative flex items-center gap-3.5 py-2">
                  <motion.span
                    className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-colors ${
                      current
                        ? 'border-brand-500 bg-brand-600 text-white'
                        : done
                          ? 'border-brand-200 bg-brand-50 text-brand-600'
                          : 'border-slate-200 bg-white text-slate-400'
                    }`}
                    animate={
                      current && !reduced
                        ? { boxShadow: ['0 0 0 0 rgba(124,58,237,0.35)', '0 0 0 10px rgba(124,58,237,0)'] }
                        : undefined
                    }
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  >
                    {done ? <Check size={17} strokeWidth={2.6} /> : <Icon size={17} strokeWidth={2.2} />}
                  </motion.span>

                  <div className="min-w-0">
                    <div
                      className={`text-sm font-semibold transition-colors ${
                        current ? 'text-brand-950' : done ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      {stage.label}
                    </div>
                    <div className="truncate text-xs text-slate-500">{stage.caption}</div>
                  </div>

                  {current && (
                    <motion.span
                      className="ml-auto flex-shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-700"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      Active
                    </motion.span>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Report preview — fills in as the last stage lands */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <FileText size={14} className="text-brand-600" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Clinical Report
              </span>
            </div>
            <div className="space-y-2">
              {[100, 82, 91, 64].map((w, i) => (
                <motion.div
                  key={i}
                  className="h-2 rounded-full bg-brand-200"
                  style={{ maxWidth: `${w}%` }}
                  initial={reduced ? false : { scaleX: 0, originX: 0 }}
                  animate={{ scaleX: active === STAGES.length - 1 ? 1 : 0.12 }}
                  transition={{ duration: 0.5, delay: i * 0.09, ease: EASE_OUT }}
                />
              ))}
            </div>
          </div>
        </div>
      </Float>

      {/* Floating stat chips */}
      <Float amplitude={12} duration={6} delay={0.6} className="absolute -left-7 -top-7 hidden lg:block">
        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg shadow-brand-950/5">
          <div className="text-xs font-bold text-brand-950">11 languages</div>
          <div className="text-[10px] text-slate-500">Indian + English</div>
        </div>
      </Float>

      <Float amplitude={10} duration={8} delay={1.2} className="absolute -bottom-7 -right-7 hidden lg:block">
        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg shadow-brand-950/5">
          <div className="text-xs font-bold text-brand-950">PDF · DOCX · TXT</div>
          <div className="text-[10px] text-slate-500">One-click export</div>
        </div>
      </Float>
    </div>
  );
}
