import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectDB } from './db';
import { Doctor, toPublic, type DoctorDoc, type PublicDoctor } from './models/Doctor';

/**
 * Doctor authentication.
 *
 * The session is a signed JWT delivered as an **httpOnly** cookie, so the token
 * is never readable from JavaScript and cannot be exfiltrated by an XSS bug the
 * way a localStorage token can. The browser never sees a password or a hash;
 * bcrypt hashing happens here and only the hash is persisted.
 *
 * Every clinical route is wrapped in `requireAuth`, which resolves the cookie to
 * a real doctor document on every request. Authorisation is therefore decided by
 * the server on each call — the frontend route guard is a UX nicety, not the
 * security boundary.
 */

const COOKIE_NAME = 'carescribe_session';
const SESSION_DAYS = 7;
const BCRYPT_ROUNDS = 12;

/** Requests carrying a verified session get the doctor attached here. */
export interface AuthedRequest extends Request {
  doctor?: PublicDoctor;
}

function jwtSecret(): string {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (!secret) {
    // Failing loudly beats silently signing sessions with a guessable key.
    throw new Error(
      'JWT_SECRET is not set. Add it to your .env file — see .env.example for how to generate one.',
    );
  }
  return secret;
}

/** True once the server is configured well enough to authenticate anyone. */
export function authConfigured(): boolean {
  return Boolean((process.env.JWT_SECRET || '').trim());
}

// In production the browser app is served from a different origin (Vercel) than
// the API (Render), so the session cookie has to be SameSite=None + Secure to be
// sent at all. In local dev the Vite proxy makes /api same-origin, where Lax is
// both sufficient and friendlier to plain http://localhost.
const isProd = process.env.NODE_ENV === 'production';

