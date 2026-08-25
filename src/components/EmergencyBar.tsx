import React, { useState, useEffect } from 'react';
import {
  Siren,
  PhoneCall,
  MapPin,
  X,
  CheckCircle,
  Navigation,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { Language } from '../types';
import { NEARBY_HOSPITALS } from '../data/countries';
import { TRANSLATIONS } from '../data/translations';
import { createDispatch } from '../lib/emergency';
import { getDrivingRoutesToMany, RouteResult } from '../lib/routing';

interface EmergencyBarProps {
  language: Language;
  authUserId?: string | null;
}

export const EmergencyBar: React.FC<EmergencyBarProps> = ({ language, authUserId = null }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<'trauma' | 'cardiac' | 'respiratory' | 'maternity' | 'unconscious'>('trauma');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isDispatched, setIsDispatched] = useState(false);
  const [dispatchId, setDispatchId] = useState<string>('');
  const [dispatchedTime, setDispatchedTime] = useState<string>('');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; address: string }>({
    lat: -6.7924,
    lng: 39.2083,
    address: 'Oysterbay / Kinondoni, Dar es Salaam (GPS Pinpoint)',
  });

  // Real driving distance/ETA per hospital, computed from the patient's
  // actual GPS location via a real road-network routing engine (OSRM) —
  // not the static placeholder numbers in NEARBY_HOSPITALS.
  const [hospitalRoutes, setHospitalRoutes] = useState<(RouteResult | null)[]>(
    NEARBY_HOSPITALS.map(() => null)
  );
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsRoutingLoading(true);
    getDrivingRoutesToMany(
      gpsLocation.lat,
      gpsLocation.lng,
      NEARBY_HOSPITALS.map((h) => ({ lat: h.lat, lng: h.lng }))
    ).then((routes) => {
      if (!cancelled) {
        setHospitalRoutes(routes);
        setIsRoutingLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gpsLocation.lat, gpsLocation.lng]);

  // Nearest hospital by real driving time, falling back to the static list
  // order if routing hasn't resolved yet.
  const nearestHospitalIndex = hospitalRoutes.some((r) => r)
    ? hospitalRoutes.reduce(
        (bestIdx, route, idx) =>
          route && (!hospitalRoutes[bestIdx] || route.durationMin < (hospitalRoutes[bestIdx] as RouteResult).durationMin)
            ? idx
            : bestIdx,
        0
      )
    : 0;
  const nearestHospital = NEARBY_HOSPITALS[nearestHospitalIndex];
  const nearestRoute = hospitalRoutes[nearestHospitalIndex];

  const t = TRANSLATIONS.emergency;

  const triggerGpsLocate = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation({
            lat: Number(pos.coords.latitude.toFixed(4)),
            lng: Number(pos.coords.longitude.toFixed(4)),
            address: `Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)} (Live GPS)`,
          });
        },
        () => {},
        { timeout: 5000 }
      );
    }
  };

  const handleOpenEmergency = () => {
    setIsModalOpen(true);
    triggerGpsLocate();
  };

  const startDispatchCountdown = () => {
    setCountdown(5);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCountdown(null);
      setDispatchedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // Real dispatch: creates an auditable record (works even without login —
      // an emergency should never be gated behind an auth screen). Includes
      // the nearest facility + real driving distance/ETA computed via routing.
      createDispatch({
        condition: selectedCondition,
        latitude: gpsLocation.lat,
        longitude: gpsLocation.lng,
        address: gpsLocation.address,
        patientId: authUserId,
        targetFacility: nearestHospital.name,
        facilityDistanceKm: nearestRoute?.distanceKm,
        facilityEtaMin: nearestRoute?.durationMin,
      }).then(({ dispatchRef }) => {
        setDispatchId(dispatchRef);
        setIsDispatched(true);
      });
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const cancelDispatch = () => {
    setCountdown(null);
    setIsDispatched(false);
  };

  const emergencyConditions: { id: 'trauma' | 'cardiac' | 'respiratory' | 'maternity' | 'unconscious'; icon: string }[] = [
    { id: 'trauma', icon: '🚨' },
    { id: 'cardiac', icon: '❤️‍🩹' },
    { id: 'respiratory', icon: '🫁' },
    { id: 'maternity', icon: '🤰' },
    { id: 'unconscious', icon: '⚡' },
  ];

  return (
    <>
      {/* 1-Tap Emergency Bar Container Matching Screenshot */}
      <section className="w-full px-4 sm:px-6 mt-2.5 mb-4 relative z-20">
        <button
          id="btn-emergency-dispatch"
          type="button"
          onClick={handleOpenEmergency}
          aria-label="Emergency Ambulance 1-Tap Dispatch"
          className="w-full bg-[#D92D3A] hover:bg-[#BF2330] active:bg-[#A71E29] text-white p-3 sm:p-3.5 rounded-2xl shadow-md shadow-red-950/15 border border-red-400/30 flex items-center justify-between transition-colors cursor-pointer"
        >
          {/* Left: Ambulance and Beacon */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white/20 px-2 py-1.5 rounded-xl backdrop-blur-xs flex-shrink-0">
              <Siren className="w-5 h-5" />
            </div>

            <div className="text-left">
              <h2 className="text-sm sm:text-base font-extrabold tracking-wide text-white uppercase leading-tight font-sans">
                {t.barTitle[language]}
              </h2>
              <p className="text-xs sm:text-[13px] text-white/90 font-medium">
                {t.barSubtitle[language]}
              </p>
            </div>
          </div>

          {/* Right Chevron Circle */}
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white flex-shrink-0 shadow-xs">
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </section>

      {/* Emergency Dispatch Drawer / Modal */}
      {isModalOpen && (
        <div
          id="modal-emergency"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border-2 border-red-500 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#E51E2B] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Siren className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">
                    {t.modalTitle[language]}
                  </h3>
                  <p className="text-xs text-red-100">
                    {t.modalSubtitle[language]}
                  </p>
                </div>
              </div>
              <button
                id="btn-close-emergency"
                type="button"
                onClick={() => {
                  cancelDispatch();
                  setIsModalOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-800">
              {/* If Dispatched Successfully */}
              {isDispatched ? (
                <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg animate-bounce">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md">
                      ID: {dispatchId}
                    </span>
                    <h4 className="text-xl font-black text-emerald-900 mt-2">
                      {t.dispatchedTitle[language]}
                    </h4>
                    <p className="text-xs text-emerald-700 mt-1">
                      {t.dispatchedDesc[language]}
                    </p>
                  </div>

                  {/* Responders Card */}
                  <div className="bg-white p-3 rounded-xl border border-emerald-200 text-left text-xs space-y-1.5">
                    {dispatchedTime && (
                      <div className="flex justify-between font-semibold text-slate-700 pb-1 border-b border-emerald-100">
                        <span>{language === 'sw' ? 'Muda wa Kutuma (Real-Time):' : 'Dispatch Timestamp:'}</span>
                        <span className="font-mono text-emerald-800 font-bold">{dispatchedTime}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>{t.paramedicLead[language]}</span>
                      <span className="text-emerald-700 font-bold">+255 754 112 999</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{t.targetFacility[language]}</span>
                      <span className="font-semibold text-slate-900">
                        {nearestHospital.name}
                        {nearestRoute ? ` (${nearestRoute.distanceKm} km)` : ` (${nearestHospital.distance})`}
                      </span>
                    </div>
                  </div>

                  <button
                    id="btn-call-responders"
                    type="button"
                    onClick={() => window.open('tel:112')}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <PhoneCall className="w-4 h-4" />
                    {t.callDirectly[language]}
                  </button>
                </div>
              ) : countdown !== null ? (
                /* Countdown Triggering Screen */
                <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-6 text-center space-y-4">
                  <div className="w-20 h-20 bg-red-600 text-white rounded-full flex items-center justify-center mx-auto shadow-xl text-3xl font-black emergency-glow">
                    {countdown}s
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-red-900">
                      {t.initiatingTitle[language]}
                    </h4>
                    <p className="text-xs text-red-700 mt-1 max-w-sm mx-auto">
                      {t.initiatingDesc[language]}
                    </p>
                  </div>
                  <button
                    id="btn-cancel-countdown"
                    type="button"
                    onClick={cancelDispatch}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold text-sm shadow-md cursor-pointer"
                  >
                    {t.cancelDispatch[language]}
                  </button>
                </div>
              ) : (
                /* Normal Emergency Config State */
                <>
                  {/* GPS Locator Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0A4275] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {t.gpsPinpoint[language]}
                        </span>
                        <button
                          type="button"
                          onClick={triggerGpsLocate}
                          className="text-[11px] text-[#0A4275] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Navigation className="w-3 h-3" />
                          {t.refresh[language]}
                        </button>
                      </div>
                      <p className="text-slate-600 mt-0.5 leading-relaxed">{gpsLocation.address}</p>
                    </div>
                  </div>

                  {/* Triage / Condition Selector */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      {t.triageTitle[language]}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {emergencyConditions.map((cond) => (
                        <button
                          id={`triage-${cond.id}`}
                          key={cond.id}
                          type="button"
                          onClick={() => setSelectedCondition(cond.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all text-xs flex flex-col justify-between cursor-pointer ${
                            selectedCondition === cond.id
                              ? 'border-red-500 bg-red-50/80 text-red-950 font-bold ring-2 ring-red-400/50'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-lg mb-1">{cond.icon}</span>
                          <span className="leading-tight">
                            {t.conditions[cond.id][language]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nearby Hospitals ETA — real driving distance/time from the patient's GPS */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center justify-between">
                      <span>{t.nearestHospitalsTitle[language]}</span>
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t.ready247[language]}
                      </span>
                    </label>
                    <div className="space-y-1.5">
                      {NEARBY_HOSPITALS.slice(0, 2).map((hosp, i) => {
                        const route = hospitalRoutes[i];
                        return (
                          <div
                            key={i}
                            className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{hosp.name}</p>
                              <p className="text-[11px] text-slate-500">{hosp.type}</p>
                            </div>
                            <div className="text-right">
                              <span className="inline-block bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px]">
                                {isRoutingLoading && !route
                                  ? '...'
                                  : route
                                  ? `${route.durationMin} mins`
                                  : hosp.eta}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {route ? `${route.distanceKm} km` : hosp.distance}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Primary Trigger Button */}
                  <div className="pt-2 space-y-2">
                    <button
                      id="btn-confirm-dispatch"
                      type="button"
                      onClick={startDispatchCountdown}
                      className="w-full bg-[#E51E2B] hover:bg-[#D01824] text-white py-3.5 px-4 rounded-xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer"
                    >
                      <Siren className="w-5 h-5 animate-pulse" />
                      {t.confirmDispatchBtn[language]}
                    </button>

                    <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-600 pt-1">
                      <span>{t.directHotlines[language]}</span>
                      <a href="tel:112" className="text-red-600 hover:underline flex items-center gap-1 font-bold">
                        <PhoneCall className="w-3 h-3" /> 112 (Polisi/EMS)
                      </a>
                      <a href="tel:999" className="text-red-600 hover:underline flex items-center gap-1 font-bold">
                        <PhoneCall className="w-3 h-3" /> 999 (Afya)
                      </a>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
