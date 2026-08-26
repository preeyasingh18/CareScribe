import mongoose from 'mongoose';
import { baseOptions, MedicationSchema } from './shared';

const { Schema, model, models } = mongoose;

const PrescriptionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    // Links this prescription back to its consultation (see Report.ts note).
    consultationId: { type: String, default: '', index: true },
    patientId: { type: String, default: '' },
    patientName: { type: String, default: 'Unknown Patient' },
    date: { type: String, default: '' },
    prescribedMedications: { type: [MedicationSchema], default: [] },
    advice: { type: [String], default: [] },
  },
  { ...baseOptions, collection: 'prescriptions' },
);

export const Prescription = models.Prescription || model('Prescription', PrescriptionSchema);
