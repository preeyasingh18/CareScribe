import mongoose from 'mongoose';
import type { SchemaOptions } from 'mongoose';

const { Schema } = mongoose;

// Reusable sub-document shapes shared across the consultation, report,
// transcript and prescription collections. `_id: false` keeps embedded
// documents clean (no per-row ObjectId).

export const MedicationSchema = new Schema(
  {
    medicine: { type: String, default: '' },
    // `dosage` retained for backward compatibility; `dose`/`strength` are the
    // Premium report fields. Non-strict so any subset of columns persists.
    dosage: { type: String, default: '' },
    strength: { type: String, default: '' },
    dose: { type: String, default: '' },
    route: { type: String, default: '' },
    frequency: { type: String, default: '' },
    timing: { type: String, default: '' },
    duration: { type: String, default: '' },
    instructions: { type: String, default: '' },
    purpose: { type: String, default: '' },
    compliance: { type: String, default: '' },
  },
  { _id: false, strict: false },
);

// Named group of findings — Review of Systems, Physical Examination, Orders.
const SystemGroupSchema = new Schema(
  {
    name: { type: String, default: '' },
    findings: { type: [String], default: [] },
  },
  { _id: false },
);

const ComplaintSchema = new Schema(
  { complaint: { type: String, default: '' }, duration: { type: String, default: '' }, severity: { type: String, default: '' } },
  { _id: false },
);

const AllergySchema = new Schema(
  { allergy: { type: String, default: '' }, reaction: { type: String, default: '' }, severity: { type: String, default: '' } },
  { _id: false },
);

export const TranscriptLineSchema = new Schema(
  {
    speaker: { type: String, default: 'Unknown Speaker' },
    text: { type: String, default: '' },
    timestamp: { type: String, default: '' },
  },
  { _id: false },
);

// Premium AI Clinical Report. Kept non-strict so any extra/legacy fields persist.
export const ReportSchema = new Schema(
  {
    clinicalOverview: { type: String, default: '' },
    chiefComplaints: { type: [ComplaintSchema], default: [] },
    historyOfPresentIllness: { type: [String], default: [] },
    pastMedicalHistory: { type: [String], default: [] },
    surgicalHistory: { type: [String], default: [] },
    medicationHistory: { type: [MedicationSchema], default: [] },
    allergies: { type: [AllergySchema], default: [] },
    familyHistory: { type: [String], default: [] },
    socialHistory: { type: [String], default: [] },
    reviewOfSystems: { type: [SystemGroupSchema], default: [] },
    clinicalMeasurements: { type: Schema.Types.Mixed, default: {} },
    physicalExamination: { type: [SystemGroupSchema], default: [] },
    assessment: { type: [String], default: [] },
    prescribedMedications: { type: [MedicationSchema], default: [] },
    ordersDiagnostics: { type: [SystemGroupSchema], default: [] },
    advice: { type: [String], default: [] },
    redFlags: { type: [String], default: [] },
    followUp: { type: Schema.Types.Mixed, default: {} },
    notes: { type: String, default: '' },
    // Compatibility projection consumed by the dashboard / patient views.
    chiefComplaint: { type: [String], default: [] },
  },
  { _id: false, strict: false },
);

// Common options for every top-level collection model.
export const baseOptions: SchemaOptions = {
  // Allow the full nested documents the app sends, even fields not declared here.
  strict: false,
  // Adds createdAt / updatedAt automatically (required for consultations).
  timestamps: true,
  versionKey: false,
};
