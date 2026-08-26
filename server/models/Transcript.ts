import mongoose from 'mongoose';
import { baseOptions, TranscriptLineSchema } from './shared';

const { Schema, model, models } = mongoose;

const TranscriptSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    // Links this transcript back to its consultation (see Report.ts note).
    consultationId: { type: String, default: '', index: true },
    patientId: { type: String, default: '' },
    patientName: { type: String, default: 'Unknown Patient' },
    date: { type: String, default: '' },
    transcript: { type: [TranscriptLineSchema], default: [] },
    transcriptText: { type: String, default: '' },
  },
  { ...baseOptions, collection: 'transcripts' },
);

export const Transcript = models.Transcript || model('Transcript', TranscriptSchema);
