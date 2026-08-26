import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, Building2, CalendarDays, LogOut, RefreshCw, Search, Moon, Sun, ShieldCheck, UserPlus,
  CreditCard, Siren, ClipboardList, LayoutDashboard, DollarSign, Stethoscope,
} from 'lucide-react';
import type { Language, Theme, UserRole, UserStatus } from '../types';
import { supabase } from '../lib/supabaseClient';
import { InviteStaffModal } from './InviteStaffModal';
import {
  fetchProviders, setProviderActive, ProviderRow,
  fetchBills, BillRow,
  fetchDispatches, setDispatchStatus, DispatchRow, DISPATCH_STATUSES,
  fetchAuditLogs, AuditLogRow,
} from '../lib/admin';

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

const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', labelSw: 'Dashibodi', Icon: LayoutDashboard },
  { key: 'users', label: 'Users Management', labelSw: 'Watumiaji', Icon: Users },
  { key: 'providers', label: 'Providers & Facilities', labelSw: 'Vituo', Icon: Building2 },
  { key: 'operations', label: 'Operations', labelSw: 'Uendeshaji', Icon: CreditCard },
  { key: 'audit', label: 'Audit / Reports', labelSw: 'Kumbukumbu', Icon: ClipboardList },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

// Matches the .nc-card radius used by Doctor/Provider/Patient dashboards —
// one consistent card language across every role, not a per-screen value.
const cardCls = 'rounded-2xl border nc-border';

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500'];
const avatarColor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};
const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';

const Avatar: React.FC<{ name: string }> = ({ name }) => (
  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${avatarColor(name)}`}>
    {initials(name)}
  </div>
);

const MiniBarChart: React.FC<{ data: { label: string; value: number }[]; color: string }> = ({ data, color }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-28 items-end gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[9px] font-bold nc-text-muted">{d.value || ''}</span>
          <div
            className="w-full rounded-t-md transition-all"
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%`, backgroundColor: color }}
          />
          <span className="text-[9px] nc-text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ language, authUserId, onLogout, theme, onToggleTheme }) => {
  const isSw = language === 'sw';
  const isDark = theme === 'dark';
  const [section, setSection] = useState<SectionKey>('dashboard');
  const [metrics, setMetrics] = useState<Metrics>({ providers: 0, appointments: 0, dispatches: 0 });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

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

  const changeRole = async (id: string, role: UserRole) => {
    setSavingId(id);
    const { error: err } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (err) setError(err.message);
    else setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
    setSavingId(null);
  };

  const toggleStatus = async (id: string, current: UserStatus) => {
    const next: UserStatus = current === 'suspended' ? 'active' : 'suspended';
    setSavingId(id);
    const { error: err } = await supabase.from('profiles').update({ status: next }).eq('id', id);
    if (err) setError(err.message);
    else setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, status: next } : p)));
    setSavingId(null);
  };

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
            <button
              type="button"
              onClick={() => setIsInviteOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#0A4275] px-3 py-2 text-xs font-bold text-white hover:opacity-90 dark:bg-cyan-500 dark:text-[#041D34]"
            >
              <UserPlus className="h-3.5 w-3.5" /> {isSw ? 'Alika Mfanyakazi' : 'Invite staff'}
            </button>
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

        <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-6 pb-2">
          {SECTIONS.map(({ key, label, labelSw, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                section === key
                  ? 'bg-[#0A4275] text-white dark:bg-cyan-500 dark:text-[#041D34]'
                  : 'nc-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {isSw ? labelSw : label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}

        {section === 'dashboard' && <DashboardPanel isSw={isSw} profiles={profiles} metrics={metrics} loading={loading} />}

        {section === 'users' && (
          <div className={`overflow-hidden ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
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
                    <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Vitendo' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr key={p.id} className="border-b nc-border last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={p.full_name} />
                          <span className="font-bold">{p.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 nc-text-secondary">{p.email || p.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={p.role}
                          disabled={savingId === p.id || p.id === authUserId}
                          onChange={(e) => changeRole(p.id, e.target.value as UserRole)}
                          className="rounded-md border nc-border bg-transparent px-1.5 py-1 font-bold capitalize"
                          title={p.id === authUserId ? (isSw ? 'Huwezi kubadilisha jukumu lako mwenyewe' : "Can't change your own role") : undefined}
                        >
                          <option value="patient">Patient</option>
                          <option value="doctor">Doctor</option>
                          <option value="provider_staff">Provider staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-md px-2 py-1 font-bold capitalize ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 nc-text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={savingId === p.id || p.id === authUserId}
                          onClick={() => toggleStatus(p.id, p.status)}
                          className={`rounded-md px-2 py-1 font-bold disabled:opacity-40 ${
                            p.status === 'suspended'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {p.status === 'suspended' ? (isSw ? 'Washa' : 'Activate') : (isSw ? 'Zuia' : 'Suspend')}
                        </button>
                      </td>
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
        )}

        {section === 'providers' && <ProvidersPanel isSw={isSw} />}
        {section === 'operations' && <OperationsPanel isSw={isSw} />}
        {section === 'audit' && <AuditPanel isSw={isSw} />}

        {authUserId && <p className="mt-4 text-center font-mono text-[10px] nc-text-muted">Admin session: {authUserId.slice(0, 12)}…</p>}
      </main>

      <InviteStaffModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} onInvited={load} />
    </div>
  );
};

const last6Months = () => {
  const arr: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString(undefined, { month: 'short' }) });
  }
  return arr;
};

const last7Days = () => {
  const arr: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    arr.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { weekday: 'short' }) });
  }
  return arr;
};

