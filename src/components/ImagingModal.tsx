import React, { useEffect, useMemo, useState } from 'react';
import { X, Scan, ArrowLeft, Building2, User, Calendar, MapPin, FileText } from 'lucide-react';
import { Language, Theme } from '../types';
import { MedicalRecord } from '../data/medicalRecords';
import { fetchMedicalRecords } from '../lib/records';
import { bodyRegionLabel } from '../data/bodyRegions';
import { withTimeout } from '../lib/useNetworkStatus';
import { EmptyState } from './EmptyState';
import { LoadingSkeleton } from './LoadingSkeleton';

interface ImagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string | null;
  language: Language;
  theme: Theme;
  initialRecordId?: string | null;
}

type ImagingType = 'all' | 'X-Ray' | 'CT' | 'MRI' | 'Ultrasound' | 'Other';

// A studytype filter over the real record title text — not a fabricated
// backend category. medical_records.category = 'radiology' is the one real
// distinction the schema makes ("imaging" as a whole); X-Ray/CT/MRI/
// Ultrasound are inferred from what the title actually says, same as a
// search would, so a hospital that never orders MRIs simply never
// populates that filter with anything real.
const detectType = (title: string): Exclude<ImagingType, 'all'> => {
  const t = title.toLowerCase();
  if (t.includes('x-ray') || t.includes('xray')) return 'X-Ray';
  if (t.includes('ct')) return 'CT';
  if (t.includes('mri')) return 'MRI';
  if (t.includes('ultrasound') || t.includes('sonogram')) return 'Ultrasound';
  return 'Other';
};

const STATUS_STYLES: Record<string, string> = {
  verified: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  clear: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  normal: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};

