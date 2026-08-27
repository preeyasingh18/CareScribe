import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

/**
 * A clinician account.
 *
 * Unlike the clinical collections this schema is `strict: true` — an auth
 * document must never absorb stray fields from a request body, and nothing
 * outside this file is allowed to invent properties on it.
 *
 * `passwordHash` holds a bcrypt hash and nothing else; the plaintext password
 * is never stored, logged, or returned. Every read path that reaches the client
 * goes through `toPublic()` so the hash cannot leak by accident.
 */
const DoctorSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    // Stored lowercased so sign-in is case-insensitive and the unique index
    // cannot be defeated by a different capitalisation of the same address.
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    specialization: { type: String, default: 'General Practice', trim: true },
    passwordHash: { type: String, required: true },
  },
  { strict: true, timestamps: true, versionKey: false, collection: 'doctors' },
);

export interface DoctorDoc {
  id: string;
  name: string;
  email: string;
  specialization: string;
  passwordHash: string;
}

/** The only shape of a doctor that is ever allowed to reach the browser. */
export interface PublicDoctor {
  id: string;
  name: string;
  email: string;
  specialization: string;
}

export function toPublic(doc: DoctorDoc): PublicDoctor {
  return {
    id: doc.id,
    name: doc.name,
    email: doc.email,
    specialization: doc.specialization,
  };
}

// Guard against model re-compilation during dev hot-reloads. The explicit
// annotation keeps the `models.X || model(...)` union from widening into
// something TypeScript refuses to run queries on.
export const Doctor: mongoose.Model<any> =
  (models.Doctor as mongoose.Model<any>) || model('Doctor', DoctorSchema);
