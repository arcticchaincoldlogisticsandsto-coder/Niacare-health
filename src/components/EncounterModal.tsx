import React, { useEffect, useState } from 'react';
import { X, Stethoscope, Activity, ClipboardList, Pill, CheckCircle2, Plus, Trash2, AlertCircle } from 'lucide-react';
import type { Language, Theme } from '../types';
import { startEncounter, saveVitals, saveDiagnosis, completeEncounter, VitalsInput } from '../lib/encounters';
import { insertPrescription } from '../lib/prescriptions';
import { logAuditEvent } from '../lib/audit';

interface EncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  theme: Theme;
  patientId: string;
  patientName: string;
  doctorProfileId: string;
  providerId: string | null;
  appointmentId: string | null;
  onCompleted?: () => void;
}

interface DraftPrescription {
  medicationName: string;
  dosageInstructions: string;
}

export const EncounterModal: React.FC<EncounterModalProps> = ({
  isOpen,
  onClose,
  language,
  theme,
  patientId,
  patientName,
  doctorProfileId,
  providerId,
  appointmentId,
  onCompleted,
}) => {
  const isDark = theme === 'dark';
  const isSw = language === 'sw';

  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const [chiefComplaint, setChiefComplaint] = useState('');
  const [vitals, setVitalsState] = useState<VitalsInput>({});
  const [vitalsSaved, setVitalsSaved] = useState(false);
  const [savingVitals, setSavingVitals] = useState(false);

  const [diagnosis, setDiagnosis] = useState('');
  const [diagnosisType, setDiagnosisType] = useState<'primary' | 'secondary' | 'differential'>('primary');
  const [diagnosisNotes, setDiagnosisNotes] = useState('');
  const [diagnosisSaved, setDiagnosisSaved] = useState(false);
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);

  const [draftMed, setDraftMed] = useState({ medicationName: '', dosageInstructions: '' });
  const [prescriptionsAdded, setPrescriptionsAdded] = useState<DraftPrescription[]>([]);
  const [savingPrescription, setSavingPrescription] = useState(false);

  const [clinicalNotes, setClinicalNotes] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen || encounterId || starting) return;
    setStarting(true);
    startEncounter(patientId, doctorProfileId, providerId, appointmentId, '').then(({ encounter, error: err }) => {
      if (err || !encounter) setError(err || 'Could not start the encounter.');
      else setEncounterId(encounter.id);
      setStarting(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const reset = () => {
    setEncounterId(null);
    setChiefComplaint('');
    setVitalsState({});
    setVitalsSaved(false);
    setDiagnosis('');
    setDiagnosisNotes('');
    setDiagnosisSaved(false);
    setDraftMed({ medicationName: '', dosageInstructions: '' });
    setPrescriptionsAdded([]);
    setClinicalNotes('');
    setFollowUpNote('');
    setCompleted(false);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSaveVitals = async () => {
    if (!encounterId) return;
    setSavingVitals(true);
    const { success, error: err } = await saveVitals(encounterId, vitals);
    setSavingVitals(false);
    if (success) setVitalsSaved(true);
    else setError(err || 'Could not save vitals.');
  };

  const handleSaveDiagnosis = async () => {
    if (!encounterId || !diagnosis.trim()) return;
    setSavingDiagnosis(true);
    const { success, error: err } = await saveDiagnosis(
      encounterId,
      patientId,
      doctorProfileId,
      diagnosis.trim(),
      diagnosisType,
      diagnosisNotes
    );
    setSavingDiagnosis(false);
    if (success) setDiagnosisSaved(true);
    else setError(err || 'Could not save the diagnosis.');
  };

  const handleAddPrescription = async () => {
    if (!draftMed.medicationName.trim()) return;
    setSavingPrescription(true);
    const { error: err } = await insertPrescription(
      patientId,
      encounterId,
      draftMed.medicationName.trim(),
      draftMed.dosageInstructions.trim(),
      patientName
    );
    setSavingPrescription(false);
    if (err) {
      setError(err);
      return;
    }
    setPrescriptionsAdded((prev) => [...prev, { ...draftMed }]);
    setDraftMed({ medicationName: '', dosageInstructions: '' });
  };

  const handleComplete = async () => {
    if (!encounterId) return;
    setCompleting(true);
    const { success, error: err } = await completeEncounter(encounterId, clinicalNotes, followUpNote);
    setCompleting(false);
    if (!success) {
      setError(err || 'Could not complete the encounter.');
      return;
    }
    await logAuditEvent('ENCOUNTER_COMPLETED', 'encounters', encounterId, patientId);
    setCompleted(true);
    onCompleted?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isDark ? 'bg-[#0B1728] border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${isDark ? 'bg-[#101F33] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">{isSw ? 'Mkutano wa Kliniki' : 'Clinical Encounter'}</h2>
              <p className="text-xs text-slate-400">{patientName}</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {starting && <p className="text-slate-400">{isSw ? 'Inaanzisha mkutano...' : 'Starting encounter…'}</p>}
          {error && (
            <p className="font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
            </p>
          )}

          {completed ? (
            <div className="py-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-bold text-sm">{isSw ? 'Mkutano Umekamilika' : 'Encounter completed'}</p>
              <button type="button" onClick={handleClose} className="mt-3 px-4 py-2 rounded-lg bg-[#0A4275] dark:bg-cyan-500 text-white dark:text-[#041D34] font-bold">
                {isSw ? 'Funga' : 'Done'}
              </button>
            </div>
          ) : (
            encounterId && (
              <>
                {/* Chief complaint */}
                <div className="space-y-1.5">
                  <label className="font-bold uppercase tracking-wide text-[10px] text-slate-400">
                    {isSw ? 'Malalamiko Makuu' : 'Chief Complaint'}
                  </label>
                  <textarea
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    rows={2}
                    className={`w-full p-2.5 rounded-xl border outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                    placeholder={isSw ? 'Mgonjwa analalamika...' : "Patient's presenting complaint..."}
                  />
                </div>

                {/* Vitals */}
                <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-2 font-bold">
                    <Activity className="w-4 h-4 text-rose-500" /> {isSw ? 'Vipimo vya Awali (Vitals)' : 'Vitals'}
                    {vitalsSaved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[
                      { key: 'systolicBp', label: 'Systolic BP' },
                      { key: 'diastolicBp', label: 'Diastolic BP' },
                      { key: 'heartRate', label: 'HR (bpm)' },
                      { key: 'temperatureC', label: 'Temp (°C)' },
                      { key: 'spo2', label: 'SpO2 (%)' },
                      { key: 'respiratoryRate', label: 'RR' },
                      { key: 'weightKg', label: 'Weight (kg)' },
                      { key: 'heightCm', label: 'Height (cm)' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-[10px] text-slate-400 mb-0.5">{label}</label>
                        <input
                          type="number"
                          value={(vitals as any)[key] ?? ''}
                          onChange={(e) =>
                            setVitalsState((prev) => ({ ...prev, [key]: e.target.value ? Number(e.target.value) : undefined }))
                          }
                          className={`w-full p-1.5 rounded-lg border text-xs outline-none ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveVitals}
                    disabled={savingVitals}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold disabled:opacity-60"
                  >
                    {savingVitals ? '...' : isSw ? 'Hifadhi Vipimo' : 'Save Vitals'}
                  </button>
                </div>

                {/* Diagnosis */}
                <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-2 font-bold">
                    <ClipboardList className="w-4 h-4 text-purple-500" /> {isSw ? 'Utambuzi' : 'Diagnosis'}
                    {diagnosisSaved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder={isSw ? 'mfano: Malaria' : 'e.g. Malaria'}
                      className={`flex-1 p-2 rounded-lg border outline-none ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                    />
                    <select
                      value={diagnosisType}
                      onChange={(e) => setDiagnosisType(e.target.value as typeof diagnosisType)}
                      className={`p-2 rounded-lg border outline-none font-bold ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                    >
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="differential">Differential</option>
                    </select>
                  </div>
                  <textarea
                    value={diagnosisNotes}
                    onChange={(e) => setDiagnosisNotes(e.target.value)}
                    rows={2}
                    placeholder={isSw ? 'Maelezo ya ziada...' : 'Notes...'}
                    className={`w-full p-2 rounded-lg border outline-none mb-2 ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                  />
                  <button
                    type="button"
                    onClick={handleSaveDiagnosis}
                    disabled={savingDiagnosis || !diagnosis.trim()}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-60"
                  >
                    {savingDiagnosis ? '...' : isSw ? 'Hifadhi Utambuzi' : 'Save Diagnosis'}
                  </button>
                </div>

                {/* Prescriptions */}
                <div className={`p-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-2 font-bold">
                    <Pill className="w-4 h-4 text-emerald-500" /> {isSw ? 'Dawa (Maagizo)' : 'Prescriptions'}
                  </div>
                  {prescriptionsAdded.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {prescriptionsAdded.map((p, i) => (
                        <div key={i} className={`p-2 rounded-lg border flex items-center justify-between ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <span className="font-bold">{p.medicationName}</span>
                          <span className="text-slate-400">{p.dosageInstructions}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={draftMed.medicationName}
                      onChange={(e) => setDraftMed((prev) => ({ ...prev, medicationName: e.target.value }))}
                      placeholder={isSw ? 'Jina la dawa' : 'Medication'}
                      className={`flex-1 p-2 rounded-lg border outline-none ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                    />
                    <input
                      value={draftMed.dosageInstructions}
                      onChange={(e) => setDraftMed((prev) => ({ ...prev, dosageInstructions: e.target.value }))}
                      placeholder={isSw ? 'Kipimo' : 'Dose & frequency'}
                      className={`flex-1 p-2 rounded-lg border outline-none ${isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                    />
                    <button
                      type="button"
                      onClick={handleAddPrescription}
                      disabled={savingPrescription || !draftMed.medicationName.trim()}
                      className="px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-60 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Clinical notes + follow-up */}
                <div className="space-y-1.5">
                  <label className="font-bold uppercase tracking-wide text-[10px] text-slate-400">
                    {isSw ? 'Maelezo ya Kliniki' : 'Clinical Notes'}
                  </label>
                  <textarea
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    rows={3}
                    className={`w-full p-2.5 rounded-xl border outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold uppercase tracking-wide text-[10px] text-slate-400">
                    {isSw ? 'Ufuatiliaji' : 'Follow-up'}
                  </label>
                  <textarea
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    rows={2}
                    className={`w-full p-2.5 rounded-xl border outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={completing}
                  className="w-full py-3 rounded-2xl bg-[#0A4275] dark:bg-cyan-500 text-white dark:text-[#041D34] font-black text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {completing ? (isSw ? 'Inakamilisha...' : 'Completing…') : isSw ? 'Kamilisha Mkutano' : 'Complete Encounter'}
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};
