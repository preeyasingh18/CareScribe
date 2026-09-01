import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';
import { useAuth, initialsFor } from '../auth/AuthContext';

/**
 * The signed-in doctor, pinned to the bottom of the sidebar, with a popover for
 * profile / settings / sign out.
 *
 * Everything shown comes from the authenticated session — nothing here is
 * hardcoded. The avatar falls back to initials derived from the doctor's own
 * name, so an account with no picture still reads as a person.
 */
export default function DoctorMenu({
  onNavigateProfile,
  onNavigateSettings,
  onSignOut,
}: {
  onNavigateProfile: () => void;
  onNavigateSettings: () => void;
  onSignOut: () => void;
}) {
  const { doctor } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape. Both listeners are only attached
  // while the menu is open so they cost nothing the rest of the time.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!doctor) return null;

  const initials = initialsFor(doctor.name);

  const item =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors';

  return (
    <div ref={wrapRef} className="relative border-t border-brand-900 p-3">
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-brand-950/30"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="border-b border-slate-100 px-3 py-3">
              <div className="truncate text-sm font-semibold text-brand-950">{doctor.name}</div>
              <div className="truncate text-xs text-slate-500">{doctor.email}</div>
            </div>

            <div className="p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onNavigateProfile();
                }}
                className={`${item} text-slate-700 hover:bg-brand-50 hover:text-brand-700`}
              >
                <UserRound size={16} />
                My Profile
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onNavigateSettings();
                }}
                className={`${item} text-slate-700 hover:bg-brand-50 hover:text-brand-700`}
              >
                <Settings size={16} />
                Settings
              </button>
            </div>

            <div className="border-t border-slate-100 p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
                className={`${item} text-red-600 hover:bg-red-50`}
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${doctor.name}`}
        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
          open ? 'bg-brand-900' : 'hover:bg-brand-900'
        }`}
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{doctor.name}</span>
          <span className="block truncate text-xs text-brand-300">
            {doctor.specialization || 'Doctor'}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-brand-300 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
    </div>
  );
}
