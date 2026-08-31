import {
  ReportData,
  Patient,
  Consultation,
  ReportRecord,
  PrescriptionRecord,
  TranscriptRecord,
  ConsultationHistoryItem,
} from '../types';

// In production the frontend (Vercel) and backend (Render) are on different
// origins, so point at the backend via VITE_API_BASE_URL. In local dev it is
// empty and requests use the Vite dev proxy (`/api` → localhost:5000).
const API_ROOT = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const BASE = `${API_ROOT}/api`;

// Extract a server-provided error message ({ error: "..." }) when available,
// falling back to a sensible default.
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error) return data.error as string;
  } catch {
    // response had no JSON body
  }
  return fallback;
}

// fetch with an abort-based timeout. Network-level failures (backend down, dropped
// socket, DNS/CORS) surface in the browser as a bare TypeError "Failed to fetch";
// we translate those into a clear, actionable message instead.
// Called when the server rejects a request as unauthenticated, so the app can
// clear its session state and send the doctor back to the login screen. Set by
// AuthProvider; a no-op until then.
let onUnauthorized: () => void = () => {};

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

/**
 * Plain fetch for the data endpoints, with the two things every authenticated
 * call needs: the session cookie and the shared "you have been signed out"
 * handling.
 *
 * `credentials: 'include'` is not optional here. These requests only looked
 * fine because a same-origin dev proxy sends cookies by default; the moment the
 * API lives on another origin — which is the deployed layout, Vercel to Render,
 * and also what VITE_API_BASE_URL does locally — the default drops the cookie
 * and every one of these endpoints answers 401 with an empty list.
 */
async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, credentials: 'include' });
  if (res.status === 401 && !url.includes('/auth/')) onUnauthorized();
  return res;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      // Sends the httpOnly session cookie, cross-origin included.
      credentials: 'include',
      signal: controller.signal,
    });
    // An expired or revoked session should surface as "signed out", not as a
    // broken page. /api/auth/* is exempt: a failed login is not a lost session.
    if (res.status === 401 && !url.includes('/auth/')) onUnauthorized();
    return res;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('The request timed out. Please check your connection and try again.');
    }
    throw new Error(
      'Could not reach the server. Make sure the backend is running (npm run dev:all), then try again.',
    );
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────
// Authentication
//
// The session itself is an httpOnly cookie set by the server — it is never
// visible to this code. These calls only ever move a doctor's public profile
// (id / name / email / specialization) across the wire; passwords go up once,
// over the same TLS connection as everything else, and are never stored here.
// ─────────────────────────────────────────────────────────────

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization: string;
}

async function authRequest(path: string, body?: unknown): Promise<Doctor | null> {
  const res = await fetchWithTimeout(
    `${BASE}/auth/${path}`,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    20000,
  );

  if (!res.ok) {
    throw new Error(await errorMessage(res, 'Something went wrong. Please try again.'));
  }

  const data = await res.json();
  return (data?.doctor as Doctor) ?? null;
}

/** Restore the session on boot. Returns null when signed out. */
export const fetchCurrentDoctor = (): Promise<Doctor | null> => authRequest('me');

export const signUpDoctor = (input: {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  specialization: string;
}): Promise<Doctor | null> => authRequest('signup', input);

export const logInDoctor = (email: string, password: string): Promise<Doctor | null> =>
  authRequest('login', { email, password });

export async function logOutDoctor(): Promise<void> {
  await fetchWithTimeout(`${BASE}/auth/logout`, { method: 'POST' }, 15000);
}

export async function transcribeAudio(
  blob: Blob,
  language?: string
): Promise<{ transcript: string; rawText: string; audioUrl: string }> {
  const form = new FormData();
  form.append('audio', blob, 'consultation.webm');
  // Forward the selected language; the server treats "Auto Detect" as auto-detect.
  // Do NOT set Content-Type — the browser sets the multipart boundary automatically.
  form.append('language', language || 'Auto Detect');
  // Transcription can take a while — allow up to 3 minutes before giving up.
  const res = await fetchWithTimeout(`${BASE}/transcribe`, { method: 'POST', body: form }, 180000);
  if (!res.ok) {
    // Log the REAL backend reason (not a generic message) so failures are debuggable.
    const message = await errorMessage(res, 'Transcription failed');
    console.error('Transcription failed:', message);
    throw new Error(message);
  }
  return res.json();
}

