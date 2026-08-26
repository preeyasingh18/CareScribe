import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { connectDB, isConnected } from './db';
import {
  patientsRepo,
  consultationsRepo,
  transcriptsRepo,
  reportsRepo,
  prescriptionsRepo,
} from './repositories';

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
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}));
app.use(express.json({ limit: '50mb' }));

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
app.delete('/api/uploads/:filename', (req, res) => {
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
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
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
app.post('/api/translate-transcript', async (req, res) => {
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
app.post('/api/generate-report', async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const { generateMedicalReport } = await import('./services/report');
    const report = await generateMedicalReport(transcript);

    return res.json(report);
  } catch (error: any) {
    console.error('[generate-report]', error);

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
// Patients
// ─────────────────────────────────────────────────────────────
app.get('/api/patients', async (_req, res) => {
  try {
    return res.json(await patientsRepo.findAll());
  } catch (error) {
    console.error('[patients]', error);
    return res.json([]);
  }
});

app.post('/api/patients', async (req, res) => {
  try {
    const patient = req.body;
    if (!patient?.id) {
      return res.status(400).json({ error: 'patient.id is required' });
    }
    // Patients are stored as a full record (replace).
    await patientsRepo.upsert(patient, true);
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
app.get('/api/patients/:patientId/history', async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }
    const order = req.query.order === 'desc' ? 'desc' : 'asc';
    const { buildPatientHistory } = await import('./services/patientHistory');
    const history = await buildPatientHistory(patientId, order);
    return res.json(history);
  } catch (error) {
    console.error('[patient-history]', error);
    return res.status(500).json({ error: 'Failed to load consultation history' });
  }
});

// ─────────────────────────────────────────────────────────────
// Consultations
// ─────────────────────────────────────────────────────────────
app.get('/api/consultations', async (_req, res) => {
  try {
    return res.json(await consultationsRepo.findAll());
  } catch (error) {
    console.error('[consultations]', error);
    return res.json([]);
  }
});

app.post('/api/save-consultation', async (req, res) => {
  try {
    const consultation = req.body;
    if (!consultation?.id) {
      return res.status(400).json({ error: 'consultation.id is required' });
    }
    // Merge so partial updates (e.g. adding a report later) don't wipe fields.
    await consultationsRepo.upsert(consultation);
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
  app.get(`/api/${name}`, async (_req, res) => {
    try {
      return res.json(await repo.findAll());
    } catch (error) {
      console.error(`[${name}]`, error);
      return res.json([]);
    }
  });

  app.post(`/api/${name}`, async (req, res) => {
    try {
      const doc = req.body;
      if (!doc?.id) {
        return res.status(400).json({ error: 'id is required' });
      }
      await repo.upsert(doc);
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
app.get('/api/stats', async (_req, res) => {
  try {
    const [patients, consultations, reports, prescriptions, transcripts] = await Promise.all([
      patientsRepo.count(),
      consultationsRepo.count(),
      reportsRepo.count(),
      prescriptionsRepo.count(),
      transcriptsRepo.count(),
    ]);
    return res.json({ patients, consultations, reports, prescriptions, transcripts });
  } catch (error) {
    console.error('[stats]', error);
    return res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ─────────────────────────────────────────────────────────────
// Config / capability checks
// ─────────────────────────────────────────────────────────────
app.get('/api/config-test', (_req, res) => {
  res.json({
    sarvam: !!(process.env.SARVAM_API_KEY || '').trim(),
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

  console.log('');
  console.log('🚀 NovaScribe API Started');
  console.log(`🌐 Server : http://localhost:${PORT}`);
  console.log(`🗄️ Database : ${dbStatus}`);
  console.log(`❤️ Health : http://localhost:${PORT}/api/health`);
  console.log('');

  startKeepAlive();
});
