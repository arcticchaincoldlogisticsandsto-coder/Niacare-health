import { supabase } from './supabaseClient';

const secureNumericCode = (digits: number): string => {
  const min = 10 ** (digits - 1);
  const span = 9 * min;
  const array = new Uint32Array(1);
  globalThis.crypto?.getRandomValues(array);
  return String(min + (array[0] % span));
};

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
  const dispatchRef = `NC-EMS-${secureNumericCode(8)}`;

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
