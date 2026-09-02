import React, { useEffect, useState } from 'react';
import { X, Heart, BadgeCheck, Building2, Globe2, GraduationCap, ShieldCheck, Video, MapPinned, Clock, AlertTriangle, Navigation, ExternalLink, Loader2 } from 'lucide-react';
import { Language, Theme } from '../types';
import { Doctor, DoctorProfileTarget } from '../data/doctors';
import { fetchAvailableSlots, fetchDoctorById, fetchDoctorByUserId } from '../lib/realDoctors';
import { withTimeout } from '../lib/useNetworkStatus';
import { getDrivingRoute, RouteResult } from '../lib/routing';
import { useGeolocation } from '../lib/useGeolocation';
import { haversineDistanceKm } from '../lib/facilityMap';
import { LoadingSkeleton } from './LoadingSkeleton';

interface DoctorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The canonical entry point: pass an already-loaded doctor, or an id to resolve — see DoctorProfileTarget. */
  target: DoctorProfileTarget | null;
  language: Language;
  theme: Theme;
  onBookAppointment: (doctor: Doctor, slot?: { date: string; time: string }) => void;
  onViewFacility?: (doctor: Doctor) => void;
}

const getDateIso = (daysAhead: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
};

const DAY_OFFSETS = [0, 1, 2];

