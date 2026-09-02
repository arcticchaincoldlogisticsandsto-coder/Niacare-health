import React, { useEffect, useMemo, useState } from 'react';
import { X, Route, Stethoscope, Share2, Scan, User, Search, FlaskConical, CalendarPlus, Activity } from 'lucide-react';
import { Language, Theme } from '../types';
import { Appointment } from '../data/doctors';
import { fetchHealthJourney, HealthJourneyEntry } from '../lib/healthJourney';
import { fetchPrescriptions } from '../lib/prescriptions';
import { DoctorProfileTarget } from '../data/doctors';
import { bodyRegionLabel } from '../data/bodyRegions';
import { withTimeout } from '../lib/useNetworkStatus';
import { logAuditEvent } from '../lib/audit';
import { LoadingSkeleton } from './LoadingSkeleton';

interface HealthJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string | null;
  language: Language;
  theme: Theme;
  onViewReport?: (recordId: string) => void;
  onViewDoctorProfile?: (target: DoctorProfileTarget) => void;
  onViewLabResults?: () => void;
  onBookFollowUp?: (entry: HealthJourneyEntry) => void;
  /** Already fetched by PatientHomeDashboard — reused for "Upcoming Appointment" in the Health Summary, no extra query. */
  appointmentsList?: Appointment[];
  onViewFacility?: (providerId: string) => void;
}

type JourneyFilter = 'all' | 'consultations' | 'lab' | 'imaging' | 'referrals' | 'followups';

const FILTERS: { key: JourneyFilter; en: string; sw: string }[] = [
  { key: 'all', en: 'All', sw: 'Zote' },
  { key: 'consultations', en: 'Consultations', sw: 'Ushauri' },
  { key: 'lab', en: 'Laboratory', sw: 'Maabara' },
  { key: 'imaging', en: 'Imaging', sw: 'Picha' },
  { key: 'referrals', en: 'Referrals', sw: 'Rufaa' },
  { key: 'followups', en: 'Follow-ups', sw: 'Ufuatiliaji' },
];

const matchesFilter = (entry: HealthJourneyEntry, filter: JourneyFilter): boolean => {
  switch (filter) {
    case 'all': return true;
    case 'consultations': return entry.type === 'encounter';
    case 'lab': return entry.type === 'lab';
    case 'imaging': return entry.type === 'imaging';
    case 'referrals': return entry.type === 'referral';
    case 'followups': return !!entry.followUpNote;
    default: return true;
  }
};

const ENTRY_DOT: Record<HealthJourneyEntry['type'], string> = {
  referral: 'bg-amber-400 border-amber-200 dark:border-amber-900',
  imaging: 'bg-teal-400 border-teal-200 dark:border-teal-900',
  lab: 'bg-violet-400 border-violet-200 dark:border-violet-900',
  encounter: 'bg-primary border-primary/20 dark:border-primary/30',
};

