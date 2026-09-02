import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Users, Star, Video, Stethoscope, ClipboardPlus, Pill, FlaskConical, Plus, Activity, FileCheck2, ChevronRight, Megaphone } from 'lucide-react';
import type { Language, Theme } from '../types';
import { supabase } from '../lib/supabaseClient';
import { callPatient } from '../lib/queue';
import { updateDoctorProfile, DoctorProfileEditInput } from '../lib/admin';
import { EncounterModal } from './EncounterModal';
import { PatientDetailModal } from './PatientDetailModal';
import { HealthJourneyModal } from './HealthJourneyModal';
import { Avatar } from './Avatar';
import { createLabOrder, fetchDoctorLabOrders, LabOrderRow } from '../lib/laboratory';
import { DashboardShell, StatCard, StatCardGrid, SegmentedTabs } from './DashboardShell';
import { ScheduleManager } from './ScheduleManager';
import { fetchMyAccessRequests, requestRecordAccess, AccessRequest, AccessScope } from '../lib/recordAccess';
import { MessagesModal } from './MessagesModal';
import { CreateReferralModal } from './CreateReferralModal';
import { NotificationBell } from './NotificationBell';
import { APPOINTMENT_STATUS_STYLES, appointmentStatusLabel, AppointmentStatus } from '../data/appointmentStatus';

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

interface ActivityItem {
  id: string;
  type: 'prescription' | 'lab' | 'encounter';
  title: string;
  patientName: string;
  timestamp: string;
}

const ACTIVITY_ICON: Record<ActivityItem['type'], React.ComponentType<{ className?: string }>> = {
  prescription: Pill,
  lab: FlaskConical,
  encounter: FileCheck2,
};

