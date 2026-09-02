import { supabase } from './supabaseClient';
import { Appointment } from '../data/doctors';

interface AppointmentRow {
  id: string;
  patient_id: string;
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

export const fetchAppointments = async (
  patientId: string
): Promise<{ appointments: Appointment[]; error?: string }> => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) return { appointments: [], error: error.message };
  return { appointments: (data as AppointmentRow[]).map(mapRowToAppointment) };
};

export const insertAppointment = async (
  patientId: string,
  appointment: Omit<Appointment, 'id'>,
  providerId?: string | null,
  doctorProfileId?: string | null
): Promise<{ appointment?: Appointment; error?: string; errorCode?: string }> => {
  // Booking goes through a single-transaction RPC (not a raw table insert)
  // so a real doctor's schedule slot is reserved atomically — two patients
  // racing for the same slot can't both win it. See public.book_appointment
  // in supabase/schema.sql.
  const { data, error } = await supabase.rpc('book_appointment', {
    p_patient_id: patientId,
    p_ticket_number: appointment.ticketNumber,
    p_doctor_id: appointment.doctorId,
    p_doctor_name: appointment.doctorName,
    p_doctor_specialty: appointment.doctorSpecialty,
    p_hospital_name: appointment.hospitalName,
    p_hospital_location: appointment.hospitalLocation,
    p_room_number: appointment.roomNumber,
    p_consultation_type: appointment.consultationType,
    p_appointment_date: appointment.date,
    p_time_slot: appointment.timeSlot,
    p_queue_number: appointment.queueNumber,
    p_reason: appointment.reason,
    p_symptoms_note: appointment.symptomsNote,
    p_insurance_provider: appointment.insuranceProvider,
    p_insurance_covered: appointment.insuranceCovered,
    p_co_pay_amount_tzs: appointment.coPayAmountTzs,
    p_patient_name: appointment.patientName,
    p_patient_phone: appointment.patientPhone,
    p_provider_id: providerId || null,
    p_doctor_profile_id: doctorProfileId || null,
  });

  if (error) return { error: error.message, errorCode: error.code };
  return { appointment: mapRowToAppointment(data as AppointmentRow) };
};

export const updateAppointmentStatus = async (
  id: string,
  status: Appointment['status']
): Promise<{ success: boolean; error?: string }> => {
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true };
};
