import React, { useEffect, useState } from 'react';
import { X, ClipboardPlus, Activity, ClipboardList, FileText, Pill, MessageSquare, Share2, Route, Scan } from 'lucide-react';
import { startConversation } from '../lib/messaging';
import type { Theme } from '../types';
import { Avatar } from './Avatar';
import { fetchDoctorPatientHistory, EncounterSummary, DiagnosisSummary, LatestVitals } from '../lib/patientHistory';
import { fetchPrescriptions, Prescription } from '../lib/prescriptions';
import { fetchMedicalRecords } from '../lib/records';
import { MedicalRecord } from '../data/medicalRecords';
import { logAuditEvent } from '../lib/audit';

interface PatientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  patientId: string;
  patientName: string;
  reason: string | null;
  doctorProfileId: string;
  onStartEncounter: () => void;
  onMessagePatient?: (conversationId: string) => void;
  onReferPatient?: () => void;
  onViewHealthJourney?: () => void;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  isOpen, onClose, theme, patientId, patientName, reason, doctorProfileId, onStartEncounter, onMessagePatient, onReferPatient, onViewHealthJourney,
}) => {
  const isDark = theme === 'dark';
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisSummary[]>([]);
  const [vitals, setVitals] = useState<LatestVitals | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [messaging, setMessaging] = useState(false);
  const [messageError, setMessageError] = useState('');

  const handleMessage = async () => {
    if (!onMessagePatient) return;
    setMessaging(true);
    setMessageError('');
    const { conversationId, error } = await startConversation(patientId);
    setMessaging(false);
    if (error || !conversationId) { setMessageError(error || 'Could not start conversation.'); return; }
    onMessagePatient(conversationId);
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([
      fetchDoctorPatientHistory(patientId, doctorProfileId),
      fetchPrescriptions(patientId),
      fetchMedicalRecords(patientId),
    ]).then(([history, presc, recs]) => {
      setEncounters(history.encounters);
      setDiagnoses(history.diagnoses);
      setVitals(history.latestVitals);
      setPrescriptions(presc.prescriptions);
      setRecords(recs.records);
      setLoading(false);
    });
    // A real "someone accessed this patient's clinical record" event — the
    // one the patient-facing Record Access history (RecordAccessModal)
    // reads back via fetch_patient_record_access_log().
    logAuditEvent('CLINICAL_RECORD_ACCESSED', 'patients', patientId, patientId, { doctor_profile_id: doctorProfileId });
  }, [isOpen, patientId, doctorProfileId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${isDark ? 'bg-[#0B1728] border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${isDark ? 'bg-[#101F33] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <Avatar name={patientName} size="lg" />
            <div>
              <h2 className="text-base font-semibold tracking-tight">{patientName}</h2>
              {reason && <p className="text-xs text-slate-400">{reason}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {loading && <p className="text-slate-400">Loading patient history…</p>}

          {!loading && (encounters.length > 0 || prescriptions.length > 0 || records.length > 0) && (() => {
            const recentVisit = encounters[0];
            const recentImaging = records.find((r) => r.category === 'radiology');
            const activePrescriptionCount = prescriptions.filter((p) => p.daysRemaining === null || p.daysRemaining > 0).length;
            return (
              <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-2 font-bold"><Route className="w-4 h-4 text-primary" /> Patient Overview</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {recentVisit && (
                    <div>
                      <p className="text-[10px] text-slate-400">Recent visit</p>
                      <p className="font-bold truncate">{recentVisit.chief_complaint || 'Consultation'}</p>
                      <p className="text-[10px] text-slate-400">{new Date(recentVisit.started_at).toLocaleDateString()}</p>
                    </div>
                  )}
                  {activePrescriptionCount > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-400">Active prescriptions</p>
                      <p className="font-bold">{activePrescriptionCount}</p>
                    </div>
                  )}
                  {recentImaging && (
                    <div>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1"><Scan className="w-3 h-3" /> Recent imaging</p>
                      <p className="font-bold truncate">{recentImaging.title}</p>
                      <p className="text-[10px] text-slate-400">{recentImaging.date}</p>
                    </div>
                  )}
                </div>
                {onViewHealthJourney && (
                  <button
                    type="button"
                    onClick={onViewHealthJourney}
                    className="mt-2.5 w-full rounded-xl bg-primary/10 text-primary dark:text-primary-light px-3 py-2 font-bold flex items-center justify-center gap-1.5"
                  >
                    <Route className="w-3.5 h-3.5" /> View Full Health Journey
                  </button>
                )}
              </div>
            );
          })()}

          {vitals && (
            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-2 font-bold"><Activity className="w-4 h-4 text-rose-500" /> Latest Vitals</div>
              <div className="grid grid-cols-3 gap-2">
                <div><p className="text-[10px] text-slate-400">BP</p><p className="font-bold">{vitals.systolic_bp ?? '—'}/{vitals.diastolic_bp ?? '—'}</p></div>
                <div><p className="text-[10px] text-slate-400">HR</p><p className="font-bold">{vitals.heart_rate ?? '—'} bpm</p></div>
                <div><p className="text-[10px] text-slate-400">Temp</p><p className="font-bold">{vitals.temperature_c ?? '—'}°C</p></div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{new Date(vitals.recorded_at).toLocaleString()}</p>
            </div>
          )}

          <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-2 font-bold"><ClipboardList className="w-4 h-4 text-primary" /> Recent Diagnoses (with you)</div>
            {diagnoses.length === 0 ? <p className="text-slate-400">No prior diagnoses recorded with you.</p> : (
              <div className="space-y-1.5">
                {diagnoses.map((d) => (
                  <div key={d.id} className="flex items-center justify-between">
                    <span className="font-bold">{d.diagnosis}</span>
                    <span className="text-slate-400 capitalize">{d.diagnosis_type} • {new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-2 font-bold"><Pill className="w-4 h-4 text-emerald-500" /> Current Prescriptions</div>
            {prescriptions.length === 0 ? <p className="text-slate-400">No prescriptions on file.</p> : (
              <div className="space-y-1.5">
                {prescriptions.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="font-bold">{p.medicationName}</span>
                    <span className="text-slate-400">{p.dosageInstructions}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-2 font-bold"><FileText className="w-4 h-4 text-primary" /> Medical Records</div>
            {records.length === 0 ? <p className="text-slate-400">No medical records on file.</p> : (
              <div className="space-y-1.5">
                {records.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span className="font-bold truncate">{r.title}</span>
                    <span className="text-slate-400">{r.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {encounters.length > 0 && (
            <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="mb-2 font-bold">Past Encounters</div>
              <div className="space-y-1.5">
                {encounters.map((e) => (
                  <div key={e.id} className="flex items-center justify-between">
                    <span>{e.chief_complaint || '—'}</span>
                    <span className="text-slate-400 capitalize">{e.status} • {new Date(e.started_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messageError && <p className="text-rose-500 text-[11px]">{messageError}</p>}
          <div className="flex gap-2">
            {onMessagePatient && (
              <button
                type="button"
                onClick={handleMessage}
                disabled={messaging}
                className={`flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 border disabled:opacity-50 ${isDark ? 'border-slate-700 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-900 hover:bg-slate-50'}`}
              >
                <MessageSquare className="w-4 h-4" /> {messaging ? 'Opening…' : 'Message'}
              </button>
            )}
            {onReferPatient && (
              <button
                type="button"
                onClick={onReferPatient}
                className={`flex-1 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 border ${isDark ? 'border-slate-700 text-white hover:bg-slate-800' : 'border-slate-200 text-slate-900 hover:bg-slate-50'}`}
              >
                <Share2 className="w-4 h-4" /> Refer
              </button>
            )}
            <button
              type="button"
              onClick={onStartEncounter}
              className="flex-[2] py-3 rounded-2xl bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] font-semibold text-sm flex items-center justify-center gap-2"
            >
              <ClipboardPlus className="w-4 h-4" /> Start Encounter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
