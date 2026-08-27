import { useEffect, useState } from 'react';

/**
 * Tiny history-API router shared by the public site and the dashboard shell.
 *
 * The dashboard (App.tsx) already drove the address bar with pushState before
 * the marketing site existed; this module simply gives the new public routes
 * the same treatment and a single place to ask "which surface owns this URL?".
 * No router dependency is added — the app is a handful of routes, not a tree.
 */

/** Routes owned by the authenticated dashboard shell. Mirrors VIEW_TO_PATH. */
export const APP_PATHS = [
  '/dashboard',
  '/patients',
  '/consultations',
  '/transcripts',
  '/reports',
  '/prescriptions',
  '/settings',
] as const;

export const LOGIN_PATH = '/login';
export const SIGNUP_PATH = '/signup';
export const LANDING_PATH = '/';
export const HOME_PATH = '/dashboard';

/** Fired by navigate() — pushState/replaceState do not emit popstate. */
const NAV_EVENT = 'carescribe:navigate';

export const isAppPath = (path: string): boolean =>
  (APP_PATHS as readonly string[]).includes(path);

export const isAuthPath = (path: string): boolean =>
  path === LOGIN_PATH || path === SIGNUP_PATH;

/** Push (or replace) a URL and let every usePathname() subscriber re-render. */
export function navigate(path: string, { replace = false }: { replace?: boolean } = {}): void {
  if (window.location.pathname !== path) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
  }
  window.dispatchEvent(new Event(NAV_EVENT));
}

/** The current pathname, kept in sync with back/forward and navigate(). */
export function usePathname(): string {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    window.addEventListener(NAV_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(NAV_EVENT, sync);
    };
  }, []);

  return path;
}

/**
 * Smooth-scroll to a landing-page section, or navigate home first when the
 * anchor lives on a page we are not currently on.
 */
export function scrollToSection(id: string): void {
  const go = () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  if (window.location.pathname !== LANDING_PATH) {
    navigate(LANDING_PATH);
    window.setTimeout(go, 60);
  } else {
    go();
  }
}
