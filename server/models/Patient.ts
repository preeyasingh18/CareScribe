import mongoose from 'mongoose';
import { baseOptions } from './shared';

const { Schema, model, models } = mongoose;

const PatientSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: 'Unknown Patient' },
    age: { type: Number, default: 0 },
    gender: { type: String, default: 'Unknown' },
    phone: { type: String, default: '' },
  },
  { ...baseOptions, collection: 'patients' },
);

// Guard against model re-compilation during dev hot-reloads.
export const Patient = models.Patient || model('Patient', PatientSchema);