function cookieOptions() {
  return {
    httpOnly: true as const,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export function issueSession(res: Response, doctor: PublicDoctor): void {
  const token = jwt.sign({ sub: doctor.id }, jwtSecret(), { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

export function clearSession(res: Response): void {
  // maxAge is dropped so the cookie expires immediately; the remaining
  // attributes must match the ones it was set with or the browser keeps it.
  const { maxAge: _drop, ...rest } = cookieOptions();
  res.clearCookie(COOKIE_NAME, rest);
}

/** Resolve the session cookie to a doctor, or null if absent/invalid/stale. */
export async function doctorFromRequest(req: Request): Promise<PublicDoctor | null> {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
  if (!token) return null;

  let sub: string;
  try {
    const payload = jwt.verify(token, jwtSecret()) as { sub?: string };
    if (!payload?.sub) return null;
    sub = payload.sub;
  } catch {
    // Expired or tampered token — treated exactly like no token at all.
    return null;
  }

  await connectDB();
  // Re-read the account on every request so a deleted doctor cannot keep using
  // a token that has not expired yet.
  const doc = await Doctor.findOne({ id: sub }).lean().exec();
  return doc ? toPublic(doc as unknown as DoctorDoc) : null;
}

/**
 * Is this error "the database is unreachable" rather than "the credentials are
 * wrong"? Mongoose raises a server-selection error when Atlas refuses the TLS
 * handshake (the signature of an IP that is not on the access list), when the
 * cluster is paused, or when the network is down.
 *
 * Worth distinguishing: reporting an outage as a sign-in failure sends people
 * hunting through their password when the real problem is infrastructure.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  if (!e) return false;
  if (e.name === 'MongooseServerSelectionError') return true;
  if (e.name === 'MongoNetworkError' || e.name === 'MongoServerSelectionError') return true;
  return /ECONNREFUSED|ETIMEDOUT|querySrv|not connect to any servers|MONGODB_URI/i.test(
    e.message || '',
  );
}

/** The message shown to the doctor when the database cannot be reached. */
export const DB_UNAVAILABLE_MESSAGE =
  'Cannot reach the CareScribe database right now. This is a server problem, not your password — check the API server and its MongoDB connection, then try again.';

/** Gate a route behind a valid session. */
export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const doctor = await doctorFromRequest(req);
    if (!doctor) {
      res.status(401).json({ error: 'Not signed in.' });
      return;
    }
    req.doctor = doctor;
    next();
  } catch (error) {
    console.error('[auth] session check failed', error);
    if (isDatabaseUnavailable(error)) {
      res.status(503).json({ error: DB_UNAVAILABLE_MESSAGE });
      return;
    }
    res.status(500).json({ error: 'Could not verify the session.' });
  }
}

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

export const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

// ── validation ───────────────────────────────────────────────────────────────
// Mirrored by the sign-up form, but enforced here because the client's copy is
// only a convenience — a request can arrive without ever touching the form.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MIN_PASSWORD_LENGTH = 8;

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  specialization: string;
}

// A flat result rather than a discriminated union: this project's tsconfig
// does not enable `strict`, and without it TypeScript will not narrow a
// boolean-literal discriminant, so `if (!r.ok)` would not reveal `r.error`.
export interface SignupResult {
  error: string | null;
  value: SignupInput | null;
}

const invalid = (error: string): SignupResult => ({ error, value: null });

export function validateSignup(input: {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
  specialization?: unknown;
}): SignupResult {
  const name = String(input.name ?? '').trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  const password = String(input.password ?? '');
  const specialization = String(input.specialization ?? '').trim();

  if (!name) return invalid('Please enter your full name.');
  if (name.length > 120) return invalid('That name is too long.');
  if (!EMAIL_RE.test(email)) return invalid('Please enter a valid email address.');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return invalid(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > 200) return invalid('That password is too long.');

  // The confirmation is optional on the wire (a direct API client has no second
  // field to fill in), but when it is sent it has to agree — the form's own
  // check runs in a browser the server does not control.
  if (input.confirmPassword !== undefined && String(input.confirmPassword) !== password) {
    return invalid('Passwords do not match.');
  }

  return {
    error: null,
    value: { name, email, password, specialization: specialization || 'General Practice' },
  };
}

// ── profile updates ──────────────────────────────────────────────────────────

export interface ProfileInput {
  name: string;
  specialization: string;
  phoneNumber: string;
  hospitalName: string;
}

export interface ProfileResult {
  error: string | null;
  value: ProfileInput | null;
}

/**
 * Validate an edit to the signed-in doctor's own profile.
 *
 * Deliberately narrow: it returns only the four editable fields, so nothing
 * else in the request body — `email`, `passwordHash`, `id`, `doctorId` — can
 * reach the update. Email is not editable here because it is the login
 * identifier and changing it needs a re-verification flow this app does not
 * have yet.
 *
 * Phone and hospital are OPTIONAL. Clearing them is a valid edit, so an empty
 * string is accepted and stored as empty rather than rejected.
 */
export function validateProfile(input: {
  name?: unknown;
  specialization?: unknown;
  phoneNumber?: unknown;
  hospitalName?: unknown;
}): ProfileResult {
  const bad = (error: string): ProfileResult => ({ error, value: null });

  const name = String(input.name ?? '').trim();
  const specialization = String(input.specialization ?? '').trim();
  const phoneNumber = String(input.phoneNumber ?? '').trim();
  const hospitalName = String(input.hospitalName ?? '').trim();

  if (!name) return bad('Please enter your full name.');
  if (name.length > 120) return bad('That name is too long.');
  if (specialization.length > 120) return bad('That specialization is too long.');
  if (hospitalName.length > 160) return bad('That hospital or clinic name is too long.');

  // Only checked when something was actually entered — an empty phone is fine.
  if (phoneNumber) {
    if (phoneNumber.length > 32) return bad('That phone number is too long.');
    if (!/^[+()\d][\d\s()+-]{5,}$/.test(phoneNumber)) {
      return bad('Please enter a valid phone number, or leave it blank.');
    }
  }

  return { error: null, value: { name, specialization, phoneNumber, hospitalName } };
}

// ── password reset ───────────────────────────────────────────────────────────

/** How long a reset link stays valid. Short on purpose. */
export const RESET_TTL_MINUTES = 30;
/** Links that may be requested for one account inside the window below. */
export const RESET_MAX_SENDS = 5;
export const RESET_SEND_WINDOW_MINUTES = 15;

/**
 * Build a reset token as `<lookupId>.<secret>`.
 *
 * The lookup half indexes the row; only the secret half is hashed and compared.
 * Splitting them means the database is searched by a public id rather than by
 * scanning every outstanding row to bcrypt-compare it, while the part that
 * actually authorises the reset is still never stored in the clear.
 *
 * Both halves come from `crypto.randomBytes`: a guessable reset link is a
 * password bypass, so the generator has to be the strong one.
 */
export function generateResetToken(): { lookupId: string; secret: string; token: string } {
  const lookupId = crypto.randomBytes(12).toString('base64url');
  const secret = crypto.randomBytes(32).toString('base64url');
  return { lookupId, secret, token: `${lookupId}.${secret}` };
}

/** Split a token back into its two halves. Returns null if it is malformed. */
export function parseResetToken(token: unknown): { lookupId: string; secret: string } | null {
  const raw = String(token || '');
  const dot = raw.indexOf('.');
  if (dot <= 0 || dot === raw.length - 1) return null;
  return { lookupId: raw.slice(0, dot), secret: raw.slice(dot + 1) };
}

/**
 * Hash the token secret before storing it. Same reasoning as passwords: the
 * database must never hold anything that can be replayed as-is. A lower cost
 * than password hashing because these live for minutes.
 */
export const hashSecret = (value: string): Promise<string> => bcrypt.hash(value, 8);
export const verifySecret = (value: string, hash: string): Promise<boolean> =>
  bcrypt.compare(value, hash);

/** Validate a new password chosen during a reset. */
export function validateNewPassword(password: unknown, confirm: unknown): string | null {
  const value = String(password ?? '');
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > 200) return 'That password is too long.';
  if (confirm !== undefined && String(confirm) !== value) return 'Passwords do not match.';
  return null;
}
