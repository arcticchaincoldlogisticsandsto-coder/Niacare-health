import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Building2, MapPin, Phone, ShieldCheck, Navigation, ExternalLink, Loader2,
  AlertTriangle, Stethoscope, BadgeCheck, Clock, User,
} from 'lucide-react';
import { Language, Theme } from '../types';
import { Doctor, DoctorProfileTarget } from '../data/doctors';
import { MapFacility, fetchMapFacilities, haversineDistanceKm } from '../lib/facilityMap';
import { getDrivingRoute, RouteResult } from '../lib/routing';
import { useGeolocation } from '../lib/useGeolocation';
import { fetchDoctorsByProvider, fetchAvailableSlots } from '../lib/realDoctors';
import { fetchDepartments, fetchServices, DepartmentRow, ServiceRow } from '../lib/facilityOps';
import { withTimeout } from '../lib/useNetworkStatus';
import { LoadingSkeleton } from './LoadingSkeleton';
import { EmptyState } from './EmptyState';

/** Same already-loaded-vs-resolve-by-id pattern as DoctorProfileTarget — a facility card the patient already tapped on the map carries the full object; Doctor Profile's "View Facility" only has the provider id. */
export type FacilityProfileTarget = { facility: MapFacility } | { providerId: string };

const facilityTypeLabel = (type: string): string => type.replace(/_/g, ' ');

const getTodayIso = (): string => new Date().toISOString().slice(0, 10);

interface FacilityProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: FacilityProfileTarget | null;
  language: Language;
  theme: Theme;
  onBookAtFacility: (facilityName: string) => void;
  onViewDoctorProfile: (target: DoctorProfileTarget) => void;
  onBookDoctor: (doctor: Doctor) => void;
}

