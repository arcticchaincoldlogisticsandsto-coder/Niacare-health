import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Users, CalendarDays, CreditCard, LogOut, RefreshCw, ShieldCheck, MapPin, Video } from 'lucide-react';
import type { Language } from '../types';
import { supabase } from '../lib/supabaseClient';
import { Avatar } from './Avatar';

interface ProviderDashboardProps {
  language: Language;
  authUserId: string | null;
  onLogout: () => void;
}

interface StaffRecord {
  provider_id: string;
  job_title: string;
  department: string | null;
}

interface ProviderRecord {
  name: string;
  region: string;
  type: string;
  address: string | null;
}

interface TodayAppointment {
  id: string;
  patient_name: string | null;
  time_slot: string;
  status: string;
  consultation_type: string;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-blue-50 text-[#0A4275] dark:bg-cyan-950 dark:text-cyan-300',
  in_queue: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export const ProviderDashboard: React.FC<ProviderDashboardProps> = ({ language, authUserId, onLogout }) => {
  const isSw = language === 'sw';
  const [staff, setStaff] = useState<StaffRecord | null>(null);
  const [provider, setProvider] = useState<ProviderRecord | null>(null);
  const [counts, setCounts] = useState({ appointmentsToday: 0, queued: 0, pendingBills: 0, activeStaff: 0 });
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!authUserId) return;
    setLoading(true); setError('');

    const { data: staffRow, error: staffError } = await supabase
      .from('provider_staff')
      .select('provider_id, job_title, department')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (staffError) {
      setError(staffError.message);
      setLoading(false);
      return;
    }
    setStaff(staffRow as StaffRecord | null);

    if (staffRow) {
      const today = todayIso();
      const [providerRow, appointmentsToday, queued, pendingBills, activeStaff, todayList] = await Promise.all([
        supabase.from('providers').select('name, region, type, address').eq('id', staffRow.provider_id).maybeSingle(),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('provider_id', staffRow.provider_id).eq('appointment_date', today),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('provider_id', staffRow.provider_id).eq('status', 'in_queue'),
        supabase.from('bills').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('provider_staff').select('*', { count: 'exact', head: true }).eq('provider_id', staffRow.provider_id).eq('is_active', true),
        supabase
          .from('appointments')
          .select('id, patient_name, time_slot, status, consultation_type')
          .eq('provider_id', staffRow.provider_id)
          .eq('appointment_date', today)
          .order('time_slot', { ascending: true }),
      ]);

      const failure = [providerRow, appointmentsToday, queued, pendingBills, activeStaff, todayList].find((r) => r.error)?.error;
      if (failure) setError(failure.message);
      else {
        setProvider((providerRow.data || null) as ProviderRecord | null);
        setCounts({
          appointmentsToday: appointmentsToday.count || 0,
          queued: queued.count || 0,
          pendingBills: pendingBills.count || 0,
          activeStaff: activeStaff.count || 0,
        });
        setTodayAppointments((todayList.data || []) as TodayAppointment[]);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [authUserId]);

  const statCards = useMemo(() => [
    { label: isSw ? 'Ziara za Leo' : "Today's Appointments", value: counts.appointmentsToday, Icon: CalendarDays, colour: 'text-cyan-600 dark:text-cyan-400' },
    { label: isSw ? 'Wagonjwa Waliosubiri' : 'Queued Patients', value: counts.queued, Icon: Users, colour: 'text-emerald-600 dark:text-emerald-400' },
    { label: isSw ? 'Malipo Yaliyobaki' : 'Pending Bills', value: counts.pendingBills, Icon: CreditCard, colour: 'text-amber-600 dark:text-amber-400' },
    { label: isSw ? 'Wafanyakazi Hai' : 'Active Staff', value: counts.activeStaff, Icon: ShieldCheck, colour: 'text-rose-500' },
  ], [counts, isSw]);

  return (
    <div className="pt-2 pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{staff?.job_title || (isSw ? 'Mtumishi wa Kituo' : 'Facility Staff')}</p>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            {provider ? provider.name : isSw ? 'Jukwaa la Kituo' : 'Provider Dashboard'}
          </h2>
          {staff?.department && <p className="text-[11px] text-slate-500 dark:text-slate-400">{staff.department}</p>}
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

      {!loading && !staff && !error && (
        <div className="nc-card p-4 mb-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isSw
              ? 'Akaunti hii bado haijaunganishwa na kituo chochote. Wasiliana na msimamizi.'
              : 'This account is not linked to a facility yet. Contact an administrator to complete your setup.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-5">
        {statCards.map(({ label, value, Icon, colour }) => (
          <div key={label} className="nc-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${colour}`} />
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {staff && (
        <div className="nc-card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Wagonjwa wa Leo' : "Today's Patients"}</h3>
          </div>
          {todayAppointments.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
              {isSw ? 'Hakuna miadi leo.' : 'No appointments today.'}
            </p>
          ) : (
            <div className="space-y-2">
              {todayAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={apt.patient_name || 'Patient'} size="md" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                        {apt.patient_name || 'Patient'}
                        {apt.consultation_type === 'telehealth' && <Video className="w-3 h-3 text-cyan-500 flex-shrink-0" />}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">{apt.time_slot}</p>
                    </div>
                  </div>
                  <span className={`rounded-lg px-2 py-1 font-bold capitalize flex-shrink-0 ${STATUS_STYLES[apt.status] || STATUS_STYLES.confirmed}`}>
                    {apt.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="nc-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Kituo' : 'Facility'}</h3>
        </div>
        {provider ? (
          <div className="space-y-1.5 text-xs">
            <p className="font-bold text-slate-900 dark:text-white">{provider.name}</p>
            <p className="text-slate-500 dark:text-slate-400 capitalize">{provider.type} • {provider.region}</p>
            {provider.address && (
              <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5" /> {provider.address}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isSw
              ? 'Dodoso la kituo litaonekana hapa baada ya msimamizi kuunganisha akaunti yako na kituo.'
              : 'Facility details will appear here once an admin links your account to a hospital or clinic.'}
          </p>
        )}
      </div>

      <div className="nc-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Usalama wa Data' : 'Data Security'}</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isSw
            ? 'Fikia taarifa za wagonjwa pekee kwa kufuata sera ya siri.'
            : 'Access patient data only in accordance with the privacy policy.'}
        </p>
      </div>

      {authUserId && (
        <p className="mt-5 text-[10px] text-center text-slate-400 dark:text-slate-600 font-mono">ID: {authUserId.slice(0, 12)}…</p>
      )}
    </div>
  );
};
