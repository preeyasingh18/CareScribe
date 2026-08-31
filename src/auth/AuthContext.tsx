import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  fetchCurrentDoctor,
  signUpDoctor,
  logInDoctor,
  logOutDoctor,
  setUnauthorizedHandler,
  type Doctor,
} from '../services/api';

/**
 * The app's single source of truth for who is signed in.
 *
 * The session lives in an httpOnly cookie issued by the API (server/auth.ts).
 * This module never sees a token or a password hash and stores nothing in
 * localStorage — on boot it simply asks the server "who am I?" via
 * /api/auth/me, and the cookie rides along automatically.
 *
 * `ready` guards the first paint: until the session check resolves, callers
 * must render a loading state rather than guess, otherwise a signed-in doctor
 * deep-linking to /dashboard sees the login screen flash first.
 *
 * The route guard built on this is a UX convenience only. Every clinical
 * endpoint independently enforces the same session server-side, so nothing here
 * is load-bearing for security.
 */

export type { Doctor };

interface AuthValue {
  doctor: Doctor | null;
  /** False until the session check has resolved. Gate redirects on this. */
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    name: string;
    email: string;
    password: string;
    confirmPassword?: string;
    specialization: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [ready, setReady] = useState(false);

  // Ask the server who the cookie belongs to. A failure here (backend down,
  // no network) is treated as "signed out" rather than blocking the app.
  useEffect(() => {
    let cancelled = false;

    fetchCurrentDoctor()
      .then(next => {
        if (!cancelled) setDoctor(next);
      })
      .catch(() => {
        if (!cancelled) setDoctor(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // If any API call comes back 401 the session expired or was revoked
  // elsewhere; drop the local user so the route guard bounces to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => setDoctor(null));
    return () => setUnauthorizedHandler(() => {});
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setDoctor(await logInDoctor(email, password));
  }, []);

  const signUp = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      confirmPassword?: string;
      specialization: string;
    }) => {
      setDoctor(await signUpDoctor(input));
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await logOutDoctor();
    } catch {
      // Even if the network call fails, drop the local session — the cookie
      // expires on its own and the user asked to be signed out.
    }
    setDoctor(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ doctor, ready, signIn, signUp, signOut }),
    [doctor, ready, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** "Dr. Priya Singh" → "PS". Falls back to "DR" when no usable name exists. */
export function initialsFor(name: string | undefined): string {
  const parts = (name || '')
    .replace(/\b(dr|doctor|prof|mr|mrs|ms)\.?\b/gi, '')
    .split(/\s+/)
    .filter(Boolean);

  const initials = parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'DR';
}