// Resolve a server-relative media path (e.g. "/api/uploads/x.mp3") into a URL
// the browser can load. In production the backend lives on a different origin
// (API_ROOT), so the stored relative path must be prefixed; in dev the Vite
// proxy makes the relative path work as-is.
export function resolveMediaUrl(audioPath: string): string {
  if (!audioPath) return '';
  if (/^https?:\/\//i.test(audioPath)) return audioPath;
  return `${API_ROOT}${audioPath}`;
}

// Upload an audio file to the active session, transcribe it via the existing
// Whisper endpoint, and persist the audio so it survives a refresh. Uses
// XMLHttpRequest (not fetch) so we can report real upload progress.
export function uploadConsultationAudio(
  file: File,
  options: {
    consultationId: string;
    language?: string;
    onProgress?: (percent: number) => void;
  },
): Promise<{ transcript: string; rawText: string; audioUrl: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('audio', file, file.name);
    form.append('language', options.language || 'Auto Detect');
    form.append('consultationId', options.consultationId);
    // Tell the server to keep the file on disk and return a real audioUrl.
    form.append('persist', 'true');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/transcribe`);
    // Whisper can take a while — match the fetch-based timeout (3 minutes).
    xhr.timeout = 180000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON response
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        // Log the REAL backend reason so an upload failure is debuggable.
        const message = data?.error || xhr.responseText || 'Transcription failed';
        console.error('Transcription failed:', message);
        reject(new Error(message));
      }
    };
    xhr.onerror = () =>
      reject(
        new Error(
          'Could not reach the server. Make sure the backend is running (npm run dev:all), then try again.',
        ),
      );
    xhr.ontimeout = () =>
      reject(new Error('The upload timed out. Please check your connection and try again.'));

    xhr.send(form);
  });
}

// Best-effort delete of a persisted upload file from server storage. Takes the
// stored audioUrl (e.g. "/api/uploads/abc.mp3"). Never throws — if storage
// deletion fails the caller still clears the session's audio reference.
export async function deleteConsultationAudio(audioUrl: string): Promise<void> {
  try {
    if (!audioUrl) return;
    const fileName = audioUrl.split('/').pop();
    if (!fileName) return;
    await apiFetch(`${BASE}/uploads/${encodeURIComponent(fileName)}`, { method: 'DELETE' });
  } catch {
    // Storage deletion is best-effort; ignore failures.
  }
}

export async function translateTranscript(
  text: string,
  targetLanguage: string
): Promise<string> {
  const res = await fetchWithTimeout(
    `${BASE}/translate-transcript`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
    },
    120000,
  );
  if (!res.ok) {
    // Log the REAL backend reason so translation failures are debuggable.
    const message = await errorMessage(res, 'Translation failed');
    console.error('Translation failed:', message);
    throw new Error(message);
  }
  const data = await res.json();
  return data.translatedText as string;
}

export async function generateReport(transcript: string): Promise<ReportData> {
  const res = await fetchWithTimeout(
    `${BASE}/generate-report`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    },
    180000,
  );
  if (!res.ok) throw new Error(await errorMessage(res, 'Report generation failed'));
  return res.json();
}

export async function saveConsultation(consultation: Consultation): Promise<void> {
  const res = await apiFetch(`${BASE}/save-consultation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(consultation),
  });
  if (!res.ok) throw new Error('Failed to save consultation');
}

export async function getPatients(): Promise<Patient[]> {
  const res = await apiFetch(`${BASE}/patients`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch patients');
  return res.json();
}

export async function getConsultations(): Promise<Consultation[]> {
  const res = await apiFetch(`${BASE}/consultations`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch consultations');
  return res.json();
}

// Fetch a single patient's previous consultation history (grouped, read-only).
// Defaults to oldest → newest; pass order='desc' to reverse.
export async function getPatientHistory(
  patientId: string,
  order: 'asc' | 'desc' = 'asc',
): Promise<ConsultationHistoryItem[]> {
  const res = await fetch(
    `${BASE}/patients/${encodeURIComponent(patientId)}/history?order=${order}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to fetch consultation history'));
  return res.json();
}

export async function savePatient(patient: Patient): Promise<void> {
  const res = await apiFetch(`${BASE}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patient),
  });
  if (!res.ok) throw new Error('Failed to save patient');
}

// ── Reports ──────────────────────────────────────────────────
export async function getReports(): Promise<ReportRecord[]> {
  const res = await apiFetch(`${BASE}/reports`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
}

export async function saveReport(report: ReportRecord): Promise<void> {
  const res = await apiFetch(`${BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
  if (!res.ok) throw new Error('Failed to save report');
}

// ── Prescriptions ────────────────────────────────────────────
export async function getPrescriptions(): Promise<PrescriptionRecord[]> {
  const res = await apiFetch(`${BASE}/prescriptions`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch prescriptions');
  return res.json();
}

export async function savePrescription(prescription: PrescriptionRecord): Promise<void> {
  const res = await apiFetch(`${BASE}/prescriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prescription),
  });
  if (!res.ok) throw new Error('Failed to save prescription');
}

// ── Dashboard stats (counts from MongoDB) ────────────────────
export interface DashboardStats {
  patients: number;
  consultations: number;
  reports: number;
  prescriptions: number;
  transcripts: number;
}

export async function getStats(): Promise<DashboardStats> {
  const res = await apiFetch(`${BASE}/stats`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

// ── Transcripts ──────────────────────────────────────────────
export async function getTranscripts(): Promise<TranscriptRecord[]> {
  const res = await apiFetch(`${BASE}/transcripts`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch transcripts');
  return res.json();
}

export async function saveTranscript(transcript: TranscriptRecord): Promise<void> {
  const res = await apiFetch(`${BASE}/transcripts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transcript),
  });
  if (!res.ok) throw new Error('Failed to save transcript');
}