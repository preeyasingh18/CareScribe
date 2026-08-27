import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import BrandLogo from '../../components/BrandLogo';
import { navigate, scrollToSection, LOGIN_PATH, SIGNUP_PATH, HOME_PATH } from '../../routing';
import { useAuth } from '../../auth/AuthContext';
import { EASE_OUT } from '../motion';

/** Nav mark size. 44 keeps the full artwork legible; below ~38 it silts up. */
const NAV_LOGO_PX = 44;

const LINKS = [
  { label: 'Home', id: 'home' },
  { label: 'How It Works', id: 'how-it-works' },
  { label: 'Features', id: 'features' },
  { label: 'About', id: 'about' },
];

interface Props {
  /** Measured by Root so the intro animation can land its mark exactly here. */
  markRef: RefObject<HTMLDivElement | null>;
  /** Hidden until the intro hands off, so the two marks never both show. */
  markVisible: boolean;
  /** Skips the entrance animation when the intro did not play. */
  animateIn: boolean;
}

export default function Navbar({ markRef, markVisible, animateIn }: Props) {
  // A doctor who is already signed in gets one button through to their
  // dashboard instead of being asked to log in again.
  const { doctor, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    scrollToSection(id);
  };

  return (
    <motion.header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'border-b border-slate-200/80 bg-white/85 backdrop-blur-md' : 'bg-transparent'
      }`}
      initial={animateIn ? { y: -24, opacity: 0 } : false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
    >
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        {/* Brand */}
        <button
          type="button"
          onClick={() => go('home')}
          className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
          aria-label="CareScribe AI — back to top"
        >
          {/* Same <img src="/logo.svg"> the intro animates, at nav size — the
              hand-off has to land on identical artwork, not a redrawn variant. */}
          <div
            ref={markRef}
            style={{ width: NAV_LOGO_PX, height: NAV_LOGO_PX }}
            className={`flex-shrink-0 transition-opacity duration-200 ${markVisible ? 'opacity-100' : 'opacity-0'}`}
          >
            <BrandLogo size={NAV_LOGO_PX} priority />
          </div>
          <span className="text-xl font-bold tracking-tight">
            <span className="text-brand-950">Care</span>
            <span className="text-brand-600">Scribe</span>
            <span className="ml-1 align-top text-xs font-semibold text-brand-400">AI</span>
          </span>
        </button>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map(link => (
            <button
              key={link.id}
              type="button"
              onClick={() => go(link.id)}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          {/* Nothing is rendered until the session check resolves, so the bar
              never flickers Login -> Go to Dashboard on a signed-in reload. */}
          {ready && doctor ? (
            <button
              type="button"
              onClick={() => navigate(HOME_PATH)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md hover:shadow-brand-600/20"
            >
              Go to Dashboard
            </button>
          ) : ready ? (
            <>
              <button
                type="button"
                onClick={() => navigate(LOGIN_PATH)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => navigate(SIGNUP_PATH)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md hover:shadow-brand-600/20"
              >
                Get Started
              </button>
            </>
          ) : null}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="-mr-2 rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100 md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="border-t border-slate-200 bg-white px-5 pb-5 pt-3 md:hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
          >
            <div className="flex flex-col gap-1">
              {LINKS.map(link => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => go(link.id)}
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  {link.label}
                </button>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
                {doctor ? (
                  <button
                    type="button"
                    onClick={() => navigate(HOME_PATH)}
                    className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                  >
                    Go to Dashboard
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(LOGIN_PATH)}
                      className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(SIGNUP_PATH)}
                      className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                    >
                      Get Started
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
