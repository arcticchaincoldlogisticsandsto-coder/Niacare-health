import { supabase } from './supabaseClient';

export interface DispatchInput {
  condition: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
  patientId: string | null;
  targetFacility?: string;
  facilityDistanceKm?: number;
  facilityEtaMin?: number;
}

export const createDispatch = async (
  input: DispatchInput
): Promise<{ dispatchRef: string; error?: string }> => {
  const dispatchRef = `NC-EMS-${Math.floor(100000 + Math.random() * 900000)}`;

  const { error } = await supabase.from('emergency_dispatches').insert({
    patient_id: input.patientId,
    condition: input.condition,
    latitude: input.latitude,
    longitude: input.longitude,
    address: input.address,
    dispatch_ref: dispatchRef,
    target_facility: input.targetFacility || null,
    facility_distance_km: input.facilityDistanceKm ?? null,
    facility_eta_min: input.facilityEtaMin ?? null,
  });

  if (error) return { dispatchRef, error: error.message };
  return { dispatchRef };
};
