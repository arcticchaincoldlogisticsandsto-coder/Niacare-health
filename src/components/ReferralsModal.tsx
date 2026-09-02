import React, { useEffect, useState } from 'react';
import { Share2, X, MapPin } from 'lucide-react';
import { Language, Theme } from '../types';
import { fetchReferralsForPatient, Referral } from '../lib/referrals';
import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';

interface ReferralsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string | null;
  language: Language;
  theme: Theme;
}

const URGENCY_STYLES: Record<string, string> = {
  routine: 'bg-primary/5 text-[var(--nc-primary)] dark:bg-primary/10 dark:text-primary-light',
  urgent: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  emergency: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  scheduled: 'bg-primary/5 text-[var(--nc-primary)] dark:bg-primary/10 dark:text-primary-light',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};

export const ReferralsModal: React.FC<ReferralsModalProps> = ({ isOpen, onClose, patientId, language, theme }) => {
  const isSw = language === 'sw';
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    fetchReferralsForPatient(patientId).then(({ referrals: fetched, error: err }) => {
      if (err) setError(err); else { setReferrals(fetched); setError(''); }
      setLoading(false);
    });
  }, [isOpen, patientId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="nc-card w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 flex items-center justify-between bg-primary text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">{isSw ? 'Rufaa Zangu' : 'My Referrals'}</h3>
              <p className="text-xs text-white/80">{isSw ? 'Rufaa kwa wataalamu na vituo vingine' : 'Referrals to specialists and other facilities'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-2 text-xs">
          {loading && <LoadingSkeleton rows={3} />}
          {error && <p className="text-rose-600">{error}</p>}
          {!loading && referrals.length === 0 && (
            <EmptyState
              icon={Share2}
              title={isSw ? 'Hakuna Rufaa' : 'No Referrals'}
              description={isSw ? 'Rufaa zitaonekana hapa baada ya daktari kukurudisha.' : 'Referrals will appear here after a doctor refers you.'}
            />
          )}
          {referrals.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900 dark:text-white">{r.destinationSpecialty}</span>
                <span className={`rounded-lg px-2 py-0.5 font-bold capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
              </div>
              {r.destinationFacility && (
                <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                  <MapPin className="w-3 h-3" /> {r.destinationFacility}
                </p>
              )}
              <p className="text-slate-600 dark:text-slate-300 mb-2">{r.reason}</p>
              <div className="flex items-center justify-between">
                <span className={`rounded-lg px-2 py-0.5 font-bold capitalize ${URGENCY_STYLES[r.urgency]}`}>{r.urgency}</span>
                <span className="text-slate-400">{isSw ? 'Kutoka kwa' : 'From'} {r.referringDoctorName} • {new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
