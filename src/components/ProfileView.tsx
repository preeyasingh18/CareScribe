import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Check, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth, initialsFor } from '../auth/AuthContext';

/**
 * The signed-in doctor's own account page.
 *
 * Everything shown is read from the session (which the server rebuilds from the
 * cookie on every request), so there is no id in the URL to point at somebody
 * else's record and nothing here is hardcoded.
 *
 * Name and specialization come from signup and stay editable. Phone and
 * hospital are optional extras that can be added, changed or cleared at any
 * time. Email is read-only: it is the login identifier, and changing it needs a
 * re-verification flow this app does not have.
 *
 * The password row is decoration — a fixed run of dots. No hash is fetched, and
 * the real password has never been in the browser to begin with.
 */

const MASKED_PASSWORD = '••••••••';

export default function ProfileView() {
  const { doctor, ready, updateProfile } = useAuth();

  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Seed the form from the session, and re-seed whenever it changes (a save
  // returns the stored record, and signing in as someone else replaces it).
  useEffect(() => {
    if (!doctor) return;
    setName(doctor.name || '');
    setSpecialization(doctor.specialization || '');
    setPhoneNumber(doctor.phoneNumber || '');
    setHospitalName(doctor.hospitalName || '');
  }, [doctor]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-500">
        <Loader2 size={18} className="mr-2 animate-spin text-brand-600" />
        Loading profile…
      </div>
    );
  }

  // The route guard normally prevents this; it is here so an expired session
  // shows an explanation instead of an empty page.
  if (!doctor) {
    return (
      <div className="p-8">
        <div className="mx-auto flex max-w-md items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Your session has ended.</p>
            <p className="mt-1">Please sign in again to view your profile.</p>
          </div>
        </div>
      </div>
    );
  }

  const dirty =
    name !== (doctor.name || '') ||
    specialization !== (doctor.specialization || '') ||
    phoneNumber !== (doctor.phoneNumber || '') ||
    hospitalName !== (doctor.hospitalName || '');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      // Phone and hospital are optional: an empty string is a valid save, not a
      // reason to block one.
      await updateProfile({ name, specialization, phoneNumber, hospitalName });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const field =
    'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';
  const label = 'mb-1.5 block text-sm font-medium text-slate-700';
  const readOnlyRow =
    'flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-slate-500">Your account information.</p>
      </div>

      <div className="max-w-2xl">
        {/* Identity header */}
        <div className="mb-6 flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:flex-row sm:text-left">
          <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
            {initialsFor(doctor.name)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-slate-900">{doctor.name}</div>
            <div className="truncate text-sm text-slate-500">
              {doctor.specialization || 'Doctor'}
            </div>
            {doctor.createdAt && (
              <div className="mt-1 text-xs text-slate-400">
                Member since{' '}
                {new Date(doctor.createdAt).toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            )}
          </div>
        </div>

        <form
          onSubmit={save}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          noValidate
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label} htmlFor="profile-name">
                Full Name
              </label>
              <input
                id="profile-name"
                className={field}
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={label} htmlFor="profile-email">
                Email
              </label>
              {/* Read-only: this is the sign-in identifier. */}
              <div className={readOnlyRow} id="profile-email">
                <Mail size={15} className="flex-shrink-0 text-slate-400" />
                <span className="truncate">{doctor.email}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Your email is used to sign in and cannot be changed here.
              </p>
            </div>

            <div>
              <label className={label} htmlFor="profile-specialization">
                Specialization
              </label>
              <input
                id="profile-specialization"
                className={field}
                value={specialization}
                onChange={e => setSpecialization(e.target.value)}
                placeholder="e.g. Cardiologist"
              />
            </div>

            <div>
              <label className={label} htmlFor="profile-phone">
                Phone Number <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="profile-phone"
                className={field}
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                autoComplete="tel"
                inputMode="tel"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={label} htmlFor="profile-hospital">
                Hospital / Clinic Name <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="profile-hospital"
                className={field}
                value={hospitalName}
                onChange={e => setHospitalName(e.target.value)}
                placeholder="Where you practise"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={label}>Password</label>
              {/* A fixed string of dots. Nothing derived from the stored hash,
                  which never leaves the server. */}
              <div className={readOnlyRow}>
                <Lock size={15} className="flex-shrink-0 text-slate-400" />
                <span className="tracking-[0.2em]">{MASKED_PASSWORD}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Your password is stored securely and is never shown.
              </p>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {error}
            </p>
          )}

          {saved && !error && (
            <p
              role="status"
              className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              <Check size={16} className="mt-0.5 flex-shrink-0" />
              Profile updated successfully.
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            {dirty && !saving && (
              <span className="text-center text-xs text-slate-400 sm:mr-auto sm:text-left">
                You have unsaved changes.
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
