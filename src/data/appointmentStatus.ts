import { Appointment } from './doctors';

export type AppointmentStatus = Appointment['status'];

// One canonical status vocabulary shared by the patient app, reception
// (ProviderDashboard), and the doctor dashboard — previously each screen
// kept its own partial copy of this map (and none of them knew about the
// newer statuses), which is exactly the kind of drift a shared module
// avoids.
export const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, string> = {
  confirmed: 'bg-primary/5 text-[var(--nc-primary)] dark:bg-primary/10 dark:text-primary-light',
  arrived: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  in_queue: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  called: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  in_consultation: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  no_show: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const LABELS_EN: Record<AppointmentStatus, string> = {
  confirmed: 'Confirmed',
  arrived: 'Arrived',
  in_queue: 'Waiting',
  called: 'Called',
  in_consultation: 'In Consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const LABELS_SW: Record<AppointmentStatus, string> = {
  confirmed: 'Imethibitishwa',
  arrived: 'Amefika',
  in_queue: 'Anasubiri',
  called: 'Ameitwa',
  in_consultation: 'Kwenye Ushauri',
  completed: 'Imekamilika',
  cancelled: 'Imeghairiwa',
  no_show: 'Hakufika',
};

export const appointmentStatusLabel = (status: AppointmentStatus, isSw: boolean): string =>
  (isSw ? LABELS_SW : LABELS_EN)[status] || status;
