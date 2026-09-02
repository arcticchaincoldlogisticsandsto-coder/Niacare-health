import { supabase } from './supabaseClient';
import { Appointment } from '../data/doctors';

interface AppointmentRow {
  id: string;
  provider_id: string | null;
  ticket_number: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialty: string;
  hospital_name: string;
  hospital_location: string | null;
  room_number: string | null;
  consultation_type: Appointment['consultationType'];
  appointment_date: string;
  time_slot: string;
  status: Appointment['status'];
  queue_number: string | null;
  doctor_profile_id: string | null;
  arrival_confirmed_at: string | null;
  patient_arrived_at: string | null;
  called_at: string | null;
  consultation_started_at: string | null;
  completed_at: string | null;
  no_show_reason: string | null;
  reason: string | null;
  symptoms_note: string | null;
  insurance_provider: string | null;
  insurance_covered: boolean;
  co_pay_amount_tzs: number;
  patient_name: string | null;
  patient_phone: string | null;
  created_at: string;
}

const mapRowToAppointment = (row: AppointmentRow): Appointment => ({
  id: row.id,
  providerId: row.provider_id,
  ticketNumber: row.ticket_number,
  doctorId: row.doctor_id,
  doctorName: row.doctor_name,
  doctorSpecialty: row.doctor_specialty,
  hospitalName: row.hospital_name,
  hospitalLocation: row.hospital_location || '',
  roomNumber: row.room_number || '',
  consultationType: row.consultation_type,
  date: row.appointment_date,
  timeSlot: row.time_slot,
  status: row.status,
  queueNumber: row.queue_number || undefined,
  doctorProfileId: row.doctor_profile_id,
  arrivalConfirmedAt: row.arrival_confirmed_at,
  patientArrivedAt: row.patient_arrived_at,
  calledAt: row.called_at,
  consultationStartedAt: row.consultation_started_at,
  completedAt: row.completed_at,
  noShowReason: row.no_show_reason,
  reason: row.reason || '',
  symptomsNote: row.symptoms_note || undefined,
  insuranceProvider: row.insurance_provider || '',
  insuranceCovered: row.insurance_covered,
  coPayAmountTzs: row.co_pay_amount_tzs,
  patientName: row.patient_name || '',
  patientPhone: row.patient_phone || '',
  createdAt: row.created_at,
});

// Reception confirms arrival: assigns a real, collision-safe queue number
// via the check_in_appointment() RPC (see supabase/schema.sql) instead of a
// raw client UPDATE, so two receptionists confirming at the same moment can
// never hand out the same queue number. Accepts a 'confirmed' (walk-up) or
// 'arrived' (patient self-checked-in via the app) appointment.
export const checkInAppointment = async (
  appointmentId: string
): Promise<{ appointment?: Appointment; error?: string }> => {
  const { data, error } = await supabase.rpc('check_in_appointment', { p_appointment_id: appointmentId });
  if (error) return { error: error.message };
  return { appointment: mapRowToAppointment(data as AppointmentRow) };
};

// Patient's own self-check-in — "I'm here" — does not assign a queue
// number (only check_in_appointment/reception does that).
export const patientArriveAppointment = async (
  appointmentId: string
): Promise<{ appointment?: Appointment; error?: string }> => {
  const { data, error } = await supabase.rpc('patient_arrive_appointment', { p_appointment_id: appointmentId });
  if (error) return { error: error.message };
  return { appointment: mapRowToAppointment(data as AppointmentRow) };
};

// Reception or the treating doctor calls the next patient out of the queue.
export const callPatient = async (
  appointmentId: string
): Promise<{ appointment?: Appointment; error?: string }> => {
  const { data, error } = await supabase.rpc('call_patient', { p_appointment_id: appointmentId });
  if (error) return { error: error.message };
  return { appointment: mapRowToAppointment(data as AppointmentRow) };
};

// Keeps appointments.status in sync when the treating doctor starts the
// real clinical encounter (encounters.startEncounter) — call both together.
export const startConsultation = async (
  appointmentId: string
): Promise<{ appointment?: Appointment; error?: string }> => {
  const { data, error } = await supabase.rpc('start_consultation', { p_appointment_id: appointmentId });
  if (error) return { error: error.message };
  return { appointment: mapRowToAppointment(data as AppointmentRow) };
};

// Keeps appointments.status in sync when the treating doctor completes the
// real clinical encounter (encounters.completeEncounter) — call both together.
export const completeAppointmentVisit = async (
  appointmentId: string
): Promise<{ appointment?: Appointment; error?: string }> => {
  const { data, error } = await supabase.rpc('complete_appointment_visit', { p_appointment_id: appointmentId });
  if (error) return { error: error.message };
  return { appointment: mapRowToAppointment(data as AppointmentRow) };
};

// Reception marks a patient absent — only while still confirmed/arrived
// (never reached the queue) and never for a future-dated appointment; see
// mark_appointment_no_show() in supabase/schema.sql for the documented rule.
export const markAppointmentNoShow = async (
  appointmentId: string,
  reason?: string
): Promise<{ appointment?: Appointment; error?: string }> => {
  const { data, error } = await supabase.rpc('mark_appointment_no_show', {
    p_appointment_id: appointmentId,
    p_reason: reason || null,
  });
  if (error) return { error: error.message };
  return { appointment: mapRowToAppointment(data as AppointmentRow) };
};

export interface QueuePosition {
  patientsAhead: number;
  /** Lowest still-waiting ticket number (status = 'in_queue') — who's up next once the current consultation finishes. */
  nowServing: string | null;
  /** Ticket actually being seen right now (status 'called' or 'in_consultation'), if any — distinct from nowServing. Only ticket numbers are ever returned here, never patient names. */
  currentlyServing: string | null;
  estimatedWaitMinutes: number;
}

// Average time reception actually spends per patient once called is not
// tracked anywhere yet, so this is a clearly-labelled estimate (patients
// ahead x a fixed per-visit minutes), not a claim of a measured wait time.
const MINUTES_PER_PATIENT = 15;

// Goes through fetch_queue_position() rather than a raw table read: this
// table's only RLS policy scopes SELECT to your own row (or treating
// doctor/facility staff/admin), so a plain patient-side query for other
// patients' rows here would silently return nothing — see the function's
// comment in supabase/schema.sql for the full explanation. The RPC returns
// only a count and ticket numbers, never another patient's name or details.
export const fetchQueuePosition = async (
  providerId: string,
  appointmentDate: string,
  myQueueNumber: string
): Promise<{ position?: QueuePosition; error?: string }> => {
  const { data, error } = await supabase.rpc('fetch_queue_position', {
    p_provider_id: providerId,
    p_appointment_date: appointmentDate,
    p_my_queue_number: myQueueNumber,
  });
  if (error) return { error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as
    | { patients_ahead: number; now_serving: string | null; currently_serving: string | null }
    | undefined;

  return {
    position: {
      patientsAhead: row?.patients_ahead || 0,
      nowServing: row?.now_serving || null,
      currentlyServing: row?.currently_serving || null,
      estimatedWaitMinutes: (row?.patients_ahead || 0) * MINUTES_PER_PATIENT,
    },
  };
};
