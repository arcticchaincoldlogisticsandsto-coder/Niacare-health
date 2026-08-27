import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, Building2, CalendarDays, LogOut, RefreshCw, Search, Moon, Sun, ShieldCheck, UserPlus,
  CreditCard, Siren, ClipboardList, LayoutDashboard, DollarSign, Stethoscope,
  Plus, Save, X, Edit3, MapPin, Phone, Mail, UserCog,
} from 'lucide-react';
import type { Language, Theme, UserRole, UserStatus } from '../types';
import { supabase } from '../lib/supabaseClient';
import { InviteStaffModal } from './InviteStaffModal';
import { Avatar } from './Avatar';
import {
  createProvider, fetchProviderDirectory, fetchProviders, setProviderActive, updateProvider,
  ProviderDoctorRow, ProviderRow, ProviderStaffRow, ProviderUpsertInput,
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
const cardCls = 'rounded-xl border nc-border shadow-[0_1px_2px_rgba(15,45,80,0.025)]';

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

        {section === 'providers' && <FacilityAdminPanel isSw={isSw} />}
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

const emptyProviderForm: ProviderUpsertInput = {
  name: '',
  region: '',
  type: '',
  address: '',
  phone: '',
  emergency_phone: '',
  email: '',
  nhif_enabled: true,
  is_active: true,
};

const providerToForm = (provider: ProviderRow): ProviderUpsertInput => ({
  name: provider.name,
  region: provider.region,
  type: provider.type,
  address: provider.address || '',
  phone: provider.phone || '',
  emergency_phone: provider.emergency_phone || '',
  email: provider.email || '',
  nhif_enabled: provider.nhif_enabled,
  is_active: provider.is_active,
});

const FacilityAdminPanel: React.FC<{ isSw: boolean }> = ({ isSw }) => {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [doctors, setDoctors] = useState<ProviderDoctorRow[]>([]);
  const [staff, setStaff] = useState<ProviderStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderUpsertInput>(emptyProviderForm);
  const selected = providers.find((provider) => provider.id === selectedId) || null;

  const load = async () => {
    setLoading(true);
    setError('');
    const { providers: fetched, error: err } = await fetchProviders();
    if (err) setError(err);
    else {
      setProviders(fetched);
      setSelectedId((current) => current || fetched[0]?.id || '');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) {
      setDoctors([]);
      setStaff([]);
      return;
    }
    setDirectoryLoading(true);
    fetchProviderDirectory(selectedId).then(({ doctors: fetchedDoctors, staff: fetchedStaff, error: err }) => {
      if (err) setError(err);
      else {
        setDoctors(fetchedDoctors);
        setStaff(fetchedStaff);
      }
      setDirectoryLoading(false);
    });
  }, [selectedId]);

  const startCreate = () => {
    setEditingId('new');
    setForm(emptyProviderForm);
  };

  const startEdit = (provider: ProviderRow) => {
    setEditingId(provider.id);
    setForm(providerToForm(provider));
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyProviderForm);
  };

  const updateForm = (key: keyof ProviderUpsertInput, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveProvider = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError('');
    const payload: ProviderUpsertInput = {
      ...form,
      name: form.name.trim(),
      region: form.region.trim(),
      type: form.type.trim(),
      address: form.address?.trim() || null,
      phone: form.phone?.trim() || null,
      emergency_phone: form.emergency_phone?.trim() || null,
      email: form.email?.trim() || null,
    };
    const result = editingId === 'new' ? await createProvider(payload) : await updateProvider(editingId, payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    closeForm();
    await load();
  };

  const toggle = async (provider: ProviderRow) => {
    setSavingId(provider.id);
    const { error: err } = await setProviderActive(provider.id, !provider.is_active);
    if (err) setError(err);
    else setProviders((prev) => prev.map((item) => (item.id === provider.id ? { ...item, is_active: !item.is_active } : item)));
    setSavingId(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
      <div className={`overflow-hidden ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
        <div className="flex items-center justify-between border-b nc-border p-4">
          <div>
            <h3 className="text-sm font-black">{isSw ? 'Vituo na Watoa Huduma' : 'Facilities & Providers'}</h3>
            <p className="mt-0.5 text-[11px] font-semibold nc-text-muted">
              {isSw ? 'Dhibiti hospitali, kliniki na timu zake.' : 'Manage facilities and their doctors/staff.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={load} className="rounded-md border nc-border p-2 nc-text-muted hover:bg-slate-50 dark:hover:bg-slate-800" title="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={startCreate} className="flex items-center gap-1.5 rounded-md bg-[#075FD6] px-3 py-2 text-xs font-black text-white">
              <Plus className="h-3.5 w-3.5" /> {isSw ? 'Ongeza' : 'Add'}
            </button>
          </div>
        </div>

        {error && <p className="border-b border-red-100 bg-red-50 p-3 text-xs font-medium text-red-700">{error}</p>}

        <div className="max-h-[620px] overflow-y-auto p-2">
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => setSelectedId(provider.id)}
              className={`mb-2 w-full rounded-md border p-3 text-left transition-colors ${
                selectedId === provider.id
                  ? 'border-[#075FD6] bg-blue-50/70 dark:border-cyan-500 dark:bg-cyan-950/20'
                  : 'border-slate-200 bg-white hover:border-[#B8D4F5] dark:border-slate-800 dark:bg-[#101F31]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{provider.name}</p>
                  <p className="mt-1 truncate text-[11px] font-semibold nc-text-muted">{provider.region}</p>
                </div>
                <span className={`rounded-md px-2 py-1 text-[10px] font-black ${provider.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {provider.is_active ? 'Active' : 'Suspended'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold nc-text-secondary">
                <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">{provider.type}</span>
                {provider.nhif_enabled && <span className="rounded-md bg-blue-50 px-2 py-1 text-[#075FD6] dark:bg-cyan-950 dark:text-cyan-300">NHIF</span>}
              </div>
            </button>
          ))}
          {!loading && !providers.length && <p className="py-10 text-center text-xs nc-text-muted">{isSw ? 'Hakuna vituo.' : 'No facilities yet.'}</p>}
        </div>
      </div>

      <div className="space-y-4">
        {(editingId || !selected) ? (
          <div className={`p-4 ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black">{editingId === 'new' ? (isSw ? 'Ongeza Kituo' : 'Add Facility') : (isSw ? 'Hariri Kituo' : 'Edit Facility')}</h3>
                <p className="mt-0.5 text-[11px] font-semibold nc-text-muted">
                  {isSw ? 'Taarifa hizi hutumika kwenye miadi na uendeshaji.' : 'These details drive bookings and provider operations.'}
                </p>
              </div>
              <button type="button" onClick={closeForm} className="rounded-md border nc-border p-2 nc-text-muted hover:bg-slate-50 dark:hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveProvider} className="grid gap-3 text-xs sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block font-bold nc-text-secondary">Facility name</span>
                <input required value={form.name} onChange={(e) => updateForm('name', e.target.value)} className="nc-input px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block font-bold nc-text-secondary">Region</span>
                <input required value={form.region} onChange={(e) => updateForm('region', e.target.value)} className="nc-input px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block font-bold nc-text-secondary">Type</span>
                <input required value={form.type} onChange={(e) => updateForm('type', e.target.value)} placeholder="Private Hospital" className="nc-input px-3 py-2" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block font-bold nc-text-secondary">Address</span>
                <input value={form.address || ''} onChange={(e) => updateForm('address', e.target.value)} className="nc-input px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block font-bold nc-text-secondary">Phone</span>
                <input value={form.phone || ''} onChange={(e) => updateForm('phone', e.target.value)} className="nc-input px-3 py-2" />
              </label>
              <label>
                <span className="mb-1 block font-bold nc-text-secondary">Emergency phone</span>
                <input value={form.emergency_phone || ''} onChange={(e) => updateForm('emergency_phone', e.target.value)} className="nc-input px-3 py-2" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block font-bold nc-text-secondary">Email</span>
                <input type="email" value={form.email || ''} onChange={(e) => updateForm('email', e.target.value)} className="nc-input px-3 py-2" />
              </label>
              <label className="flex items-center gap-2 font-bold nc-text-secondary">
                <input type="checkbox" checked={form.nhif_enabled} onChange={(e) => updateForm('nhif_enabled', e.target.checked)} className="h-4 w-4 accent-[#075FD6]" />
                NHIF enabled
              </label>
              <label className="flex items-center gap-2 font-bold nc-text-secondary">
                <input type="checkbox" checked={form.is_active} onChange={(e) => updateForm('is_active', e.target.checked)} className="h-4 w-4 accent-[#075FD6]" />
                Active
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" onClick={closeForm} className="rounded-md border nc-border px-3 py-2 font-bold nc-text-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-md bg-[#075FD6] px-3 py-2 font-black text-white disabled:opacity-60">
                  <Save className="h-3.5 w-3.5" /> {saving ? 'Saving...' : 'Save facility'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className={`p-4 ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-black nc-text-muted">Selected facility</p>
                  <h3 className="mt-1 text-lg font-black">{selected.name}</h3>
                  <p className="mt-1 text-xs font-semibold nc-text-secondary">{selected.type} - {selected.region}</p>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    {selected.address && <p className="flex items-center gap-2 nc-text-secondary"><MapPin className="h-3.5 w-3.5 text-[#075FD6]" /> {selected.address}</p>}
                    {selected.phone && <p className="flex items-center gap-2 nc-text-secondary"><Phone className="h-3.5 w-3.5 text-[#075FD6]" /> {selected.phone}</p>}
                    {selected.email && <p className="flex items-center gap-2 nc-text-secondary"><Mail className="h-3.5 w-3.5 text-[#075FD6]" /> {selected.email}</p>}
                    {selected.emergency_phone && <p className="flex items-center gap-2 nc-text-secondary"><Siren className="h-3.5 w-3.5 text-rose-500" /> {selected.emergency_phone}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => startEdit(selected)} className="flex items-center gap-1.5 rounded-md border nc-border px-3 py-2 text-xs font-black nc-text-secondary hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Edit3 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button type="button" disabled={savingId === selected.id} onClick={() => toggle(selected)} className="rounded-md border nc-border px-3 py-2 text-xs font-black nc-text-secondary hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800">
                    {selected.is_active ? 'Suspend' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <TeamList
                icon={<Stethoscope className="h-4 w-4 text-[#075FD6]" />}
                title={isSw ? 'Madaktari wa Kituo' : 'Facility Doctors'}
                empty={isSw ? 'Hakuna madaktari bado.' : 'No doctors attached yet.'}
                loading={directoryLoading}
                rows={doctors.map((doctor) => ({
                  id: doctor.id,
                  name: doctor.full_name,
                  meta: [doctor.specialty, doctor.sub_specialty].filter(Boolean).join(' - '),
                  status: doctor.is_active ? (doctor.is_verified ? 'Verified' : 'Active') : 'Inactive',
                }))}
              />
              <TeamList
                icon={<UserCog className="h-4 w-4 text-[#075FD6]" />}
                title={isSw ? 'Wafanyakazi wa Kituo' : 'Provider Staff'}
                empty={isSw ? 'Hakuna wafanyakazi bado.' : 'No provider staff attached yet.'}
                loading={directoryLoading}
                rows={staff.map((member) => ({
                  id: member.id,
                  name: member.full_name,
                  meta: [member.job_title, member.department].filter(Boolean).join(' - '),
                  status: member.is_active ? 'Active' : 'Inactive',
                }))}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const TeamList: React.FC<{
  icon: React.ReactNode;
  title: string;
  empty: string;
  loading: boolean;
  rows: { id: string; name: string; meta: string; status: string }[];
}> = ({ icon, title, empty, loading, rows }) => (
  <div className={`overflow-hidden ${cardCls}`} style={{ backgroundColor: 'var(--nc-surface)' }}>
    <div className="flex items-center justify-between border-b nc-border p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-black">{title}</h3>
      </div>
      <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-black text-[#075FD6] dark:bg-cyan-950 dark:text-cyan-300">
        {rows.length}
      </span>
    </div>
    <div className="space-y-2 p-2">
      {loading ? (
        <p className="p-3 text-xs nc-text-muted">Loading team...</p>
      ) : rows.length ? (
        rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3 text-xs dark:border-slate-800">
            <div className="min-w-0">
              <p className="truncate font-black">{row.name}</p>
              <p className="mt-0.5 truncate nc-text-muted">{row.meta || '-'}</p>
            </div>
            <span className={`rounded-md px-2 py-1 text-[10px] font-black ${row.status === 'Inactive' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {row.status}
            </span>
          </div>
        ))
      ) : (
        <p className="p-3 text-xs nc-text-muted">{empty}</p>
      )}
    </div>
  </div>
);

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
