import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Users, CalendarDays, CreditCard, LogOut, RefreshCw, ShieldCheck, MapPin, Video, Search, UserCheck, ClipboardList, Package, MessageSquare, Plus, Send, Stethoscope, Megaphone, UserX } from 'lucide-react';
import type { Language, Theme } from '../types';
import { supabase } from '../lib/supabaseClient';
import { Avatar } from './Avatar';
import {
  fetchTasks, createTask, updateTaskStatus, TaskRow,
  fetchInventory, updateInventoryQuantity, addInventoryItem, InventoryRow,
  fetchFacilityMessages, postFacilityMessage, FacilityMessageRow,
} from '../lib/providerOps';
import { ScheduleManager } from './ScheduleManager';
import { checkInAppointment, callPatient, markAppointmentNoShow } from '../lib/queue';
import { NotificationBell } from './NotificationBell';
import { fetchInsuranceBillsForProvider, submitClaim, updateClaimStatus, InsuranceBillRow, ClaimStatus } from '../lib/claims';
import { APPOINTMENT_STATUS_STYLES, appointmentStatusLabel, AppointmentStatus } from '../data/appointmentStatus';
import {
  fetchDepartments, createDepartment, updateDepartment, setDepartmentActive,
  fetchServices, createService, updateService, setServiceActive,
  assignDoctorDepartment, DepartmentRow, ServiceRow,
} from '../lib/facilityOps';

interface FacilityDoctor {
  id: string;
  name: string;
  specialty: string;
}

