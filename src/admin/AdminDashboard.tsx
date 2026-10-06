import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  Loader2,
  LogOut,
  Mail,
  Phone,
  Pill,
  RefreshCw,
  Search,
  Stethoscope,
  User,
  Users,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import {
  AdminUnauthorized,
  fetchAdminOverview,
  fetchDoctorPatients,
  type AdminOverview,
  type AdminPatient,
  type AdminPatientList,
  type AdminVisit,
} from './adminApi';

/**
 * The read-only admin view: every doctor account, with their patients nested
 * underneath.
 *
 * There is nothing in this file that writes. No form posts a record, no button
 * saves, and the API it talks to exposes no mutation to call — expanding a
 * doctor issues a GET and renders what comes back.
 *
 * Patients are loaded per doctor, on first expand, rather than all at once:
 * fetching every visit for every account up front would be a large response
 * that is mostly unread.
 */

const dateOnly = (value: string | null | undefined): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon size={17} strokeWidth={2.1} />
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-brand-950">{value}</p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}

/** A labelled run of bullet points, rendered only when there is something in it. */
function Detail({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-slate-600">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function VisitCard({ visit }: { visit: AdminVisit }) {
  const empty =
    !visit.complaints.length &&
    !visit.assessment.length &&
    !visit.medications.length &&
    !visit.advice.length &&
    !visit.transcript.text;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[13px] font-semibold text-brand-950">
          {dateOnly(visit.date || visit.createdAt)}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
          {visit.status}
        </span>
        {visit.hasAudio && (
          <span className="text-[11px] font-medium text-slate-400">Audio attached</span>
        )}
      </div>

      <Detail label="Complaints" items={visit.complaints} />
      <Detail label="Assessment" items={visit.assessment} />
      <Detail label="Medications" items={visit.medications} />
      <Detail label="Advice" items={visit.advice} />

      {visit.transcript.text && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Transcript
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            {visit.transcript.text}
          </p>
        </div>
      )}

      {empty && <p className="mt-2 text-[13px] text-slate-400">No details recorded.</p>}
    </div>
  );
}

