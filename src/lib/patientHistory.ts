import { supabase } from './supabaseClient';

export interface EncounterSummary {
  id: string;
  chief_complaint: string | null;
  status: string;
  started_at: string;
}

export interface DiagnosisSummary {
  id: string;
  diagnosis: string;
  diagnosis_type: string;
  created_at: string;
}

export interface LatestVitals {
  systolic_bp: number | null;
  diastolic_bp: number | null;
  heart_rate: number | null;
  temperature_c: number | null;
  spo2: number | null;
  recorded_at: string;
}

/**
 * A doctor's own clinical history with one patient — encounters and
 * diagnoses are scoped to encounters THIS doctor ran (RLS enforces this:
 * a different doctor's encounters with the same patient aren't visible),
 * which is the correct clinical-confidentiality boundary, not a bug.
 */
export const fetchDoctorPatientHistory = async (
  patientId: string,
  doctorProfileId: string
): Promise<{
  encounters: EncounterSummary[];
  diagnoses: DiagnosisSummary[];
  latestVitals: LatestVitals | null;
  error?: string;
}> => {
  const [encountersRes, diagnosesRes] = await Promise.all([
    supabase
      .from('encounters')
      .select('id, chief_complaint, status, started_at')
      .eq('patient_id', patientId)
      .eq('doctor_profile_id', doctorProfileId)
      .order('started_at', { ascending: false })
      .limit(10),
    supabase
      .from('diagnoses')
      .select('id, diagnosis, diagnosis_type, created_at')
      .eq('patient_id', patientId)
      .eq('doctor_profile_id', doctorProfileId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const failure = encountersRes.error || diagnosesRes.error;
  if (failure) return { encounters: [], diagnoses: [], latestVitals: null, error: failure.message };

  const encounterIds = (encountersRes.data || []).map((e) => e.id);
  let latestVitals: LatestVitals | null = null;
  if (encounterIds.length > 0) {
    const { data: vitalsRows } = await supabase
      .from('vitals')
      .select('systolic_bp, diastolic_bp, heart_rate, temperature_c, spo2, recorded_at')
      .in('encounter_id', encounterIds)
      .order('recorded_at', { ascending: false })
      .limit(1);
    latestVitals = (vitalsRows && vitalsRows[0]) || null;
  }

  return {
    encounters: (encountersRes.data || []) as EncounterSummary[],
    diagnoses: (diagnosesRes.data || []) as DiagnosisSummary[],
    latestVitals,
  };
};
