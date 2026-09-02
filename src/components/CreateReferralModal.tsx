import React, { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { createReferral, ReferralUrgency } from '../lib/referrals';

interface CreateReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

const SPECIALTIES = [
  'Cardiology', 'Dermatology', 'Ophthalmology', 'Orthopedics', 'Gynecology',
  'Pediatrics', 'Neurology', 'Oncology', 'Psychiatry', 'General Surgery',
];

export const CreateReferralModal: React.FC<CreateReferralModalProps> = ({ isOpen, onClose, patientId, patientName }) => {
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [destinationProviderId, setDestinationProviderId] = useState('');
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]);
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<ReferralUrgency>('routine');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    supabase.from('providers').select('id, name').order('name').then(({ data }) => setProviders(data || []));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');
    const { success, error: err } = await createReferral(
      patientId, destinationProviderId || null, specialty, reason.trim(), urgency
    );
    setSubmitting(false);
    if (!success) { setError(err || 'Something went wrong.'); return; }
    setDone(true);
  };

  const handleClose = () => {
    setReason('');
    setDone(false);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="nc-card w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 flex items-center justify-between bg-primary text-white">
          <div>
            <h3 className="text-sm font-bold">Refer {patientName}</h3>
            <p className="text-xs text-white/80">To a specialist or another facility</p>
          </div>
          <button type="button" onClick={handleClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {done ? (
            <div className="text-center py-6">
              <p className="font-bold text-slate-900 dark:text-white mb-1">Referral sent</p>
              <p className="text-slate-500 dark:text-slate-400 mb-4">{patientName} has been notified.</p>
              <button type="button" onClick={handleClose} className="rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-4 py-2 font-bold">
                Done
              </button>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">Specialty</span>
                <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="nc-input w-full px-3 py-2">
                  {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">Destination facility (optional)</span>
                <select value={destinationProviderId} onChange={(e) => setDestinationProviderId(e.target.value)} className="nc-input w-full px-3 py-2">
                  <option value="">Any / not specified</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-slate-500 dark:text-slate-400 mb-1">Reason</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Clinical reason for referral"
                  className="nc-input w-full px-3 py-2 resize-none"
                />
              </label>
              <div className="flex gap-1.5">
                {(['routine', 'urgent', 'emergency'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgency(u)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold capitalize ${
                      urgency === u
                        ? u === 'emergency'
                          ? 'bg-rose-500 text-white'
                          : u === 'urgent'
                          ? 'bg-amber-500 text-white'
                          : 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              {error && <p className="text-rose-600">{error}</p>}
              <button
                type="button"
                disabled={submitting || !reason.trim()}
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-3 py-2.5 font-bold disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" /> {submitting ? 'Sending…' : 'Send Referral'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
