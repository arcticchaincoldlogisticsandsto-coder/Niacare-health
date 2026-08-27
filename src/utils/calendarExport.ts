interface AppointmentIcsInput {
  ticketNumber: string;
  doctorName: string;
  doctorSpecialty: string;
  hospitalName: string;
  hospitalLocation: string;
  roomNumber: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "10:15 AM"
}

const DEFAULT_DURATION_MINUTES = 30;

const parseTimeSlot = (timeSlot: string): { hours: number; minutes: number } => {
  const match = timeSlot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hours: 9, minutes: 0 };

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return { hours, minutes };
};

const formatIcsDate = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(
    date.getMinutes()
  )}00`;
};

const escapeIcsText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function generateAppointmentIcs(appointment: AppointmentIcsInput): void {
  const [year, month, day] = appointment.date.split('-').map((n) => parseInt(n, 10));
  const { hours, minutes } = parseTimeSlot(appointment.timeSlot);

  const start = new Date(year, (month || 1) - 1, day || 1, hours, minutes);
  const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
  const stamp = formatIcsDate(new Date()) + 'Z';

  const summary = escapeIcsText(`NiaCare: ${appointment.doctorName} (${appointment.doctorSpecialty})`);
  const location = escapeIcsText(`${appointment.hospitalName}, ${appointment.hospitalLocation}, ${appointment.roomNumber}`);
  const description = escapeIcsText(`NiaCare appointment ticket ${appointment.ticketNumber}.`);

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NiaCare//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${appointment.ticketNumber}@niacare.health`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `niacare-appointment-${appointment.ticketNumber}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
