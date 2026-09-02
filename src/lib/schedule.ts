import { supabase } from './supabaseClient';
import { logAuditEvent } from './audit';

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
  if (!error) logAuditEvent('SCHEDULE_CHANGED', 'doctor_schedule', doctorProfileId, undefined, { action: 'slot_added', date: dateIso, time_slot: timeSlot });
  return { error: error?.message };
};

// Only ever removes an unbooked slot — the caller is responsible for not
// offering this action on a booked one; RLS also doesn't special-case this,
// so a booked slot could technically be deleted by its own doctor, but the
// UI never exposes that path.
export const removeScheduleSlot = async (id: string): Promise<{ error?: string }> => {
  const { error } = await supabase.from('doctor_schedule').delete().eq('id', id).eq('is_booked', false);
  if (!error) logAuditEvent('SCHEDULE_CHANGED', 'doctor_schedule', id, undefined, { action: 'slot_removed' });
  return { error: error?.message };
};

export interface WeeklyAvailabilityRule {
  weekdays: number[]; // 0 = Sunday .. 6 = Saturday
  startTime: string; // "08:00", 24h
  endTime: string; // "17:00", 24h
  slotMinutes: number;
  breakStart?: string; // "12:00"
  breakEnd?: string; // "13:00"
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const formatSlotLabel = (minutesSinceMidnight: number): string => {
  const hour24 = Math.floor(minutesSinceMidnight / 60);
  const minute = minutesSinceMidnight % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
};

// Bulk-generates real doctor_schedule rows from a recurring weekly pattern
// (e.g. "Mon-Fri, 08:00-17:00, 30 min slots, lunch break 12:00-13:00") —
// replaces clicking "add slot" one at a time for every date. Upserts with
// ignoreDuplicates so re-running a pattern (or one that overlaps an
// already-generated week) never errors or duplicates existing slots, and
// never touches a slot that's already booked (upsert only inserts new rows;
// it doesn't rewrite time_slot on conflict).
export const generateWeeklySlots = async (
  doctorProfileId: string,
  rule: WeeklyAvailabilityRule,
  weeksAhead: number = 4
): Promise<{ created: number; error?: string }> => {
  const startMin = toMinutes(rule.startTime);
  const endMin = toMinutes(rule.endTime);
  if (!(startMin < endMin) || rule.slotMinutes <= 0) {
    return { created: 0, error: 'Invalid time range.' };
  }
  const breakStartMin = rule.breakStart ? toMinutes(rule.breakStart) : null;
  const breakEndMin = rule.breakEnd ? toMinutes(rule.breakEnd) : null;

  const rows: { doctor_profile_id: string; schedule_date: string; time_slot: string; is_booked: boolean }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < weeksAhead * 7; dayOffset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    if (!rule.weekdays.includes(d.getDay())) continue;
    const dateIso = d.toISOString().slice(0, 10);

    for (let t = startMin; t + rule.slotMinutes <= endMin; t += rule.slotMinutes) {
      if (breakStartMin !== null && breakEndMin !== null && t < breakEndMin && t + rule.slotMinutes > breakStartMin) {
        continue;
      }
      rows.push({
        doctor_profile_id: doctorProfileId,
        schedule_date: dateIso,
        time_slot: formatSlotLabel(t),
        is_booked: false,
      });
    }
  }

  if (rows.length === 0) return { created: 0, error: 'No slots matched this pattern.' };

  const { data, error } = await supabase
    .from('doctor_schedule')
    .upsert(rows, { onConflict: 'doctor_profile_id,schedule_date,time_slot', ignoreDuplicates: true })
    .select('id');

  if (error) return { created: 0, error: error.message };
  const created = (data || []).length;
  if (created > 0) logAuditEvent('SCHEDULE_CHANGED', 'doctor_schedule', doctorProfileId, undefined, { action: 'weekly_pattern_generated', created, weeks_ahead: weeksAhead });
  return { created };
};

// Clears a doctor's open slots on one date (leave / holiday / blocked day).
// Never removes an already-booked slot — a real patient appointment is
// never silently cancelled by this action — so it reports back how many
// booked slots remain on that date for the caller to handle separately.
export const blockDate = async (
  doctorProfileId: string,
  dateIso: string
): Promise<{ removed: number; stillBooked: number; error?: string }> => {
  const { data: existing, error: fetchErr } = await supabase
    .from('doctor_schedule')
    .select('id, is_booked')
    .eq('doctor_profile_id', doctorProfileId)
    .eq('schedule_date', dateIso);
  if (fetchErr) return { removed: 0, stillBooked: 0, error: fetchErr.message };

  const rows = existing || [];
  const stillBooked = rows.filter((r) => r.is_booked).length;
  const unbookedIds = rows.filter((r) => !r.is_booked).map((r) => r.id);
  if (unbookedIds.length === 0) return { removed: 0, stillBooked };

  const { error: delErr } = await supabase.from('doctor_schedule').delete().in('id', unbookedIds);
  if (delErr) return { removed: 0, stillBooked, error: delErr.message };
  logAuditEvent('SCHEDULE_CHANGED', 'doctor_schedule', doctorProfileId, undefined, { action: 'date_blocked', date: dateIso, removed: unbookedIds.length });
  return { removed: unbookedIds.length, stillBooked };
};
