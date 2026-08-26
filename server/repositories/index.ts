import { Patient } from '../models/Patient';
import { Consultation } from '../models/Consultation';
import { Transcript } from '../models/Transcript';
import { Report } from '../models/Report';
import { Prescription } from '../models/Prescription';
import { createRepository } from './baseRepository';

// One repository per collection. Routes use these instead of touching
// Mongoose models directly, so the persistence layer stays swappable.
export const patientsRepo = createRepository(Patient);
export const consultationsRepo = createRepository(Consultation);
export const transcriptsRepo = createRepository(Transcript);
export const reportsRepo = createRepository(Report);
export const prescriptionsRepo = createRepository(Prescription);
