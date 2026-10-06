import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { connectDB, isConnected } from './db';
import {
  requireAuth,
  issueSession,
  clearSession,
  doctorFromRequest,
  hashPassword,
  verifyPassword,
  validateSignup,
  authConfigured,
  validateProfile,
  generateResetToken,
  parseResetToken,
  hashSecret,
  verifySecret,
  validateNewPassword,
  RESET_TTL_MINUTES,
  RESET_MAX_SENDS,
  RESET_SEND_WINDOW_MINUTES,
  isDatabaseUnavailable,
  DB_UNAVAILABLE_MESSAGE,
  type AuthedRequest,
} from './auth';
import { Doctor, toPublic, type DoctorDoc } from './models/Doctor';
import { PasswordReset, type PasswordResetDoc } from './models/PasswordReset';
import {
  SEND_FAILED_MESSAGE,
  ensureEmailReady,
  maskEmail,
  sendResetLink,
  verifyEmailTransport,
} from './services/notify';
import {
  patientsRepo,
  consultationsRepo,
  transcriptsRepo,
  reportsRepo,
  prescriptionsRepo,
} from './repositories';
import { registerAdminRoutes } from './adminRoutes';
import { adminConfigured } from './admin';

dotenv.config();

const app = express();

// 25 MB ceiling — matches the client-side limit for uploaded audio files.
// Live recordings are far smaller, so this never affects the recording flow.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
});
const PORT = Number(process.env.PORT) || 5000;

// Directory where uploaded audio files are persisted so they can be replayed
// (and survive a page refresh) via /api/uploads/<file>. Created on startup.
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// CORS — allow all origins by default; restrict via CORS_ORIGIN (comma-separated)
// in production if you want to lock it down to your Vercel domain.
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
// `credentials: true` is required for the httpOnly session cookie to be sent
// cross-site. It is incompatible with a wildcard origin, so when CORS_ORIGIN is
// unset we reflect the caller's origin (`origin: true`) instead of '*'.
app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Serve persisted upload audio. Registered before the /api 404 handler so
// GET /api/uploads/<file> resolves to a real file on disk. Upload filenames are
// unique (they embed a timestamp) and never rewritten, so they can be cached
// aggressively and immutably — a replay after refresh then loads from cache.
app.use(
  '/api/uploads',
  express.static(UPLOADS_DIR, { maxAge: '1y', immutable: true }),
);

// Never cache API data responses. Dashboard stats, patients, consultations,
// reports, prescriptions and transcripts must always reflect the CURRENT
// database — after a record is deleted the client must not be served a stale
// browser/CDN-cached copy. Registered AFTER the uploads static route above, so
// immutable audio files keep their long-lived cache; every other /api response
// is marked no-store. Applies on localhost and the deployed backend alike.
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Delete a persisted upload audio file (used by "Remove audio" in a session).
// Best-effort: a missing file is treated as already removed (200), so the client
// flow never breaks if the file is already gone.
app.delete('/api/uploads/:filename', requireAuth, (req, res) => {
  // Strip any path parts so the request can only target a file inside UPLOADS_DIR.
  const safeName = path.basename(req.params.filename || '');
  if (!safeName) return res.status(400).json({ error: 'Invalid file name' });
  const target = path.join(UPLOADS_DIR, safeName);
  try {
    fs.rmSync(target, { force: true });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[uploads:delete]', error);
    // Don't fail the client flow on a storage error; the reference is still cleared.
    return res.json({ ok: false });
  }
});

// Ensure the DB connection is ready before any data route runs. Reads/writes
// `await connectDB()`; this middleware just warms it and surfaces failures.
app.use('/api', async (_req, _res, next) => {
  connectDB().catch(() => {}); // fire-and-forget warm-up; routes handle errors
  next();
});

