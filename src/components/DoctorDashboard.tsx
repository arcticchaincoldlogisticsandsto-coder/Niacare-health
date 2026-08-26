import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Users, Star, LogOut, RefreshCw, Video, Stethoscope, ClipboardPlus } from 'lucide-react';
import type { Language, Theme } from '../types';
import { supabase } from '../lib/supabaseClient';
import { EncounterModal } from './EncounterModal';
import { Avatar } from './Avatar';

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
  confirmed: 'bg-blue-50 text-[#0A4275] dark:bg-cyan-950 dark:text-cyan-300',
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
  const [queueTab, setQueueTab] = useState<'waiting' | 'completed'>('waiting');

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

  const statCards = [
    { label: isSw ? 'Wagonjwa wa Leo' : "Today's Patients", value: todaysPatients.length, Icon: Users, colour: 'text-cyan-600 dark:text-cyan-400' },
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
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
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
            <p className="text-2xl font-black text-slate-900 dark:text-white">{loading ? '—' : value}</p>
            {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

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
                    ? 'bg-[#0A4275] text-white dark:bg-cyan-500 dark:text-[#041D34]'
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
                <div key={apt.id} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={apt.patient_name || 'Patient'} size="md" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                        {apt.patient_name || 'Patient'}
                        {apt.consultation_type === 'telehealth' && <Video className="w-3 h-3 text-cyan-500 flex-shrink-0" />}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 truncate">{apt.time_slot} {apt.reason ? `• ${apt.reason}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`rounded-lg px-2 py-1 font-bold capitalize ${STATUS_STYLES[apt.status] || STATUS_STYLES.confirmed}`}>
                      {apt.status.replace('_', ' ')}
                    </span>
                    {apt.status !== 'cancelled' && apt.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => setEncounterTarget(apt)}
                        className="rounded-lg bg-[#0A4275] dark:bg-cyan-500 text-white dark:text-[#041D34] px-2 py-1 font-bold flex items-center gap-1"
                        title={isSw ? 'Anza Mkutano' : 'Start Encounter'}
                      >
                        <ClipboardPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {authUserId && (
        <p className="mt-5 text-[10px] text-center text-slate-400 dark:text-slate-600 font-mono">ID: {authUserId.slice(0, 12)}…</p>
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