export const FacilityProfileModal: React.FC<FacilityProfileModalProps> = ({
  isOpen, onClose, target, language, theme, onBookAtFacility, onViewDoctorProfile, onBookDoctor,
}) => {
  const isSw = language === 'sw';
  const isDark = theme === 'dark';
  const geo = useGeolocation();

  const [facility, setFacility] = useState<MapFacility | null>(target && 'facility' in target ? target.facility : null);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [facilityError, setFacilityError] = useState('');
  const [facilityRetryToken, setFacilityRetryToken] = useState(0);

  useEffect(() => {
    if (!isOpen || !target) return;
    if ('facility' in target) {
      setFacility(target.facility);
      setFacilityError('');
      return;
    }
    let active = true;
    setFacilityLoading(true);
    setFacilityError('');
    withTimeout(fetchMapFacilities(), 15000)
      .then(({ facilities, error }) => {
        if (!active) return;
        if (error) { setFacilityError(isSw ? 'Imeshindwa kupata kituo. Angalia mtandao wako.' : 'Unable to load this facility. Check your connection.'); }
        else {
          const found = facilities.find((f) => f.id === target.providerId) || null;
          if (!found) setFacilityError(isSw ? 'Taarifa za kituo hazipatikani.' : 'No profile data is available for this facility.');
          else setFacility(found);
        }
        setFacilityLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setFacilityError(isSw ? 'Imeshindwa kupata kituo. Angalia mtandao wako.' : 'Unable to load this facility. Check your connection.');
        setFacilityLoading(false);
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, target, facilityRetryToken]);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState('');
  const [doctorsRetryToken, setDoctorsRetryToken] = useState(0);
  const [availableTodayIds, setAvailableTodayIds] = useState<Set<string>>(new Set());

  // Departments/services RLS already returns only is_active rows to a
  // patient (see supabase/schema.sql) — no separate "public" query needed.
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);

  useEffect(() => {
    if (!isOpen || !facility) return;
    let active = true;
    Promise.all([fetchDepartments(facility.id), fetchServices(facility.id)]).then(([deptRes, svcRes]) => {
      if (!active) return;
      if (!deptRes.error) setDepartments(deptRes.departments);
      if (!svcRes.error) setServices(svcRes.services);
    });
    return () => { active = false; };
  }, [isOpen, facility?.id]);

  useEffect(() => {
    if (!isOpen || !facility) return;
    let active = true;
    setDoctorsLoading(true);
    setDoctorsError('');
    withTimeout(fetchDoctorsByProvider(facility.id), 15000)
      .then(async ({ doctors: fetched, error }) => {
        if (!active) return;
        if (error) { setDoctorsError(isSw ? 'Imeshindwa kupata madaktari.' : 'Unable to load doctors at this facility.'); setDoctorsLoading(false); return; }
        setDoctors(fetched);
        setDoctorsLoading(false);
        // "Available Today" per doctor — best-effort; a failed lookup just
        // omits that badge rather than blocking the whole doctors list.
        const today = getTodayIso();
        const results = await Promise.all(
          fetched.map((d) => fetchAvailableSlots(d.id, today).then((b) => ({ id: d.id, has: b.morning.length + b.afternoon.length + b.evening.length > 0 })).catch(() => ({ id: d.id, has: false })))
        );
        if (!active) return;
        setAvailableTodayIds(new Set(results.filter((r) => r.has).map((r) => r.id)));
      })
      .catch(() => {
        if (!active) return;
        setDoctorsError(isSw ? 'Imeshindwa kupata madaktari.' : 'Unable to load doctors at this facility.');
        setDoctorsLoading(false);
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, facility?.id, doctorsRetryToken]);

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  useEffect(() => {
    setRoute(null);
    setRouteError('');
  }, [facility?.id]);

  const distanceKm = useMemo(
    () => (geo.coords && facility ? haversineDistanceKm(geo.coords.lat, geo.coords.lng, facility.lat, facility.lng) : null),
    [geo.coords, facility]
  );

  if (!isOpen || !target) return null;

  const handleGetDirections = async () => {
    if (!facility) return;
    if (!geo.coords) { geo.request(); return; }
    setRouteLoading(true);
    setRouteError('');
    const { route: result, error } = await getDrivingRoute(geo.coords.lat, geo.coords.lng, facility.lat, facility.lng);
    setRouteLoading(false);
    if (error || !result) { setRouteError(isSw ? 'Imeshindwa kupata njia.' : "We couldn't calculate a driving route."); return; }
    setRoute(result);
  };

  const handleOpenInMaps = () => {
    if (!facility) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="nc-card w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 flex items-center justify-between bg-primary text-white flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">{facility ? facility.name : isSw ? 'Wasifu wa Kituo' : 'Facility Profile'}</h3>
              {facility && <p className="text-[11px] text-white/80 truncate capitalize">{facilityTypeLabel(facility.type)}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={isSw ? 'Funga' : 'Close'} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto text-xs space-y-4">
          {facilityLoading && <LoadingSkeleton rows={4} />}

          {!facilityLoading && facilityError && (
            <div role="alert" className="flex flex-col items-center gap-2 text-center py-6">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
              <p className="text-rose-600">{facilityError}</p>
              <button
                type="button"
                onClick={() => setFacilityRetryToken((t) => t + 1)}
                className="mt-1 rounded-lg px-3 py-1.5 font-bold bg-primary/10 text-primary dark:text-primary-light"
              >
                {isSw ? 'Jaribu Tena' : 'Retry'}
              </button>
            </div>
          )}

          {!facilityLoading && !facilityError && facility && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {facility.address && (
                  <div className="col-span-2 rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1"><MapPin className="w-3 h-3" /> {isSw ? 'Anwani' : 'Address'}</p>
                    <p className="font-bold text-slate-900 dark:text-white">{facility.address}</p>
                  </div>
                )}
                {facility.phone && (
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1"><Phone className="w-3 h-3" /> {isSw ? 'Simu' : 'Phone'}</p>
                    <p className="font-bold text-slate-900 dark:text-white truncate">{facility.phone}</p>
                  </div>
                )}
                {(route || distanceKm !== null) && (
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1"><Navigation className="w-3 h-3" /> {isSw ? 'Umbali' : 'Distance'}</p>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {route ? `${route.distanceKm} km · ~${route.durationMin} min` : `~${distanceKm} km (${isSw ? 'makadirio' : 'estimate'})`}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {facility.nhifEnabled && <span className="text-[10px] font-bold rounded-lg bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light px-2 py-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> NHIF</span>}
              </div>

              {facility.specialties.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{isSw ? 'Utaalamu' : 'Specialties'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {facility.specialties.map((s) => (
                      <span key={s} className="text-[10px] font-bold rounded-md bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light px-2 py-1">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {departments.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{isSw ? 'Idara' : 'Departments'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {departments.map((d) => (
                      <span key={d.id} title={d.description || undefined} className="text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1">{d.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {services.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{isSw ? 'Huduma' : 'Services'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((s) => (
                      <span key={s.id} title={s.description || undefined} className="text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1">{s.name}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleGetDirections}
                  disabled={routeLoading}
                  aria-busy={routeLoading}
                  aria-label={isSw ? 'Pata njia halisi ya barabara' : 'Get real driving directions'}
                  className="flex-1 min-h-[38px] flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-2 font-bold disabled:opacity-50"
                >
                  {routeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />} {isSw ? 'Njia' : 'Directions'}
                </button>
                <button
                  type="button"
                  onClick={handleOpenInMaps}
                  aria-label={isSw ? 'Fungua kwenye programu ya ramani' : 'Open in maps app'}
                  className="flex-1 min-h-[38px] flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-2 font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> {isSw ? 'Fungua Ramani' : 'Open in Maps'}
                </button>
              </div>
              {routeError && <p role="alert" className="text-rose-600">{routeError}</p>}
              {geo.state === 'denied' && (
                <p className="text-slate-400">{isSw ? 'Ruhusa ya mahali imekataliwa — tumia "Fungua Ramani" badala yake.' : 'Location permission denied — use "Open in Maps" instead.'}</p>
              )}

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1">
                  <Stethoscope className="w-3 h-3" /> {isSw ? 'Madaktari' : 'Doctors'}
                </p>
                {doctorsLoading && <LoadingSkeleton rows={2} />}
                {!doctorsLoading && doctorsError && (
                  <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 dark:border-rose-900 p-2.5">
                    <p className="text-rose-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {doctorsError}</p>
                    <button type="button" onClick={() => setDoctorsRetryToken((t) => t + 1)} className="font-bold text-primary dark:text-primary-light flex-shrink-0">
                      {isSw ? 'Jaribu Tena' : 'Retry'}
                    </button>
                  </div>
                )}
                {!doctorsLoading && !doctorsError && doctors.length === 0 && (
                  <EmptyState
                    icon={Stethoscope}
                    title={isSw ? 'Hakuna Madaktari' : 'No Doctors Listed'}
                    description={isSw ? 'Hakuna daktari aliyesajiliwa kwenye kituo hiki bado.' : 'No doctors are registered at this facility yet.'}
                  />
                )}
                {!doctorsLoading && !doctorsError && doctors.length > 0 && (
                  <div className="space-y-2">
                    {doctors.map((doc) => (
                      <div key={doc.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${doc.avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                            {doc.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1 truncate">
                              {doc.name}
                              {doc.isVerified && <BadgeCheck className="w-3 h-3 text-primary flex-shrink-0" />}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 truncate">{doc.specialty}</p>
                          </div>
                          {availableTodayIds.has(doc.id) && (
                            <span className="text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 flex items-center gap-1 flex-shrink-0">
                              <Clock className="w-3 h-3" /> {isSw ? 'Leo' : 'Today'}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewDoctorProfile({ doctor: doc })}
                            aria-label={isSw ? `Angalia wasifu wa ${doc.name}` : `View ${doc.name}'s profile`}
                            className="flex-1 min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1.5 font-bold flex items-center justify-center gap-1"
                          >
                            <User className="w-3 h-3" /> {isSw ? 'Wasifu' : 'View Profile'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onBookDoctor(doc)}
                            aria-label={isSw ? `Weka miadi na ${doc.name}` : `Book with ${doc.name}`}
                            className="flex-1 min-h-[34px] rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-2 py-1.5 font-bold"
                          >
                            {isSw ? 'Weka Miadi' : 'Book'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!facilityLoading && !facilityError && facility && (
          <div className="p-3 border-t nc-border flex-shrink-0">
            <button
              type="button"
              onClick={() => onBookAtFacility(facility.name)}
              className="w-full rounded-xl bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-4 py-3 text-sm font-bold"
            >
              {isSw ? 'Weka Miadi Kituoni' : 'Book Appointment at This Facility'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
