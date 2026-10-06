import type express from 'express';
import type { Model } from 'mongoose';
import { connectDB } from './db';
import { Doctor, toPublic, type DoctorDoc } from './models/Doctor';
import { Patient } from './models/Patient';
import { Consultation } from './models/Consultation';
import { Report } from './models/Report';
import { Prescription } from './models/Prescription';
import { Transcript } from './models/Transcript';
import { isDatabaseUnavailable, DB_UNAVAILABLE_MESSAGE } from './auth';
import {
  LOCKED_OUT_MESSAGE,
  adminConfigured,
  attemptsRemaining,
  clearAdminSession,
  clearAttempts,
  hasAdminSession,
  issueAdminSession,
  passwordMatches,
  recordFailedAttempt,
  requireAdmin,
} from './admin';

/**
 * Read-only admin endpoints.
 *
 * Every route here is a GET behind `requireAdmin`, apart from the two that open
 * and close the admin session. There is no create, update or delete: this
 * module imports the models purely to query them, and nothing in it writes to
 * the database.
 *
 * The doctor → patient relationship is the one the app already uses — patients,
 * consultations, reports, prescriptions and transcripts each carry a
 * `doctorId` matching `Doctor.id`, stamped from the session when the record was
 * created. Nothing new is introduced to link them.
 */

// Only Doctor carries an explicit model annotation; the clinical models resolve
// to a `models.X || model(...)` union that TypeScript will not run a typed query
// against. Narrowing them here keeps those model files untouched.
const Patients = Patient as Model<any>;
const Consultations = Consultation as Model<any>;

/** Fields that must never leave the server, whatever a document happens to hold. */
const HIDE = { _id: 0, __v: 0, passwordHash: 0 } as const;

/** Where the request came from, for throttling failed password attempts. */
function clientIp(req: express.Request): string {
  const forwarded = (req.headers['x-forwarded-for'] as string) || '';
  return forwarded.split(',')[0].trim() || req.ip || 'unknown';
}

/** Group a collection by `doctorId` into a count plus the latest activity. */
async function countByDoctor(
  model: { aggregate: (p: unknown[]) => { exec: () => Promise<any[]> } },
): Promise<Map<string, { count: number; latest: string | null }>> {
  const rows = await model
    .aggregate([
      {
        $group: {
          _id: '$doctorId',
          count: { $sum: 1 },
          latest: { $max: { $ifNull: ['$updatedAt', '$createdAt'] } },
        },
      },
    ])
    .exec();

  const out = new Map<string, { count: number; latest: string | null }>();
  for (const row of rows) {
    out.set(String(row._id ?? ''), {
      count: row.count || 0,
      latest: row.latest ? new Date(row.latest).toISOString() : null,
    });
  }
  return out;
}

const iso = (value: unknown): string | null =>
  value ? new Date(value as string).toISOString() : null;

/** The most recent of two ISO timestamps, either of which may be missing. */
function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Flatten a stored report into the handful of lines worth reading in a list.
 *
 * Only fields that already exist on the report schema are read; anything absent
 * simply produces an empty array, so a consultation saved before a field
 * existed renders as a visit with fewer details rather than an error.
 */
function summariseReport(report: any): {
  complaints: string[];
  assessment: string[];
  medications: string[];
  advice: string[];
} {
  if (!report || typeof report !== 'object') {
    return { complaints: [], assessment: [], medications: [], advice: [] };
  }

  // Two shapes exist in the data: the structured `chiefComplaints` objects and
  // the flat `chiefComplaint` strings kept for the dashboard views.
  const structured: string[] = Array.isArray(report.chiefComplaints)
    ? report.chiefComplaints
        .map((c: any) => [c?.complaint, c?.duration, c?.severity].filter(Boolean).join(' · '))
        .filter(Boolean)
    : [];
  const flat: string[] = Array.isArray(report.chiefComplaint)
    ? report.chiefComplaint.filter((c: any) => typeof c === 'string' && c.trim())
    : [];

  const medications: string[] = Array.isArray(report.prescribedMedications)
    ? report.prescribedMedications
        .map((m: any) =>
          [m?.medicine, m?.strength || m?.dosage, m?.frequency, m?.duration]
            .filter(Boolean)
            .join(' · '),
        )
        .filter(Boolean)
    : [];

  return {
    complaints: structured.length ? structured : flat,
    assessment: Array.isArray(report.assessment) ? report.assessment.filter(Boolean) : [],
    medications,
    advice: Array.isArray(report.advice) ? report.advice.filter(Boolean) : [],
  };
}

