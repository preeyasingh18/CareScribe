import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import LandingPage from './landing/LandingPage';
import IntroAnimation from './landing/IntroAnimation';
import Toaster from './components/Toast';
import AuthLoading from './auth/AuthLoading';
import { AuthProvider, useAuth } from './auth/AuthContext';
import {
  usePathname,
  navigate,
  isAppPath,
  isAuthPath,
  LANDING_PATH,
  LOGIN_PATH,
  SIGNUP_PATH,
  RESET_PATH,
  HOME_PATH,
} from './routing';

// Both are lazy so a landing-page visitor never downloads the dashboard shell,
// and a signed-in doctor deep-linking to /dashboard never downloads the site.
const App = lazy(() => import('./App'));
const AuthPage = lazy(() => import('./auth/AuthPage'));
const ResetPassword = lazy(() => import('./auth/ResetPassword'));

/**
 * Top-level surface switch.
 *
 *   /                     public landing page (preceded by the intro animation)
 *   /login, /signup       authentication
 *   /dashboard, ...       the existing dashboard shell, behind the auth gate
 *
 * The dashboard itself (App.tsx) is untouched — it still owns its own view
 * routing once Root has decided it is allowed to render.
 */

/** Once per browser tab. A returning doctor never sits through the intro twice. */
const INTRO_KEY = 'carescribe.intro.played';

function hasPlayedIntro(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return true; // storage blocked — err towards not replaying the animation
  }
}

function markIntroPlayed(): void {
  try {
    window.sessionStorage.setItem(INTRO_KEY, '1');
  } catch {
    /* ignore */
  }
}

function Surfaces() {
  const path = usePathname();
  const { doctor, ready } = useAuth();

  const markRef = useRef<HTMLDivElement>(null);
  const [markRect, setMarkRect] = useState<DOMRect | null>(null);

  // The intro only ever runs for an unauthenticated visitor landing on the
  // public root — never on a deep link, an auth page, or a returning session.
  const [introRunning, setIntroRunning] = useState(
    () => path === LANDING_PATH && !hasPlayedIntro(),
  );
  const [introJustPlayed, setIntroJustPlayed] = useState(false);

  // Measure the navbar's logo slot so the intro can fly its mark exactly there.
  useEffect(() => {
    if (!introRunning) return;
    const measure = () => {
      const rect = markRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0) setMarkRect(rect);
    };
    measure();
    // Fonts/layout settle a frame or two later; re-measure before the flight.
    const id = window.setTimeout(measure, 400);
    return () => window.clearTimeout(id);
  }, [introRunning]);

  const finishIntro = useCallback(() => {
    markIntroPlayed();
    setIntroRunning(false);
    setIntroJustPlayed(true);
  }, []);

  // An authenticated doctor who opens the site still sees the landing page, but
  // any attempt to sit on an auth page just forwards them into the dashboard.
  useEffect(() => {
    if (!ready) return;
    if (doctor && isAuthPath(path) && path !== RESET_PATH) navigate(HOME_PATH, { replace: true });
    if (!doctor && isAppPath(path)) navigate(LOGIN_PATH, { replace: true });
  }, [ready, doctor, path]);

  // The intro is itself a loading screen, so while it is running we let it cover
  // the session check rather than stacking two splashes on top of each other.
  // Everywhere else, hold the first paint until the check resolves: otherwise a
  // signed-in doctor deep-linking to /dashboard flashes the login page, and an
  // unauthenticated one briefly sees the dashboard shell.
  if (!ready && !introRunning) return <AuthLoading />;

  if (isAppPath(path)) {
    // Still resolving, or redirecting — either way show the neutral screen
    // rather than a flash of the wrong surface.
    if (!ready || !doctor) return <AuthLoading />;
    return (
      <Suspense fallback={<AuthLoading />}>
        <App />
      </Suspense>
    );
  }

  if (path === RESET_PATH) {
    // Reached from an emailed link, so it renders regardless of session state.
    return (
      <Suspense fallback={<AuthLoading />}>
        <ResetPassword />
      </Suspense>
    );
  }

  if (isAuthPath(path)) {
    if (!ready) return <AuthLoading />;
    return (
      <Suspense fallback={<AuthLoading />}>
        <AuthPage mode={path === SIGNUP_PATH ? 'signup' : 'login'} />
      </Suspense>
    );
  }

  return (
    <>
      <LandingPage markRef={markRef} markVisible={!introRunning} animateIn={introJustPlayed} />
      <AnimatePresence>
        {introRunning && (
          <IntroAnimation key="intro" targetRect={markRect} onFinished={finishIntro} />
        )}
      </AnimatePresence>
    </>
  );
}

export default function Root() {
  // Unknown paths (typos, stale links) resolve to the landing page rather than
  // a blank screen — the SPA host rewrites everything to index.html.
  useEffect(() => {
    const p = window.location.pathname;
    if (p !== LANDING_PATH && !isAppPath(p) && !isAuthPath(p)) {
      navigate(LANDING_PATH, { replace: true });
    }
  }, []);

  return (
    <AuthProvider>
      <Surfaces />
      {/* Above the surface switch so a toast raised during a redirect (e.g.
          "Signed out successfully.") survives the screen that raised it. */}
      <Toaster />
    </AuthProvider>
  );
}
