import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// Mirrors admin.ts DISPATCH_STATUSES / the emergency_dispatches_status_check
// constraint — kept here too so the patient-facing tracking screen doesn't
// import from the admin module.
export const DISPATCH_STATUS_ORDER = [
  'dispatched', 'requested', 'accepted', 'assigned', 'en_route', 'arrived', 'transporting', 'completed',
] as const;
export type DispatchStatus = (typeof DISPATCH_STATUS_ORDER)[number] | 'cancelled';

export interface DispatchRecord {
  id: string;
  dispatchRef: string;
  status: DispatchStatus;
  condition: string;
  targetFacility: string | null;
  facilityDistanceKm: number | null;
  facilityEtaMin: number | null;
  createdAt: string;
  updatedAt: string;
  patientId: string | null;
}

interface DispatchRow {
  id: string;
  dispatch_ref: string;
  status: string;
  condition: string;
  target_facility: string | null;
  facility_distance_km: number | null;
  facility_eta_min: number | null;
  created_at: string;
  updated_at: string;
  patient_id: string | null;
}

const DISPATCH_SELECT = 'id, dispatch_ref, status, condition, target_facility, facility_distance_km, facility_eta_min, created_at, updated_at, patient_id';

const toDispatchRecord = (row: DispatchRow): DispatchRecord => ({
  id: row.id,
  dispatchRef: row.dispatch_ref,
  status: row.status as DispatchStatus,
  condition: row.condition,
  targetFacility: row.target_facility,
  facilityDistanceKm: row.facility_distance_km,
  facilityEtaMin: row.facility_eta_min,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  patientId: row.patient_id,
});

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
): Promise<{ dispatchId: string; dispatchRef: string; error?: string }> => {
  const dispatchRef = `NC-EMS-${secureNumericCode(8)}`;

  const { data, error } = await supabase
    .from('emergency_dispatches')
    .insert({
      patient_id: input.patientId,
      condition: input.condition,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address,
      dispatch_ref: dispatchRef,
      target_facility: input.targetFacility || null,
      facility_distance_km: input.facilityDistanceKm ?? null,
      facility_eta_min: input.facilityEtaMin ?? null,
    })
    .select('id')
    .single();

  if (error) return { dispatchId: '', dispatchRef, error: error.message };
  return { dispatchId: data.id, dispatchRef };
};

export const fetchDispatch = async (id: string): Promise<{ dispatch: DispatchRecord | null; error?: string }> => {
  const { data, error } = await supabase
    .from('emergency_dispatches')
    .select(DISPATCH_SELECT)
    .eq('id', id)
    .single();
  if (error) return { dispatch: null, error: error.message };
  return { dispatch: toDispatchRecord(data as DispatchRow) };
};

// A signed-in patient can cancel their own dispatch — enforced server-side
// by cancel_own_dispatch() (ownership + status re-checked there, not just
// here), not by this function withholding the button.
export const cancelDispatch = async (id: string): Promise<{ error?: string }> => {
  const { error } = await supabase.rpc('cancel_own_dispatch', { p_dispatch_id: id });
  return { error: error?.message };
};

// Tries a Supabase Realtime subscription for instant updates; the caller
// must still poll underneath regardless (see EmergencyBar.tsx) since this
// project has no way to confirm in advance that the emergency_dispatches
// table is in the project's realtime publication — onConnected only fires
// once the channel actually reports SUBSCRIBED, never assumed.
export const subscribeToDispatch = (
  id: string,
  onChange: (dispatch: DispatchRecord) => void,
  onConnected: (connected: boolean) => void
): { unsubscribe: () => void } => {
  const channel: RealtimeChannel = supabase
    .channel(`emergency_dispatch_${id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'emergency_dispatches', filter: `id=eq.${id}` },
      (payload) => onChange(toDispatchRecord(payload.new as DispatchRow))
    )
    .subscribe((status) => onConnected(status === 'SUBSCRIBED'));

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
};