// ─────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  let dbConnected = isConnected();
  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
    } catch {
      dbConnected = false;
    }
  }

  res.json({
    success: true,
    status: 'running',
    database: dbConnected ? 'mongodb' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Pick a sensible file extension for a persisted upload from its original
// name, falling back to the mimetype, then to .webm (the live-recording type).
const AUDIO_MIME_EXT: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
};

function audioExtension(originalName?: string, mimetype?: string): string {
  const fromName = originalName ? path.extname(originalName).toLowerCase() : '';
  if (fromName) return fromName;
  return AUDIO_MIME_EXT[(mimetype || '').toLowerCase()] || '.webm';
}

// Server-side audio acceptance — mirrors the frontend check so a request that
// bypasses the UI is still validated. Accept by MIME ("audio/*" or explicit
// list), the video/mpeg special case for MP3/MPEG, or extension fallback.
const ACCEPTED_AUDIO_MIME = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/webm', 'audio/ogg',
  'audio/aac', 'audio/flac', 'audio/3gpp', 'audio/amr', 'audio/opus',
]);
const ACCEPTED_AUDIO_EXT = new Set([
  '.mp3', '.mpeg', '.wav', '.m4a', '.webm', '.ogg', '.aac', '.flac', '.mp4', '.3gp', '.amr', '.opus',
]);

function checkAudioFile(originalName?: string, mimetype?: string): { accepted: boolean; reason: string } {
  const mime = (mimetype || '').toLowerCase();
  const ext = originalName ? path.extname(originalName).toLowerCase() : '';
  if (mime.startsWith('audio/')) return { accepted: true, reason: `MIME ${mime}` };
  if (mime === 'video/mpeg' && (ext === '.mpeg' || ext === '.mp3')) {
    return { accepted: true, reason: `video/mpeg with ${ext} (MP3/MPEG audio)` };
  }
  if (ACCEPTED_AUDIO_MIME.has(mime)) return { accepted: true, reason: `allowed MIME ${mime}` };
  if (ACCEPTED_AUDIO_EXT.has(ext)) return { accepted: true, reason: `extension ${ext}` };
  return { accepted: false, reason: `unrecognised audio (mime=${mime || 'empty'}, ext=${ext || 'none'})` };
}

