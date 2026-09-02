import React, { useEffect, useState } from 'react';
import { Calendar, Plus, Repeat, CalendarX } from 'lucide-react';
import {
  fetchDoctorScheduleForDate,
  addScheduleSlot,
  removeScheduleSlot,
  generateWeeklySlots,
  blockDate,
  ScheduleSlotRow,
} from '../lib/schedule';

const STANDARD_SLOT_OPTIONS = ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'];

const WEEKDAYS: { value: number; en: string; sw: string }[] = [
  { value: 1, en: 'Mon', sw: 'Jtt' },
  { value: 2, en: 'Tue', sw: 'Jnn' },
  { value: 3, en: 'Wed', sw: 'Jtn' },
  { value: 4, en: 'Thu', sw: 'Alh' },
  { value: 5, en: 'Fri', sw: 'Ijm' },
  { value: 6, en: 'Sat', sw: 'Jmo' },
  { value: 0, en: 'Sun', sw: 'Jpi' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

interface ScheduleManagerProps {
  isSw: boolean;
  doctorProfileId: string;
  /** Shown as a small heading above the panel when managing someone else's schedule (facility view). */
  doctorLabel?: string;
}

// Shared by DoctorDashboard (a doctor managing their own hours) and
// ProviderDashboard (facility staff managing a doctor at their facility —
// RLS already permits both, see "Doctors and staff can manage own schedule"
// in supabase/schema.sql). Combines the original one-slot-at-a-time view
// with a recurring weekly-pattern generator, so a facility can set "Mon-Fri
// 08:00-17:00, 30 min slots" once instead of clicking Add dozens of times.
export const ScheduleManager: React.FC<ScheduleManagerProps> = ({ isSw, doctorProfileId, doctorLabel }) => {
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<ScheduleSlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showPattern, setShowPattern] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [useBreak, setUseBreak] = useState(true);
  const [breakStart, setBreakStart] = useState('12:00');
  const [breakEnd, setBreakEnd] = useState('13:00');
  const [weeksAhead, setWeeksAhead] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string>('');

  const [blocking, setBlocking] = useState(false);

  const load = async () => {
    setLoading(true);
    const { slots: fetched, error: err } = await fetchDoctorScheduleForDate(doctorProfileId, date);
    if (err) setError(err); else { setSlots(fetched); setError(''); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [doctorProfileId, date]);

  const existingTimes = new Set(slots.map((s) => s.time_slot));
  const available = STANDARD_SLOT_OPTIONS.filter((t) => !existingTimes.has(t));
  const bookedCount = slots.filter((s) => s.is_booked).length;

  const handleAddSlot = async (timeSlot: string) => {
    setBusyId(timeSlot);
    const { error: err } = await addScheduleSlot(doctorProfileId, date, timeSlot);
    setBusyId(null);
    if (err) setError(err); else load();
  };

  const handleRemove = async (slot: ScheduleSlotRow) => {
    setBusyId(slot.id);
    const { error: err } = await removeScheduleSlot(slot.id);
    setBusyId(null);
    if (err) setError(err); else load();
  };

  const toggleWeekday = (value: number) => {
    setWeekdays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value].sort()));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateResult('');
    const { created, error: err } = await generateWeeklySlots(
      doctorProfileId,
      {
        weekdays,
        startTime,
        endTime,
        slotMinutes,
        breakStart: useBreak ? breakStart : undefined,
        breakEnd: useBreak ? breakEnd : undefined,
      },
      weeksAhead
    );
    setGenerating(false);
    if (err) {
      setError(err);
      return;
    }
    setGenerateResult(
      isSw
        ? `Nafasi ${created} mpya zimeongezwa kwa wiki ${weeksAhead}.`
        : `${created} new slots created over the next ${weeksAhead} week${weeksAhead === 1 ? '' : 's'}.`
    );
    load();
  };

  const handleBlockDate = async () => {
    if (bookedCount > 0) {
      const confirmMsg = isSw
        ? `Miadi ${bookedCount} tayari imewekwa tarehe hii na haitaondolewa. Endelea kuzuia nafasi zilizobaki?`
        : `${bookedCount} appointment${bookedCount === 1 ? ' is' : 's are'} already booked on this date and won't be removed. Block the remaining open slots?`;
      if (!window.confirm(confirmMsg)) return;
    }
    setBlocking(true);
    const { removed, error: err } = await blockDate(doctorProfileId, date);
    setBlocking(false);
    if (err) { setError(err); return; }
    setGenerateResult(
      isSw ? `Nafasi ${removed} zimeondolewa tarehe hii.` : `${removed} open slot${removed === 1 ? '' : 's'} cleared for this date.`
    );
    load();
  };

  return (
    <div className="nc-card p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {doctorLabel ? doctorLabel : isSw ? 'Ratiba Yangu' : 'My Calendar'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} className="nc-input px-2.5 py-1.5 text-xs" />
          <button
            type="button"
            onClick={handleBlockDate}
            disabled={blocking || (slots.length === 0)}
            className="flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 disabled:opacity-40"
            title={isSw ? 'Zuia Tarehe (Likizo)' : 'Block this date (leave)'}
          >
            <CalendarX className="w-3.5 h-3.5" /> {isSw ? 'Zuia Siku' : 'Block Date'}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
      {generateResult && <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">{generateResult}</p>}

      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{isSw ? 'Nafasi Zilizopo' : 'Available Slots'}</p>
      {!loading && slots.filter((s) => !s.is_booked).length === 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{isSw ? 'Hakuna nafasi tarehe hii.' : 'No open slots on this date yet.'}</p>
      )}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {slots.map((s) => (
          <span
            key={s.id}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
              s.is_booked
                ? 'bg-primary/5 text-[var(--nc-primary)] dark:bg-primary/10 dark:text-primary-light'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            }`}
          >
            {s.time_slot}
            {!s.is_booked && (
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => handleRemove(s)}
                className="hover:text-rose-600 disabled:opacity-40"
                title={isSw ? 'Zuia (ondoa nafasi)' : 'Remove this slot'}
              >
                ×
              </button>
            )}
            {s.is_booked && <span className="text-[9px] opacity-70">{isSw ? '(imechukuliwa)' : '(booked)'}</span>}
          </span>
        ))}
      </div>

      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{isSw ? 'Ongeza Nafasi Moja' : 'Add a Single Slot'}</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {available.length === 0 ? (
          <p className="text-xs text-slate-400">{isSw ? 'Nafasi zote za kawaida zimeongezwa.' : 'All standard slots are already open for this date.'}</p>
        ) : (
          available.map((t) => (
            <button
              key={t}
              type="button"
              disabled={busyId === t}
              onClick={() => handleAddSlot(t)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-[var(--nc-primary)] dark:hover:border-primary disabled:opacity-40 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> {t}
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowPattern((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline mb-3"
      >
        <Repeat className="w-3.5 h-3.5" />
        {showPattern
          ? (isSw ? 'Ficha Ratiba ya Wiki' : 'Hide weekly pattern')
          : (isSw ? 'Weka Ratiba ya Wiki (Nyingi kwa Wakati Mmoja)' : 'Set weekly working hours (bulk-generate)')}
      </button>

      {showPattern && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{isSw ? 'Siku za Wiki' : 'Working Days'}</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleWeekday(d.value)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                    weekdays.includes(d.value)
                      ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isSw ? d.sw : d.en}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">
              <span className="block text-slate-500 dark:text-slate-400 mb-1">{isSw ? 'Anza' : 'Start time'}</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="nc-input w-full px-2.5 py-1.5" />
            </label>
            <label className="text-xs">
              <span className="block text-slate-500 dark:text-slate-400 mb-1">{isSw ? 'Malizia' : 'End time'}</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="nc-input w-full px-2.5 py-1.5" />
            </label>
          </div>

          <label className="text-xs block">
            <span className="block text-slate-500 dark:text-slate-400 mb-1">{isSw ? 'Muda wa Kila Miadi' : 'Consultation duration'}</span>
            <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className="nc-input w-full px-2.5 py-1.5">
              <option value={15}>15 {isSw ? 'dakika' : 'min'}</option>
              <option value={20}>20 {isSw ? 'dakika' : 'min'}</option>
              <option value={30}>30 {isSw ? 'dakika' : 'min'}</option>
              <option value={45}>45 {isSw ? 'dakika' : 'min'}</option>
              <option value={60}>60 {isSw ? 'dakika' : 'min'}</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={useBreak} onChange={(e) => setUseBreak(e.target.checked)} className="rounded" />
            {isSw ? 'Muda wa Mapumziko' : 'Include a break'}
          </label>
          {useBreak && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">{isSw ? 'Anza Mapumziko' : 'Break start'}</span>
                <input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="nc-input w-full px-2.5 py-1.5" />
              </label>
              <label className="text-xs">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">{isSw ? 'Malizia Mapumziko' : 'Break end'}</span>
                <input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="nc-input w-full px-2.5 py-1.5" />
              </label>
            </div>
          )}

          <label className="text-xs block">
            <span className="block text-slate-500 dark:text-slate-400 mb-1">{isSw ? 'Wiki Ngapi Mbeleni' : 'Generate for how many weeks ahead'}</span>
            <select value={weeksAhead} onChange={(e) => setWeeksAhead(Number(e.target.value))} className="nc-input w-full px-2.5 py-1.5">
              {[1, 2, 4, 8, 12].map((w) => (
                <option key={w} value={w}>{w} {isSw ? 'wiki' : w === 1 ? 'week' : 'weeks'}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || weekdays.length === 0}
            className="w-full rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            {generating ? (isSw ? 'Inaunda...' : 'Generating…') : (isSw ? 'Unda Nafasi' : 'Generate Availability')}
          </button>
        </div>
      )}
    </div>
  );
};
