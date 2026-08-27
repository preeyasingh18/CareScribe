import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

/**
 * A minimal toast, mounted once at the root.
 *
 * It lives above the landing/auth/dashboard surface switch on purpose: the
 * message that matters most — "Signed out successfully." — is raised by a
 * screen that unmounts in the same tick, so a toast owned by that screen would
 * never be seen.
 */

const EVENT = 'carescribe:toast';
const VISIBLE_MS = 3200;

export function showToast(message: string): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

export default function Toaster() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer = 0;

    const onToast = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), VISIBLE_MS);
    };

    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[200] flex justify-center px-4"
    >
      <AnimatePresence>
        {message && (
          <motion.div
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-brand-950 px-4 py-3 text-sm font-medium text-white shadow-xl shadow-brand-950/25"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-500">
              <Check size={12} strokeWidth={3} />
            </span>
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
