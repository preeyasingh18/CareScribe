import mongoose from 'mongoose';
import { baseOptions, ReportSchema } from './shared';

const { Schema, model, models } = mongoose;

const ReportRecordSchema = new Schema(
  {
    id: { type: String, required: true, index: true },
    // Owning clinician (server-stamped from the session). Indexed because every
    // read is scoped by it.
    doctorId: { type: String, required: true, index: true },
    // Links this report back to its consultation. Defaults to `id`, which the
    // app already sets equal to the consultation id, so existing records group
    // correctly even before this field is populated.
    consultationId: { type: String, default: '', index: true },
    patientId: { type: String, default: '' },
    patientName: { type: String, default: 'Unknown Patient' },
    date: { type: String, default: '' },
    report: { type: ReportSchema, default: undefined },
  },
  { ...baseOptions, collection: 'reports' },
);

export const Report = models.Report || model('Report', ReportRecordSchema);
