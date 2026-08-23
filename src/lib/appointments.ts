import { supabase } from './supabaseClient';
import { Appointment } from '../data/doctors';

interface AppointmentRow {
  id: string;
  patient_id: string;
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
  appointment: Omit<Appointment, 'id'>
): Promise<{ appointment?: Appointment; error?: string }> => {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: patientId,
      ticket_number: appointment.ticketNumber,
      doctor_id: appointment.doctorId,
      doctor_name: appointment.doctorName,
      doctor_specialty: appointment.doctorSpecialty,
      hospital_name: appointment.hospitalName,
      hospital_location: appointment.hospitalLocation,
      room_number: appointment.roomNumber,
      consultation_type: appointment.consultationType,
      appointment_date: appointment.date,
      time_slot: appointment.timeSlot,
      status: appointment.status,
      queue_number: appointment.queueNumber,
      reason: appointment.reason,
      symptoms_note: appointment.symptomsNote,
      insurance_provider: appointment.insuranceProvider,
      insurance_covered: appointment.insuranceCovered,
      co_pay_amount_tzs: appointment.coPayAmountTzs,
      patient_name: appointment.patientName,
      patient_phone: appointment.patientPhone,
    })
    .select('*')
    .single();

  if (error) return { error: error.message };
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
