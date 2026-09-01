import { motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, Check, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { LogoMark } from '../components/Logo';
import { checkResetToken, resetPassword } from '../services/api';
import { navigate, LOGIN_PATH } from '../routing';

/**
 * The page the emailed reset link opens: /reset-password?token=…
 *
 * The token is checked before the form is shown, so an expired link says so
 * straight away rather than after a new password has been typed. On success the
 * doctor is sent back to sign in, where the new password works immediately.
 */

const field =
  'w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100';

export default function ResetPassword() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [checking, setChecking] = useState(true);
  const [account, setAccount] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Validate the link on load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLinkError('This reset link is missing its token. Please request a new one.');
        setChecking(false);
        return;
      }
      try {
        const res = await checkResetToken(token);
        if (!cancelled) setAccount(res.email || '');
      } catch (err) {
        if (!cancelled) {
          setLinkError(
            err instanceof Error ? err.message : 'This reset link is invalid or has expired.',
          );
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Once the password is changed, hand the doctor back to the login screen.
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => navigate(LOGIN_PATH, { replace: true }), 2200);
    return () => window.clearTimeout(id);
  }, [done]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await resetPassword({ token, password, confirmPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-5 py-10">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <LogoMark size={44} />

        {checking ? (
          <p className="mt-8 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin text-brand-600" />
            Checking your reset link…
          </p>
        ) : linkError ? (
          <>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-brand-950 sm:text-3xl">
              This link has expired
            </h1>
            <p className="mt-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {linkError}
            </p>
            <button
              type="button"
              onClick={() => navigate(LOGIN_PATH, { replace: true })}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-700"
            >
              <ArrowLeft size={15} />
              Back to sign in
            </button>
          </>
        ) : done ? (
          <>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-brand-950 sm:text-3xl">
              Password reset successfully.
            </h1>
            <p className="mt-6 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <Check size={16} className="mt-0.5 flex-shrink-0" />
              You can now sign in with your new password. Taking you to the login page…
            </p>
            <button
              type="button"
              onClick={() => navigate(LOGIN_PATH, { replace: true })}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-700"
            >
              Go to sign in
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-brand-950 sm:text-3xl">
              Choose a new password
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {account ? `For ${account}. ` : ''}Make it at least 8 characters.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
              <div className="relative">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={field}
                  type="password"
                  placeholder="New password (8+ characters)"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <div className="relative">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={field}
                  type="password"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
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
                Reset password
              </button>
            </form>
          </>
        )}

        <p className="mt-8 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
          <ShieldCheck size={14} className="mt-px flex-shrink-0 text-brand-500" />
          <span>
            This link can be used once and expires shortly. Your new password is encrypted before
            it is stored and is never kept in this browser.
          </span>
        </p>
      </motion.div>
    </div>
  );
}
