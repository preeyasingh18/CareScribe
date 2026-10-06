import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Loader2, Lock, ShieldAlert } from 'lucide-react';
import { adminLogin } from './adminApi';
import BrandLogo from '../components/BrandLogo';

/**
 * The password screen shown at /admin before anything else.
 *
 * The password is judged entirely by the server. This component holds the typed
 * value only long enough to post it, compares it against nothing, and knows no
 * expected value to compare it against — a wrong guess is a 401 from the API,
 * not a branch in this file.
 */
export default function AdminGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (!password) {
      setError('Please enter the admin password.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await adminLogin(password);
      setPassword(''); // don't leave it sitting in component state
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect password');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <BrandLogo size={34} priority />
          <span className="text-lg font-bold tracking-tight text-brand-950">CareScribe</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Lock size={19} strokeWidth={2.1} />
          </div>

          <h1 className="mt-5 text-xl font-bold tracking-tight text-brand-950">Admin Access</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Enter the admin password to continue.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <div className="relative">
              <input
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                type={visible ? 'text' : 'password'}
                placeholder="Admin password"
                autoComplete="off"
                aria-label="Admin password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setVisible(v => !v)}
                aria-label={visible ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:text-slate-600"
              >
                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <motion.p
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ShieldAlert size={15} className="mt-0.5 flex-shrink-0" />
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Continue
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          This area is restricted and view-only.
        </p>
      </motion.div>
    </div>
  );
}