const RecentActivityPanel: React.FC<{ isSw: boolean; items: ActivityItem[]; loading: boolean }> = ({ isSw, items, loading }) => (
  <div className="nc-card p-4">
    <div className="flex items-center gap-2 mb-3">
      <Activity className="w-4 h-4 text-primary" />
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
        {isSw ? 'Shughuli za Karibuni' : 'Recent Clinical Activity'}
      </h3>
    </div>
    {loading ? (
      <p className="text-xs text-slate-400 py-2">{isSw ? 'Inapakia…' : 'Loading…'}</p>
    ) : items.length === 0 ? (
      <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
        {isSw ? 'Hakuna shughuli za hivi karibuni.' : 'No recent activity yet — issued prescriptions, ordered labs, and completed visits will show up here.'}
      </p>
    ) : (
      <div className="space-y-3">
        {items.map((item) => {
          const Icon = ACTIVITY_ICON[item.type];
          return (
            <div key={`${item.type}-${item.id}`} className="flex items-start gap-2.5 text-xs">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary dark:text-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 dark:text-white truncate">{item.title}</p>
                <p className="text-slate-500 dark:text-slate-400 truncate">
                  {item.patientName} • {new Date(item.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const SCOPE_OPTIONS: { key: AccessScope; en: string; sw: string }[] = [
  { key: 'medical_records', en: 'Medical Records', sw: 'Rekodi za Matibabu' },
  { key: 'prescriptions', en: 'Prescriptions', sw: 'Dawa' },
  { key: 'lab_results', en: 'Lab Results', sw: 'Matokeo ya Maabara' },
  { key: 'diagnoses', en: 'Diagnoses', sw: 'Uchunguzi' },
];

// A doctor with no prior appointment/encounter relationship to a patient
// has no RLS path to that patient's records at all (correctly, per the RLS
// audit earlier this session) — this is the deliberate exception: request
// access using an identifier the patient shared directly (NIDA or phone),
// the patient approves or declines from their own session, never a search
// across the patient directory. See request_record_access() in
// supabase/schema.sql.
const RequestRecordAccessPanel: React.FC<{ isSw: boolean; doctorAuthUserId: string }> = ({ isSw, doctorAuthUserId }) => {
  const [expanded, setExpanded] = useState(false);
  const [identifierType, setIdentifierType] = useState<'nida' | 'phone'>('nida');
  const [identifierValue, setIdentifierValue] = useState('');
  const [reason, setReason] = useState('');
  const [scopes, setScopes] = useState<AccessScope[]>(['medical_records']);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const load = async () => {
    setLoadingRequests(true);
    const { requests } = await fetchMyAccessRequests(doctorAuthUserId);
    setMyRequests(requests);
    setLoadingRequests(false);
  };
  useEffect(() => { load(); }, [doctorAuthUserId]);

  const toggleScope = (key: AccessScope) => {
    setScopes((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  };

  const submit = async () => {
    if (!identifierValue.trim() || !reason.trim() || scopes.length === 0) return;
    setSubmitting(true);
    setFeedback(null);
    const { success, error } = await requestRecordAccess(identifierType, identifierValue.trim(), reason.trim(), scopes);
    setSubmitting(false);
    if (!success) {
      setFeedback({ ok: false, text: error || (isSw ? 'Imeshindwa.' : 'Something went wrong.') });
      return;
    }
    setFeedback({ ok: true, text: isSw ? 'Ombi limetumwa. Mgonjwa ataarifiwa.' : 'Request sent — the patient will be asked to approve it.' });
    setIdentifierValue('');
    setReason('');
    load();
  };

  const REQUEST_STATUS_STYLES: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    declined: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    revoked: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    expired: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };

  return (
    <div className="nc-card p-4">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isSw ? 'Omba Rekodi za Mgonjwa Mwingine' : 'Request Records From a Different Patient'}
          </h3>
        </div>
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
        {isSw
          ? 'Kwa mgonjwa asiye na miadi nawe (rufaa, maoni ya pili). Wanahitaji kukubali.'
          : 'For a patient with no appointment history with you (referral, second opinion). They must approve it.'}
      </p>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2.5">
            <div className="flex gap-1.5">
              {(['nida', 'phone'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setIdentifierType(t)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                    identifierType === t
                      ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {t === 'nida' ? (isSw ? 'NIDA' : 'NIDA') : isSw ? 'Namba ya Simu' : 'Phone'}
                </button>
              ))}
            </div>
            <input
              value={identifierValue}
              onChange={(e) => setIdentifierValue(e.target.value)}
              placeholder={identifierType === 'nida' ? (isSw ? 'Namba ya NIDA ya mgonjwa' : "Patient's NIDA number") : (isSw ? 'Namba ya simu ya mgonjwa' : "Patient's phone number")}
              className="nc-input w-full px-3 py-2 text-xs"
            />
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder={isSw ? 'Sababu ya kuomba (mf. rufaa kutoka Aga Khan)' : 'Reason for the request (e.g. referral from Aga Khan)'}
              className="nc-input w-full px-3 py-2 text-xs resize-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {SCOPE_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => toggleScope(o.key)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                    scopes.includes(o.key)
                      ? 'bg-primary/10 text-primary dark:text-primary-light border border-primary/30'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isSw ? o.sw : o.en}
                </button>
              ))}
            </div>
            {feedback && (
              <p className={`text-xs ${feedback.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>{feedback.text}</p>
            )}
            <button
              type="button"
              disabled={submitting || !identifierValue.trim() || !reason.trim() || scopes.length === 0}
              onClick={submit}
              className="w-full rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-3 py-2 text-xs font-bold disabled:opacity-50"
            >
              {submitting ? (isSw ? 'Inatuma...' : 'Sending…') : isSw ? 'Tuma Ombi' : 'Send Request'}
            </button>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{isSw ? 'Maombi Yangu' : 'My Requests'}</p>
            {!loadingRequests && myRequests.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">{isSw ? 'Hakuna maombi bado.' : 'No requests yet.'}</p>
            ) : (
              <div className="space-y-1.5">
                {myRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 px-2.5 py-1.5 text-xs">
                    <span className="text-slate-600 dark:text-slate-300 truncate flex-1">{r.reason}</span>
                    <span className={`ml-2 flex-shrink-0 rounded-lg px-2 py-0.5 font-bold capitalize ${REQUEST_STATUS_STYLES[r.status]}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
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
  bio: string | null;
  languages: string[];
  consultation_fee_tzs: number;
  telehealth_fee_tzs: number;
  home_visit_fee_tzs: number;
  experience_years: number | null;
}

interface AppointmentRow {
  id: string;
  patient_id: string;
  patient_name: string | null;
  appointment_date: string;
  time_slot: string;
  status: AppointmentStatus;
  consultation_type: string;
  reason: string | null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
// No Supabase Realtime configured — see the identical note in
// ProviderDashboard.tsx. Same lightweight polling substitute.
const DOCTOR_POLL_MS = 25000;

// A real gap found while reviewing doctor_profiles' RLS: it already has an
// "own profile" UPDATE policy (auth.uid() = user_id), but nothing in the
// app ever called it — sub_specialty/bio/languages/fees/experience_years
// could only ever be set once, at profile creation, with no way to edit
// them afterward. Collapsed by default so it doesn't compete with the
// schedule editor it sits above.
const DoctorMyProfilePanel: React.FC<{ isSw: boolean; profile: DoctorProfile; onSaved: (updated: DoctorProfile) => void }> = ({ isSw, profile, onSaved }) => {
  const [expanded, setExpanded] = useState(false);
  const [bio, setBio] = useState(profile.bio || '');
  const [subSpecialty, setSubSpecialty] = useState(profile.sub_specialty || '');
  const [languages, setLanguages] = useState((profile.languages || []).join(', '));
  const [consultationFee, setConsultationFee] = useState(String(profile.consultation_fee_tzs));
  const [telehealthFee, setTelehealthFee] = useState(String(profile.telehealth_fee_tzs));
  const [homeVisitFee, setHomeVisitFee] = useState(String(profile.home_visit_fee_tzs));
  const [experienceYears, setExperienceYears] = useState(profile.experience_years == null ? '' : String(profile.experience_years));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSavedMsg('');
    const payload: DoctorProfileEditInput = {
      bio: bio.trim() || null,
      sub_specialty: subSpecialty.trim() || null,
      languages: languages.split(',').map((l) => l.trim()).filter(Boolean),
      consultation_fee_tzs: Number(consultationFee) || 0,
      telehealth_fee_tzs: Number(telehealthFee) || 0,
      home_visit_fee_tzs: Number(homeVisitFee) || 0,
      experience_years: experienceYears === '' ? null : Number(experienceYears),
    };
    const { error: err } = await updateDoctorProfile(profile.id, payload);
    setSaving(false);
    if (err) { setError(err); return; }
    setSavedMsg(isSw ? 'Wasifu umehifadhiwa.' : 'Profile saved.');
    onSaved({ ...profile, ...payload });
  };

  return (
    <div className="nc-card p-4 mb-4">
      <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="flex items-center justify-between w-full text-left">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? 'Wasifu Wangu wa Kitaalamu' : 'My Professional Profile'}</h3>
        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <form onSubmit={save} className="grid gap-3 text-xs mt-3">
          {error && <p className="text-rose-600">{error}</p>}
          {savedMsg && <p className="text-emerald-600 dark:text-emerald-400">{savedMsg}</p>}
          <label>
            <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Utaalamu Mdogo' : 'Sub-specialty'}</span>
            <input value={subSpecialty} onChange={(e) => setSubSpecialty(e.target.value)} className="nc-input w-full px-3 py-2" />
          </label>
          <label>
            <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Wasifu' : 'Bio'}</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="nc-input w-full px-3 py-2" />
          </label>
          <label>
            <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Lugha (tenga kwa koma)' : 'Languages (comma-separated)'}</span>
            <input value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Swahili" className="nc-input w-full px-3 py-2" />
          </label>
          <label>
            <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Miaka ya Uzoefu' : 'Years of experience'}</span>
            <input type="number" min={0} value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} className="nc-input w-full px-3 py-2" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label>
              <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Ada (TZS)' : 'Consult fee'}</span>
              <input type="number" min={0} value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} className="nc-input w-full px-2 py-2" />
            </label>
            <label>
              <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Video' : 'Telehealth'}</span>
              <input type="number" min={0} value={telehealthFee} onChange={(e) => setTelehealthFee(e.target.value)} className="nc-input w-full px-2 py-2" />
            </label>
            <label>
              <span className="mb-1 block font-bold text-slate-500 dark:text-slate-400">{isSw ? 'Nyumbani' : 'Home visit'}</span>
              <input type="number" min={0} value={homeVisitFee} onChange={(e) => setHomeVisitFee(e.target.value)} className="nc-input w-full px-2 py-2" />
            </label>
          </div>
          <button type="submit" disabled={saving} className="justify-self-end rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-3 py-2 font-bold disabled:opacity-50">
            {saving ? (isSw ? 'Inahifadhi...' : 'Saving…') : (isSw ? 'Hifadhi' : 'Save')}
          </button>
        </form>
      )}
    </div>
  );
};

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ language, theme, authUserId, onLogout }) => {
  const isSw = language === 'sw';
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [doctorName, setDoctorName] = useState<string>('');
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrderRow[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [encounterTarget, setEncounterTarget] = useState<AppointmentRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<AppointmentRow | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [journeyPatient, setJourneyPatient] = useState<{ id: string; name: string } | null>(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [referralTarget, setReferralTarget] = useState<{ id: string; name: string } | null>(null);
  const [queueTab, setQueueTab] = useState<'waiting' | 'completed'>('waiting');
  const [section, setSection] = useState<'overview' | 'prescriptions' | 'labs' | 'calendar'>('overview');

  const loadActivityFeed = async (doctorProfileId: string) => {
    setActivityLoading(true);

    const [{ data: rx }, { data: encounters }] = await Promise.all([
      supabase
        .from('prescriptions')
        .select('id, patient_id, medication_name, created_at')
        .eq('created_by', authUserId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('encounters')
        .select('id, patient_id, chief_complaint, ended_at')
        .eq('doctor_profile_id', doctorProfileId)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(5),
    ]);

    const rxRows = rx || [];
    const encounterRows = encounters || [];
    const patientIds = Array.from(
      new Set([...rxRows.map((r) => r.patient_id), ...encounterRows.map((r) => r.patient_id)])
    );
    const names = new Map<string, string>();
    if (patientIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', patientIds);
      for (const p of profiles || []) names.set(p.id, p.full_name);
    }

    const items: ActivityItem[] = [
      ...rxRows.map((r) => ({
        id: r.id,
        type: 'prescription' as const,
        title: isSw ? `Dawa iliyoandikwa: ${r.medication_name}` : `Prescribed ${r.medication_name}`,
        patientName: names.get(r.patient_id) || 'Patient',
        timestamp: r.created_at,
      })),
      ...encounterRows
        .filter((e) => e.ended_at)
        .map((e) => ({
          id: e.id,
          type: 'encounter' as const,
          title: isSw ? `Mkutano ulikamilika: ${e.chief_complaint || 'Ziara'}` : `Completed visit: ${e.chief_complaint || 'Consultation'}`,
          patientName: names.get(e.patient_id) || 'Patient',
          timestamp: e.ended_at as string,
        })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setActivityFeed(items.slice(0, 6));
    setActivityLoading(false);
  };

  const load = async (silent = false) => {
    if (!authUserId) return;
    if (!silent) setLoading(true);
    setError('');
    const [{ data: doctorProfile, error: profileError }, { data: ownProfile }] = await Promise.all([
      supabase
        .from('doctor_profiles')
        .select('id, provider_id, specialty, sub_specialty, rating, reviews_count, is_verified, bio, languages, consultation_fee_tzs, telehealth_fee_tzs, home_visit_fee_tzs, experience_years')
        .eq('user_id', authUserId)
        .maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', authUserId).maybeSingle(),
    ]);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }
    setProfile(doctorProfile as DoctorProfile | null);
    setDoctorName(ownProfile?.full_name || '');

    if (doctorProfile) {
      const [{ data: appts, error: apptError }, { orders: fetchedLabOrders }] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, patient_id, patient_name, appointment_date, time_slot, status, consultation_type, reason')
          .eq('doctor_profile_id', doctorProfile.id)
          .order('appointment_date', { ascending: true })
          .order('time_slot', { ascending: true })
          .limit(200),
        fetchDoctorLabOrders(doctorProfile.id),
      ]);
      if (apptError) setError(apptError.message);
      else setAppointments((appts || []) as AppointmentRow[]);
      setLabOrders(fetchedLabOrders);
      loadActivityFeed(doctorProfile.id);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [authUserId]);

  // No Realtime configured — quiet background refresh so a reception
  // check-in/call shows up here without a manual reload.
  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(() => load(true), DOCTOR_POLL_MS);
    return () => clearInterval(interval);
  }, [profile, authUserId]);

  const today = todayIso();
  const todaysPatients = useMemo(() => appointments.filter((a) => a.appointment_date === today && a.status !== 'cancelled'), [appointments, today]);
  const inQueue = useMemo(() => appointments.filter((a) => a.status === 'in_queue'), [appointments]);
  const pendingLabs = useMemo(() => labOrders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled'), [labOrders]);
  const patientOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of appointments) if (!seen.has(a.patient_id)) seen.set(a.patient_id, a.patient_name || 'Patient');
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [appointments]);

  const handleCallPatient = async (id: string) => {
    setCallingId(id);
    const { appointment, error: err } = await callPatient(id);
    setCallingId(null);
    if (err) { setError(err); return; }
    if (appointment) setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'called' } : a)));
  };

  const displayName = doctorName ? (doctorName.trim().toLowerCase().startsWith('dr') ? doctorName : `Dr. ${doctorName}`) : '';

  const statCards = [
    { label: isSw ? 'Wagonjwa wa Leo' : "Today's Patients", value: todaysPatients.length, Icon: Users, colour: 'text-primary dark:text-primary-light' },
    { label: isSw ? 'Wanaosubiri' : 'In Queue', value: inQueue.length, Icon: Clock, colour: 'text-amber-600 dark:text-amber-400' },
    { label: isSw ? 'Vipimo Vinavyosubiri' : 'Pending Labs', value: pendingLabs.length, Icon: FlaskConical, colour: 'text-rose-600 dark:text-rose-400' },
    {
      label: isSw ? 'Ukadiriaji' : 'Rating',
      value: profile ? `${profile.rating.toFixed(1)}` : '—',
      sub: profile ? `${profile.reviews_count} ${isSw ? 'maoni' : 'reviews'}` : undefined,
      Icon: Star,
      colour: 'text-yellow-500',
    },
  ];

  return (
    <DashboardShell
      role="doctor"
      roleLabel={isSw ? 'Daktari' : 'Doctor Portal'}
      title={displayName || (profile ? profile.specialty : isSw ? 'Jukwaa la Daktari' : 'Doctor Dashboard')}
      subtitle={profile ? [profile.specialty, profile.sub_specialty].filter(Boolean).join(' • ') : undefined}
      language={language}
      theme={theme}
      onLogout={onLogout}
      onRefresh={() => load()}
      loading={loading}
      notificationBell={<NotificationBell userId={authUserId} language={language} theme={theme} />}
    >
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

      <StatCardGrid>
        {statCards.map(({ label, value, sub, Icon, colour }) => (
          <StatCard key={label} label={label} value={value} sub={sub} Icon={Icon} colorClass={colour} loading={loading} />
        ))}
      </StatCardGrid>

      <SegmentedTabs
        tabs={[
          { key: 'overview', label: isSw ? 'Muhtasari' : 'Overview', Icon: Stethoscope },
          { key: 'prescriptions', label: isSw ? 'Dawa' : 'Prescriptions', Icon: Pill },
          { key: 'labs', label: isSw ? 'Maabara' : 'Labs', Icon: FlaskConical },
          { key: 'calendar', label: isSw ? 'Ratiba' : 'Calendar', Icon: Calendar },
        ]}
        active={section}
        onChange={(key) => setSection(key as typeof section)}
      />

      <div className="mt-4">

      {section === 'prescriptions' && authUserId && (
        <DoctorPrescriptionsPanel isSw={isSw} doctorAuthUserId={authUserId} />
      )}

      {section === 'labs' && profile && (
        <DoctorLabsPanel isSw={isSw} doctorProfileId={profile.id} providerId={profile.provider_id} patientOptions={patientOptions} />
      )}

      {section === 'calendar' && profile && (
        <>
          <DoctorMyProfilePanel isSw={isSw} profile={profile} onSaved={(updated) => setProfile(updated)} />
          <ScheduleManager isSw={isSw} doctorProfileId={profile.id} />
        </>
      )}

      {section === 'overview' && (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
      <div className="nc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{isSw ? "Ratiba ya Leo" : "Today's Timeline"}</h3>
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
                  ? `${isSw ? 'Wanaosubiri' : 'Waiting'} (${todaysPatients.filter((a) => a.status !== 'completed' && a.status !== 'no_show').length})`
                  : `${isSw ? 'Wamemaliza' : 'Completed'} (${todaysPatients.filter((a) => a.status === 'completed').length})`}
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const list = todaysPatients.filter((a) =>
            queueTab === 'waiting' ? a.status !== 'completed' && a.status !== 'no_show' : a.status === 'completed'
          );
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
                    <span className={`rounded-lg px-2 py-1 font-bold ${APPOINTMENT_STATUS_STYLES[apt.status] || APPOINTMENT_STATUS_STYLES.confirmed}`}>
                      {appointmentStatusLabel(apt.status, isSw)}
                    </span>
                    {apt.status === 'in_queue' && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-busy={callingId === apt.id}
                        aria-label={isSw ? 'Mwite Mgonjwa' : 'Call Patient'}
                        onClick={(e) => { e.stopPropagation(); if (callingId !== apt.id) handleCallPatient(apt.id); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); if (callingId !== apt.id) handleCallPatient(apt.id); } }}
                        className={`rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 font-bold flex items-center gap-1 ${callingId === apt.id ? 'opacity-50' : ''}`}
                        title={isSw ? 'Mwite Mgonjwa' : 'Call Patient'}
                      >
                        <Megaphone className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {apt.status !== 'cancelled' && apt.status !== 'completed' && apt.status !== 'no_show' && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={isSw ? 'Anza Mkutano' : 'Start Encounter'}
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
      <RecentActivityPanel isSw={isSw} items={activityFeed} loading={activityLoading} />
      </div>
      {profile && authUserId && <div className="mt-4"><RequestRecordAccessPanel isSw={isSw} doctorAuthUserId={authUserId} /></div>}
      </>
      )}

      </div>

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
          onMessagePatient={(conversationId) => {
            setDetailTarget(null);
            setActiveConversationId(conversationId);
            setMessagesOpen(true);
          }}
          onReferPatient={() => {
            setReferralTarget({ id: detailTarget.patient_id, name: detailTarget.patient_name || 'Patient' });
            setDetailTarget(null);
          }}
          onViewHealthJourney={() => {
            setJourneyPatient({ id: detailTarget.patient_id, name: detailTarget.patient_name || 'Patient' });
            setDetailTarget(null);
          }}
        />
      )}

      {/* Reuses the exact same patient-facing Health Journey — RLS on
          encounters/referrals/lab_orders/medical_records already scopes
          what comes back to what this doctor is actually authorized to see
          (treating doctor of an encounter, facility staff, or an approved
          record_access_requests grant for medical_records/prescriptions/
          lab_results/diagnoses); passing the patient's id here can never
          return more than RLS already allows. No booking/lab-navigation
          props are passed — those only make sense from the patient's own
          session. */}
      <HealthJourneyModal
        isOpen={!!journeyPatient}
        onClose={() => setJourneyPatient(null)}
        patientId={journeyPatient?.id || null}
        language={language}
        theme={theme}
      />

      <MessagesModal
        isOpen={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        myUserId={authUserId}
        language={language}
        theme={theme}
        initialConversationId={activeConversationId}
      />

      {referralTarget && (
        <CreateReferralModal
          isOpen
          onClose={() => setReferralTarget(null)}
          patientId={referralTarget.id}
          patientName={referralTarget.name}
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
    </DashboardShell>
  );
};
