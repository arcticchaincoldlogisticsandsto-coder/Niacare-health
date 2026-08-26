import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Users, CalendarDays, CreditCard, LogOut, RefreshCw, ShieldCheck, MapPin, Video, Search, UserCheck, ClipboardList, Package, MessageSquare, Plus, Send } from 'lucide-react';
import type { Language } from '../types';
import { supabase } from '../lib/supabaseClient';
import { Avatar } from './Avatar';
import {
  fetchTasks, createTask, updateTaskStatus, TaskRow,
  fetchInventory, updateInventoryQuantity, addInventoryItem, InventoryRow,
  fetchFacilityMessages, postFacilityMessage, FacilityMessageRow,
} from '../lib/providerOps';

const TasksPanel: React.FC<{ isSw: boolean; providerId: string }> = ({ isSw, providerId }) => {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { tasks: fetched, error: err } = await fetchTasks(providerId);
    if (err) setError(err); else setTasks(fetched);
    setLoading(false);
  };
  useEffect(() => { load(); }, [providerId]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    const { error: err } = await createTask(providerId, newTitle.trim(), null);
    setAdding(false);
    if (err) { setError(err); return; }
    setNewTitle('');
    load();
  };

  const cycleStatus = async (t: TaskRow) => {
    const next = t.status === 'pending' ? 'in_progress' : t.status === 'in_progress' ? 'completed' : 'pending';
    const { error: err } = await updateTaskStatus(t.id, next);
    if (err) setError(err);
    else setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
  };

  const TASK_STYLES: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    in_progress: 'bg-blue-50 text-[#0A4275] dark:bg-cyan-950 dark:text-cyan-300',
    completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  };

  return (
    <div className="nc-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-cyan-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Majukumu' : 'Tasks'}</h3>
      </div>
      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
      <div className="flex gap-2 mb-3">
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={isSw ? 'Ongeza jukumu jipya...' : 'Add a new task...'} className="nc-input flex-1 px-3 py-2 text-xs" />
        <button type="button" onClick={handleAdd} disabled={adding || !newTitle.trim()} className="rounded-lg bg-[#0A4275] dark:bg-cyan-500 text-white dark:text-[#041D34] px-3 py-2 text-xs font-bold disabled:opacity-50 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {!loading && tasks.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-2">{isSw ? 'Hakuna majukumu.' : 'No tasks yet.'}</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <button key={t.id} type="button" onClick={() => cycleStatus(t)} className="w-full flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs text-left hover:border-[#0A4275] dark:hover:border-cyan-500 transition-colors">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white truncate">{t.title}</p>
                {t.patientName && <p className="text-slate-500 dark:text-slate-400 truncate">{t.patientName}</p>}
              </div>
              <span className={`rounded-lg px-2 py-1 font-bold capitalize flex-shrink-0 ${TASK_STYLES[t.status]}`}>{t.status.replace('_', ' ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const InventoryPanel: React.FC<{ isSw: boolean; providerId: string }> = ({ isSw, providerId }) => {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newItem, setNewItem] = useState({ name: '', quantity: '', minimum: '', unit: 'units' });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { items: fetched, error: err } = await fetchInventory(providerId);
    if (err) setError(err); else setItems(fetched);
    setLoading(false);
  };
  useEffect(() => { load(); }, [providerId]);

  const adjust = async (item: InventoryRow, delta: number) => {
    const next = Math.max(0, item.quantity + delta);
    const { error: err } = await updateInventoryQuantity(item.id, next);
    if (err) setError(err);
    else setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, quantity: next } : x)));
  };

  const handleAdd = async () => {
    if (!newItem.name.trim()) return;
    setAdding(true);
    const { error: err } = await addInventoryItem(providerId, newItem.name.trim(), Number(newItem.quantity) || 0, Number(newItem.minimum) || 0, newItem.unit);
    setAdding(false);
    if (err) { setError(err); return; }
    setNewItem({ name: '', quantity: '', minimum: '', unit: 'units' });
    load();
  };

  return (
    <div className="nc-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Bohari' : 'Inventory'}</h3>
      </div>
      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
        <input value={newItem.name} onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))} placeholder={isSw ? 'Jina la kifaa' : 'Item name'} className="nc-input px-2.5 py-2 col-span-2 sm:col-span-1" />
        <input value={newItem.quantity} onChange={(e) => setNewItem((p) => ({ ...p, quantity: e.target.value }))} placeholder={isSw ? 'Kiasi' : 'Qty'} type="number" className="nc-input px-2.5 py-2" />
        <input value={newItem.minimum} onChange={(e) => setNewItem((p) => ({ ...p, minimum: e.target.value }))} placeholder={isSw ? 'Kiwango cha chini' : 'Minimum'} type="number" className="nc-input px-2.5 py-2" />
        <button type="button" onClick={handleAdd} disabled={adding || !newItem.name.trim()} className="rounded-lg bg-[#0A4275] dark:bg-cyan-500 text-white dark:text-[#041D34] px-2.5 py-2 font-bold disabled:opacity-50 flex items-center justify-center gap-1">
          <Plus className="w-3.5 h-3.5" /> {isSw ? 'Ongeza' : 'Add'}
        </button>
      </div>
      {!loading && items.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-2">{isSw ? 'Hakuna bidhaa bado.' : 'No inventory items yet.'}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                <p className={`truncate ${item.quantity <= item.minimum_quantity ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                  {item.quantity} {item.unit} {item.quantity <= item.minimum_quantity ? `• ${isSw ? 'Kiwango cha chini!' : 'Low stock!'}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button type="button" onClick={() => adjust(item, -1)} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold">−</button>
                <button type="button" onClick={() => adjust(item, 1)} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold">+</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const MessagesPanel: React.FC<{ isSw: boolean; providerId: string }> = ({ isSw, providerId }) => {
  const [messages, setMessages] = useState<FacilityMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { messages: fetched, error: err } = await fetchFacilityMessages(providerId);
    if (err) setError(err); else setMessages(fetched);
    setLoading(false);
  };
  useEffect(() => { load(); }, [providerId]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    const { error: err } = await postFacilityMessage(providerId, draft.trim());
    setSending(false);
    if (err) { setError(err); return; }
    setDraft('');
    load();
  };

  return (
    <div className="nc-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-purple-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Ujumbe wa Kituo' : 'Facility Messages'}</h3>
      </div>
      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
      <div className="flex gap-2 mb-3">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={isSw ? 'Andika ujumbe...' : 'Post an update to your team...'} className="nc-input flex-1 px-3 py-2 text-xs" />
        <button type="button" onClick={send} disabled={sending || !draft.trim()} className="rounded-lg bg-[#0A4275] dark:bg-cyan-500 text-white dark:text-[#041D34] px-3 py-2 text-xs font-bold disabled:opacity-50">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
      {!loading && messages.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-2">{isSw ? 'Hakuna ujumbe bado.' : 'No messages yet.'}</p>
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900 dark:text-white">{m.senderName}</span>
                <span className="text-slate-400">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">{m.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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
  const [checkInQuery, setCheckInQuery] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [section, setSection] = useState<'patients' | 'tasks' | 'inventory' | 'messages'>('patients');

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

  const checkIn = async (id: string) => {
    setCheckingInId(id);
    const { error: err } = await supabase.from('appointments').update({ status: 'in_queue' }).eq('id', id);
    if (err) setError(err.message);
    else {
      setTodayAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'in_queue' } : a)));
      setCounts((prev) => ({ ...prev, queued: prev.queued + 1 }));
    }
    setCheckingInId(null);
  };

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
        <div className="mb-4 flex gap-1.5 overflow-x-auto">
          {([
            { key: 'patients', label: isSw ? 'Wagonjwa' : 'Patients', Icon: Users },
            { key: 'tasks', label: isSw ? 'Majukumu' : 'Tasks', Icon: ClipboardList },
            { key: 'inventory', label: isSw ? 'Bohari' : 'Inventory', Icon: Package },
            { key: 'messages', label: isSw ? 'Ujumbe' : 'Messages', Icon: MessageSquare },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                section === key
                  ? 'bg-[#0A4275] text-white dark:bg-cyan-500 dark:text-[#041D34]'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      )}

      {staff && section === 'tasks' && <div className="mb-4"><TasksPanel isSw={isSw} providerId={staff.provider_id} /></div>}
      {staff && section === 'inventory' && <div className="mb-4"><InventoryPanel isSw={isSw} providerId={staff.provider_id} /></div>}
      {staff && section === 'messages' && <div className="mb-4"><MessagesPanel isSw={isSw} providerId={staff.provider_id} /></div>}

      {staff && section === 'patients' && (
        <div className="nc-card p-4 mb-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Wagonjwa wa Leo' : "Today's Patients"}</h3>
            </div>
            <div className="relative w-40 sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={checkInQuery}
                onChange={(e) => setCheckInQuery(e.target.value)}
                placeholder={isSw ? 'Tafuta mgonjwa...' : 'Search patient…'}
                className="nc-input w-full py-1.5 pl-8 pr-2 text-xs"
              />
            </div>
          </div>
          {todayAppointments.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
              {isSw ? 'Hakuna miadi leo.' : 'No appointments today.'}
            </p>
          ) : (
            <div className="space-y-2">
              {todayAppointments
                .filter((apt) => !checkInQuery.trim() || (apt.patient_name || '').toLowerCase().includes(checkInQuery.trim().toLowerCase()))
                .map((apt) => (
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`rounded-lg px-2 py-1 font-bold capitalize ${STATUS_STYLES[apt.status] || STATUS_STYLES.confirmed}`}>
                      {apt.status.replace('_', ' ')}
                    </span>
                    {apt.status === 'confirmed' && (
                      <button
                        type="button"
                        disabled={checkingInId === apt.id}
                        onClick={() => checkIn(apt.id)}
                        className="rounded-lg bg-[#0A4275] dark:bg-cyan-500 text-white dark:text-[#041D34] px-2 py-1 font-bold flex items-center gap-1 disabled:opacity-50"
                        title={isSw ? 'Ingiza Mgonjwa' : 'Check In'}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
