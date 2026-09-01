import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;

/**
 * A single password-reset link.
 *
 * This is a short-lived token store, not a second account record — it points at
 * an existing doctor by `doctorId` and holds nothing about them beyond that.
 *
 * The token is stored as a bcrypt hash, exactly like a password: whoever holds
 * the emailed link can set a new password, so a leaked dump of this collection
 * must not be enough to do the same. `expiresAt` carries a TTL index so Mongo
 * clears spent links itself, and `usedAt` makes the link single-use even while
 * it is still inside its lifetime.
 */
const PasswordResetSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    doctorId: { type: String, required: true, index: true },
    // Public half of the link (?token=<lookupId>.<secret>); indexed for lookup.
    lookupId: { type: String, required: true, unique: true, index: true },
    tokenHash: { type: String, required: true },
    // Set the moment the password is actually changed — the link is finished.
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { strict: true, timestamps: true, versionKey: false, collection: 'passwordResets' },
);

// Mongo removes the document once expiresAt passes, so spent links do not pile up.
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export interface PasswordResetDoc {
  id: string;
  doctorId: string;
  lookupId: string;
  tokenHash: string;
  usedAt: Date | null;
  expiresAt: Date;
  createdAt?: Date;
}

export const PasswordReset: mongoose.Model<any> =
  (models.PasswordReset as mongoose.Model<any>) || model('PasswordReset', PasswordResetSchema);
