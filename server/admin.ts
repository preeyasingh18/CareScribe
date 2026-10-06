import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * Admin access.
 *
 * A single shared password, held only in the server's environment, unlocks a
 * read-only view of the data. It is deliberately NOT an account: there is no
 * admin document in the database, no signup, and nothing in the doctor auth
 * flow changes because of it.
 *
 * Two properties matter here and are enforced below rather than in the UI:
 *
 *   1. The password never reaches the browser. The client posts a candidate and
 *      is told yes or no; `ADMIN_PASSWORD` itself is never returned, logged, or
 *      echoed in an error.
 *   2. The session is a signed httpOnly cookie whose key is derived from BOTH
 *      `JWT_SECRET` and the current password. A doctor's session token is
 *      signed with a different key, so one can never be replayed as the other,
 *      and changing the admin password invalidates every outstanding admin
 *      session for free.
 */

const COOKIE_NAME = 'carescribe_admin';
/** Short by design — this unlocks a view of everyone's records. */
const SESSION_HOURS = 2;

const isProd = process.env.NODE_ENV === 'production';

/** The configured admin password, or '' when the feature is switched off. */
function adminPassword(): string {
  return (process.env.ADMIN_PASSWORD || '').trim();
}

/** True once the server has everything it needs to authenticate an admin. */
export function adminConfigured(): boolean {
  return Boolean(adminPassword() && (process.env.JWT_SECRET || '').trim());
}

/**
 * The key admin sessions are signed with.
 *
 * Derived from the app's JWT secret and the password itself, so it is a
 * different key from the one doctor sessions use. The password is only ever
 * consumed as HMAC input here — the digest is what gets used, never the value.
 */
function adminKey(): string {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (!secret || !adminPassword()) {
    throw new Error('Admin access is not configured on this server.');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(`carescribe-admin-session:${adminPassword()}`)
    .digest('base64url');
}

function cookieOptions() {
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
    path: '/',
  };
}

/**
 * Compare the submitted password with the configured one in constant time.
 *
 * Both sides are hashed first so the buffers are always the same length —
 * `timingSafeEqual` throws on a length mismatch, and that throw would itself
 * leak the length of the real password.
 */
export function passwordMatches(candidate: unknown): boolean {
  const expected = adminPassword();
  if (!expected) return false;
  const a = crypto.createHash('sha256').update(String(candidate ?? '')).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueAdminSession(res: Response): void {
  const token = jwt.sign({ scope: 'admin' }, adminKey(), { expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

export function clearAdminSession(res: Response): void {
  // maxAge is dropped so the cookie expires now; the rest must match how it was
  // set or the browser keeps it.
  const { maxAge: _drop, ...rest } = cookieOptions();
  res.clearCookie(COOKIE_NAME, rest);
}

/** Does this request carry a valid, unexpired admin session? */
export function hasAdminSession(req: Request): boolean {
  if (!adminConfigured()) return false;
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
  if (!token) return false;
  try {
    const payload = jwt.verify(token, adminKey()) as { scope?: string };
    return payload?.scope === 'admin';
  } catch {
    // Expired, tampered with, or signed for a previous password — all the same
    // as having no session at all.
    return false;
  }
}

/**
 * Gate for every endpoint that returns data.
 *
 * This is the security boundary. The browser's idea of whether it is "logged
 * in" as an admin has no bearing on it: a request without a valid cookie is
 * refused here, before any query runs, so calling /api/admin/* directly returns
 * 401 and nothing else.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!hasAdminSession(req)) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  next();
}

// ── brute-force throttling ───────────────────────────────────────────────────
// One shared password with no account to lock means the only thing standing
// between a guesser and the data is how fast they can try. In-memory is enough:
// a restart clearing the counters is not a meaningful weakening, and this app
// runs as a single instance.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const attempts = new Map<string, { count: number; firstAt: number }>();

export function attemptsRemaining(ip: string): number {
  const entry = attempts.get(ip);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) return MAX_ATTEMPTS;
  return Math.max(0, MAX_ATTEMPTS - entry.count);
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now });
    return;
  }
  entry.count += 1;

  // Opportunistic sweep so the map cannot grow without bound.
  if (attempts.size > 500) {
    for (const [key, value] of attempts) {
      if (now - value.firstAt > WINDOW_MS) attempts.delete(key);
    }
  }
}

export function clearAttempts(ip: string): void {
  attempts.delete(ip);
}

export const LOCKED_OUT_MESSAGE =
  'Too many incorrect attempts. Please wait a few minutes and try again.';
