import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2, Lock, Mail, ShieldCheck, Stethoscope, User } from 'lucide-react';
import { LogoMark } from '../components/Logo';
import Waveform from '../landing/Waveform';
import { EASE_OUT } from '../landing/motion';
import { useAuth } from './AuthContext';
import ForgotPassword from './ForgotPassword';
import { navigate, LANDING_PATH, LOGIN_PATH, SIGNUP_PATH, HOME_PATH } from '../routing';

const HIGHLIGHTS = [
  'Record the visit — CareScribe transcribes it as you talk.',
  'Get a structured draft report across 18 clinical sections.',
  'Review, edit and save straight to the patient record.',
];

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp } = useAuth();
  const isSignup = mode === 'signup';

  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Password reset takes over the form panel; the brand panel stays as it is.
  const [forgot, setForgot] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    // Mirrors server/auth.ts validateSignup — the server still enforces all of
    // this, but catching it here saves a round trip and reads better.
    if (isSignup) {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setBusy(true);
    try {
      if (isSignup) {
        // confirmPassword goes to the server too, so the match is enforced
        // there as well and not only by this form.
        await signUp({ name, email, password, confirmPassword, specialization });
      } else {
        await signIn(email, password);
      }
      navigate(HOME_PATH, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100';

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-12 lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-brand-300/15 blur-3xl"
        />

        <button
          type="button"
          onClick={() => navigate(LANDING_PATH)}
          className="relative flex items-center gap-2.5 self-start transition-opacity hover:opacity-80"
        >
          <LogoMark size={38} light />
          <span className="text-xl font-bold tracking-tight">
            <span className="text-white">Care</span>
            <span className="text-brand-300">Scribe</span>
          </span>
        </button>

        <div className="relative">
          <h2 className="max-w-sm text-3xl font-bold leading-tight tracking-tight text-white">
            Spend more time caring. Less time documenting.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((line, i) => (
              <motion.li
                key={line}
                className="flex items-start gap-3 text-sm leading-relaxed text-brand-200"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.1, ease: EASE_OUT }}
              >
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-400" />
                {line}
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <Waveform bars={28} height={30} color="bg-brand-400/70" className="justify-start" />
          <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-400">
            Listens · Transcribes · Cares
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        {forgot ? (
          <ForgotPassword
            onBackToLogin={() => {
              setForgot(false);
              setError(null);
              navigate(LOGIN_PATH);
            }}
          />
        ) : (
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
        >
          <button
            type="button"
            onClick={() => navigate(LANDING_PATH)}
            className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand-700"
          >
            <ArrowLeft size={15} />
            Back to home
          </button>

          <div className="lg:hidden">
            <LogoMark size={44} />
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight text-brand-950 sm:text-3xl">
            {isSignup ? 'Create your CareScribe account' : 'Welcome back, doctor'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isSignup
              ? 'Set up your account to start documenting consultations.'
              : 'Sign in to reach your dashboard and patient records.'}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            {isSignup && (
              <>
                <div className="relative">
                  <User size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className={field}
                    placeholder="Full name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Stethoscope size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className={field}
                    placeholder="Specialization (optional)"
                    value={specialization}
                    onChange={e => setSpecialization(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="relative">
              <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={field}
                type="email"
                placeholder="Email address"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={field}
                type="password"
                placeholder={isSignup ? 'Create a password (8+ characters)' : 'Password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {isSignup && (
              <div className="relative">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={field}
                  type="password"
                  placeholder="Confirm password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
            )}

            {!isSignup && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setForgot(true);
                  }}
                  className="text-xs font-medium text-slate-500 transition-colors hover:text-brand-700"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <motion.p
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {isSignup ? 'Already have an account?' : 'New to CareScribe?'}{' '}
            <button
              type="button"
              onClick={() => navigate(isSignup ? LOGIN_PATH : SIGNUP_PATH)}
              className="font-semibold text-brand-600 transition-colors hover:text-brand-700"
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>

          <p className="mt-8 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
            <ShieldCheck size={14} className="mt-px flex-shrink-0 text-brand-500" />
            <span>
              Your password is encrypted before it is stored and is never kept in this browser.
              Your sign-in stays private to you.
            </span>
          </p>
        </motion.div>
        )}
      </div>
    </div>
  );
}
