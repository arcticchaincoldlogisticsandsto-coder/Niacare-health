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

export const updatePrescriptionTaken = async (
  id: string,
  takenToday: boolean
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('prescriptions').update({ taken_today: takenToday }).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const updatePrescriptionRefillRequested = async (
  id: string,
  refillRequested: boolean
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase
    .from('prescriptions')
    .update({ refill_requested: refillRequested })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
};
