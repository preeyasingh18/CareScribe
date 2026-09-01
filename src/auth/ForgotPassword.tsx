import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2, Mail, MailCheck, ShieldCheck } from 'lucide-react';
import { requestPasswordReset } from '../services/api';

/**
 * Step one of a password reset: ask where to send the link.
 *
 * Nothing is simulated — the confirmation below only appears after the server
 * reports that Gmail accepted the message. A server that cannot send (missing
 * or rejected credentials) returns an error, and that error is what the doctor
 * sees, rather than a false "check your inbox".
 */

const field =
  'w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100';

export default function ForgotPassword({ onBackToLogin }: { onBackToLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      const res = await requestPasswordReset(email.trim());
      setSentMessage(res.message || 'If that email has a CareScribe account, a reset link is on its way.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="w-full max-w-md"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        type="button"
        onClick={onBackToLogin}
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand-700"
      >
        <ArrowLeft size={15} />
        Back to sign in
      </button>

      <h1 className="mt-5 text-2xl font-bold tracking-tight text-brand-950 sm:text-3xl">
        {sentMessage ? 'Check your inbox' : 'Reset your password'}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {sentMessage
          ? 'Open the link in the email to choose a new password.'
          : 'Enter the email address on your CareScribe account and we will send you a reset link.'}
      </p>

      {sentMessage ? (
        <div className="mt-8 space-y-4">
          <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <MailCheck size={16} className="mt-0.5 flex-shrink-0" />
            {sentMessage}
          </p>
          <p className="text-xs leading-relaxed text-slate-500">
            The link expires in 30 minutes and can be used once. If it does not arrive, check your
            spam folder, then try again.
          </p>
          <button
            type="button"
            onClick={onBackToLogin}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-700"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
          <div className="relative">
            <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={field}
              type="email"
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <motion.p
              role="alert"
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
            Send reset link
          </button>
        </form>
      )}

      <p className="mt-8 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
        <ShieldCheck size={14} className="mt-px flex-shrink-0 text-brand-500" />
        <span>
          Reset links can be used once and expire in minutes. Your existing password is never shown
          or emailed to you.
        </span>
      </p>
    </motion.div>
  );
}
