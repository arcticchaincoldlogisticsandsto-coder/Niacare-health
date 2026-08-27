import { supabase } from './supabaseClient';

export interface Prescription {
  id: string;
  medicationName: string;
  dosageInstructions: string;
  prescribedBy: string;
  isSos: boolean;
  daysRemaining: number | null;
  takenToday: boolean;
  refillRequested: boolean;
  createdAt: string;
}

interface PrescriptionRow {
  id: string;
  medication_name: string;
  dosage_instructions: string | null;
  prescribed_by: string | null;
  is_sos: boolean;
  days_remaining: number | null;
  taken_today: boolean;
  refill_requested: boolean;
  created_at: string;
}

const mapRowToPrescription = (row: PrescriptionRow): Prescription => ({
  id: row.id,
  medicationName: row.medication_name,
  dosageInstructions: row.dosage_instructions || '',
  prescribedBy: row.prescribed_by || '',
  isSos: row.is_sos,
  daysRemaining: row.days_remaining,
  takenToday: row.taken_today,
  refillRequested: row.refill_requested,
  createdAt: row.created_at,
});

export const fetchPrescriptions = async (
  patientId: string
): Promise<{ prescriptions: Prescription[]; error?: string }> => {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) return { prescriptions: [], error: error.message };
  return { prescriptions: (data as PrescriptionRow[]).map(mapRowToPrescription) };
};

// Patients no longer have raw UPDATE access to prescriptions (RLS would
// otherwise let them rewrite medication_name/dosage_instructions on a real,
// doctor-issued prescription — see supabase/schema.sql). This calls a
// SECURITY DEFINER function that only ever touches taken_today.
export const updatePrescriptionTaken = async (
  id: string,
  takenToday: boolean
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.rpc('set_prescription_taken', { p_id: id, p_taken: takenToday });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const insertPrescription = async (
  patientId: string,
  encounterId: string | null,
  medicationName: string,
  dosageInstructions: string,
  prescribedBy: string
): Promise<{ prescription?: Prescription; error?: string }> => {
  const { data, error } = await supabase
    .from('prescriptions')
    .insert({
      patient_id: patientId,
      encounter_id: encounterId,
      medication_name: medicationName,
      dosage_instructions: dosageInstructions,
      prescribed_by: prescribedBy,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .select('*')
    .single();

  if (error) return { error: error.message };
  return { prescription: mapRowToPrescription(data as PrescriptionRow) };
};

// Only ever called to request a refill (never to un-request one) anywhere
// in the app today, matching the request_prescription_refill() RPC below,
// which only sets the flag true.
export const updatePrescriptionRefillRequested = async (
  id: string,
  refillRequested: boolean
): Promise<{ success: boolean; error?: string }> => {
  if (!refillRequested) {
    return { success: false, error: 'Cancelling a refill request is not supported.' };
  }
  const { error } = await supabase.rpc('request_prescription_refill', { p_id: id });
  if (error) return { success: false, error: error.message };
  return { success: true };
};