export const DoctorProfileModal: React.FC<DoctorProfileModalProps> = ({
  isOpen, onClose, target, language, theme, onBookAppointment, onViewFacility,
}) => {
  const isSw = language === 'sw';
  const isDark = theme === 'dark';
  const [favorited, setFavorited] = useState(false);
  const geo = useGeolocation();
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  // Resolve the target into a real Doctor. Already-loaded objects (doctor
  // browse lists) render immediately with no fetch; an id-only target
  // (appointments, health journey, messages) fetches from doctor_profiles —
  // this is what makes it one canonical component instead of every caller
  // needing its own copy of the doctor already in hand.
  const [doctor, setDoctor] = useState<Doctor | null>(target && 'doctor' in target ? target.doctor : null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState('');
  const [doctorRetryToken, setDoctorRetryToken] = useState(0);

  useEffect(() => {
    if (!isOpen || !target) return;
    if ('doctor' in target) {
      setDoctor(target.doctor);
      setDoctorError('');
      return;
    }
    let active = true;
    setDoctorLoading(true);
    setDoctorError('');
    const lookup = 'doctorId' in target ? fetchDoctorById(target.doctorId) : fetchDoctorByUserId(target.doctorUserId);
    withTimeout(lookup, 15000)
      .then(({ doctor: found, error }) => {
        if (!active) return;
        if (error) setDoctorError(isSw ? 'Imeshindwa kupata wasifu wa daktari. Angalia mtandao wako.' : 'Unable to load this doctor. Check your connection.');
        else if (!found) setDoctorError(isSw ? 'Wasifu wa daktari haupatikani.' : 'No profile data is available for this doctor.');
        else setDoctor(found);
        setDoctorLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setDoctorError(isSw ? 'Imeshindwa kupata wasifu wa daktari. Angalia mtandao wako.' : 'Unable to load this doctor. Check your connection.');
        setDoctorLoading(false);
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, target, doctorRetryToken]);

  const [slotsByDay, setSlotsByDay] = useState<Record<string, { morning: string[]; afternoon: string[]; evening: string[] }>>({});
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !doctor) return;
    let active = true;
    setLoadingSlots(true);
    setSlotsError('');
    withTimeout(Promise.all(DAY_OFFSETS.map((d) => fetchAvailableSlots(doctor.id, getDateIso(d)))), 15000)
      .then((results) => {
        if (!active) return;
        const map: typeof slotsByDay = {};
        DAY_OFFSETS.forEach((d, i) => { map[getDateIso(d)] = results[i]; });
        setSlotsByDay(map);
        setLoadingSlots(false);
      })
      .catch(() => {
        if (!active) return;
        setSlotsError(isSw ? 'Imeshindwa kupata ratiba. Angalia mtandao wako.' : 'Unable to load availability. Check your connection.');
        setLoadingSlots(false);
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, doctor?.id, retryToken]);

  useEffect(() => {
    if (!isOpen) setSelectedSlotKey(null);
  }, [isOpen]);

  useEffect(() => {
    setRoute(null);
    setRouteError('');
  }, [doctor?.id]);

  const distanceKm =
    geo.coords && doctor?.facilityLat != null && doctor?.facilityLng != null
      ? haversineDistanceKm(geo.coords.lat, geo.coords.lng, doctor.facilityLat, doctor.facilityLng)
      : null;

  const handleGetDirections = async () => {
    if (!doctor?.facilityLat || !doctor?.facilityLng) return;
    if (!geo.coords) { geo.request(); return; }
    setRouteLoading(true);
    setRouteError('');
    const { route: result, error } = await getDrivingRoute(geo.coords.lat, geo.coords.lng, doctor.facilityLat, doctor.facilityLng);
    setRouteLoading(false);
    if (error || !result) { setRouteError(isSw ? 'Imeshindwa kupata njia.' : "We couldn't calculate a driving route."); return; }
    setRoute(result);
  };

  const handleOpenInMaps = () => {
    if (!doctor?.facilityLat || !doctor?.facilityLng) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${doctor.facilityLat},${doctor.facilityLng}`, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen || !target) return null;

  const dayLabel = (offset: number) => {
    if (offset === 0) return isSw ? 'Leo' : 'Today';
    if (offset === 1) return isSw ? 'Kesho' : 'Tomorrow';
    return new Date(getDateIso(offset)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const anySlotsAnyDay = DAY_OFFSETS.some((d) => {
    const b = slotsByDay[getDateIso(d)];
    return b && (b.morning.length || b.afternoon.length || b.evening.length);
  });

  const handleSlotTap = (offset: number, slot: string) => {
    if (!doctor) return;
    setSelectedSlotKey(`${offset}-${slot}`);
    onBookAppointment(doctor, { date: getDateIso(offset), time: slot });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="nc-card w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 flex items-center justify-between bg-primary text-white flex-shrink-0">
          <button type="button" onClick={onClose} aria-label={isSw ? 'Funga' : 'Close'} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
          {doctor && (
            <button
              type="button"
              onClick={() => setFavorited((v) => !v)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              aria-pressed={favorited}
              aria-label={isSw ? 'Pendekeza' : 'Favorite'}
              title={isSw ? 'Pendekeza' : 'Favorite'}
            >
              <Heart className={`w-4 h-4 ${favorited ? 'fill-white' : ''}`} />
            </button>
          )}
        </div>

        <div className="p-4 overflow-y-auto text-xs space-y-4">
          {doctorLoading && <LoadingSkeleton rows={4} />}

          {!doctorLoading && doctorError && (
            <div role="alert" className="flex flex-col items-center gap-2 text-center py-6">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
              <p className="text-rose-600">{doctorError}</p>
              <button
                type="button"
                onClick={() => setDoctorRetryToken((t) => t + 1)}
                className="mt-1 rounded-lg px-3 py-1.5 font-bold bg-primary/10 text-primary dark:text-primary-light"
              >
                {isSw ? 'Jaribu Tena' : 'Retry'}
              </button>
            </div>
          )}

          {!doctorLoading && !doctorError && doctor && (
            <>
              <div className="flex items-center gap-3">
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${doctor.avatarColor} flex items-center justify-center text-white text-xl font-bold flex-shrink-0`}
                >
                  {doctor.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                    {doctor.name}
                    {doctor.isVerified && (
                      <span title={isSw ? 'Amethibitishwa' : 'Verified'} className="inline-flex flex-shrink-0">
                        <BadgeCheck className="w-4 h-4 text-primary" />
                      </span>
                    )}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">{doctor.specialty}</p>
                  <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3 flex-shrink-0" /> {doctor.hospital}
                  </p>
                </div>
              </div>

              {doctor.reviewsCount > 0 && (
                <p className="text-slate-500 dark:text-slate-400">
                  ★ {doctor.rating.toFixed(1)} ({doctor.reviewsCount} {isSw ? 'maoni' : 'reviews'})
                </p>
              )}

              {doctor.bio && (
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{isSw ? doctor.bioSw : doctor.bio}</p>
              )}

              <div className="grid grid-cols-2 gap-2">
                {doctor.experienceYears > 0 && (
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{isSw ? 'Uzoefu' : 'Experience'}</p>
                    <p className="font-bold text-slate-900 dark:text-white">{doctor.experienceYears} {isSw ? 'miaka' : 'years'}</p>
                  </div>
                )}
                {doctor.languages.length > 0 && (
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1"><Globe2 className="w-3 h-3" /> {isSw ? 'Lugha' : 'Languages'}</p>
                    <p className="font-bold text-slate-900 dark:text-white truncate">{doctor.languages.join(', ')}</p>
                  </div>
                )}
                {doctor.mctRegistration && doctor.mctRegistration !== '—' && (
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {isSw ? 'Usajili' : 'Registration'}</p>
                    <p className="font-bold text-slate-900 dark:text-white truncate">{doctor.mctRegistration}</p>
                  </div>
                )}
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{isSw ? 'Ada ya Ushauri' : 'Consultation Fee'}</p>
                  <p className="font-bold text-slate-900 dark:text-white">TZS {doctor.consultationFeeTzs.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {doctor.nhifAccepted && <span className="text-[10px] font-bold rounded-lg bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light px-2 py-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> NHIF</span>}
                {doctor.telehealthAvailable && <span className="text-[10px] font-bold rounded-lg bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light px-2 py-1 flex items-center gap-1"><Video className="w-3 h-3" /> {isSw ? 'Telehealth' : 'Telehealth'}</span>}
              </div>

              {(onViewFacility || doctor.facilityLat != null) && (
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 space-y-2">
                  {onViewFacility ? (
                    <button
                      type="button"
                      onClick={() => onViewFacility(doctor)}
                      aria-label={isSw ? `Angalia wasifu wa ${doctor.hospital}` : `View ${doctor.hospital}'s facility profile`}
                      className="w-full flex items-center justify-between gap-2 text-left"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <MapPinned className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="min-w-0">
                          <span className="block font-bold text-slate-900 dark:text-white truncate">{doctor.hospital}</span>
                          <span className="block text-slate-400 truncate">
                            {route ? `${route.distanceKm} km · ~${route.durationMin} min` : distanceKm !== null ? `~${distanceKm} km ${isSw ? 'mbali' : 'away'}` : doctor.region}
                          </span>
                        </span>
                      </span>
                      <span className="text-primary font-bold flex-shrink-0">{isSw ? 'Angalia' : 'View'}</span>
                    </button>
                  ) : (
                    <span className="flex items-center gap-2 min-w-0">
                      <MapPinned className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="min-w-0">
                        <span className="block font-bold text-slate-900 dark:text-white truncate">{doctor.hospital}</span>
                        <span className="block text-slate-400 truncate">
                          {route ? `${route.distanceKm} km · ~${route.durationMin} min` : distanceKm !== null ? `~${distanceKm} km ${isSw ? 'mbali' : 'away'}` : doctor.region}
                        </span>
                      </span>
                    </span>
                  )}
                  {doctor.facilityLat != null && doctor.facilityLng != null && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handleGetDirections}
                        disabled={routeLoading}
                        aria-busy={routeLoading}
                        aria-label={isSw ? 'Pata njia halisi ya barabara' : 'Get real driving directions'}
                        className="flex-1 min-h-[34px] flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-1.5 font-bold disabled:opacity-50"
                      >
                        {routeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />} {isSw ? 'Njia' : 'Directions'}
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenInMaps}
                        aria-label={isSw ? 'Fungua kwenye programu ya ramani' : 'Open in maps app'}
                        className="flex-1 min-h-[34px] flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-1.5 font-bold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> {isSw ? 'Fungua Ramani' : 'Open in Maps'}
                      </button>
                    </div>
                  )}
                  {routeError && <p role="alert" className="text-rose-600">{routeError}</p>}
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {isSw ? 'Nafasi Zilizopo' : 'Available Times'}
                </p>
                {loadingSlots && <LoadingSkeleton rows={2} />}
                {!loadingSlots && slotsError && (
                  <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 dark:border-rose-900 p-2.5">
                    <p className="text-rose-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {slotsError}</p>
                    <button type="button" onClick={() => setRetryToken((t) => t + 1)} className="font-bold text-primary dark:text-primary-light flex-shrink-0">
                      {isSw ? 'Jaribu Tena' : 'Retry'}
                    </button>
                  </div>
                )}
                {!loadingSlots && !slotsError && !anySlotsAnyDay && (
                  <p className="text-slate-500 dark:text-slate-400">
                    {isSw ? 'Hakuna nafasi zilizopo kwa daktari huyu kwa sasa.' : 'No appointments are currently available for this doctor.'}
                  </p>
                )}
                {!loadingSlots && !slotsError && anySlotsAnyDay && (
                  <div className="space-y-3">
                    {DAY_OFFSETS.map((offset) => {
                      const bucket = slotsByDay[getDateIso(offset)];
                      const allSlots = bucket ? [...bucket.morning, ...bucket.afternoon, ...bucket.evening] : [];
                      if (allSlots.length === 0) return null;
                      return (
                        <div key={offset}>
                          <p className="font-bold text-slate-700 dark:text-slate-200 mb-1.5">{dayLabel(offset)}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {allSlots.map((slot) => {
                              const key = `${offset}-${slot}`;
                              const isSelected = selectedSlotKey === key;
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => handleSlotTap(offset, slot)}
                                  aria-pressed={isSelected}
                                  aria-label={isSw ? `Chagua muda ${slot} tarehe ${dayLabel(offset)}` : `Select ${slot} on ${dayLabel(offset)}`}
                                  className={`min-h-[36px] rounded-lg px-2.5 py-1.5 text-[11px] font-bold border transition-colors ${
                                    isSelected
                                      ? 'bg-primary text-white border-primary shadow-md'
                                      : isDark
                                      ? 'bg-primary/10 text-primary-light border-transparent hover:bg-primary/20'
                                      : 'bg-primary/5 text-[var(--nc-primary)] border-transparent hover:bg-primary/10'
                                  }`}
                                >
                                  {slot}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!doctorLoading && !doctorError && doctor && (
          <div className="p-3 border-t nc-border flex-shrink-0">
            <button
              type="button"
              onClick={() => onBookAppointment(doctor)}
              className="w-full rounded-xl bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-4 py-3 text-sm font-bold"
            >
              {isSw ? 'Weka Miadi' : 'Book Appointment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
