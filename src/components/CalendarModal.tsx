import React, { useMemo, useState } from 'react';
import { X, CalendarDays, ChevronLeft, ChevronRight, Video, Clock, User } from 'lucide-react';
import { Language, Theme } from '../types';
import { Appointment, DoctorProfileTarget } from '../data/doctors';
import { EmptyState } from './EmptyState';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  language: Language;
  theme: Theme;
  onViewDoctorProfile?: (target: DoctorProfileTarget) => void;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-primary/5 text-[var(--nc-primary)] dark:bg-primary/10 dark:text-primary-light',
  in_queue: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

const toDateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Pulled entirely from the patient's already-fetched appointmentsList — no
// new fetch, no new table. A real month grid + that day's visits, matching
// the spec's calendar ask without inventing a fake events feed.
export const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, appointments, language, theme, onViewDoctorProfile }) => {
  const isSw = language === 'sw';
  const isDark = theme === 'dark';
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));

  const activeAppointments = useMemo(() => appointments.filter((a) => a.status !== 'cancelled'), [appointments]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of activeAppointments) {
      map.set(a.date, [...(map.get(a.date) || []), a]);
    }
    return map;
  }, [activeAppointments]);

  if (!isOpen) return null;

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const startOffset = firstDayOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weekdayLabels = isSw
    ? ['J', 'J', 'J', 'A', 'I', 'J', 'J']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const selectedAppointments = appointmentsByDate.get(selectedDate) || [];
  const todayKey = toDateKey(today);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="nc-card w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 flex items-center justify-between bg-primary text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold">{isSw ? 'Kalenda Yangu' : 'My Calendar'}</h3>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto text-xs">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
              className="w-7 h-7 rounded-lg border nc-border flex items-center justify-center text-slate-500 dark:text-slate-400 hover:border-primary"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <p className="font-bold text-slate-900 dark:text-white capitalize">{monthLabel}</p>
            <button
              type="button"
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
              className="w-7 h-7 rounded-lg border nc-border flex items-center justify-center text-slate-500 dark:text-slate-400 hover:border-primary"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekdayLabels.map((w, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-slate-400 py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const dateKey = toDateKey(new Date(year, month, day));
              const hasAppointments = appointmentsByDate.has(dateKey);
              const isSelected = dateKey === selectedDate;
              const isToday = dateKey === todayKey;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDate(dateKey)}
                  className={`relative aspect-square rounded-lg text-[11px] font-semibold flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                      : isToday
                      ? 'border border-primary text-primary dark:text-primary-light'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {day}
                  {hasAppointments && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
            {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>

          {selectedAppointments.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title={isSw ? 'Hakuna Miadi' : 'No Visits'}
              description={isSw ? 'Hakuna miadi tarehe hii.' : 'No appointments on this date.'}
            />
          ) : (
            <div className="space-y-2">
              {selectedAppointments.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {a.doctorName}
                      {a.consultationType === 'telehealth' && <Video className="w-3 h-3 text-primary" />}
                    </p>
                    <span className={`rounded-lg px-2 py-0.5 font-bold capitalize ${STATUS_STYLES[a.status] || STATUS_STYLES.confirmed}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">{a.doctorSpecialty} • {a.hospitalName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {a.timeSlot}
                    </p>
                    {onViewDoctorProfile && (
                      <button
                        type="button"
                        onClick={() => onViewDoctorProfile({ doctorId: a.doctorId })}
                        aria-label={isSw ? `Angalia wasifu wa ${a.doctorName}` : `View ${a.doctorName}'s profile`}
                        className="inline-flex items-center gap-1 text-primary dark:text-primary-light font-bold underline underline-offset-2"
                      >
                        <User className="w-3 h-3" /> {isSw ? 'Wasifu' : 'View Doctor'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