export const HealthJourneyModal: React.FC<HealthJourneyModalProps> = ({
  isOpen, onClose, patientId, language, theme, onViewReport, onViewDoctorProfile, onViewLabResults, onBookFollowUp, appointmentsList, onViewFacility,
}) => {
  const isSw = language === 'sw';
  const isDark = theme === 'dark';
  const [entries, setEntries] = useState<HealthJourneyEntry[]>([]);
  const [activePrescriptions, setActivePrescriptions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    withTimeout(fetchHealthJourney(patientId), 15000)
      .then(({ entries: fetched, error: err }) => {
        if (err) setError(err); else { setEntries(fetched); setError(''); }
        setLoading(false);
      })
      .catch(() => {
        setError(isSw ? 'Imeshindwa kupakia. Angalia mtandao wako.' : 'Unable to load your health journey. Check your connection.');
        setLoading(false);
      });
    // Reuses the same fetchPrescriptions() the Prescriptions tab already
    // uses — only for a count here, best-effort (a failure just leaves the
    // summary's prescriptions line out rather than blocking the Journey).
    fetchPrescriptions(patientId)
      .then(({ prescriptions }) => {
        setActivePrescriptions(prescriptions.filter((p) => p.daysRemaining === null || p.daysRemaining > 0).length);
      })
      .catch(() => undefined);
  }, [isOpen, patientId, retryToken]);

  useEffect(() => {
    if (!isOpen) { setFilter('all'); setSearch(''); }
  }, [isOpen]);

  // Client-side over the already-fetched entries — no extra query. Search
  // matches facility/doctor/specialty/title/date text, the fields the spec
  // asks for; "diagnosis where authorized" is already folded into
  // consultation subItems and matches there too.
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => matchesFilter(e, filter))
      .filter((e) => {
        if (!q) return true;
        const haystack = [e.title, e.facilityName, e.doctorName, e.specialty, ...e.subItems, e.date].join(' ').toLowerCase();
        return haystack.includes(q);
      });
  }, [entries, filter, search]);

  const summary = useMemo(() => {
    const latestOf = (type: HealthJourneyEntry['type']) =>
      entries.filter((e) => e.type === type).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const todayIso = new Date().toISOString().slice(0, 10);
    const upcoming = (appointmentsList || [])
      .filter((a) => a.status !== 'cancelled' && a.status !== 'completed' && a.status !== 'no_show' && a.date >= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return {
      lastConsultation: latestOf('encounter'),
      lastImaging: latestOf('imaging'),
      lastLab: latestOf('lab'),
      upcomingAppointment: upcoming,
      activePrescriptions,
      followUps: entries.filter((e) => e.followUpNote).length,
    };
  }, [entries, appointmentsList, activePrescriptions]);

  const specialists = useMemo(() => {
    const bySpecialty = new Map<string, HealthJourneyEntry>();
    for (const e of entries) {
      if (e.type !== 'encounter' || !e.specialty) continue;
      const key = `${e.specialty}|${e.doctorName}`;
      const existing = bySpecialty.get(key);
      if (!existing || new Date(e.date) > new Date(existing.date)) bySpecialty.set(key, e);
    }
    return [...bySpecialty.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries]);

  // Real visit counts only — imaging entries have no facilityId (medical_records
  // has no provider FK, only free-text hospital_name), so they're excluded
  // here rather than counted against a guessed facility.
  const facilities = useMemo(() => {
    const byFacility = new Map<string, { facilityId: string; name: string; count: number; lastDate: string }>();
    for (const e of entries) {
      if (!e.facilityId || !e.facilityName) continue;
      const existing = byFacility.get(e.facilityId);
      if (existing) {
        existing.count += 1;
        if (new Date(e.date) > new Date(existing.lastDate)) existing.lastDate = e.date;
      } else {
        byFacility.set(e.facilityId, { facilityId: e.facilityId, name: e.facilityName, count: 1, lastDate: e.date });
      }
    }
    return [...byFacility.values()].sort((a, b) => b.count - a.count);
  }, [entries]);

  const hasAnySummary =
    summary.lastConsultation || summary.lastImaging || summary.lastLab ||
    summary.upcomingAppointment || summary.activePrescriptions > 0 || summary.followUps > 0;

  if (!isOpen) return null;

  const logViewed = (action: string, entry: HealthJourneyEntry) => {
    if (patientId) logAuditEvent(action, entry.type === 'lab' ? 'lab_orders' : entry.type === 'imaging' ? 'medical_records' : 'encounters', entry.id.replace(/^(encounter|referral|imaging|lab)-/, ''), patientId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="nc-card w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 flex items-center justify-between bg-primary text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">{isSw ? 'Safari Yangu ya Afya' : 'Health Journey'}</h3>
              <p className="text-xs text-white/80">{isSw ? 'Historia yako ya matibabu kwa mpangilio' : 'Your care history, in order'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={isSw ? 'Funga' : 'Close'} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto text-xs">
          {loading && <LoadingSkeleton rows={3} />}
          {error && (
            <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 dark:border-rose-900 p-2.5 mb-2">
              <p className="text-rose-600">{error}</p>
              <button type="button" onClick={() => setRetryToken((t) => t + 1)} className="font-bold text-primary dark:text-primary-light flex-shrink-0">
                {isSw ? 'Jaribu Tena' : 'Retry'}
              </button>
            </div>
          )}
          {!loading && entries.length === 0 && !error && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              {isSw
                ? 'Safari yako ya afya itaonekana hapa baada ya ziara yako ya kwanza.'
                : 'Your health journey will appear here after your first visit.'}
            </p>
          )}

          {!loading && entries.length > 0 && (
            <>
              {hasAnySummary && (
                <div className={`rounded-xl border p-3 mb-3 ${isDark ? 'border-slate-800 bg-[#0B1522]' : 'border-slate-100 bg-slate-50'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> {isSw ? 'Muhtasari wa Afya' : 'Health Summary'}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {summary.lastConsultation && (
                      <div>
                        <span className="text-slate-400 block">{isSw ? 'Ushauri wa Mwisho' : 'Last Consultation'}</span>
                        <span className="font-bold text-slate-900 dark:text-white block truncate">{summary.lastConsultation.specialty || summary.lastConsultation.title}</span>
                        <span className="text-slate-400">{new Date(summary.lastConsultation.date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {summary.upcomingAppointment && (
                      <div>
                        <span className="text-slate-400 block">{isSw ? 'Miadi Ijayo' : 'Upcoming Appointment'}</span>
                        <span className="font-bold text-slate-900 dark:text-white block truncate">{summary.upcomingAppointment.doctorSpecialty}</span>
                        <span className="text-slate-400">{summary.upcomingAppointment.date}, {summary.upcomingAppointment.timeSlot}</span>
                      </div>
                    )}
                    {summary.activePrescriptions > 0 && (
                      <div>
                        <span className="text-slate-400 block">{isSw ? 'Dawa Zinazoendelea' : 'Active Prescriptions'}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{summary.activePrescriptions}</span>
                      </div>
                    )}
                    {summary.lastImaging && (
                      <div>
                        <span className="text-slate-400 block">{isSw ? 'Picha ya Mwisho' : 'Recent Imaging'}</span>
                        <span className="font-bold text-slate-900 dark:text-white block truncate">{summary.lastImaging.title}</span>
                        <span className="text-slate-400">{new Date(summary.lastImaging.date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {summary.lastLab && (
                      <div>
                        <span className="text-slate-400 block">{isSw ? 'Maabara ya Mwisho' : 'Last Laboratory'}</span>
                        <span className="font-bold text-slate-900 dark:text-white block truncate">{summary.lastLab.title}</span>
                        <span className="text-slate-400">{new Date(summary.lastLab.date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {summary.followUps > 0 && (
                      <div>
                        <span className="text-slate-400 block">{isSw ? 'Ufuatiliaji' : 'Follow-ups'}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{summary.followUps}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {specialists.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{isSw ? 'Madaktari Bingwa Uliowatembelea' : 'Previous Specialists'}</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {specialists.map((s) => (
                      <div key={`${s.specialty}-${s.doctorName}`} className={`flex-shrink-0 rounded-xl border p-2.5 min-w-[130px] ${isDark ? 'border-slate-800 bg-[#0B1522]' : 'border-slate-100 bg-white'}`}>
                        <p className="font-bold text-slate-900 dark:text-white truncate">{s.specialty}</p>
                        <p className="text-slate-500 dark:text-slate-400 truncate">{s.doctorName}</p>
                        <p className="text-slate-400 truncate">{isSw ? 'Ziara ya Mwisho' : 'Last visit'}: {new Date(s.date).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {facilities.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{isSw ? 'Vituo Ulivyotembelea' : 'Previous Facilities'}</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {facilities.map((f) => (
                      <button
                        key={f.facilityId}
                        type="button"
                        onClick={() => onViewFacility?.(f.facilityId)}
                        disabled={!onViewFacility}
                        aria-label={isSw ? `Angalia ${f.name}` : `View ${f.name}`}
                        className={`flex-shrink-0 rounded-xl border p-2.5 min-w-[130px] text-left disabled:cursor-default ${isDark ? 'border-slate-800 bg-[#0B1522]' : 'border-slate-100 bg-white'}`}
                      >
                        <p className="font-bold text-slate-900 dark:text-white truncate">{f.name}</p>
                        <p className="text-slate-400 truncate">{f.count} {isSw ? (f.count === 1 ? 'ziara' : 'ziara') : f.count === 1 ? 'visit' : 'visits'}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isSw ? 'Tafuta kituo, daktari, utaalamu...' : 'Search facility, doctor, specialty...'}
                  aria-label={isSw ? 'Tafuta historia ya afya' : 'Search health history'}
                  className="nc-input w-full pl-8 pr-3 py-2 text-xs"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto mb-3 pb-1">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    aria-pressed={filter === f.key}
                    className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 font-bold whitespace-nowrap ${
                      filter === f.key
                        ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isSw ? f.sw : f.en}
                  </button>
                ))}
              </div>
            </>
          )}

          {!loading && entries.length > 0 && filteredEntries.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              {isSw ? 'Hakuna rekodi zinazolingana.' : 'No records match this filter or search.'}
            </p>
          )}

          {filteredEntries.length > 0 && (
            <div className="relative pl-5">
              <div className={`absolute left-[7px] top-2 bottom-2 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <div className="space-y-4">
                {filteredEntries.map((entry) => (
                  <div key={entry.id} className="relative">
                    <div className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 ${ENTRY_DOT[entry.type]}`} />
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                      {new Date(entry.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-800 bg-[#0B1522]' : 'border-slate-100 bg-white'}`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {entry.type === 'referral' ? (
                          <Share2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        ) : entry.type === 'imaging' ? (
                          <Scan className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                        ) : entry.type === 'lab' ? (
                          <FlaskConical className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                        ) : (
                          <Stethoscope className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        )}
                        <p className="font-bold text-slate-900 dark:text-white">{entry.title}</p>
                      </div>
                      {entry.facilityName && (
                        <p className="text-slate-500 dark:text-slate-400">{entry.facilityName}</p>
                      )}
                      {entry.doctorName && (
                        <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          {entry.doctorName}
                          {entry.doctorProfileId && onViewDoctorProfile && (
                            <button
                              type="button"
                              onClick={() => onViewDoctorProfile({ doctorId: entry.doctorProfileId! })}
                              aria-label={isSw ? `Angalia wasifu wa ${entry.doctorName}` : `View ${entry.doctorName}'s profile`}
                              className="inline-flex items-center gap-0.5 text-primary dark:text-primary-light font-bold underline underline-offset-2"
                            >
                              <User className="w-3 h-3" /> {isSw ? 'Wasifu' : 'Profile'}
                            </button>
                          )}
                        </p>
                      )}
                      {entry.subItems.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {entry.subItems.filter(Boolean).map((item, i) => (
                            <span key={i} className="rounded-lg bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light px-2 py-1 font-bold">
                              {entry.type === 'imaging' ? bodyRegionLabel(item, isSw) : item}
                            </span>
                          ))}
                        </div>
                      )}
                      {entry.type === 'imaging' && entry.recordId && onViewReport && (
                        <button
                          type="button"
                          onClick={() => { logViewed('IMAGING_ACCESSED', entry); onViewReport(entry.recordId!); }}
                          className="mt-2 text-primary dark:text-primary-light font-bold underline underline-offset-2"
                        >
                          {isSw ? 'Angalia Ripoti' : 'View Report'}
                        </button>
                      )}
                      {entry.type === 'lab' && onViewLabResults && (
                        <button
                          type="button"
                          onClick={() => { logViewed('LAB_RESULT_VIEWED', entry); onViewLabResults(); }}
                          className="mt-2 text-primary dark:text-primary-light font-bold underline underline-offset-2"
                        >
                          {isSw ? 'Angalia Matokeo' : 'View Results'}
                        </button>
                      )}
                      {entry.type === 'encounter' && (
                        <button
                          type="button"
                          onClick={() => logViewed('MEDICAL_RECORD_VIEWED', entry)}
                          className="mt-2 text-primary dark:text-primary-light font-bold underline underline-offset-2"
                        >
                          {isSw ? 'Angalia Rekodi' : 'View Record'}
                        </button>
                      )}
                      {entry.followUpNote && (
                        <div className={`mt-2.5 pt-2.5 border-t rounded-b-lg ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                          <p className="text-slate-600 dark:text-slate-300">
                            <span className="font-bold">{isSw ? 'Ufuatiliaji uliombwa: ' : 'Follow-up requested: '}</span>
                            {entry.followUpNote}
                          </p>
                          {onBookFollowUp && (
                            <button
                              type="button"
                              onClick={() => onBookFollowUp(entry)}
                              className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-primary/10 text-primary dark:text-primary-light px-2.5 py-1.5 font-bold"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" /> {isSw ? 'Weka Miadi ya Ufuatiliaji' : 'Book Follow-Up'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
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
