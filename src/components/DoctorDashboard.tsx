import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Users, Star, LogOut, RefreshCw, Video, Stethoscope, ClipboardPlus, Pill, FlaskConical, Plus } from 'lucide-react';
import type { Language, Theme } from '../types';
import { supabase } from '../lib/supabaseClient';
import { EncounterModal } from './EncounterModal';
import { PatientDetailModal } from './PatientDetailModal';
import { Avatar } from './Avatar';
import { createLabOrder, fetchDoctorLabOrders, LabOrderRow } from '../lib/laboratory';
import { fetchDoctorScheduleForDate, addScheduleSlot, removeScheduleSlot, ScheduleSlotRow } from '../lib/schedule';

const STANDARD_SLOT_OPTIONS = ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'];

const DoctorCalendarPanel: React.FC<{ isSw: boolean; doctorProfileId: string }> = ({ isSw, doctorProfileId }) => {
  const [date, setDate] = useState(todayIso());
  const [slots, setSlots] = useState<ScheduleSlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { slots: fetched, error: err } = await fetchDoctorScheduleForDate(doctorProfileId, date);
    if (err) setError(err); else setSlots(fetched);
    setLoading(false);
  };
  useEffect(() => { load(); }, [doctorProfileId, date]);

  const existingTimes = new Set(slots.map((s) => s.time_slot));
  const available = STANDARD_SLOT_OPTIONS.filter((t) => !existingTimes.has(t));

  const handleAddSlot = async (timeSlot: string) => {
    setBusyId(timeSlot);
    const { error: err } = await addScheduleSlot(doctorProfileId, date, timeSlot);
    setBusyId(null);
    if (err) setError(err); else load();
  };

  const handleBlock = async (slot: ScheduleSlotRow) => {
    setBusyId(slot.id);
    const { error: err } = await removeScheduleSlot(slot.id);
    setBusyId(null);
    if (err) setError(err); else load();
  };

  return (
    <div className="nc-card p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Ratiba Yangu' : 'My Calendar'}</h3>
        </div>
        <input type="date" value={date} min={todayIso()} onChange={(e) => setDate(e.target.value)} className="nc-input px-2.5 py-1.5 text-xs" />
      </div>
      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}

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
                onClick={() => handleBlock(s)}
                className="hover:text-rose-600 disabled:opacity-40"
                title={isSw ? 'Zuia (ondoa nafasi)' : 'Block (remove this slot)'}
              >
                ×
              </button>
            )}
            {s.is_booked && <span className="text-[9px] opacity-70">{isSw ? '(imechukuliwa)' : '(booked)'}</span>}
          </span>
        ))}
      </div>

      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{isSw ? 'Ongeza Nafasi' : 'Create Availability'}</p>
      <div className="flex flex-wrap gap-1.5">
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
    </div>
  );
};