function PatientCard({ patient }: { patient: AdminPatient }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <User size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-brand-950">{patient.name}</span>
          <span className="block truncate text-xs text-slate-500">
            {patient.age ? `${patient.age} yrs` : 'Age not recorded'} · {patient.gender}
            {patient.phone ? ` · ${patient.phone}` : ''}
          </span>
        </span>
        <span className="flex-shrink-0 text-xs text-slate-400">
          {patient.visitCount} {patient.visitCount === 1 ? 'visit' : 'visits'}
        </span>
        <ChevronDown
          size={15}
          className={`flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {[
              ['Age', patient.age ? String(patient.age) : '—'],
              ['Gender', patient.gender || '—'],
              ['Phone', patient.phone || '—'],
              ['Added', dateOnly(patient.createdAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {label}
                </dt>
                <dd className="mt-0.5 truncate text-[13px] text-slate-700">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 space-y-2.5">
            {patient.visits.length ? (
              patient.visits.map(v => <VisitCard key={v.id} visit={v} />)
            ) : (
              <p className="text-[13px] text-slate-400">No visits recorded for this patient.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Per-doctor patient data, once it has been asked for. */
interface Loaded {
  status: 'loading' | 'ready' | 'error';
  data?: AdminPatientList;
  error?: string;
}

function DoctorSection({
  doctor,
  loaded,
  patientQuery,
  onToggle,
  expanded,
}: {
  doctor: AdminOverview['doctors'][number];
  loaded: Loaded | undefined;
  patientQuery: string;
  onToggle: () => void;
  expanded: boolean;
}) {
  const patients = loaded?.data?.patients ?? [];
  const q = patientQuery.trim().toLowerCase();
  const visible = q ? patients.filter(p => p.name.toLowerCase().includes(q)) : patients;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start gap-4 p-5 sm:flex-nowrap">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Stethoscope size={19} strokeWidth={2.1} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-bold tracking-tight text-brand-950">
            {doctor.name}
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-slate-500">{doctor.specialization}</p>

          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Mail size={12} className="flex-shrink-0 text-slate-400" />
              <span className="truncate">{doctor.email}</span>
            </span>
            {doctor.phoneNumber && (
              <span className="inline-flex items-center gap-1.5">
                <Phone size={12} className="text-slate-400" />
                {doctor.phoneNumber}
              </span>
            )}
            {doctor.hospitalName && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Building2 size={12} className="flex-shrink-0 text-slate-400" />
                <span className="truncate">{doctor.hospitalName}</span>
              </span>
            )}
          </div>

          <p className="mt-2 text-xs text-slate-400">
            Account created {dateOnly(doctor.createdAt)}
            {doctor.lastActivity ? ` · Last activity ${dateOnly(doctor.lastActivity)}` : ''}
          </p>
        </div>

        <div className="flex w-full flex-shrink-0 items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end">
          <div className="text-right">
            <p className="text-lg font-bold leading-none text-brand-950">{doctor.patientCount}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              {doctor.patientCount === 1 ? 'Patient' : 'Patients'}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
          >
            {expanded ? 'Hide Patients' : 'View Patients'}
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-5">
          {loaded?.status === 'loading' && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={15} className="animate-spin text-brand-600" />
              Loading patients…
            </p>
          )}

          {loaded?.status === 'error' && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              {loaded.error}
            </p>
          )}

          {loaded?.status === 'ready' && (
            <>
              <div className="space-y-2.5">
                {visible.length ? (
                  visible.map(p => <PatientCard key={p.id} patient={p} />)
                ) : (
                  <p className="text-sm text-slate-500">
                    {patients.length
                      ? 'No patients match that search.'
                      : 'This doctor has no patient records yet.'}
                  </p>
                )}
              </div>

              {!!loaded.data?.unassignedVisits.length && (
                <div className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Sessions without a patient record ({loaded.data.unassignedVisits.length})
                  </p>
                  <div className="mt-2 space-y-2.5">
                    {loaded.data.unassignedVisits.map(v => (
                      <VisitCard key={v.id} visit={v} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [patients, setPatients] = useState<Record<string, Loaded>>({});

  const [doctorQuery, setDoctorQuery] = useState('');
  const [patientQuery, setPatientQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await fetchAdminOverview());
    } catch (err) {
      // An expired session drops back to the password screen rather than
      // showing a broken page.
      if (err instanceof AdminUnauthorized) return onSignOut();
      setError(err instanceof Error ? err.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, [onSignOut]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleDoctor = useCallback(
    async (doctorId: string) => {
      setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(doctorId)) next.delete(doctorId);
        else next.add(doctorId);
        return next;
      });

      // Fetch once, then keep it — collapsing and re-expanding should not
      // re-query.
      if (patients[doctorId]?.status === 'ready') return;

      setPatients(prev => ({ ...prev, [doctorId]: { status: 'loading' } }));
      try {
        const data = await fetchDoctorPatients(doctorId);
        setPatients(prev => ({ ...prev, [doctorId]: { status: 'ready', data } }));
      } catch (err) {
        if (err instanceof AdminUnauthorized) return onSignOut();
        setPatients(prev => ({
          ...prev,
          [doctorId]: {
            status: 'error',
            error: err instanceof Error ? err.message : 'Could not load patients.',
          },
        }));
      }
    },
    [patients, onSignOut],
  );

  const doctors = useMemo(() => {
    const q = doctorQuery.trim().toLowerCase();
    if (!overview) return [];
    if (!q) return overview.doctors;
    return overview.doctors.filter(
      d =>
        d.name.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q),
    );
  }, [overview, doctorQuery]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3.5 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <BrandLogo size={28} priority />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-brand-950">
                Admin Dashboard
              </p>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                View only
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={13} />
              Exit
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {loading && !overview && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin text-brand-600" />
            Loading…
          </p>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
            <div>
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-2 font-semibold underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {overview && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Overview
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                <Stat icon={Stethoscope} label="Doctors" value={overview.totals.doctors} />
                <Stat icon={Users} label="Patients" value={overview.totals.patients} />
                <Stat
                  icon={ClipboardList}
                  label="Consultations"
                  value={overview.totals.consultations}
                />
                <Stat icon={FileText} label="Reports" value={overview.totals.reports} />
              </div>
            </section>

            <section className="mt-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Doctors
                </h2>
                <span className="text-xs text-slate-400">
                  {doctors.length} of {overview.doctors.length} shown
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="relative block">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                    type="search"
                    placeholder="Search doctors by name, email or specialization"
                    value={doctorQuery}
                    onChange={e => setDoctorQuery(e.target.value)}
                  />
                </label>
                <label className="relative block">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                    type="search"
                    placeholder="Filter patients by name"
                    value={patientQuery}
                    onChange={e => setPatientQuery(e.target.value)}
                  />
                </label>
              </div>

              <div className="mt-4 space-y-3">
                {doctors.length ? (
                  doctors.map(doctor => (
                    <DoctorSection
                      key={doctor.id}
                      doctor={doctor}
                      expanded={expanded.has(doctor.id)}
                      loaded={patients[doctor.id]}
                      patientQuery={patientQuery}
                      onToggle={() => void toggleDoctor(doctor.id)}
                    />
                  ))
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                    {overview.doctors.length
                      ? 'No doctors match that search.'
                      : 'No doctor accounts yet.'}
                  </p>
                )}
              </div>
            </section>

            <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <Pill size={12} />
              This dashboard is read-only. Nothing here can change a record.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