const DashboardPanel: React.FC<{ isSw: boolean; profiles: Profile[]; metrics: Metrics; loading: boolean }> = ({ isSw, profiles, metrics, loading }) => {
  const [apptDates, setApptDates] = useState<string[]>([]);
  const [billTotals, setBillTotals] = useState({ revenue: 0, pending: 0 });

  useEffect(() => {
    supabase.from('appointments').select('appointment_date').limit(1000).then(({ data }) => {
      setApptDates((data || []).map((r) => r.appointment_date as string));
    });
    supabase.from('bills').select('status, total_tzs').then(({ data }) => {
      let revenue = 0, pending = 0;
      for (const b of data || []) {
        if (b.status === 'settled') revenue += b.total_tzs;
        if (b.status === 'pending') pending += b.total_tzs;
      }
      setBillTotals({ revenue, pending });
    });
  }, []);

  const patients = profiles.filter((p) => p.role === 'patient').length;
  const doctors = profiles.filter((p) => p.role === 'doctor').length;

  const overviewStats = [
    { label: isSw ? 'Watumiaji' : 'Users', value: profiles.length, Icon: Users, accent: 'bg-cyan-500' },
    { label: isSw ? 'Wagonjwa' : 'Patients', value: patients, Icon: Users, accent: 'bg-blue-500' },
    { label: isSw ? 'Madaktari' : 'Doctors', value: doctors, Icon: Stethoscope, accent: 'bg-purple-500' },
    { label: isSw ? 'Vituo' : 'Facilities', value: metrics.providers, Icon: Building2, accent: 'bg-emerald-500' },
    { label: isSw ? 'Miadi' : 'Appointments', value: metrics.appointments, Icon: CalendarDays, accent: 'bg-amber-500' },
    { label: isSw ? 'Mapato' : 'Revenue', value: `${billTotals.revenue.toLocaleString()} TZS`, Icon: DollarSign, accent: 'bg-emerald-600' },
    { label: isSw ? 'Inasubiri' : 'Pending Payments', value: `${billTotals.pending.toLocaleString()} TZS`, Icon: CreditCard, accent: 'bg-amber-600' },
    { label: isSw ? 'Simu za Dharura' : 'Emergency Calls', value: metrics.dispatches, Icon: Siren, accent: 'bg-rose-500' },
  ];

  const patientGrowth = last6Months().map((m) => ({
    label: m.label,
    value: profiles.filter((p) => p.role === 'patient' && p.created_at.startsWith(m.key)).length,
  }));

  const appointmentsTrend = last7Days().map((d) => ({
    label: d.label,
    value: apptDates.filter((x) => x === d.key).length,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {overviewStats.map(({ label, value, Icon, accent }) => (
          <div key={label} className={`flex items-center gap-3 p-4 ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-black leading-none">{loading ? '—' : value}</p>
              <p className="mt-1 text-[11px] font-semibold nc-text-muted">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={`p-4 ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wide nc-text-muted">{isSw ? 'Ukuaji wa Wagonjwa' : 'Patient Growth'}</h3>
          <MiniBarChart data={patientGrowth} color="#0A4275" />
        </div>
        <div className={`p-4 ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wide nc-text-muted">{isSw ? 'Miadi (Siku 7)' : 'Appointments (Last 7 Days)'}</h3>
          <MiniBarChart data={appointmentsTrend} color="#06B6D4" />
        </div>
      </div>
    </div>
  );
};

const OperationsPanel: React.FC<{ isSw: boolean }> = ({ isSw }) => {
  const [tab, setTab] = useState<'billing' | 'emergency'>('billing');
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(['billing', 'emergency'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === key
                ? 'bg-[#0A4275] text-white dark:bg-cyan-500 dark:text-[#041D34]'
                : 'nc-text-secondary hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {key === 'billing' ? <CreditCard className="h-3.5 w-3.5" /> : <Siren className="h-3.5 w-3.5" />}
            {key === 'billing' ? (isSw ? 'Malipo' : 'Billing') : (isSw ? 'Dharura' : 'Emergency')}
          </button>
        ))}
      </div>
      {tab === 'billing' ? <BillingPanel isSw={isSw} /> : <EmergencyPanel isSw={isSw} />}
    </div>
  );
};

const ProvidersPanel: React.FC<{ isSw: boolean }> = ({ isSw }) => {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { providers: fetched, error: err } = await fetchProviders();
    if (err) setError(err); else setProviders(fetched);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (p: ProviderRow) => {
    setSavingId(p.id);
    const { error: err } = await setProviderActive(p.id, !p.is_active);
    if (err) setError(err);
    else setProviders((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
    setSavingId(null);
  };

  return (
    <div className={`overflow-hidden ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
      <div className="flex items-center justify-between border-b nc-border p-4">
        <h3 className="text-sm font-black">{isSw ? 'Vituo vya Afya' : 'Facilities'}</h3>
        <button type="button" onClick={load} className="text-xs font-bold nc-text-muted hover:underline">{isSw ? 'Onyesha upya' : 'Refresh'}</button>
      </div>
      {error && <p className="p-4 text-xs font-medium text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b nc-border nc-text-muted">
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Jina' : 'Facility'}</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Mkoa' : 'Region'}</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Aina' : 'Type'}</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">NHIF</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Hali' : 'Status'}</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Vitendo' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id} className="border-b nc-border last:border-0">
                <td className="px-4 py-3 font-bold">{p.name}</td>
                <td className="px-4 py-3 nc-text-secondary">{p.region}</td>
                <td className="px-4 py-3 nc-text-secondary">{p.type}</td>
                <td className="px-4 py-3">{p.nhif_enabled ? '✓' : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-md px-2 py-1 font-bold ${p.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}`}>
                    {p.is_active ? (isSw ? 'Hai' : 'Active') : (isSw ? 'Imesitishwa' : 'Suspended')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button type="button" disabled={savingId === p.id} onClick={() => toggle(p)} className="rounded-md bg-slate-100 px-2 py-1 font-bold hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40">
                    {p.is_active ? (isSw ? 'Sitisha' : 'Suspend') : (isSw ? 'Idhinisha' : 'Approve')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !providers.length && <p className="py-10 text-center text-xs nc-text-muted">{isSw ? 'Hakuna vituo.' : 'No facilities yet.'}</p>}
      </div>
    </div>
  );
};

const BILL_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  settled: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  processing: 'bg-blue-50 text-[#0A4275] dark:bg-cyan-950 dark:text-cyan-300',
};

const BillingPanel: React.FC<{ isSw: boolean }> = ({ isSw }) => {
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBills().then(({ bills: fetched, error: err }) => {
      if (err) setError(err); else setBills(fetched);
      setLoading(false);
    });
  }, []);

  const totals = useMemo(() => {
    const acc = { revenue: 0, pending: 0, settled: 0 };
    for (const b of bills) {
      if (b.status === 'settled') acc.revenue += b.total_tzs;
      if (b.status === 'pending') acc.pending += b.total_tzs;
      acc.settled += b.status === 'settled' ? 1 : 0;
    }
    return acc;
  }, [bills]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className={`p-4 ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
          <p className="text-[11px] font-semibold nc-text-muted">{isSw ? 'Mapato Yaliyokusanywa' : 'Revenue collected'}</p>
          <p className="text-xl font-black">{totals.revenue.toLocaleString()} TZS</p>
        </div>
        <div className={`p-4 ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
          <p className="text-[11px] font-semibold nc-text-muted">{isSw ? 'Inasubiri' : 'Pending'}</p>
          <p className="text-xl font-black">{totals.pending.toLocaleString()} TZS</p>
        </div>
        <div className={`p-4 ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
          <p className="text-[11px] font-semibold nc-text-muted">{isSw ? 'Bili Zilizolipwa' : 'Bills settled'}</p>
          <p className="text-xl font-black">{totals.settled}</p>
        </div>
      </div>

      <div className={`overflow-hidden ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
        {error && <p className="p-4 text-xs font-medium text-red-700">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b nc-border nc-text-muted">
                <th className="px-4 py-2.5 font-bold uppercase tracking-wide">Invoice</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Mgonjwa' : 'Patient'}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Kituo' : 'Facility'}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Kiasi' : 'Amount'}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Hali' : 'Status'}</th>
                <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Tarehe' : 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-b nc-border last:border-0">
                  <td className="px-4 py-3 font-mono">{b.invoice_number}</td>
                  <td className="px-4 py-3 font-bold">{b.patientName}</td>
                  <td className="px-4 py-3 nc-text-secondary">{b.facility}</td>
                  <td className="px-4 py-3 font-mono">{b.total_tzs.toLocaleString()} TZS</td>
                  <td className="px-4 py-3"><span className={`rounded-md px-2 py-1 font-bold capitalize ${BILL_STATUS_STYLES[b.status] || ''}`}>{b.status}</span></td>
                  <td className="px-4 py-3 nc-text-muted">{new Date(b.bill_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !bills.length && <p className="py-10 text-center text-xs nc-text-muted">{isSw ? 'Hakuna bili bado.' : 'No bills yet.'}</p>}
        </div>
      </div>
    </div>
  );
};

const EmergencyPanel: React.FC<{ isSw: boolean }> = ({ isSw }) => {
  const [dispatches, setDispatches] = useState<DispatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { dispatches: fetched, error: err } = await fetchDispatches();
    if (err) setError(err); else setDispatches(fetched);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setSavingId(id);
    const { error: err } = await setDispatchStatus(id, status);
    if (err) setError(err);
    else setDispatches((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
    setSavingId(null);
  };

  return (
    <div className={`overflow-hidden ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
      <div className="flex items-center justify-between border-b nc-border p-4">
        <h3 className="text-sm font-black">{isSw ? 'Uendeshaji wa Dharura' : 'Emergency operations'}</h3>
        <button type="button" onClick={load} className="text-xs font-bold nc-text-muted hover:underline">{isSw ? 'Onyesha upya' : 'Refresh'}</button>
      </div>
      {error && <p className="p-4 text-xs font-medium text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b nc-border nc-text-muted">
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">Ref</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Mgonjwa' : 'Patient'}</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Hali ya Dharura' : 'Condition'}</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Kituo' : 'Facility'}</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">ETA</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Hali' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {dispatches.map((d) => (
              <tr key={d.id} className="border-b nc-border last:border-0">
                <td className="px-4 py-3 font-mono">{d.dispatch_ref}</td>
                <td className="px-4 py-3 font-bold">{d.patientName}</td>
                <td className="px-4 py-3 nc-text-secondary capitalize">{d.condition}</td>
                <td className="px-4 py-3 nc-text-secondary">{d.target_facility || '—'}</td>
                <td className="px-4 py-3 nc-text-muted">{d.facility_eta_min ? `${d.facility_eta_min} min` : '—'}</td>
                <td className="px-4 py-3">
                  <select
                    value={d.status}
                    disabled={savingId === d.id}
                    onChange={(e) => updateStatus(d.id, e.target.value)}
                    className="rounded-md border nc-border bg-transparent px-1.5 py-1 font-bold capitalize"
                  >
                    {DISPATCH_STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !dispatches.length && <p className="py-10 text-center text-xs nc-text-muted">{isSw ? 'Hakuna dharura zilizoripotiwa.' : 'No emergency dispatches yet.'}</p>}
      </div>
    </div>
  );
};

const AuditPanel: React.FC<{ isSw: boolean }> = ({ isSw }) => {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    const { logs: fetched, error: err } = await fetchAuditLogs();
    if (err) setError(err); else setLogs(fetched);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => l.action.toLowerCase().includes(q) || l.resource_type.toLowerCase().includes(q) || l.actorName.toLowerCase().includes(q));
  }, [logs, query]);

  return (
    <div className={`overflow-hidden ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
      <div className="flex flex-col gap-3 border-b nc-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-black">{isSw ? 'Kumbukumbu za Usalama' : 'Audit logs'}</h3>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 nc-text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isSw ? 'Tafuta kitendo...' : 'Search action, resource, actor'} className="nc-input w-full py-2 pl-8 pr-3 text-xs" />
        </div>
      </div>
      {error && <p className="p-4 text-xs font-medium text-red-700">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b nc-border nc-text-muted">
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Muda' : 'Time'}</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Mtekelezaji' : 'Actor'}</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Kitendo' : 'Action'}</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Rasilimali' : 'Resource'}</th>
              <th className="px-4 py-2.5 font-bold uppercase tracking-wide">{isSw ? 'Mgonjwa' : 'Patient'}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => (
              <tr key={l.id} className="border-b nc-border last:border-0">
                <td className="px-4 py-3 nc-text-muted whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-bold">{l.actorName}</td>
                <td className="px-4 py-3"><span className="rounded-md bg-blue-50 px-2 py-1 font-bold text-[#0A4275] dark:bg-cyan-950 dark:text-cyan-300">{l.action}</span></td>
                <td className="px-4 py-3 nc-text-secondary">{l.resource_type}</td>
                <td className="px-4 py-3 nc-text-secondary">{l.patientName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !visible.length && <p className="py-10 text-center text-xs nc-text-muted">{isSw ? 'Hakuna kumbukumbu bado.' : 'No audit entries yet.'}</p>}
      </div>
    </div>
  );
};