const LAB_STATUS_STYLES: Record<string, string> = {
  ordered: 'bg-primary/5 text-[var(--nc-primary)] dark:bg-primary/10 dark:text-primary-light',
  collected: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  processing: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

interface DoctorPrescriptionRow {
  id: string;
  patient_id: string;
  medication_name: string;
  dosage_instructions: string | null;
  created_at: string;
  patientName?: string;
}

const DoctorPrescriptionsPanel: React.FC<{ isSw: boolean; doctorAuthUserId: string }> = ({ isSw, doctorAuthUserId }) => {
  const [rows, setRows] = useState<DoctorPrescriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    supabase
      .from('prescriptions')
      .select('id, patient_id, medication_name, dosage_instructions, created_at')
      .eq('created_by', doctorAuthUserId)
      .order('created_at', { ascending: false })
      .then(async ({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return; }
        const rowsData = data || [];
        const ids = Array.from(new Set(rowsData.map((r) => r.patient_id)));
        const names = new Map<string, string>();
        if (ids.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
          for (const p of profiles || []) names.set(p.id, p.full_name);
        }
        setRows(rowsData.map((r) => ({ ...r, patientName: names.get(r.patient_id) || 'Patient' })));
        setLoading(false);
      });
  }, [doctorAuthUserId]);

  return (
    <div className="nc-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Pill className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Dawa Ulizoandika' : 'Prescriptions Issued'}</h3>
      </div>
      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
      {!loading && rows.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-2">{isSw ? 'Bado hujaandika dawa yoyote.' : "You haven't issued any prescriptions yet."}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white truncate">{r.medication_name}</p>
                <p className="text-slate-500 dark:text-slate-400 truncate">{r.patientName} • {r.dosage_instructions || '—'}</p>
              </div>
              <span className="text-slate-400 flex-shrink-0">{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DoctorLabsPanel: React.FC<{
  isSw: boolean;
  doctorProfileId: string;
  providerId: string | null;
  patientOptions: { id: string; name: string }[];
}> = ({ isSw, doctorProfileId, providerId, patientOptions }) => {
  const [orders, setOrders] = useState<LabOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testName, setTestName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [notes, setNotes] = useState('');
  const [ordering, setOrdering] = useState(false);

  const load = async () => {
    setLoading(true);
    const { orders: fetched, error: err } = await fetchDoctorLabOrders(doctorProfileId);
    if (err) setError(err); else setOrders(fetched);
    setLoading(false);
  };
  useEffect(() => { load(); }, [doctorProfileId]);

  const handleOrder = async () => {
    if (!testName.trim() || !patientId) return;
    setOrdering(true);
    const { error: err } = await createLabOrder(patientId, doctorProfileId, providerId, null, testName.trim(), notes);
    setOrdering(false);
    if (err) { setError(err); return; }
    setTestName(''); setNotes(''); setPatientId('');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="nc-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Agiza Kipimo' : 'Order a Lab Test'}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)} className="nc-input px-2.5 py-2">
            <option value="">{isSw ? 'Chagua mgonjwa' : 'Select patient'}</option>
            {patientOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder={isSw ? 'Jina la kipimo' : 'Test name'} className="nc-input px-2.5 py-2" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={isSw ? 'Maelezo (hiari)' : 'Notes (optional)'} className="nc-input px-2.5 py-2" />
        </div>
        <button
          type="button"
          onClick={handleOrder}
          disabled={ordering || !testName.trim() || !patientId}
          className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-3 py-1.5 text-xs font-bold disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> {isSw ? 'Agiza' : 'Order Test'}
        </button>
      </div>

      <div className="nc-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FlaskConical className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Vipimo Vilivyoagizwa' : 'Ordered Tests'}</h3>
        </div>
        {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
        {!loading && orders.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2">{isSw ? 'Hakuna vipimo bado.' : 'No lab tests ordered yet.'}</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{o.test_name}</p>
                  <p className="text-slate-500 dark:text-slate-400 truncate">{o.patientName}</p>
                </div>
                <span className={`rounded-lg px-2 py-1 font-bold capitalize flex-shrink-0 ${LAB_STATUS_STYLES[o.status] || ''}`}>{o.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface DoctorDashboardProps {
  language: Language;
  theme: Theme;
  authUserId: string | null;
  onLogout: () => void;
}

interface DoctorProfile {
  id: string;
  provider_id: string | null;
  specialty: string;
  sub_specialty: string | null;
  rating: number;
  reviews_count: number;
  is_verified: boolean;
}

interface AppointmentRow {
  id: string;
  patient_id: string;
  patient_name: string | null;
  appointment_date: string;
  time_slot: string;
  status: string;
  consultation_type: string;
  reason: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-primary/5 text-[var(--nc-primary)] dark:bg-primary/10 dark:text-primary-light',
  in_queue: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ language, theme, authUserId, onLogout }) => {
  const isSw = language === 'sw';
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [encounterTarget, setEncounterTarget] = useState<AppointmentRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<AppointmentRow | null>(null);
  const [queueTab, setQueueTab] = useState<'waiting' | 'completed'>('waiting');
  const [section, setSection] = useState<'queue' | 'prescriptions' | 'labs' | 'calendar'>('queue');

  const load = async () => {
    if (!authUserId) return;
    setLoading(true); setError('');
    const { data: doctorProfile, error: profileError } = await supabase
      .from('doctor_profiles')
      .select('id, provider_id, specialty, sub_specialty, rating, reviews_count, is_verified')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }
    setProfile(doctorProfile as DoctorProfile | null);

    if (doctorProfile) {
      const { data: appts, error: apptError } = await supabase
        .from('appointments')
        .select('id, patient_id, patient_name, appointment_date, time_slot, status, consultation_type, reason')
        .eq('doctor_profile_id', doctorProfile.id)
        .order('appointment_date', { ascending: true })
        .order('time_slot', { ascending: true })
        .limit(200);
      if (apptError) setError(apptError.message);
      else setAppointments((appts || []) as AppointmentRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [authUserId]);

  const today = todayIso();
  const todaysPatients = useMemo(() => appointments.filter((a) => a.appointment_date === today && a.status !== 'cancelled'), [appointments, today]);
  const upcomingVisits = useMemo(() => appointments.filter((a) => a.appointment_date > today && a.status === 'confirmed'), [appointments, today]);
  const inQueue = useMemo(() => appointments.filter((a) => a.status === 'in_queue'), [appointments]);
  const patientOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of appointments) if (!seen.has(a.patient_id)) seen.set(a.patient_id, a.patient_name || 'Patient');
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [appointments]);

  const statCards = [
    { label: isSw ? 'Wagonjwa wa Leo' : "Today's Patients", value: todaysPatients.length, Icon: Users, colour: 'text-primary dark:text-primary-light' },
    { label: isSw ? 'Ziara Zilizobaki' : 'Upcoming Visits', value: upcomingVisits.length, Icon: Calendar, colour: 'text-emerald-600 dark:text-emerald-400' },
    { label: isSw ? 'Wanaosubiri' : 'In Queue', value: inQueue.length, Icon: Clock, colour: 'text-amber-600 dark:text-amber-400' },
    {
      label: isSw ? 'Ukadiriaji' : 'Rating',
      value: profile ? `${profile.rating.toFixed(1)}` : '—',
      sub: profile ? `${profile.reviews_count} ${isSw ? 'maoni' : 'reviews'}` : undefined,
      Icon: Star,
      colour: 'text-yellow-500',
    },
  ];

  return (
    <div className="pt-2 pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Daktari' : 'Doctor Portal'}</p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {profile ? profile.specialty : isSw ? 'Jukwaa la Daktari' : 'Doctor Dashboard'}
          </h2>
          {profile?.sub_specialty && <p className="text-[11px] text-slate-500 dark:text-slate-400">{profile.sub_specialty}</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={isSw ? 'Toka' : 'Logout'}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}

      {!loading && !profile && !error && (
        <div className="nc-card p-4 mb-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isSw
              ? 'Hakuna wasifu wa daktari uliounganishwa na akaunti hii bado. Wasiliana na msimamizi.'
              : 'No doctor profile is linked to this account yet. Contact an administrator to complete your clinical setup.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-5">
        {statCards.map(({ label, value, sub, Icon, colour }) => (
          <div key={label} className="nc-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${colour}`} />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
            </div>
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{loading ? '—' : value}</p>
            {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-1.5">
        {([
          { key: 'queue', label: isSw ? 'Foleni' : 'Queue', Icon: Stethoscope },
          { key: 'prescriptions', label: isSw ? 'Dawa' : 'Prescriptions', Icon: Pill },
          { key: 'labs', label: isSw ? 'Maabara' : 'Labs', Icon: FlaskConical },
          { key: 'calendar', label: isSw ? 'Ratiba' : 'Calendar', Icon: Calendar },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              section === key
                ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {section === 'prescriptions' && authUserId && (
        <DoctorPrescriptionsPanel isSw={isSw} doctorAuthUserId={authUserId} />
      )}

      {section === 'labs' && profile && (
        <DoctorLabsPanel isSw={isSw} doctorProfileId={profile.id} providerId={profile.provider_id} patientOptions={patientOptions} />
      )}

      {section === 'calendar' && profile && (
        <DoctorCalendarPanel isSw={isSw} doctorProfileId={profile.id} />
      )}

      {section === 'queue' && (
      <div className="nc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Foleni ya Leo' : "Today's Queue"}</h3>
          </div>
          <div className="flex gap-1">
            {(['waiting', 'completed'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setQueueTab(key)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  queueTab === key
                    ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {key === 'waiting'
                  ? `${isSw ? 'Wanaosubiri' : 'Waiting'} (${todaysPatients.filter((a) => a.status !== 'completed').length})`
                  : `${isSw ? 'Wamemaliza' : 'Completed'} (${todaysPatients.filter((a) => a.status === 'completed').length})`}
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const list = todaysPatients.filter((a) => (queueTab === 'waiting' ? a.status !== 'completed' : a.status === 'completed'));
          if (list.length === 0) {
            return (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                {queueTab === 'waiting'
                  ? isSw
                    ? 'Hakuna miadi iliyopangwa leo. Miadi mpya itaonekana hapa.'
                    : 'No appointments scheduled for today. New bookings will appear here.'
                  : isSw
                  ? 'Hakuna waliomaliza leo bado.'
                  : 'No completed visits yet today.'}
              </p>
            );
          }
          return (
            <div className="space-y-2">
              {list.map((apt) => (
                <button
                  type="button"
                  key={apt.id}
                  onClick={() => setDetailTarget(apt)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs text-left hover:border-[var(--nc-primary)] dark:hover:border-primary transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={apt.patient_name || 'Patient'} size="md" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                        {apt.patient_name || 'Patient'}
                        {apt.consultation_type === 'telehealth' && <Video className="w-3 h-3 text-primary flex-shrink-0" />}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 truncate">{apt.time_slot} {apt.reason ? `• ${apt.reason}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`rounded-lg px-2 py-1 font-bold capitalize ${STATUS_STYLES[apt.status] || STATUS_STYLES.confirmed}`}>
                      {apt.status.replace('_', ' ')}
                    </span>
                    {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setEncounterTarget(apt); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setEncounterTarget(apt); } }}
                        className="rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-2 py-1 font-bold flex items-center gap-1"
                        title={isSw ? 'Anza Mkutano' : 'Start Encounter'}
                      >
                        <ClipboardPlus className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          );
        })()}
      </div>
      )}

      {authUserId && (
        <p className="mt-5 text-[10px] text-center text-slate-400 dark:text-slate-600 font-mono">ID: {authUserId.slice(0, 12)}…</p>
      )}

      {detailTarget && profile && (
        <PatientDetailModal
          isOpen
          onClose={() => setDetailTarget(null)}
          theme={theme}
          patientId={detailTarget.patient_id}
          patientName={detailTarget.patient_name || 'Patient'}
          reason={detailTarget.reason}
          doctorProfileId={profile.id}
          onStartEncounter={() => {
            setEncounterTarget(detailTarget);
            setDetailTarget(null);
          }}
        />
      )}

      {encounterTarget && profile && (
        <EncounterModal
          isOpen
          onClose={() => setEncounterTarget(null)}
          language={language}
          theme={theme}
          patientId={encounterTarget.patient_id}
          patientName={encounterTarget.patient_name || 'Patient'}
          doctorProfileId={profile.id}
          providerId={profile.provider_id}
          appointmentId={encounterTarget.id}
          onCompleted={load}
        />
      )}
    </div>
  );
};
