import React, { useEffect, useState } from 'react';
import { ShieldCheck, X, Clock, Check, Ban, FileText, Pill, FlaskConical, Stethoscope, Eye } from 'lucide-react';
import { Language, Theme } from '../types';
import {
  fetchAccessRequestsForPatient,
  respondToAccessRequest,
  revokeAccessGrant,
  fetchPatientRecordAccessLog,
  AccessRequest,
  AccessScope,
  RecordAccessLogEntry,
} from '../lib/recordAccess';
import { LoadingSkeleton } from './LoadingSkeleton';

const ACCESS_ACTION_LABEL: Record<string, { en: string; sw: string }> = {
  CLINICAL_RECORD_ACCESSED: { en: 'Viewed your clinical record', sw: 'Aliangalia rekodi yako ya kliniki' },
  MEDICAL_RECORD_VIEWED: { en: 'Viewed a medical record', sw: 'Aliangalia rekodi ya matibabu' },
  IMAGING_ACCESSED: { en: 'Viewed an imaging report', sw: 'Aliangalia ripoti ya picha' },
  LAB_RESULT_VIEWED: { en: 'Viewed a lab result', sw: 'Aliangalia matokeo ya maabara' },
};

interface RecordAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUserId: string | null;
  language: Language;
  theme: Theme;
}

const SCOPE_META: Record<AccessScope, { en: string; sw: string; Icon: React.FC<{ className?: string }> }> = {
  medical_records: { en: 'Medical Records', sw: 'Rekodi za Matibabu', Icon: FileText },
  prescriptions: { en: 'Prescriptions', sw: 'Dawa', Icon: Pill },
  lab_results: { en: 'Lab Results', sw: 'Matokeo ya Maabara', Icon: FlaskConical },
  diagnoses: { en: 'Diagnoses', sw: 'Uchunguzi', Icon: Stethoscope },
};

export const RecordAccessModal: React.FC<RecordAccessModalProps> = ({ isOpen, onClose, authUserId, language, theme }) => {
  const isSw = language === 'sw';
  const isDark = theme === 'dark';
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [accessLog, setAccessLog] = useState<RecordAccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!authUserId) { setLoading(false); return; }
    setLoading(true);
    const [{ requests: fetched, error: err }, { entries: logEntries }] = await Promise.all([
      fetchAccessRequestsForPatient(authUserId),
      fetchPatientRecordAccessLog(),
    ]);
    if (err) setError(err); else { setRequests(fetched); setError(''); }
    setAccessLog(logEntries);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, authUserId]);

  if (!isOpen) return null;

  const pending = requests.filter((r) => r.status === 'pending');
  const others = requests.filter((r) => r.status !== 'pending');

  const respond = async (id: string, approve: boolean) => {
    setBusyId(id);
    const { error: err } = await respondToAccessRequest(id, approve, 7);
    setBusyId(null);
    if (err) setError(err); else load();
  };

  const revoke = async (id: string) => {
    setBusyId(id);
    const { error: err } = await revokeAccessGrant(id);
    setBusyId(null);
    if (err) setError(err); else load();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="nc-card w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 flex items-center justify-between bg-primary text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">{isSw ? 'Ufikiaji wa Rekodi Zangu' : 'Record Access'}</h3>
              <p className="text-xs text-white/80">
                {isSw ? 'Idhinisha au kataa maombi ya madaktari wapya' : 'Approve or decline requests from doctors outside your care team'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {error && <p className="text-rose-600">{error}</p>}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              {isSw ? 'Maombi Yanayosubiri' : 'Pending Requests'}
            </p>
            {loading && <LoadingSkeleton rows={2} />}
            {!loading && pending.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 py-2">
                {isSw ? 'Hakuna maombi yanayosubiri kwa sasa.' : 'No pending requests right now.'}
              </p>
            )}
            <div className="space-y-2">
              {pending.map((r) => (
                <div key={r.id} className={`p-3 rounded-xl border ${isDark ? 'border-slate-700 bg-[#0B1522]' : 'border-slate-200 bg-white'}`}>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {r.requesterName}
                    {r.requesterSpecialty && <span className="font-medium text-slate-500 dark:text-slate-400"> · {r.requesterSpecialty}</span>}
                  </p>
                  {r.requesterFacility && <p className="text-slate-500 dark:text-slate-400">{r.requesterFacility}</p>}
                  <p className="text-slate-600 dark:text-slate-300 mt-1.5">{r.reason}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.scopes.map((s) => {
                      const meta = SCOPE_META[s];
                      if (!meta) return null;
                      return (
                        <span key={s} className="flex items-center gap-1 rounded-lg bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light px-2 py-1 font-bold">
                          <meta.Icon className="w-3 h-3" /> {isSw ? meta.sw : meta.en}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => respond(r.id, true)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-3 py-2 font-bold disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> {isSw ? 'Ruhusu Siku 7' : 'Allow for 7 days'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => respond(r.id, false)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 px-3 py-2 font-bold disabled:opacity-50"
                    >
                      <Ban className="w-3.5 h-3.5" /> {isSw ? 'Kataa' : 'Decline'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              {isSw ? 'Historia ya Ufikiaji' : 'Access History'}
            </p>
            {!loading && others.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 py-2">{isSw ? 'Hakuna historia bado.' : 'No history yet.'}</p>
            )}
            <div className="space-y-2">
              {others.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{r.requesterName || (isSw ? 'Daktari' : 'Doctor')}</p>
                    <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {r.isActive && r.expiresAt
                        ? isSw
                          ? `Inaisha ${new Date(r.expiresAt).toLocaleDateString()}`
                          : `Expires ${new Date(r.expiresAt).toLocaleDateString()}`
                        : r.status}
                    </p>
                  </div>
                  {r.isActive ? (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => revoke(r.id)}
                      className="flex-shrink-0 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 px-2.5 py-1.5 font-bold disabled:opacity-50"
                    >
                      {isSw ? 'Batilisha' : 'Revoke'}
                    </button>
                  ) : (
                    <span className="flex-shrink-0 text-slate-400 capitalize">{r.status}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1">
              <Eye className="w-3 h-3" /> {isSw ? 'Nani Ameona Rekodi Zangu' : 'Record Access'}
            </p>
            {!loading && accessLog.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 py-2">
                {isSw ? 'Hakuna rekodi za ufikiaji bado.' : 'No record access events yet.'}
              </p>
            )}
            <div className="space-y-2">
              {accessLog.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{entry.actorName}</p>
                    <p className="text-slate-500 dark:text-slate-400 truncate">
                      {isSw ? ACCESS_ACTION_LABEL[entry.action]?.sw : ACCESS_ACTION_LABEL[entry.action]?.en || entry.action}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(entry.accessedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
