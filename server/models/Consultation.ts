import mongoose from 'mongoose';
import { baseOptions, ReportSchema, TranscriptLineSchema, MedicationSchema } from './shared';

const { Schema, model, models } = mongoose;

const ConsultationSchema = new Schema(
  {
    id: { type: String, required: true, index: true },
    // Owning clinician (server-stamped from the session). Indexed because every
    // read is scoped by it.
    doctorId: { type: String, required: true, index: true },
    patientId: { type: String, default: '' },
    patientName: { type: String, default: 'Unknown Patient' },
    date: { type: String, default: '' },
    status: { type: String, default: 'Draft' },
    transcript: { type: [TranscriptLineSchema], default: [] },
    transcriptText: { type: String, default: '' },
    originalTranscript: { type: String, default: '' },
    // URL of an uploaded audio file attached to this session (empty for live
    // recordings, which are not persisted).
    audioUrl: { type: String, default: '' },
    report: { type: ReportSchema, default: undefined },
    prescriptions: { type: [MedicationSchema], default: [] },
  },
  { ...baseOptions, collection: 'consultations' },
);

export const Consultation = models.Consultation || model('Consultation', ConsultationSchema);
