import React, { useEffect, useMemo, useState } from 'react';
import { Users, Building2, CalendarDays, Activity, LogOut, RefreshCw, Search, Moon, Sun, ShieldCheck } from 'lucide-react';
import type { Language, Theme, UserRole, UserStatus } from '../types';
import { supabase } from '../lib/supabaseClient';

interface AdminDashboardProps {
  language: Language;
  authUserId: string | null;
  onLogout: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  email: string | null;
  phone: string | null;
  created_at: string;
}

interface Metrics { providers: number; appointments: number; dispatches: number; }

const ROLE_TABS: { key: UserRole | 'all'; label: string; labelSw: string }[] = [
  { key: 'all', label: 'All', labelSw: 'Wote' },
  { key: 'patient', label: 'Patients', labelSw: 'Wagonjwa' },
  { key: 'doctor', label: 'Doctors', labelSw: 'Madaktari' },
  { key: 'provider_staff', label: 'Provider staff', labelSw: 'Wafanyakazi' },
  { key: 'admin', label: 'Admins', labelSw: 'Wasimamizi' },
];

const STATUS_STYLES: Record<UserStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  suspended: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ language, authUserId, onLogout, theme, onToggleTheme }) => {
  const isSw = language === 'sw';
  const isDark = theme === 'dark';
  const [metrics, setMetrics] = useState<Metrics>({ providers: 0, appointments: 0, dispatches: 0 });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError('');
    const [providers, appointments, dispatches, people] = await Promise.all([
      supabase.from('providers').select('*', { count: 'exact', head: true }),
      supabase.from('appointments').select('*', { count: 'exact', head: true }),
      supabase.from('emergency_dispatches').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('id, full_name, role, status, email, phone, created_at').order('created_at', { ascending: false }).limit(1000),
    ]);
    const failure = [providers, appointments, dispatches, people].find((item) => item.error)?.error;
    if (failure) setError(`${failure.message}. Confirm this account has role "admin" in public.profiles.`);
    else {
      setMetrics({ providers: providers.count || 0, appointments: appointments.count || 0, dispatches: dispatches.count || 0 });
      setProfiles((people.data || []) as Profile[]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: profiles.length };
    for (const p of profiles) counts[p.role] = (counts[p.role] || 0) + 1;
    return counts;
  }, [profiles]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (!q) return true;
      return (
        p.full_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q)
      );
    });
  }, [profiles, roleFilter, query]);

  const statCards = [
    { label: isSw ? 'Watumiaji' : 'Total users', value: profiles.length, Icon: Users, accent: 'bg-cyan-500' },
    { label: isSw ? 'Vituo' : 'Providers', value: metrics.providers, Icon: Building2, accent: 'bg-emerald-500' },
    { label: isSw ? 'Miadi' : 'Appointments', value: metrics.appointments, Icon: CalendarDays, accent: 'bg-amber-500' },
    { label: isSw ? 'Dharura' : 'Dispatches', value: metrics.dispatches, Icon: Activity, accent: 'bg-rose-500' },
  ];

  return (
    <div className="min-h-screen nc-bg nc-text">
      <header className="border-b nc-border" style={{ backgroundColor: 'var(--nc-surface)' }}>
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A4275] dark:bg-cyan-500">
              <ShieldCheck className="h-5 w-5 text-white dark:text-[#041D34]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide nc-text-muted">NiaCare</p>
              <h1 className="text-base font-black leading-tight">{isSw ? 'Jopo la Usimamizi' : 'Admin console'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onToggleTheme} className="rounded-lg border nc-border p-2 hover:bg-slate-100 dark:hover:bg-slate-800" title="Toggle theme">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button type="button" onClick={load} className="rounded-lg border nc-border p-2 hover:bg-slate-100 dark:hover:bg-slate-800" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onLogout} className="flex items-center gap-1.5 rounded-lg border nc-border px-3 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800">
              <LogOut className="h-3.5 w-3.5" /> {isSw ? 'Toka' : 'Log out'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map(({ label, value, Icon, accent }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border nc-border p-4" style={{ backgroundColor: 'var(--nc-surface)' }}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black leading-none">{loading ? '—' : value}</p>
                <p className="mt-1 text-[11px] font-semibold nc-text-muted">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border nc-border" style={{ backgroundColor: 'var(--nc-surface)' }}>
          <div className="flex flex-col gap-3 border-b nc-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {ROLE_TABS.map(({ key, label, labelSw }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRoleFilter(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    roleFilter === key
                      ? 'bg-[#0A4275] text-white dark:bg-cyan-500 dark:text-[#041D34]'
                      : 'nc-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {isSw ? labelSw : label} <span className="opacity-70">{roleCounts[key] ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 nc-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isSw ? 'Tafuta jina au barua pepe' : 'Search name or email'}
                className="nc-input w-full py-2 pl-8 pr-3 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b nc-border nc-text-muted">
                  <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Jina' : 'Name'}</th>
                  <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Mawasiliano' : 'Contact'}</th>
                  <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Jukumu' : 'Role'}</th>
                  <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Hali' : 'Status'}</th>
                  <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Alijiunga' : 'Joined'}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="border-b nc-border last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-bold">{p.full_name}</td>
                    <td className="px-4 py-3 nc-text-secondary">{p.email || p.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-blue-50 px-2 py-1 font-bold capitalize text-[#0A4275] dark:bg-cyan-950 dark:text-cyan-300">
                        {p.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-1 font-bold capitalize ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3 nc-text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !visible.length && (
              <p className="py-10 text-center text-xs nc-text-muted">
                {isSw ? 'Hakuna akaunti zilizopatikana.' : 'No accounts match this filter.'}
              </p>
            )}
          </div>
        </div>

        {authUserId && <p className="mt-4 text-center font-mono text-[10px] nc-text-muted">Admin session: {authUserId.slice(0, 12)}…</p>}
      </main>
    </div>
  );
};
