import React, { useEffect, useState } from 'react';
import { X, FlaskConical, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { Theme } from '../types';
import { fetchPatientLabOrders, LabOrderRow, LabResultRow } from '../lib/laboratory';

interface LaboratoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  patientId: string | null;
}

const INTERPRETATION_STYLES: Record<string, string> = {
  normal: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  abnormal: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  critical: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-black',
};

export const LaboratoryModal: React.FC<LaboratoryModalProps> = ({ isOpen, onClose, theme, patientId }) => {
  const isDark = theme === 'dark';
  const [orders, setOrders] = useState<(LabOrderRow & { result?: LabResultRow })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !patientId) return;
    setLoading(true);
    fetchPatientLabOrders(patientId).then(({ orders: fetched, error: err }) => {
      if (err) setError(err); else setOrders(fetched);
      setLoading(false);
    });
  }, [isOpen, patientId]);

  if (!isOpen) return null;

  const pending = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  const completed = orders.filter((o) => o.status === 'completed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDark ? 'bg-[#0B1728] border-slate-700/80 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${isDark ? 'bg-[#101F33] border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <h2 className="text-base font-black tracking-tight">Laboratory</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && <p className="text-rose-600 font-semibold">{error}</p>}
          {!loading && orders.length === 0 && <p className="text-slate-500 dark:text-slate-400 py-6 text-center">No laboratory tests on file yet.</p>}

          {pending.length > 0 && (
            <div>
              <h3 className="font-bold uppercase tracking-wide text-[10px] text-slate-400 mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Pending</h3>
              <div className="space-y-2">
                {pending.map((o) => (
                  <div key={o.id} className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <p className="font-bold">{o.test_name}</p>
                    <p className="text-slate-500 dark:text-slate-400 capitalize">{o.status.replace('_', ' ')} • {new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h3 className="font-bold uppercase tracking-wide text-[10px] text-slate-400 mb-2 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</h3>
              <div className="space-y-2">
                {completed.map((o) => (
                  <div key={o.id} className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold">{o.test_name}</p>
                      {o.result && (
                        <span className={`rounded-md px-2 py-0.5 font-bold capitalize flex items-center gap-1 ${INTERPRETATION_STYLES[o.result.interpretation]}`}>
                          {o.result.interpretation === 'critical' && <AlertTriangle className="w-3 h-3" />}
                          {o.result.interpretation}
                        </span>
                      )}
                    </div>
                    {o.result && (
                      <div className="text-slate-600 dark:text-slate-300 space-y-0.5">
                        {o.result.result_value && <p>Result: <span className="font-mono font-bold">{o.result.result_value}</span> {o.result.reference_range && `(ref: ${o.result.reference_range})`}</p>}
                        {o.result.summary && <p className="text-slate-500 dark:text-slate-400">{o.result.summary}</p>}
                      </div>
                    )}
                    <p className="text-slate-400 mt-1">{new Date(o.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
