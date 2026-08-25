import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Building2, CalendarDays, Activity, LogOut, RefreshCw, UserRoundCheck } from 'lucide-react';
import type { Language, UserRole } from '../types';
import { supabase } from '../lib/supabaseClient';

interface AdminDashboardProps { language: Language; authUserId: string | null; onLogout: () => void; }
interface Profile { id: string; full_name: string; role: UserRole; status: string; email: string | null; }
interface Metrics { users: number; providers: number; appointments: number; dispatches: number; }

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ language, authUserId, onLogout }) => {
  const isSw = language === 'sw';
  const [metrics, setMetrics] = useState<Metrics>({ users: 0, providers: 0, appointments: 0, dispatches: 0 });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError('');
    const [users, providers, appointments, dispatches, people] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('providers').select('*', { count: 'exact', head: true }),
      supabase.from('appointments').select('*', { count: 'exact', head: true }),
      supabase.from('emergency_dispatches').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('id, full_name, role, status, email').order('created_at', { ascending: false }).limit(8),
    ]);
    const failure = [users, providers, appointments, dispatches, people].find((item) => item.error)?.error;
    if (failure) setError(`${failure.message}. Confirm this account has role “admin” in public.profiles.`);
    else {
      setMetrics({ users: users.count || 0, providers: providers.count || 0, appointments: appointments.count || 0, dispatches: dispatches.count || 0 });
      setProfiles((people.data || []) as Profile[]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const cards = [
    { label: isSw ? 'Watumiaji' : 'Users', value: metrics.users, Icon: Users, colour: 'text-cyan-600 dark:text-cyan-400' },
    { label: isSw ? 'Vituo' : 'Providers', value: metrics.providers, Icon: Building2, colour: 'text-emerald-600 dark:text-emerald-400' },
    { label: isSw ? 'Miadi' : 'Appointments', value: metrics.appointments, Icon: CalendarDays, colour: 'text-amber-600 dark:text-amber-400' },
    { label: isSw ? 'Dharura' : 'Dispatches', value: metrics.dispatches, Icon: Activity, colour: 'text-rose-500' },
  ];

  return <div className="pt-2 pb-6">
    <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{isSw ? 'Msimamizi' : 'Administrator'}</p><h2 className="text-lg font-black text-slate-900 dark:text-white">{isSw ? 'Jukwaa la Usimamizi' : 'Admin control centre'}</h2></div><div className="flex gap-2"><button type="button" onClick={load} className="rounded-xl bg-slate-100 p-2.5 dark:bg-slate-800" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button><button type="button" onClick={onLogout} className="rounded-xl bg-slate-100 p-2.5 dark:bg-slate-800" title="Logout"><LogOut className="w-4 h-4" /></button></div></div>
    <div className="mb-5 grid grid-cols-2 gap-3">{cards.map(({ label, value, Icon, colour }) => <div key={label} className="nc-card p-4"><div className="mb-2 flex items-center gap-2"><Icon className={`w-4 h-4 ${colour}`} /><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span></div><p className="text-2xl font-black text-slate-900 dark:text-white">{loading ? '—' : value}</p></div>)}</div>
    {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}
    <section className="nc-card p-4"><div className="mb-3 flex items-center gap-2"><LayoutDashboard className="w-4 h-4 text-blue-500" /><h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Akaunti za majukumu yote' : 'Accounts across all roles'}</h3></div><div className="space-y-2">{profiles.map((profile) => <div key={profile.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 text-xs dark:border-slate-800"><div className="min-w-0"><p className="truncate font-bold text-slate-900 dark:text-white">{profile.full_name}</p><p className="truncate text-slate-500">{profile.email || profile.id}</p></div><div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1 font-bold capitalize text-[#0A4275] dark:bg-cyan-950 dark:text-cyan-300"><UserRoundCheck className="w-3.5 h-3.5" />{profile.role.replace('_', ' ')}</div></div>)}{!loading && !profiles.length && !error && <p className="py-4 text-center text-xs text-slate-500">No accounts found.</p>}</div></section>
    {authUserId && <p className="mt-5 text-center font-mono text-[10px] text-slate-400 dark:text-slate-600">Admin session: {authUserId.slice(0, 12)}…</p>}
  </div>;
};