// Facilities control doctor availability, not just the doctor themselves —
// RLS on doctor_schedule already grants provider_staff at the same facility
// manage rights (see "Doctors and staff can manage own schedule" in
// supabase/schema.sql), this panel is just the missing UI for that.
const SchedulesPanel: React.FC<{ isSw: boolean; providerId: string }> = ({ isSw, providerId }) => {
  const [doctors, setDoctors] = useState<FacilityDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const { data, error: err } = await supabase
        .from('doctor_profiles')
        .select('id, user_id, specialty')
        .eq('provider_id', providerId)
        .eq('is_active', true);
      if (!active) return;
      if (err) { setError(err.message); setLoading(false); return; }

      const rows = data || [];
      const userIds = rows.map((r) => r.user_id);
      const namesByUserId = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        for (const p of profileRows || []) namesByUserId.set(p.id, p.full_name);
      }

      const list = rows.map((r) => ({ id: r.id, name: namesByUserId.get(r.user_id) || 'Doctor', specialty: r.specialty }));
      setDoctors(list);
      if (list.length > 0) setSelectedId((prev) => prev || list[0].id);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [providerId]);

  const selected = doctors.find((d) => d.id === selectedId);

  return (
    <div className="space-y-3">
      <div className="nc-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Chagua Daktari' : 'Select a Doctor'}</h3>
        </div>
        {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
        {!loading && doctors.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isSw ? 'Hakuna madaktari waliosajiliwa katika kituo hiki bado.' : 'No doctors registered at this facility yet.'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {doctors.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  selectedId === d.id
                    ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                    : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {d.name} <span className="opacity-70 font-medium">· {d.specialty}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && <ScheduleManager isSw={isSw} doctorProfileId={selected.id} doctorLabel={`${selected.name} — ${isSw ? 'Ratiba' : 'Schedule'}`} />}
    </div>
  );
};

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
    in_progress: 'bg-primary/5 text-[var(--nc-primary)] dark:bg-primary/10 dark:text-primary-light',
    completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  };

  return (
    <div className="nc-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Majukumu' : 'Tasks'}</h3>
      </div>
      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
      <div className="flex gap-2 mb-3">
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={isSw ? 'Ongeza jukumu jipya...' : 'Add a new task...'} className="nc-input flex-1 px-3 py-2 text-xs" />
        <button type="button" onClick={handleAdd} disabled={adding || !newTitle.trim()} className="rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-3 py-2 text-xs font-bold disabled:opacity-50 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      {!loading && tasks.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-2">{isSw ? 'Hakuna majukumu.' : 'No tasks yet.'}</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <button key={t.id} type="button" onClick={() => cycleStatus(t)} className="w-full flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs text-left hover:border-[var(--nc-primary)] dark:hover:border-primary transition-colors">
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
        <button type="button" onClick={handleAdd} disabled={adding || !newItem.name.trim()} className="rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-2.5 py-2 font-bold disabled:opacity-50 flex items-center justify-center gap-1">
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
        <MessageSquare className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Ujumbe wa Kituo' : 'Facility Messages'}</h3>
      </div>
      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
      <div className="flex gap-2 mb-3">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={isSw ? 'Andika ujumbe...' : 'Post an update to your team...'} className="nc-input flex-1 px-3 py-2 text-xs" />
        <button type="button" onClick={send} disabled={sending || !draft.trim()} className="rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-3 py-2 text-xs font-bold disabled:opacity-50">
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

const CLAIM_STATUS_STYLES: Record<ClaimStatus, string> = {
  submitted: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  under_review: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  approved: 'bg-primary/5 text-[var(--nc-primary)] dark:bg-primary/10 dark:text-primary-light',
  rejected: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
};

interface DeptDoctor {
  id: string;
  name: string;
  specialty: string;
  department_id: string | null;
}

// Facility-scoped department/service management — new this phase.
// facility_departments/facility_services RLS (see supabase/schema.sql)
// already restricts writes to admin or this facility's own active staff,
// so no extra client-side gating is needed beyond "this component only
// renders when `staff` exists" (already true — see the render call site).
const DepartmentsPanel: React.FC<{ isSw: boolean; providerId: string }> = ({ isSw, providerId }) => {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [doctors, setDoctors] = useState<DeptDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [deptForm, setDeptForm] = useState<{ id: string | null; name: string; description: string } | null>(null);
  const [savingDept, setSavingDept] = useState(false);
  const [svcForm, setSvcForm] = useState<{ id: string | null; name: string; description: string; departmentId: string } | null>(null);
  const [savingSvc, setSavingSvc] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    const [deptRes, svcRes, docRes] = await Promise.all([
      fetchDepartments(providerId),
      fetchServices(providerId),
      supabase.from('doctor_profiles').select('id, user_id, specialty, department_id').eq('provider_id', providerId).eq('is_active', true),
    ]);
    if (deptRes.error) { setError(deptRes.error); setLoading(false); return; }
    if (svcRes.error) { setError(svcRes.error); setLoading(false); return; }
    if (docRes.error) { setError(docRes.error.message); setLoading(false); return; }

    const rows = docRes.data || [];
    const userIds = rows.map((r) => r.user_id);
    const namesByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      for (const p of profileRows || []) namesByUserId.set(p.id, p.full_name);
    }
    setDoctors(rows.map((r) => ({ id: r.id, name: namesByUserId.get(r.user_id) || 'Doctor', specialty: r.specialty, department_id: r.department_id })));
    setDepartments(deptRes.departments);
    setServices(svcRes.services);
    setLoading(false);
  };
  useEffect(() => { load(); }, [providerId]);

  const doctorCountByDept = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of doctors) if (d.department_id) m.set(d.department_id, (m.get(d.department_id) || 0) + 1);
    return m;
  }, [doctors]);

  const saveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm || !deptForm.name.trim()) return;
    setSavingDept(true);
    const result = deptForm.id
      ? await updateDepartment(deptForm.id, providerId, deptForm.name, deptForm.description)
      : await createDepartment(providerId, deptForm.name, deptForm.description);
    setSavingDept(false);
    if (result.error) { setError(result.error); return; }
    setDeptForm(null);
    load();
  };

  const toggleDepartment = async (dept: DepartmentRow) => {
    setBusyId(dept.id);
    const { error: err } = await setDepartmentActive(dept.id, providerId, !dept.is_active);
    setBusyId(null);
    if (err) { setError(err); return; }
    setDepartments((prev) => prev.map((d) => (d.id === dept.id ? { ...d, is_active: !d.is_active } : d)));
  };

  const saveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!svcForm || !svcForm.name.trim()) return;
    setSavingSvc(true);
    const departmentId = svcForm.departmentId || null;
    const result = svcForm.id
      ? await updateService(svcForm.id, providerId, departmentId, svcForm.name, svcForm.description)
      : await createService(providerId, departmentId, svcForm.name, svcForm.description);
    setSavingSvc(false);
    if (result.error) { setError(result.error); return; }
    setSvcForm(null);
    load();
  };

  const toggleService = async (svc: ServiceRow) => {
    setBusyId(svc.id);
    const { error: err } = await setServiceActive(svc.id, providerId, !svc.is_active);
    setBusyId(null);
    if (err) { setError(err); return; }
    setServices((prev) => prev.map((s) => (s.id === svc.id ? { ...s, is_active: !s.is_active } : s)));
  };

  const changeDoctorDepartment = async (doctorId: string, departmentId: string) => {
    setBusyId(doctorId);
    const { error: err } = await assignDoctorDepartment(doctorId, departmentId || null);
    setBusyId(null);
    if (err) { setError(err); return; }
    setDoctors((prev) => prev.map((d) => (d.id === doctorId ? { ...d, department_id: departmentId || null } : d)));
  };

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-rose-600">{error}</p>}

      <div className="nc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Idara' : 'Departments'}</h3>
          <button
            type="button"
            onClick={() => setDeptForm({ id: null, name: '', description: '' })}
            className="flex items-center gap-1 rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-2.5 py-1.5 text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> {isSw ? 'Ongeza Idara' : 'Add Department'}
          </button>
        </div>

        {deptForm && (
          <form onSubmit={saveDepartment} className="mb-3 grid gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs">
            <label>
              <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Jina la Idara' : 'Department name'}</span>
              <input
                required
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="Cardiology"
                className="nc-input w-full px-3 py-2"
              />
            </label>
            <label>
              <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Maelezo (hiari)' : 'Description (optional)'}</span>
              <textarea
                value={deptForm.description}
                onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                rows={2}
                className="nc-input w-full px-3 py-2"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeptForm(null)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold text-slate-500 dark:text-slate-400">
                {isSw ? 'Ghairi' : 'Cancel'}
              </button>
              <button type="submit" disabled={savingDept} className="rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-3 py-2 font-bold disabled:opacity-50">
                {savingDept ? (isSw ? 'Inahifadhi...' : 'Saving…') : (isSw ? 'Hifadhi' : 'Save')}
              </button>
            </div>
          </form>
        )}

        {!loading && departments.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{isSw ? 'Hakuna idara zilizosanidiwa bado.' : 'No departments configured yet.'}</p>
        )}
        <div className="space-y-2">
          {departments.map((dept) => (
            <div key={dept.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white truncate">{dept.name}</p>
                <p className="text-slate-500 dark:text-slate-400">
                  {doctorCountByDept.get(dept.id) || 0} {isSw ? 'madaktari' : 'doctors'}
                  {dept.description ? ` • ${dept.description}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`rounded-md px-2 py-1 font-bold ${dept.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {dept.is_active ? (isSw ? 'Hai' : 'Active') : (isSw ? 'Imezimwa' : 'Inactive')}
                </span>
                <button type="button" onClick={() => setDeptForm({ id: dept.id, name: dept.name, description: dept.description || '' })} className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 font-bold text-slate-600 dark:text-slate-300">
                  {isSw ? 'Hariri' : 'Edit'}
                </button>
                <button
                  type="button"
                  disabled={busyId === dept.id}
                  onClick={() => toggleDepartment(dept)}
                  className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40"
                >
                  {dept.is_active ? (isSw ? 'Zima' : 'Deactivate') : (isSw ? 'Washa' : 'Activate')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="nc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Huduma' : 'Services'}</h3>
          <button
            type="button"
            onClick={() => setSvcForm({ id: null, name: '', description: '', departmentId: '' })}
            className="flex items-center gap-1 rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-2.5 py-1.5 text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> {isSw ? 'Ongeza Huduma' : 'Add Service'}
          </button>
        </div>

        {svcForm && (
          <form onSubmit={saveService} className="mb-3 grid gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs">
            <label>
              <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Jina la Huduma' : 'Service name'}</span>
              <input
                required
                value={svcForm.name}
                onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })}
                placeholder="Laboratory"
                className="nc-input w-full px-3 py-2"
              />
            </label>
            <label>
              <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Idara (hiari)' : 'Department (optional)'}</span>
              <select value={svcForm.departmentId} onChange={(e) => setSvcForm({ ...svcForm, departmentId: e.target.value })} className="nc-input w-full px-3 py-2">
                <option value="">{isSw ? 'Hakuna idara maalum' : 'No specific department'}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Maelezo (hiari)' : 'Description (optional)'}</span>
              <textarea
                value={svcForm.description}
                onChange={(e) => setSvcForm({ ...svcForm, description: e.target.value })}
                rows={2}
                className="nc-input w-full px-3 py-2"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSvcForm(null)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 font-bold text-slate-500 dark:text-slate-400">
                {isSw ? 'Ghairi' : 'Cancel'}
              </button>
              <button type="submit" disabled={savingSvc} className="rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-3 py-2 font-bold disabled:opacity-50">
                {savingSvc ? (isSw ? 'Inahifadhi...' : 'Saving…') : (isSw ? 'Hifadhi' : 'Save')}
              </button>
            </div>
          </form>
        )}

        {!loading && services.length === 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{isSw ? 'Hakuna huduma zilizosanidiwa bado.' : 'No services configured yet.'}</p>
        )}
        <div className="space-y-2">
          {services.map((svc) => (
            <div key={svc.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white truncate">{svc.name}</p>
                <p className="text-slate-500 dark:text-slate-400 truncate">
                  {departments.find((d) => d.id === svc.department_id)?.name || (isSw ? 'Bila idara maalum' : 'No specific department')}
                  {svc.description ? ` • ${svc.description}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`rounded-md px-2 py-1 font-bold ${svc.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                  {svc.is_active ? (isSw ? 'Hai' : 'Active') : (isSw ? 'Imezimwa' : 'Inactive')}
                </span>
                <button
                  type="button"
                  onClick={() => setSvcForm({ id: svc.id, name: svc.name, description: svc.description || '', departmentId: svc.department_id || '' })}
                  className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 font-bold text-slate-600 dark:text-slate-300"
                >
                  {isSw ? 'Hariri' : 'Edit'}
                </button>
                <button
                  type="button"
                  disabled={busyId === svc.id}
                  onClick={() => toggleService(svc)}
                  className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40"
                >
                  {svc.is_active ? (isSw ? 'Zima' : 'Deactivate') : (isSw ? 'Washa' : 'Activate')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {departments.length > 0 && doctors.length > 0 && (
        <div className="nc-card p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{isSw ? 'Wapangie Madaktari Idara' : 'Assign Doctors to Departments'}</h3>
          <div className="space-y-2">
            {doctors.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{doc.name}</p>
                  <p className="text-slate-500 dark:text-slate-400">{doc.specialty}</p>
                </div>
                <select
                  value={doc.department_id || ''}
                  disabled={busyId === doc.id}
                  onChange={(e) => changeDoctorDepartment(doc.id, e.target.value)}
                  aria-label={isSw ? `Idara ya ${doc.name}` : `Department for ${doc.name}`}
                  className="nc-input px-2.5 py-1.5 flex-shrink-0"
                >
                  <option value="">{isSw ? 'Hakuna Idara' : 'No department'}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Billing staff's insurance worklist: bills that came from a
// insurance_covered appointment at this facility, with a "Submit Claim"
// action for ones with no claim yet and a status-advance action for ones
// already submitted. See CLAIMS in supabase/schema.sql — RLS scopes both
// insert and update to staff at the bill's own facility.
const BillingPanel: React.FC<{ isSw: boolean; providerId: string }> = ({ isSw, providerId }) => {
  const [rows, setRows] = useState<InsuranceBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { rows: fetched, error: err } = await fetchInsuranceBillsForProvider(providerId);
    if (err) setError(err); else { setRows(fetched); setError(''); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [providerId]);

  const handleSubmit = async (row: InsuranceBillRow) => {
    setBusyId(row.billId);
    const { error: err } = await submitClaim(row.billId, row.patientId, row.insuranceProvider || (isSw ? 'Bima' : 'Insurance'), row.totalTzs);
    setBusyId(null);
    if (err) { setError(err); return; }
    load();
  };

  const advanceStatus = async (claimId: string, current: ClaimStatus) => {
    const next: Record<ClaimStatus, ClaimStatus> = {
      submitted: 'under_review',
      under_review: 'approved',
      approved: 'paid',
      paid: 'paid',
      rejected: 'rejected',
    };
    setBusyId(claimId);
    const { error: err } = await updateClaimStatus(claimId, next[current]);
    setBusyId(null);
    if (err) { setError(err); return; }
    load();
  };

  return (
    <div className="nc-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Madai ya Bima' : 'Insurance Claims'}</h3>
      </div>
      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}
      {!loading && rows.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
          {isSw ? 'Hakuna ankara za bima kwa sasa.' : 'No insurance-covered bills right now.'}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.billId} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white truncate">{row.patientName}</p>
                <p className="text-slate-500 dark:text-slate-400 truncate">
                  {row.invoiceNumber} • {row.insuranceProvider || (isSw ? 'Bima' : 'Insurance')} • TZS {row.totalTzs.toLocaleString()}
                </p>
              </div>
              {row.existingClaim ? (
                <button
                  type="button"
                  disabled={busyId === row.existingClaim.id || row.existingClaim.status === 'paid' || row.existingClaim.status === 'rejected'}
                  onClick={() => advanceStatus(row.existingClaim!.id, row.existingClaim!.status)}
                  className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 font-bold capitalize disabled:opacity-70 ${CLAIM_STATUS_STYLES[row.existingClaim.status]}`}
                  title={isSw ? 'Bofya kusonga mbele' : 'Click to advance status'}
                >
                  {row.existingClaim.status.replace('_', ' ')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyId === row.billId}
                  onClick={() => handleSubmit(row)}
                  className="flex-shrink-0 rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-2.5 py-1.5 font-bold disabled:opacity-50"
                >
                  {isSw ? 'Tuma Dai' : 'Submit Claim'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface ProviderDashboardProps {
  language: Language;
  theme: Theme;
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
  patient_phone: string | null;
  ticket_number: string;
  time_slot: string;
  status: AppointmentStatus;
  consultation_type: string;
  queue_number: string | null;
  arrival_confirmed_at: string | null;
}

const RECEPTION_FILTERS = ['all', 'upcoming', 'arrived', 'in_queue', 'in_consultation', 'completed', 'no_show'] as const;
type ReceptionFilter = (typeof RECEPTION_FILTERS)[number];

const FILTER_LABELS: Record<ReceptionFilter, { en: string; sw: string }> = {
  all: { en: 'All', sw: 'Zote' },
  upcoming: { en: 'Upcoming', sw: 'Zijazo' },
  arrived: { en: 'Arrived', sw: 'Wamefika' },
  in_queue: { en: 'Waiting', sw: 'Wanaosubiri' },
  in_consultation: { en: 'In Consultation', sw: 'Kwenye Ushauri' },
  completed: { en: 'Completed', sw: 'Zimekamilika' },
  no_show: { en: 'No Show', sw: 'Hawakufika' },
};

// 'upcoming' bundles confirmed + called since both mean "not yet in a
// terminal or in-progress state" from reception's point of view; 'called'
// still shows its own true status badge on the card, this only affects
// which tab groups it under.
const FILTER_MATCHES: Record<ReceptionFilter, (status: AppointmentStatus) => boolean> = {
  all: () => true,
  upcoming: (s) => s === 'confirmed' || s === 'called',
  arrived: (s) => s === 'arrived',
  in_queue: (s) => s === 'in_queue',
  in_consultation: (s) => s === 'in_consultation',
  completed: (s) => s === 'completed',
  no_show: (s) => s === 'no_show',
};

const todayIso = () => new Date().toISOString().slice(0, 10);
// No Supabase Realtime is configured anywhere in this project (checked —
// no publication, no .channel() usage). This is the same lightweight
// polling pattern already used for the patient's queue position
// (QueueStatusStrip in PatientHomeDashboard); the real fix is enabling
// Realtime on public.appointments, documented in the final report.
const RECEPTION_POLL_MS = 25000;

export const ProviderDashboard: React.FC<ProviderDashboardProps> = ({ language, theme, authUserId, onLogout }) => {
  const isSw = language === 'sw';
  const [staff, setStaff] = useState<StaffRecord | null>(null);
  const [provider, setProvider] = useState<ProviderRecord | null>(null);
  const [counts, setCounts] = useState({ appointmentsToday: 0, queued: 0, pendingBills: 0, activeStaff: 0, activeDepartments: 0 });
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkInQuery, setCheckInQuery] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [receptionFilter, setReceptionFilter] = useState<ReceptionFilter>('all');
  const [section, setSection] = useState<'patients' | 'schedules' | 'departments' | 'billing' | 'tasks' | 'inventory' | 'messages'>('patients');

  const load = async (silent = false) => {
    if (!authUserId) return;
    if (!silent) setLoading(true);
    setError('');

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
      const [providerRow, appointmentsToday, queued, pendingBills, activeStaff, activeDepartments, todayList] = await Promise.all([
        supabase.from('providers').select('name, region, type, address').eq('id', staffRow.provider_id).maybeSingle(),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('provider_id', staffRow.provider_id).eq('appointment_date', today),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('provider_id', staffRow.provider_id).eq('status', 'in_queue'),
        supabase.from('bills').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('provider_staff').select('*', { count: 'exact', head: true }).eq('provider_id', staffRow.provider_id).eq('is_active', true),
        supabase.from('facility_departments').select('*', { count: 'exact', head: true }).eq('provider_id', staffRow.provider_id).eq('is_active', true),
        supabase
          .from('appointments')
          .select('id, patient_name, patient_phone, ticket_number, time_slot, status, consultation_type, queue_number, arrival_confirmed_at')
          .eq('provider_id', staffRow.provider_id)
          .eq('appointment_date', today)
          .order('time_slot', { ascending: true }),
      ]);

      // facility_departments not existing live yet (pending migration) must
      // not break the rest of this dashboard — treated as "0 departments"
      // rather than a hard failure, unlike the other queries here.
      const failure = [providerRow, appointmentsToday, queued, pendingBills, activeStaff, todayList].find((r) => r.error)?.error;
      if (failure) setError(failure.message);
      else {
        setProvider((providerRow.data || null) as ProviderRecord | null);
        setCounts({
          appointmentsToday: appointmentsToday.count || 0,
          queued: queued.count || 0,
          pendingBills: pendingBills.count || 0,
          activeStaff: activeStaff.count || 0,
          activeDepartments: activeDepartments.error ? 0 : activeDepartments.count || 0,
        });
        setTodayAppointments((todayList.data || []) as TodayAppointment[]);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [authUserId]);

  // No Supabase Realtime configured (see RECEPTION_POLL_MS above) — a quiet
  // background refresh so reception sees a patient's self-check-in or a
  // status change from another staff member without a manual reload.
  useEffect(() => {
    if (!staff) return;
    const interval = setInterval(() => load(true), RECEPTION_POLL_MS);
    return () => clearInterval(interval);
  }, [staff, authUserId]);

  const checkIn = async (id: string) => {
    setCheckingInId(id);
    // Goes through check_in_appointment() rather than a raw status update
    // so the queue number is assigned atomically — see supabase/schema.sql.
    const { appointment, error: err } = await checkInAppointment(id);
    if (err) setError(err);
    else if (appointment) {
      setTodayAppointments((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: 'in_queue', queue_number: appointment.queueNumber || null, arrival_confirmed_at: appointment.arrivalConfirmedAt || null }
            : a
        )
      );
      setCounts((prev) => ({ ...prev, queued: prev.queued + 1 }));
    }
    setCheckingInId(null);
  };

  const callNext = async (id: string) => {
    setBusyId(id);
    const { appointment, error: err } = await callPatient(id);
    setBusyId(null);
    if (err) { setError(err); return; }
    if (appointment) {
      setTodayAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'called' } : a)));
    }
  };

  const noShow = async (id: string) => {
    if (!window.confirm(isSw ? 'Una uhakika mgonjwa huyu hakufika?' : 'Mark this patient as a no-show?')) return;
    setBusyId(id);
    const { appointment, error: err } = await markAppointmentNoShow(id);
    setBusyId(null);
    if (err) { setError(err); return; }
    if (appointment) {
      setTodayAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'no_show' } : a)));
    }
  };

  const statCards = useMemo(() => [
    { label: isSw ? 'Ziara za Leo' : "Today's Appointments", value: counts.appointmentsToday, Icon: CalendarDays, colour: 'text-primary dark:text-primary-light' },
    { label: isSw ? 'Wagonjwa Waliosubiri' : 'Queued Patients', value: counts.queued, Icon: Users, colour: 'text-emerald-600 dark:text-emerald-400' },
    { label: isSw ? 'Malipo Yaliyobaki' : 'Pending Bills', value: counts.pendingBills, Icon: CreditCard, colour: 'text-amber-600 dark:text-amber-400' },
    { label: isSw ? 'Wafanyakazi Hai' : 'Active Staff', value: counts.activeStaff, Icon: ShieldCheck, colour: 'text-rose-500' },
    { label: isSw ? 'Idara Hai' : 'Active Departments', value: counts.activeDepartments, Icon: Building2, colour: 'text-primary dark:text-primary-light' },
  ], [counts, isSw]);

  return (
    <div className="pt-2 pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{staff?.job_title || (isSw ? 'Mtumishi wa Kituo' : 'Facility Staff')}</p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {provider ? provider.name : isSw ? 'Jukwaa la Kituo' : 'Provider Dashboard'}
          </h2>
          {staff?.department && <p className="text-[11px] text-slate-500 dark:text-slate-400">{staff.department}</p>}
        </div>
        <div className="flex gap-2 items-center">
          <NotificationBell userId={authUserId} language={language} theme={theme} />
          <button type="button" onClick={() => load()} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Refresh">
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
            <p className="text-2xl font-semibold text-slate-900 dark:text-white">{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {staff && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto">
          {([
            { key: 'patients', label: isSw ? 'Wagonjwa' : 'Patients', Icon: Users },
            { key: 'schedules', label: isSw ? 'Ratiba za Madaktari' : 'Doctor Schedules', Icon: CalendarDays },
            { key: 'departments', label: isSw ? 'Idara na Huduma' : 'Departments & Services', Icon: Building2 },
            { key: 'billing', label: isSw ? 'Madai ya Bima' : 'Billing', Icon: CreditCard },
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
                  ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      )}

      {staff && section === 'schedules' && <div className="mb-4"><SchedulesPanel isSw={isSw} providerId={staff.provider_id} /></div>}
      {staff && section === 'departments' && <div className="mb-4"><DepartmentsPanel isSw={isSw} providerId={staff.provider_id} /></div>}
      {staff && section === 'billing' && <div className="mb-4"><BillingPanel isSw={isSw} providerId={staff.provider_id} /></div>}
      {staff && section === 'tasks' && <div className="mb-4"><TasksPanel isSw={isSw} providerId={staff.provider_id} /></div>}
      {staff && section === 'inventory' && <div className="mb-4"><InventoryPanel isSw={isSw} providerId={staff.provider_id} /></div>}
      {staff && section === 'messages' && <div className="mb-4"><MessagesPanel isSw={isSw} providerId={staff.provider_id} /></div>}

      {staff && section === 'patients' && (
        <div className="nc-card p-4 mb-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Wagonjwa wa Leo' : "Today's Patients"}</h3>
            </div>
            <div className="relative w-40 sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={checkInQuery}
                onChange={(e) => setCheckInQuery(e.target.value)}
                placeholder={isSw ? 'Jina, Namba ya Ziara, au simu...' : 'Name, Visit ID, or phone…'}
                className="nc-input w-full py-1.5 pl-8 pr-2 text-xs"
              />
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto mb-3 pb-1">
            {RECEPTION_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setReceptionFilter(f)}
                className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap ${
                  receptionFilter === f
                    ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                    : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {isSw ? FILTER_LABELS[f].sw : FILTER_LABELS[f].en}
              </button>
            ))}
          </div>

          {todayAppointments.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
              {isSw ? 'Hakuna miadi leo.' : 'No appointments today.'}
            </p>
          ) : (
            <div className="space-y-2">
              {todayAppointments
                .filter((apt) => FILTER_MATCHES[receptionFilter](apt.status))
                .filter((apt) => {
                  const q = checkInQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (apt.patient_name || '').toLowerCase().includes(q) ||
                    (apt.patient_phone || '').toLowerCase().includes(q) ||
                    apt.ticket_number.toLowerCase().includes(q)
                  );
                })
                .map((apt) => (
                <div key={apt.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={apt.patient_name || 'Patient'} size="md" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                          {apt.patient_name || 'Patient'}
                          {apt.consultation_type === 'telehealth' && <Video className="w-3 h-3 text-primary flex-shrink-0" />}
                          {apt.queue_number && (
                            <span className="font-mono text-[10px] text-primary dark:text-primary-light">{apt.queue_number}</span>
                          )}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 font-mono">
                          {apt.ticket_number} • {apt.time_slot}
                          {apt.arrival_confirmed_at && (
                            <span className="ml-1">
                              • {isSw ? 'Aliingia' : 'Checked in'} {new Date(apt.arrival_confirmed_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className={`flex-shrink-0 rounded-lg px-2 py-1 font-bold ${APPOINTMENT_STATUS_STYLES[apt.status] || APPOINTMENT_STATUS_STYLES.confirmed}`}>
                      {appointmentStatusLabel(apt.status, isSw)}
                    </span>
                  </div>
                  {(apt.status === 'confirmed' || apt.status === 'arrived' || apt.status === 'in_queue') && (
                    <div className="flex gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {(apt.status === 'confirmed' || apt.status === 'arrived') && (
                        <button
                          type="button"
                          disabled={checkingInId === apt.id}
                          onClick={() => checkIn(apt.id)}
                          className="flex-1 min-h-[32px] rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-2 py-1.5 font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> {isSw ? 'Thibitisha Kufika' : 'Confirm Arrival'}
                        </button>
                      )}
                      {apt.status === 'in_queue' && (
                        <button
                          type="button"
                          disabled={busyId === apt.id}
                          onClick={() => callNext(apt.id)}
                          className="flex-1 min-h-[32px] rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-2 py-1.5 font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Megaphone className="w-3.5 h-3.5" /> {isSw ? 'Mwite' : 'Call Patient'}
                        </button>
                      )}
                      {(apt.status === 'confirmed' || apt.status === 'arrived') && (
                        <button
                          type="button"
                          disabled={busyId === apt.id}
                          onClick={() => noShow(apt.id)}
                          className="rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 px-2 py-1.5 font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                          title={isSw ? 'Hakufika' : 'Mark No Show'}
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="nc-card p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-primary" />
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
