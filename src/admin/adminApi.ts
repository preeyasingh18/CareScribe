// Client for the read-only admin endpoints.
//
// Kept separate from services/api.ts on purpose: the admin view has its own
// session and shares no state with a doctor's, and nothing here should ever be
// reachable from the dashboard's data layer.
//
// There is no password in this file, and no check against one. The password is
// posted once to /api/admin/login and judged by the server; everything below
// simply carries the cookie the server set and reports what came back.

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const BASE = `${API_ROOT}/api/admin`;

export interface AdminDoctor {
  id: string;
  name: string;
  email: string;
  specialization: string;
  phoneNumber: string;
  hospitalName: string;
  createdAt?: string;
  patientCount: number;
  consultationCount: number;
  reportCount: number;
  prescriptionCount: number;
  transcriptCount: number;
  lastActivity: string | null;
}

export interface AdminVisit {
  id: string;
  date: string;
  status: string;
  createdAt: string | null;
  patientName: string;
  hasAudio: boolean;
  transcript: { text: string; truncated: boolean };
  complaints: string[];
  assessment: string[];
  medications: string[];
  advice: string[];
}

export interface AdminPatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  createdAt: string | null;
  visitCount: number;
  lastVisit: string | null;
  visits: AdminVisit[];
}

export interface AdminOverview {
  totals: {
    doctors: number;
    patients: number;
    consultations: number;
    reports: number;
    prescriptions: number;
  };
  doctors: AdminDoctor[];
}

export interface AdminPatientList {
  doctor: Omit<AdminDoctor, 'patientCount' | 'consultationCount' | 'reportCount' | 'prescriptionCount' | 'transcriptCount' | 'lastActivity'>;
  patients: AdminPatient[];
  unassignedVisits: AdminVisit[];
}

/** Raised when the server says the admin session is missing or expired. */
export class AdminUnauthorized extends Error {
  constructor() {
    super('Admin session expired.');
    this.name = 'AdminUnauthorized';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    // `credentials: 'include'` so the httpOnly admin cookie travels, including
    // when the API is on another origin.
    res = await fetch(`${BASE}${path}`, { ...init, credentials: 'include' });
  } catch {
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }

  // A 401 means "your session is gone" everywhere except on the login call,
  // where it means the password was wrong. Mapping both to the same error would
  // answer a bad password with "Admin session expired."
  if (res.status === 401 && path !== '/login') throw new AdminUnauthorized();

  if (!res.ok) {
    let message = 'Something went wrong. Please try again.';
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* no JSON body */
    }
    throw new Error(message);
  }

  return res.json();
}

const post = <T,>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** Is there already a valid admin session? Returns no data either way. */
export const checkAdminSession = (): Promise<{ authenticated: boolean; available: boolean }> =>
  request('/session');

export const adminLogin = (password: string): Promise<{ authenticated: boolean }> =>
  post('/login', { password });

export const adminLogout = (): Promise<{ authenticated: boolean }> => post('/logout');

export const fetchAdminOverview = (): Promise<AdminOverview> => request('/overview');

export const fetchDoctorPatients = (doctorId: string): Promise<AdminPatientList> =>
  request(`/doctors/${encodeURIComponent(doctorId)}/patients`);
