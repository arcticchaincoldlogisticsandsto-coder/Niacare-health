import { supabase } from './supabaseClient';

export interface ScheduleSlotRow {
  id: string;
  schedule_date: string;
  time_slot: string;
  is_booked: boolean;
}

export const fetchDoctorScheduleForDate = async (
  doctorProfileId: string,
  dateIso: string
): Promise<{ slots: ScheduleSlotRow[]; error?: string }> => {
  const { data, error } = await supabase
    .from('doctor_schedule')
    .select('id, schedule_date, time_slot, is_booked')
    .eq('doctor_profile_id', doctorProfileId)
    .eq('schedule_date', dateIso)
    .order('time_slot', { ascending: true });
  if (error) return { slots: [], error: error.message };
  return { slots: (data || []) as ScheduleSlotRow[] };
};

export const addScheduleSlot = async (
  doctorProfileId: string,
  dateIso: string,
  timeSlot: string
): Promise<{ error?: string }> => {
  const { error } = await supabase
    .from('doctor_schedule')
    .upsert(
      { doctor_profile_id: doctorProfileId, schedule_date: dateIso, time_slot: timeSlot, is_booked: false },
      { onConflict: 'doctor_profile_id,schedule_date,time_slot', ignoreDuplicates: true }
    );
  return { error: error?.message };
};

// Only ever removes an unbooked slot — the caller is responsible for not
// offering this action on a booked one; RLS also doesn't special-case this,
// so a booked slot could technically be deleted by its own doctor, but the
// UI never exposes that path.
export const removeScheduleSlot = async (id: string): Promise<{ error?: string }> => {
  const { error } = await supabase.from('doctor_schedule').delete().eq('id', id).eq('is_booked', false);
  return { error: error?.message };
};