/** Transcripts can run to thousands of words; a list view only needs the start. */
const EXCERPT_CHARS = 600;

function excerpt(text: unknown): { text: string; truncated: boolean } {
  const value = String(text || '').trim();
  if (value.length <= EXCERPT_CHARS) return { text: value, truncated: false };
  return { text: `${value.slice(0, EXCERPT_CHARS).trimEnd()}…`, truncated: true };
}

export function registerAdminRoutes(app: express.Express): void {
  // ── session ────────────────────────────────────────────────────────────────

  /**
   * Exchange the admin password for a session cookie.
   *
   * The comparison happens here and only here. The password is not sent to the
   * browser at any point, and a wrong guess is answered with a fixed message
   * that says nothing about the real value.
   */
  app.post('/api/admin/login', (req, res) => {
    if (!adminConfigured()) {
      // Deliberately vague: an unconfigured server should not advertise which
      // variable is missing to whoever is knocking.
      return res.status(503).json({ error: 'Admin access is unavailable on this server.' });
    }

    const ip = clientIp(req);
    if (attemptsRemaining(ip) <= 0) {
      return res.status(429).json({ error: LOCKED_OUT_MESSAGE });
    }

    const password = req.body?.password;
    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Please enter the admin password.' });
    }

    if (!passwordMatches(password)) {
      recordFailedAttempt(ip);
      return res.status(401).json({ error: 'Incorrect password' });
    }

    clearAttempts(ip);
    issueAdminSession(res);
    return res.json({ authenticated: true });
  });

  app.post('/api/admin/logout', (_req, res) => {
    clearAdminSession(res);
    return res.json({ authenticated: false });
  });

  /**
   * Called when /admin loads, so a refresh inside the session window goes
   * straight back to the dashboard. It reports only whether the caller is
   * authenticated — never any data.
   */
  app.get('/api/admin/session', (req, res) => {
    return res.json({ authenticated: hasAdminSession(req), available: adminConfigured() });
  });

  // ── data (read-only) ───────────────────────────────────────────────────────

  /**
   * Every doctor account, each with a count of the records that belong to it.
   *
   * Doctors are projected through `toPublic()`, the same function the rest of
   * the app uses, so the password hash is absent by construction rather than by
   * remembering to delete it here.
   */
  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    try {
      await connectDB();

      const [docs, patientsBy, consultsBy, reportsBy, prescriptionsBy, transcriptsBy] =
        await Promise.all([
          Doctor.find({}, HIDE).sort({ createdAt: -1 }).lean().exec(),
          countByDoctor(Patient),
          countByDoctor(Consultation),
          countByDoctor(Report),
          countByDoctor(Prescription),
          countByDoctor(Transcript),
        ]);

      const doctors = (docs as unknown as DoctorDoc[]).map(doc => {
        const patients = patientsBy.get(doc.id);
        const consultations = consultsBy.get(doc.id);
        return {
          ...toPublic(doc),
          patientCount: patients?.count || 0,
          consultationCount: consultations?.count || 0,
          reportCount: reportsBy.get(doc.id)?.count || 0,
          prescriptionCount: prescriptionsBy.get(doc.id)?.count || 0,
          transcriptCount: transcriptsBy.get(doc.id)?.count || 0,
          lastActivity: laterOf(patients?.latest || null, consultations?.latest || null),
        };
      });

      const sum = (m: Map<string, { count: number }>) =>
        [...m.values()].reduce((total, v) => total + v.count, 0);

      return res.json({
        totals: {
          doctors: doctors.length,
          patients: sum(patientsBy),
          consultations: sum(consultsBy),
          reports: sum(reportsBy),
          prescriptions: sum(prescriptionsBy),
        },
        doctors,
      });
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return res.status(503).json({ error: DB_UNAVAILABLE_MESSAGE });
      }
      console.error('[admin:overview]', error);
      return res.status(500).json({ error: 'Could not load the overview.' });
    }
  });

  /**
   * One doctor's patients, each with the visits recorded against them.
   *
   * The grouping is `Patient.doctorId` → `Doctor.id`, then
   * `Consultation.patientId` → `Patient.id` within that same doctor. Both
   * queries are scoped by `doctorId`, so a consultation belonging to another
   * clinician cannot appear under this one even if two doctors happened to use
   * the same patient id.
   */
  app.get('/api/admin/doctors/:doctorId/patients', requireAdmin, async (req, res) => {
    try {
      const doctorId = String(req.params.doctorId || '');
      if (!doctorId) return res.status(400).json({ error: 'A doctor id is required.' });

      await connectDB();

      const doctor = (await Doctor.findOne({ id: doctorId }, HIDE).lean().exec()) as
        | DoctorDoc
        | null;
      if (!doctor) return res.status(404).json({ error: 'No such doctor.' });

      const [patientDocs, consultationDocs] = await Promise.all([
        Patients.find({ doctorId }, { _id: 0, __v: 0 }).sort({ createdAt: -1 }).lean().exec(),
        Consultations.find({ doctorId }, { _id: 0, __v: 0 })
          .sort({ createdAt: -1 })
          .lean()
          .exec(),
      ]);

      // Bucket the visits by patient id in one pass rather than querying per
      // patient, and keep the ones whose patientId no longer matches a record
      // so nothing that exists in the data silently disappears from the view.
      const visitsByPatient = new Map<string, any[]>();
      const orphanVisits: any[] = [];

      const knownPatientIds = new Set(patientDocs.map((p: any) => String(p.id)));

      for (const c of consultationDocs as any[]) {
        const visit = {
          id: String(c.id || ''),
          date: c.date || iso(c.createdAt) || '',
          status: c.status || 'Draft',
          createdAt: iso(c.createdAt),
          patientName: c.patientName || 'Unknown Patient',
          hasAudio: Boolean(c.audioUrl),
          transcript: excerpt(c.transcriptText),
          ...summariseReport(c.report),
        };
        const key = String(c.patientId || '');
        if (key && knownPatientIds.has(key)) {
          const list = visitsByPatient.get(key);
          if (list) list.push(visit);
          else visitsByPatient.set(key, [visit]);
        } else {
          orphanVisits.push(visit);
        }
      }

      const patients = (patientDocs as any[]).map(p => {
        const visits = visitsByPatient.get(String(p.id)) || [];
        return {
          id: String(p.id || ''),
          name: p.name || 'Unknown Patient',
          age: typeof p.age === 'number' ? p.age : 0,
          gender: p.gender || 'Unknown',
          phone: p.phone || '',
          createdAt: iso(p.createdAt),
          visitCount: visits.length,
          lastVisit: visits[0]?.date || null,
          visits,
        };
      });

      return res.json({
        doctor: toPublic(doctor),
        patients,
        // Sessions recorded without a saved patient record. Shown separately so
        // the totals on the overview always add up.
        unassignedVisits: orphanVisits,
      });
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        return res.status(503).json({ error: DB_UNAVAILABLE_MESSAGE });
      }
      console.error('[admin:patients]', error);
      return res.status(500).json({ error: 'Could not load the patient list.' });
    }
  });
}
