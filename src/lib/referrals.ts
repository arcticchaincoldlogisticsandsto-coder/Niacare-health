import { supabase } from './supabaseClient';

export type ReferralUrgency = 'routine' | 'urgent' | 'emergency';
export type ReferralStatus = 'pending' | 'scheduled' | 'completed' | 'cancelled';

export interface Referral {
  id: string;
  patientId: string;
  referringDoctorName: string;
  destinationFacility: string;
  destinationSpecialty: string;
  reason: string;
  urgency: ReferralUrgency;
  status: ReferralStatus;
  createdAt: string;
}

interface ReferralRow {
  id: string;
  patient_id: string;
  referring_doctor_profile_id: string;
  destination_provider_id: string | null;
  destination_specialty: string;
  reason: string;
  urgency: ReferralUrgency;
  status: ReferralStatus;
  created_at: string;
}

// Only succeeds when the caller (a doctor) has a real appointment/encounter
// relationship with the patient — see create_referral() in
// supabase/schema.sql.
export const createReferral = async (
  patientId: string,
  destinationProviderId: string | null,
  destinationSpecialty: string,
  reason: string,
  urgency: ReferralUrgency
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.rpc('create_referral', {
    p_patient_id: patientId,
    p_destination_provider_id: destinationProviderId,
    p_destination_specialty: destinationSpecialty,
    p_reason: reason,
    p_urgency: urgency,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const fetchReferralsForPatient = async (
  patientId: string
): Promise<{ referrals: Referral[]; error?: string }> => {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) return { referrals: [], error: error.message };
  const rows = (data || []) as ReferralRow[];

  const doctorProfileIds = [...new Set(rows.map((r) => r.referring_doctor_profile_id))];
  const doctorNames = new Map<string, string>();
  if (doctorProfileIds.length > 0) {
    const { data: docs } = await supabase.from('doctor_profiles').select('id, user_id').in('id', doctorProfileIds);
    const userIds = (docs || []).map((d) => d.user_id);
    const namesByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      for (const p of profileRows || []) namesByUserId.set(p.id, p.full_name);
    }
    for (const d of docs || []) doctorNames.set(d.id, namesByUserId.get(d.user_id) || 'Doctor');
  }

  const providerIds = rows.map((r) => r.destination_provider_id).filter((id): id is string => !!id);
  const providerNames = new Map<string, string>();
  if (providerIds.length > 0) {
    const { data: providerRows } = await supabase.from('providers').select('id, name').in('id', providerIds);
    for (const p of providerRows || []) providerNames.set(p.id, p.name);
  }

  return {
    referrals: rows.map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      referringDoctorName: doctorNames.get(row.referring_doctor_profile_id) || 'Doctor',
      destinationFacility: (row.destination_provider_id && providerNames.get(row.destination_provider_id)) || '',
      destinationSpecialty: row.destination_specialty,
      reason: row.reason,
      urgency: row.urgency,
      status: row.status,
      createdAt: row.created_at,
    })),
  };
};
