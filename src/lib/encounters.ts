import { supabase } from './supabaseClient';
import { startConsultation, completeAppointmentVisit } from './queue';

export interface VitalsInput {
  temperatureC?: number;
  heartRate?: number;
  respiratoryRate?: number;
  spo2?: number;
  systolicBp?: number;
  diastolicBp?: number;
  weightKg?: number;
  heightCm?: number;
}

export interface EncounterRow {
  id: string;
  patient_id: string;
  doctor_profile_id: string | null;
  provider_id: string | null;
  appointment_id: string | null;
  status: string;
  chief_complaint: string | null;
  clinical_notes: string | null;
  follow_up_note: string | null;
  started_at: string;
  ended_at: string | null;
}

export const startEncounter = async (
  patientId: string,
  doctorProfileId: string,
  providerId: string | null,
  appointmentId: string | null,
  chiefComplaint: string
): Promise<{ encounter?: EncounterRow; error?: string }> => {
  const { data, error } = await supabase
    .from('encounters')
    .insert({
      patient_id: patientId,
      doctor_profile_id: doctorProfileId,
      provider_id: providerId,
      appointment_id: appointmentId,
      chief_complaint: chiefComplaint,
      status: 'in_progress',
      created_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .select('*')
    .single();

  if (error) return { error: error.message };

  // Keeps appointments.status (what reception/patient views read) in sync
  // with this real clinical encounter — best-effort: a failure here doesn't
  // block the encounter itself, since the appointment may already be past
  // the queue stage (e.g. telehealth with no reception check-in) where the
  // status transition legitimately doesn't apply.
  if (appointmentId) await startConsultation(appointmentId).catch(() => undefined);

  return { encounter: data as EncounterRow };
};

export const saveVitals = async (
  encounterId: string,
  vitals: VitalsInput
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('vitals').insert({
    encounter_id: encounterId,
    temperature_c: vitals.temperatureC ?? null,
    heart_rate: vitals.heartRate ?? null,
    respiratory_rate: vitals.respiratoryRate ?? null,
    spo2: vitals.spo2 ?? null,
    systolic_bp: vitals.systolicBp ?? null,
    diastolic_bp: vitals.diastolicBp ?? null,
    weight_kg: vitals.weightKg ?? null,
    height_cm: vitals.heightCm ?? null,
    recorded_by: (await supabase.auth.getUser()).data.user?.id,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const saveDiagnosis = async (
  encounterId: string,
  patientId: string,
  doctorProfileId: string,
  diagnosis: string,
  diagnosisType: 'primary' | 'secondary' | 'differential',
  notes: string,
  bodyRegion?: string,
  bodySide?: 'left' | 'right' | 'bilateral' | 'midline'
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('diagnoses').insert({
    encounter_id: encounterId,
    patient_id: patientId,
    doctor_profile_id: doctorProfileId,
    diagnosis,
    diagnosis_type: diagnosisType,
    notes,
    body_region: bodyRegion || null,
    body_side: bodySide || null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const completeEncounter = async (
  encounterId: string,
  clinicalNotes: string,
  followUpNote: string,
  appointmentId?: string | null
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('encounters')
    .update({
      status: 'completed',
      clinical_notes: clinicalNotes,
      follow_up_note: followUpNote,
      ended_at: new Date().toISOString(),
    })
    .eq('id', encounterId);
  if (error) return { success: false, error: error.message };

  // Keeps appointments.status in sync — see startEncounter's same note.
  if (appointmentId) await completeAppointmentVisit(appointmentId).catch(() => undefined);

  return { success: true };
};