export const ImagingModal: React.FC<ImagingModalProps> = ({ isOpen, onClose, patientId, language, theme, initialRecordId }) => {
  const isSw = language === 'sw';
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<ImagingType>('all');
  const [selected, setSelected] = useState<MedicalRecord | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    withTimeout(fetchMedicalRecords(patientId), 15000)
      .then(({ records: fetched, error: err }) => {
        if (err) setError(err); else { setRecords(fetched); setError(''); }
        setLoading(false);
      })
      .catch(() => {
        setError(isSw ? 'Imeshindwa kupakia. Angalia mtandao wako.' : 'Unable to load imaging. Check your connection.');
        setLoading(false);
      });
  }, [isOpen, patientId, retryToken]);

  useEffect(() => {
    if (!isOpen) { setSelected(null); setTypeFilter('all'); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || loading || !initialRecordId) return;
    const match = records.find((r) => r.id === initialRecordId);
    if (match) setSelected(match);
  }, [isOpen, loading, initialRecordId, records]);

  const imaging = useMemo(() => records.filter((r) => r.category === 'radiology'), [records]);
  const availableTypes = useMemo(() => [...new Set(imaging.map((r) => detectType(r.title)))], [imaging]);
  const filtered = useMemo(
    () => (typeFilter === 'all' ? imaging : imaging.filter((r) => detectType(r.title) === typeFilter)),
    [imaging, typeFilter]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="nc-card w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 flex items-center justify-between bg-primary text-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {selected ? (
              <button type="button" onClick={() => setSelected(null)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <Scan className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">{selected ? selected.title : (isSw ? 'Picha za Radiolojia' : 'Imaging')}</h3>
              {!selected && <p className="text-xs text-white/80">{isSw ? 'Ripoti za X-Ray, CT, MRI na zaidi' : 'X-Ray, CT, MRI, and more'}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto text-xs">
          {loading && <LoadingSkeleton rows={3} />}
          {error && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 dark:border-rose-900 p-2.5 mb-2">
              <p className="text-rose-600">{error}</p>
              <button type="button" onClick={() => setRetryToken((t) => t + 1)} className="font-bold text-primary dark:text-primary-light flex-shrink-0">
                {isSw ? 'Jaribu Tena' : 'Retry'}
              </button>
            </div>
          )}

          {!loading && !error && !selected && (
            <>
              {imaging.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto mb-3">
                  <button type="button" onClick={() => setTypeFilter('all')} className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 font-bold ${typeFilter === 'all' ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]' : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                    {isSw ? 'Zote' : 'All'}
                  </button>
                  {availableTypes.map((t) => (
                    <button key={t} type="button" onClick={() => setTypeFilter(t)} className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 font-bold whitespace-nowrap ${typeFilter === t ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]' : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {imaging.length === 0 ? (
                <EmptyState
                  icon={Scan}
                  title={isSw ? 'Hakuna Picha za Radiolojia' : 'No Imaging Yet'}
                  description={isSw ? 'Ripoti za picha zitaonekana hapa baada ya ziara yako.' : 'Your imaging reports will appear here after your healthcare visits.'}
                />
              ) : filtered.length === 0 ? (
                <EmptyState icon={Scan} title={isSw ? 'Hakuna Matokeo' : 'No Matches'} description={isSw ? 'Hakuna picha za aina hii.' : 'No imaging of this type yet.'} />
              ) : (
                <div className="space-y-2">
                  {filtered.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelected(r)}
                      className="w-full text-left rounded-xl border border-slate-100 dark:border-slate-800 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-bold text-slate-900 dark:text-white">{r.title}</p>
                        {r.status && <span className={`rounded-lg px-2 py-0.5 font-bold capitalize flex-shrink-0 ${STATUS_STYLES[r.status] || ''}`}>{r.status === 'pending' ? (isSw ? 'Inasubiri' : 'Pending') : (isSw ? 'Ripoti Ipo' : 'Report Available')}</span>}
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">{new Date(r.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      <p className="text-slate-400">{r.hospitalName}{r.doctorName ? ` • ${r.doctorName}` : ''}</p>
                      {r.bodyRegion && (
                        <span className="inline-block mt-1.5 text-[10px] font-bold rounded-md bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light px-1.5 py-0.5">
                          {bodyRegionLabel(r.bodyRegion, isSw)}{r.bodySide ? ` (${r.bodySide})` : ''}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && selected && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1"><Calendar className="w-3 h-3" /> {isSw ? 'Tarehe' : 'Date'}</p>
                  <p className="font-bold text-slate-900 dark:text-white">{new Date(selected.date).toLocaleDateString()}</p>
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1"><Building2 className="w-3 h-3" /> {isSw ? 'Kituo' : 'Facility'}</p>
                  <p className="font-bold text-slate-900 dark:text-white truncate">{selected.hospitalName}</p>
                </div>
                {selected.doctorName && (
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1"><User className="w-3 h-3" /> {isSw ? 'Daktari' : 'Doctor'}</p>
                    <p className="font-bold text-slate-900 dark:text-white truncate">{selected.doctorName}</p>
                  </div>
                )}
                {selected.bodyRegion && (
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1"><MapPin className="w-3 h-3" /> {isSw ? 'Eneo la Mwili' : 'Body Region'}</p>
                    <p className="font-bold text-slate-900 dark:text-white">{bodyRegionLabel(selected.bodyRegion, isSw)}{selected.bodySide ? ` (${selected.bodySide})` : ''}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mb-1.5 flex items-center gap-1"><FileText className="w-3 h-3" /> {isSw ? 'Ripoti' : 'Report'}</p>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed">
                  {(isSw ? selected.summary.sw : selected.summary.en) || (isSw ? 'Hakuna maelezo ya ziada.' : 'No further details recorded.')}
                </p>
                {selected.details?.radiologyFindings && (
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed mt-2">
                    {isSw ? selected.details.radiologyFindings.sw : selected.details.radiologyFindings.en}
                  </p>
                )}
                {selected.details?.recommendation && (
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed mt-2">
                    <span className="font-bold">{isSw ? 'Pendekezo: ' : 'Recommendation: '}</span>
                    {isSw ? selected.details.recommendation.sw : selected.details.recommendation.en}
                  </p>
                )}
              </div>

              <p className="text-slate-400 text-center">
                {isSw ? 'Hakuna faili la picha lililopakiwa kwa rekodi hii — ripoti iliyo hapo juu ndiyo taarifa halisi iliyopo.' : 'No image file is attached to this record — the report above is the real information on file.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