// ─────────────────────────────────────────────────────────────
// Transcription (OpenAI Whisper) — exact spoken text, no fallback
// ─────────────────────────────────────────────────────────────
app.post('/api/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('[transcribe] rejected: no audio file provided');
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { accepted, reason } = checkAudioFile(req.file.originalname, req.file.mimetype);
    // Detailed debug logs for the upload/transcription flow (no secrets).
    console.log('[transcribe] file received:', req.file.originalname);
    console.log('[transcribe] body:', req.body);
    console.log('[transcribe] mime:', req.file.mimetype, '| size:', req.file.size);
    console.log(
      '[transcribe] originalName:', req.file.originalname,
      '| mimetype:', req.file.mimetype,
      '| extension:', path.extname(req.file.originalname || '').toLowerCase(),
      '| size:', req.file.size,
      '| language:', req.body?.language,
      '| decision:', accepted ? 'accepted' : 'rejected',
      '| reason:', reason,
    );

    // Validate by MIME OR extension; reject genuine non-audio files.
    if (!accepted) {
      console.error('[transcribe] rejected:', reason);
      return res.status(400).json({ error: 'Please upload a valid audio file.' });
    }

    // Reject only essentially-empty recordings (silence / mic not captured),
    // which make Whisper return generic hallucinated text. Kept low so short but
    // real clips are still transcribed (must stay in sync with the client guard).
    if (req.file.size < 2000) {
      console.error('[transcribe] rejected: file too small or empty', { size: req.file.size });
      return res.status(400).json({ error: 'Audio file too small or empty' });
    }

    const { transcribeAudio } = await import('./services/sarvamStt');

    // Sarvam transcribes the actual spoken audio (exact text).
    const text = await transcribeAudio(req.file.buffer, req.file.mimetype, req.body?.language);

    // Persist the audio only when explicitly asked (the upload flow sets
    // persist=true). Live recordings omit it, so their behaviour is unchanged
    // and audioUrl stays empty as before.
    let audioUrl = '';
    if (req.body?.persist === 'true' || req.body?.persist === true) {
      const ext = audioExtension(req.file.originalname, req.file.mimetype);
      const safeId = String(req.body?.consultationId || 'audio').replace(/[^a-zA-Z0-9_-]/g, '');
      const fileName = `${safeId}-${Date.now()}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, fileName), req.file.buffer);
      audioUrl = `/api/uploads/${fileName}`;
    }

    return res.json({ rawText: text, transcript: text, audioUrl });
  } catch (error: any) {
    // Surface the REAL Sarvam reason (never the generic message) so the client
    // console shows why it failed. Sarvam errors carry no secrets.
    const detail = error?.detail || error?.message || 'Transcription failed';
    console.error('[transcribe] error:', error?.status || '', detail);

    if (error?.status === 401 || error?.status === 403) {
      return res.status(401).json({
        error: 'Invalid Sarvam API key. Check SARVAM_API_KEY in your .env file.',
      });
    }

    return res.status(500).json({ error: detail });
  }
});

// ─────────────────────────────────────────────────────────────
// Transcript Translation
// ─────────────────────────────────────────────────────────────
app.post('/api/translate-transcript', requireAuth, async (req, res) => {
  try {
    const { text, targetLanguage } = req.body ?? {};

    if (!text || !text.toString().trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    const { translateTranscript } = await import('./services/translate');
    const translatedText = await translateTranscript(text.toString(), targetLanguage);

    return res.json({ translatedText });
  } catch (error: any) {
    console.error('[translate-transcript]', error);
    const detail = error?.message || error?.error?.message || 'Unknown error';
    return res.status(502).json({ error: `Translation failed: ${detail}` });
  }
});

// ─────────────────────────────────────────────────────────────
// Report Generation (OpenAI)
// ─────────────────────────────────────────────────────────────
app.post('/api/generate-report', requireAuth, async (req, res) => {
  const startedAt = Date.now();
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    // Only the transcript is sent to the model — no session, patient or doctor
    // record, and no previous report.
    console.log('[REPORT] request received | transcript chars:', String(transcript).length);

    const { generateMedicalReport } = await import('./services/report');
    const report = await generateMedicalReport(transcript);

    console.log('[REPORT] total:', Date.now() - startedAt, 'ms');
    return res.json(report);
  } catch (error: any) {
    console.error('[generate-report] failed after', Date.now() - startedAt, 'ms:', error?.message || error);

    if (error?.timeout) {
      return res.status(504).json({
        error: 'Report generation is taking longer than expected. Please try again.',
      });
    }

    const detail =
      error?.message ||
      error?.error?.message ||
      'Unknown error while generating the report with Sarvam.';
    const status = error?.status ?? error?.code;

    if (status === 401 || status === 403) {
      return res.status(401).json({
        error: 'Invalid Sarvam API key. Check SARVAM_API_KEY in your .env file.',
      });
    }

    const isQuota = status === 429 || /quota|rate.?limit|too many requests/i.test(detail);
    if (isQuota) {
      return res.status(429).json({
        error:
          'Sarvam quota exceeded or rate limited. The transcript is preserved — please wait a moment and try generating the report again.',
      });
    }

    return res.status(502).json({ error: `Sarvam report generation failed: ${detail}` });
  }
});

// ─────────────────────────────────────────────────────────────
// Authentication
//
// Sessions are signed JWTs delivered as httpOnly cookies (see auth.ts). The
// browser never handles a token or a password hash; every clinical route below
// is gated by requireAuth, so the server — not the UI — decides who may read
// what.
// ─────────────────────────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  try {
    if (!authConfigured()) {
      return res.status(500).json({ error: 'Server auth is not configured (JWT_SECRET missing).' });
    }

    const parsed = validateSignup(req.body ?? {});
    if (parsed.error || !parsed.value) {
      return res.status(400).json({ error: parsed.error || 'Invalid details.' });
    }
    const { name, email, password, specialization } = parsed.value;

    await connectDB();
    if (await Doctor.exists({ email })) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const doctor = {
      id: crypto.randomUUID(),
      name,
      email,
      specialization,
      passwordHash: await hashPassword(password),
    };
    await Doctor.create(doctor);

    const publicDoctor = toPublic(doctor as DoctorDoc);
    issueSession(res, publicDoctor);
    return res.status(201).json({ doctor: publicDoctor });
  } catch (error: any) {
    // A racing duplicate slips past the exists() check and lands here.
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    if (isDatabaseUnavailable(error)) {
      console.error('[auth:signup] database unavailable');
      return res.status(503).json({ error: DB_UNAVAILABLE_MESSAGE });
    }
    console.error('[auth:signup]', error);
    return res.status(500).json({ error: 'Could not create the account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!authConfigured()) {
      return res.status(500).json({ error: 'Server auth is not configured (JWT_SECRET missing).' });
    }

    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter your email and password.' });
    }

    await connectDB();
    const doc = (await Doctor.findOne({ email }).lean().exec()) as DoctorDoc | null;

    // One message for "no such account" and "wrong password" so the form cannot
    // be used to discover which emails are registered.
    const rejection = { error: 'Invalid email or password.' };
    if (!doc) {
      // Spend comparable time on a miss so response timing does not leak either.
      await verifyPassword(password, '$2a$12$dummysaltdummysaltdummysaltdummysaltdummysaltdu');
      return res.status(401).json(rejection);
    }
    if (!(await verifyPassword(password, doc.passwordHash))) {
      return res.status(401).json(rejection);
    }

    const publicDoctor = toPublic(doc);
    issueSession(res, publicDoctor);
    return res.json({ doctor: publicDoctor });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      console.error('[auth:login] database unavailable');
      return res.status(503).json({ error: DB_UNAVAILABLE_MESSAGE });
    }
    console.error('[auth:login]', error);
    return res.status(500).json({ error: 'Could not sign you in.' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  clearSession(res);
  return res.json({ success: true });
});

// The browser calls this on boot to restore a session. 200 with doctor: null
// (rather than 401) so "signed out" is an ordinary answer, not a console error.
app.get('/api/auth/me', async (req, res) => {
  try {
    return res.json({ doctor: await doctorFromRequest(req) });
  } catch (error) {
    console.error('[auth:me]', error);
    return res.json({ doctor: null });
  }
});

// ─────────────────────────────────────────────────────────────
// Password reset (forgot password) — emailed link, Gmail SMTP
//
//   1. /auth/forgot-password    email the account a single-use reset link
//   2. /auth/reset-token        the reset page checks the link is still valid
//   3. /auth/reset-password     the link is spent to set the new password
//
// Tokens are random, stored hashed, expire in minutes and are single-use, and
// the number of links per account is capped.
// ─────────────────────────────────────────────────────────────

/** Where the browser app lives, for building the link in the email. */
function appOrigin(req: express.Request): string {
  const configured = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const firstCors = (process.env.CORS_ORIGIN || '').split(',')[0].trim().replace(/\/+$/, '');
  if (firstCors) return firstCors;
  // Dev fallback: the Vite origin that made the request.
  const origin = (req.get('origin') || '').replace(/\/+$/, '');
  return origin || 'http://localhost:3000';
}

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Please enter your email address.' });

    // Checked BEFORE the account lookup, and before anything is sent, so a
    // broken mail configuration answers identically for a registered and an
    // unregistered address. Doing this afterwards leaked which emails have
    // accounts: unknown ones got the generic reply while real ones surfaced the
    // SMTP error. Configuration problems are the server's fault, not the
    // doctor's, so they are reported plainly rather than hidden.
    const status = await ensureEmailReady();
    if (!status.configured) {
      // The diagnosis goes to the operator; the visitor gets a generic message.
      console.error('[auth:forgot-password] email cannot be sent:', status.reason);
      return res.status(503).json({ error: SEND_FAILED_MESSAGE });
    }

    await connectDB();
    const doctor = (await Doctor.findOne({ email }).lean().exec()) as DoctorDoc | null;

    // Same reply whether or not the address is registered, so this form cannot
    // be used to discover which emails have accounts.
    const generic = {
      sent: true,
      message: 'If that email has a CareScribe account, a reset link is on its way.',
    };
    if (!doctor) {
      console.log('[auth:forgot-password] no account for that address; replying generically');
      return res.json(generic);
    }

    // Rate limit per account: a reset form must not become an email cannon.
    const windowStart = new Date(Date.now() - RESET_SEND_WINDOW_MINUTES * 60000);
    const recent = await PasswordReset.countDocuments({
      doctorId: doctor.id,
      createdAt: { $gte: windowStart },
    });
    if (recent >= RESET_MAX_SENDS) {
      return res.status(429).json({
        error: `Too many reset emails requested. Please wait ${RESET_SEND_WINDOW_MINUTES} minutes and try again.`,
      });
    }

    const { lookupId, secret, token } = generateResetToken();
    const link = `${appOrigin(req)}/reset-password?token=${encodeURIComponent(token)}`;

    // Send FIRST. If Gmail rejects it, nothing is stored and the doctor is told
    // the truth rather than being sent to wait for mail that never left.
    try {
      await sendResetLink(doctor.email, link, RESET_TTL_MINUTES);
    } catch (err: any) {
      console.error('[auth:forgot-password] delivery failed:', err?.message || err);
      return res.status(err?.notConfigured ? 503 : 502).json({ error: SEND_FAILED_MESSAGE });
    }

    // Any earlier unused link is void once a new one goes out.
    await PasswordReset.deleteMany({ doctorId: doctor.id, usedAt: null });
    await PasswordReset.create({
      id: crypto.randomUUID(),
      doctorId: doctor.id,
      lookupId,
      tokenHash: await hashSecret(secret),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60000),
    });
    console.log(`[auth:forgot-password] reset link emailed, expires in ${RESET_TTL_MINUTES}m`);

    return res.json(generic);
  } catch (error) {
    if (isDatabaseUnavailable(error)) return res.status(503).json({ error: DB_UNAVAILABLE_MESSAGE });
    console.error('[auth:forgot-password]', error);
    return res.status(500).json({ error: 'Could not start the password reset.' });
  }
});

/** Resolve a token to its still-valid reset row, or null. */
async function findResetByToken(
  token: unknown,
): Promise<{ attempt: PasswordResetDoc; doctor: DoctorDoc } | null> {
  const parts = parseResetToken(token);
  if (!parts) return null;

  const attempt = (await PasswordReset.findOne({
    lookupId: parts.lookupId,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .lean()
    .exec()) as PasswordResetDoc | null;
  if (!attempt) return null;
  if (!(await verifySecret(parts.secret, attempt.tokenHash))) return null;

  const doctor = (await Doctor.findOne({ id: attempt.doctorId }).lean().exec()) as DoctorDoc | null;
  return doctor ? { attempt, doctor } : null;
}

// The reset page calls this on load so an expired link says so immediately
// instead of after the doctor has typed a new password.
app.post('/api/auth/reset-token', async (req, res) => {
  try {
    await connectDB();
    const found = await findResetByToken(req.body?.token);
    if (!found) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }
    return res.json({ valid: true, email: maskEmail(found.doctor.email) });
  } catch (error) {
    if (isDatabaseUnavailable(error)) return res.status(503).json({ error: DB_UNAVAILABLE_MESSAGE });
    console.error('[auth:reset-token]', error);
    return res.status(500).json({ error: 'Could not check that reset link.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const invalid = validateNewPassword(req.body?.password, req.body?.confirmPassword);
    if (invalid) return res.status(400).json({ error: invalid });

    await connectDB();
    const found = await findResetByToken(req.body?.token);
    if (!found) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    // Burn the link in the same breath as changing the password, so it can
    // never be replayed.
    await PasswordReset.updateOne({ id: found.attempt.id }, { $set: { usedAt: new Date() } });
    await Doctor.updateOne(
      { id: found.doctor.id },
      { $set: { passwordHash: await hashPassword(String(req.body.password)) } },
    );
    await PasswordReset.deleteMany({ doctorId: found.doctor.id, usedAt: null });
    console.log('[auth:reset-password] password changed via reset link');

    return res.json({ success: true });
  } catch (error) {
    if (isDatabaseUnavailable(error)) return res.status(503).json({ error: DB_UNAVAILABLE_MESSAGE });
    console.error('[auth:reset-password]', error);
    return res.status(500).json({ error: 'Could not reset the password.' });
  }
});

// Update the signed-in doctor's own profile. The record is located by the id
// on the session, never by an id in the request, so there is no parameter to
// tamper with: a doctor can only ever edit themselves.
app.patch('/api/auth/profile', requireAuth, async (req: AuthedRequest, res) => {
  try {
    // PATCH semantics: a field the caller did not send keeps its current
    // value. Without this, a body carrying only { phoneNumber } would blank the
    // doctor's specialization and hospital as a side effect.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const current = req.doctor!;
    const merged = {
      name: 'name' in body ? body.name : current.name,
      specialization: 'specialization' in body ? body.specialization : current.specialization,
      phoneNumber: 'phoneNumber' in body ? body.phoneNumber : current.phoneNumber,
      hospitalName: 'hospitalName' in body ? body.hospitalName : current.hospitalName,
    };

    const parsed = validateProfile(merged);
    if (parsed.error || !parsed.value) {
      return res.status(400).json({ error: parsed.error || 'Invalid details.' });
    }

    await connectDB();
    const updated = (await Doctor.findOneAndUpdate(
      { id: req.doctor!.id },
      { $set: parsed.value },
      { new: true },
    )
      .lean()
      .exec()) as DoctorDoc | null;

    if (!updated) {
      return res.status(404).json({ error: 'Your account could not be found.' });
    }

    return res.json({ doctor: toPublic(updated) });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      console.error('[auth:profile] database unavailable');
      return res.status(503).json({ error: DB_UNAVAILABLE_MESSAGE });
    }
    console.error('[auth:profile]', error);
    return res.status(500).json({ error: 'Could not save your profile.' });
  }
});

// ─────────────────────────────────────────────────────────────
// Patients
// ─────────────────────────────────────────────────────────────
app.get('/api/patients', requireAuth, async (req: AuthedRequest, res) => {
  try {
    return res.json(await patientsRepo.findAll(req.doctor!.id));
  } catch (error) {
    console.error('[patients]', error);
    return res.json([]);
  }
});

app.post('/api/patients', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const patient = req.body;
    if (!patient?.id) {
      return res.status(400).json({ error: 'patient.id is required' });
    }
    // Patients are stored as a full record (replace).
    await patientsRepo.upsert(req.doctor!.id, patient, true);
    return res.json({ success: true });
  } catch (error) {
    console.error('[save-patient]', error);
    return res.status(500).json({ error: 'Failed to save patient' });
  }
});

// Previous Consultation History — read-only grouping of a patient's existing
// consultations (with their linked reports/prescriptions/transcripts). Creates
// nothing; see services/patientHistory.ts for the linking model.
// Pass ?order=desc to reverse the default oldest → newest ordering.
app.get('/api/patients/:patientId/history', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }
    // Confirm the patient is this doctor's before building anything. The
    // history query is already scoped by doctorId, so a foreign id could only
    // ever return an empty list — but that reads to the doctor as "no visits
    // recorded" when the truthful answer is "no such patient of yours". The
    // lookup is itself scoped, so someone else's patient and a patient that
    // does not exist produce the same 404 and neither confirms the other's
    // existence.
    const patient = await patientsRepo.findById(req.doctor!.id, patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    const order = req.query.order === 'desc' ? 'desc' : 'asc';
    const { buildPatientHistory } = await import('./services/patientHistory');
    const history = await buildPatientHistory(req.doctor!.id, patientId, order);
    return res.json(history);
  } catch (error) {
    console.error('[patient-history]', error);
    return res.status(500).json({ error: 'Failed to load consultation history' });
  }
});

// ─────────────────────────────────────────────────────────────
// Consultations
// ─────────────────────────────────────────────────────────────
app.get('/api/consultations', requireAuth, async (req: AuthedRequest, res) => {
  try {
    return res.json(await consultationsRepo.findAll(req.doctor!.id));
  } catch (error) {
    console.error('[consultations]', error);
    return res.json([]);
  }
});

app.post('/api/save-consultation', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const consultation = req.body;
    if (!consultation?.id) {
      return res.status(400).json({ error: 'consultation.id is required' });
    }
    // Merge so partial updates (e.g. adding a report later) don't wipe fields.
    await consultationsRepo.upsert(req.doctor!.id, consultation);
    return res.json({ success: true });
  } catch (error) {
    console.error('[save-consultation]', error);
    return res.status(500).json({ error: 'Failed to save consultation' });
  }
});

// ─────────────────────────────────────────────────────────────
// Generic collections: reports, prescriptions, transcripts
// ─────────────────────────────────────────────────────────────
function registerCollection(name: string, repo: typeof reportsRepo) {
  app.get(`/api/${name}`, requireAuth, async (req: AuthedRequest, res) => {
    try {
      return res.json(await repo.findAll(req.doctor!.id));
    } catch (error) {
      console.error(`[${name}]`, error);
      return res.json([]);
    }
  });

  app.post(`/api/${name}`, requireAuth, async (req: AuthedRequest, res) => {
    try {
      const doc = req.body;
      if (!doc?.id) {
        return res.status(400).json({ error: 'id is required' });
      }
      await repo.upsert(req.doctor!.id, doc);
      return res.json({ success: true });
    } catch (error) {
      console.error(`[save-${name}]`, error);
      return res.status(500).json({ error: `Failed to save ${name}` });
    }
  });
}

registerCollection('reports', reportsRepo);
registerCollection('prescriptions', prescriptionsRepo);
registerCollection('transcripts', transcriptsRepo);

// ─────────────────────────────────────────────────────────────
// Dashboard stats (all counts come from MongoDB)
// ─────────────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [patients, consultations, reports, prescriptions, transcripts] = await Promise.all([
      patientsRepo.count(req.doctor!.id),
      consultationsRepo.count(req.doctor!.id),
      reportsRepo.count(req.doctor!.id),
      prescriptionsRepo.count(req.doctor!.id),
      transcriptsRepo.count(req.doctor!.id),
    ]);
    return res.json({ patients, consultations, reports, prescriptions, transcripts });
  } catch (error) {
    console.error('[stats]', error);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ─────────────────────────────────────────────────────────────
// Admin (read-only)
//
// A separate, self-contained set of endpoints behind their own password and
// their own session cookie. Nothing above is affected by it: it adds no writes,
// touches no schema, and shares no state with the doctor session.
// ─────────────────────────────────────────────────────────────
registerAdminRoutes(app);

// ─────────────────────────────────────────────────────────────
// Config / capability checks
// ─────────────────────────────────────────────────────────────
app.get('/api/config-test', async (_req, res) => {
  // Reset email reports whether Gmail actually ACCEPTS the credentials, not
  // merely whether the variables are present — a rejected App Password would
  // otherwise be reported as "configured" right up until someone tried to use
  // it. The credentials themselves are never included.
  const mail = await ensureEmailReady();
  res.json({
    sarvam: !!(process.env.SARVAM_API_KEY || '').trim(),
    auth: authConfigured(),
    // Whether an admin password is set — never the password itself.
    admin: adminConfigured(),
    resetEmail: mail.configured,
    database: 'mongodb',
  });
});

// 404 for unknown API routes.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — last line of defence so failures return JSON, not HTML.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled]', err);
  // multer rejects oversized uploads before the route runs — surface a clear,
  // actionable 413 instead of a generic 500.
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Audio file is too large. Maximum size is 25MB.' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// ─────────────────────────────────────────────────────────────
// Keep-alive (Render free tier cold-start mitigation)
// ─────────────────────────────────────────────────────────────
// Render's free plan spins the instance down after ~15 min of inactivity, which
// adds a ~50s cold start to the next request. A lightweight self-ping to the
// health endpoint keeps it warm. Opt-in: only runs when a public base URL is
// known (KEEP_ALIVE_URL, or RENDER_EXTERNAL_URL which Render injects), so local
// dev is unaffected. Read-only — it does not change any API behaviour.
function startKeepAlive() {
  const base = (process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
  if (!base || typeof fetch !== 'function') return;
  // Slightly under Render's 15-min idle window so the instance never sleeps.
  const intervalMs = Number(process.env.KEEP_ALIVE_INTERVAL_MS) || 14 * 60 * 1000;
  const timer = setInterval(() => {
    fetch(`${base}/api/health`).catch(() => {}); // best-effort; failures are harmless
  }, intervalMs);
  // Don't keep the event loop alive solely for the ping.
  timer.unref?.();
  console.log(`💓 Keep-alive enabled → ${base}/api/health every ${Math.round(intervalMs / 60000)} min`);
}

// ─────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  let dbStatus = 'Not connected';
  try {
    await connectDB();
    dbStatus = 'Connected (MongoDB)';
  } catch (error: any) {
    dbStatus = `Connection failed: ${error?.message || error}`;
  }

  // Check the Gmail credentials at startup rather than letting a wrong App
  // Password surface as a mystery failure the first time someone resets.
  const mail = await verifyEmailTransport();
  const mailStatus = mail.configured ? 'Ready (Gmail SMTP)' : 'NOT CONFIGURED';

  console.log('');
  console.log('🚀 CareScribe API Started');
  console.log(`🌐 Server : http://localhost:${PORT}`);
  console.log(`🗄️ Database : ${dbStatus}`);
  console.log(`📧 Reset email : ${mailStatus}`);
  if (!mail.configured) console.error(`   ↳ ${mail.reason}`);
  console.log(`❤️ Health : http://localhost:${PORT}/api/health`);
  console.log('');

  startKeepAlive();
});
