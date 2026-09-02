import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  X, Search, MapPin, Navigation, Locate, Map as MapIcon, List as ListIcon,
  Layers, ZoomIn, ZoomOut, ShieldCheck, Building2, Loader2, AlertTriangle,
} from 'lucide-react';
import { Language, Theme } from '../types';
import { fetchMapFacilities, haversineDistanceKm, MapFacility } from '../lib/facilityMap';
import { getDrivingRoute, RouteResult } from '../lib/routing';
import { useGeolocation } from '../lib/useGeolocation';
import { NIACARE_MAP_TILE_LAYERS, NIACARE_MAP_TILE_LAYERS_DARK, NIACARE_SATELLITE_LAYER, TileLayerConfig } from '../data/mapTiles';
import { EmptyState } from './EmptyState';
import { LoadingSkeleton } from './LoadingSkeleton';

interface FacilityMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  theme: Theme;
  onBookAtFacility: (facilityName: string) => void;
  /** Optional — opens the dedicated Facility Profile (name/type/address/specialties/doctors) for this facility. Additive only; existing map behavior is unchanged when omitted. */
  onViewFacilityProfile?: (facility: MapFacility) => void;
}

const TANZANIA_CENTER: [number, number] = [-6.369, 34.888]; // roughly central Tanzania
const TANZANIA_DEFAULT_ZOOM = 6;

const facilityIcon = (selected: boolean) =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:${selected ? 34 : 26}px;height:${selected ? 34 : 26}px;">
        ${selected ? '<div style="position:absolute;inset:-6px;border-radius:9999px;border:2px solid var(--nc-primary);opacity:0.55;animation:nc-marker-pulse 1.6s ease-out infinite;"></div>' : ''}
        <div style="width:100%;height:100%;border-radius:9999px;background:var(--nc-primary);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">
          <div style="width:${selected ? 10 : 7}px;height:${selected ? 10 : 7}px;border-radius:9999px;background:white;"></div>
        </div>
      </div>
    `,
    iconSize: [selected ? 34 : 26, selected ? 34 : 26],
    iconAnchor: [selected ? 17 : 13, selected ? 17 : 13],
  });

const patientIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:20px;height:20px;">
      <div style="position:absolute;inset:-8px;border-radius:9999px;background:#3B82F6;opacity:0.2;animation:nc-marker-pulse 1.8s ease-out infinite;"></div>
      <div style="width:100%;height:100%;border-radius:9999px;background:#3B82F6;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface ZoomAction { dir: 1 | -1; nonce: number }

// Keeps the Leaflet map instance's imperative flyTo/zoom in sync with React
// state, without exposing the map instance outside this file. Zoom reads
// map.getZoom() fresh each time rather than accumulating a delta in state,
// so each button press is always a single relative step from wherever the
// map currently is (including from the user's own scroll-zoom).
const MapController: React.FC<{ flyTo: [number, number] | null; zoomAction: ZoomAction | null }> = ({ flyTo, zoomAction }) => {
  const map = useMap();
  useEffect(() => {
    if (flyTo) map.flyTo(flyTo, Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [flyTo, map]);
  useEffect(() => {
    if (zoomAction) map.setZoom(map.getZoom() + zoomAction.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomAction]);
  return null;
};

const facilityTypeLabel = (type: string): string => {
  const t = type.toLowerCase();
  if (t.includes('laborator')) return 'Laboratory';
  if (t.includes('pharmac')) return 'Pharmacy';
  if (t.includes('clinic')) return 'Clinic';
  return 'Hospital';
};

export const FacilityMapModal: React.FC<FacilityMapModalProps> = ({ isOpen, onClose, language, theme, onBookAtFacility, onViewFacilityProfile }) => {
  const isSw = language === 'sw';
  const isDark = theme === 'dark';
  const [facilities, setFacilities] = useState<MapFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [nearMeOnly, setNearMeOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [zoomAction, setZoomAction] = useState<ZoomAction | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<{ facilityId: string; result: RouteResult } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  const [tileLayerIndex, setTileLayerIndex] = useState(0);
  const [tileErrorCount, setTileErrorCount] = useState(0);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  const geo = useGeolocation();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchMapFacilities().then(({ facilities: fetched, error: err }) => {
      if (err) setError(err); else { setFacilities(fetched); setError(''); }
      setLoading(false);
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedId(null);
      setRoute(null);
      setRouteError('');
    }
  }, [isOpen]);

  const availableTypes = useMemo(() => {
    const set = new Set(facilities.map((f) => facilityTypeLabel(f.type)));
    return [...set];
  }, [facilities]);

  // Real configured specialties only — derived from the same doctor_profiles
  // rows fetchMapFacilities() already aggregates per facility, not a
  // separately maintained list.
  const availableSpecialties = useMemo(() => {
    const set = new Set(facilities.flatMap((f) => f.specialties));
    return [...set].sort();
  }, [facilities]);

  const withDistance = useMemo(() => {
    return facilities.map((f) => ({
      ...f,
      distanceKm: geo.coords ? haversineDistanceKm(geo.coords.lat, geo.coords.lng, f.lat, f.lng) : null,
    }));
  }, [facilities, geo.coords]);

  const filtered = useMemo(() => {
    let list = withDistance.filter((f) => {
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || f.name.toLowerCase().includes(q) || f.region.toLowerCase().includes(q) || f.specialties.some((s) => s.toLowerCase().includes(q));
      const matchesType = typeFilter === 'all' || facilityTypeLabel(f.type) === typeFilter;
      const matchesSpecialty = specialtyFilter === 'all' || f.specialties.includes(specialtyFilter);
      return matchesQuery && matchesType && matchesSpecialty;
    });
    if (nearMeOnly && geo.coords) {
      list = [...list].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
    return list;
  }, [withDistance, query, typeFilter, specialtyFilter, nearMeOnly, geo.coords]);

  const selected = filtered.find((f) => f.id === selectedId) || withDistance.find((f) => f.id === selectedId) || null;

  const handleSelect = (facility: MapFacility) => {
    setSelectedId(facility.id);
    setFlyTarget([facility.lat, facility.lng]);
    setRoute(null);
    setRouteError('');
  };

  const handleNearMe = () => {
    setNearMeOnly(true);
    geo.request();
  };

  useEffect(() => {
    if (geo.state === 'available' && geo.coords) setFlyTarget([geo.coords.lat, geo.coords.lng]);
  }, [geo.state, geo.coords]);

  const handleGetDirections = async (facility: MapFacility) => {
    if (!geo.coords) {
      geo.request();
      return;
    }
    setRouteLoading(true);
    setRouteError('');
    const { route: result, error: err } = await getDrivingRoute(geo.coords.lat, geo.coords.lng, facility.lat, facility.lng);
    setRouteLoading(false);
    if (err || !result) { setRouteError(isSw ? 'Imeshindwa kupata njia.' : "We couldn't calculate a driving route."); return; }
    setRoute({ facilityId: facility.id, result });
  };

  const handleStartExternalDirections = (facility: MapFacility) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  const tileLayers: TileLayerConfig[] = satellite ? [NIACARE_SATELLITE_LAYER] : (isDark ? NIACARE_MAP_TILE_LAYERS_DARK : NIACARE_MAP_TILE_LAYERS);
  const activeTile = tileLayers[Math.min(tileLayerIndex, tileLayers.length - 1)];

  const handleTileError = () => {
    setTileErrorCount((prev) => {
      const next = prev + 1;
      if (next > 5) {
        if (tileLayerIndex + 1 < tileLayers.length) {
          setTileLayerIndex((i) => i + 1);
          return 0;
        }
        setMapUnavailable(true);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-200">
      <style>{`
        @keyframes nc-marker-pulse { 0% { transform: scale(0.6); opacity: 0.6; } 100% { transform: scale(1.6); opacity: 0; } }
        .nc-map-dark-tiles .leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
      `}</style>
      <div className="nc-card w-full max-w-2xl h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 flex items-center justify-between bg-primary text-white flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <MapPin className="w-5 h-5 flex-shrink-0" />
            <h3 className="text-sm font-bold truncate">{isSw ? 'Huduma za Afya Karibu' : 'Nearby Healthcare'}</h3>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setView(view === 'map' ? 'list' : 'map')}
              className="flex items-center gap-1 rounded-lg bg-white/15 hover:bg-white/25 px-2.5 py-1.5 text-[11px] font-bold"
            >
              {view === 'map' ? <><ListIcon className="w-3.5 h-3.5" /> {isSw ? 'Orodha' : 'List'}</> : <><MapIcon className="w-3.5 h-3.5" /> {isSw ? 'Ramani' : 'Map'}</>}
            </button>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3 border-b nc-border flex-shrink-0 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isSw ? 'Tafuta hospitali, kliniki, maabara...' : 'Search hospitals, clinics, laboratories…'}
              className="nc-input w-full pl-8 pr-3 py-2 text-xs"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={handleNearMe}
              className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap ${
                nearMeOnly ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]' : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              {isSw ? 'Karibu Nami' : 'Near Me'}
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap ${
                typeFilter === 'all' ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]' : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              {isSw ? 'Zote' : 'All'}
            </button>
            {availableTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap ${
                  typeFilter === t ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]' : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {availableSpecialties.length > 0 && (
            <select
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              aria-label={isSw ? 'Chuja kwa Utaalamu' : 'Filter by specialty'}
              className="nc-input w-full py-2 px-3 text-xs"
            >
              <option value="all">{isSw ? 'Utaalamu Wote' : 'All Specialties'}</option>
              {availableSpecialties.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {geo.state === 'denied' && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              {isSw ? 'Ruhusa ya eneo imekataliwa. Tafuta kwa jina badala yake.' : 'Location permission denied — search by name instead.'}
            </p>
          )}
          {(geo.state === 'error' || geo.state === 'unavailable') && (
            <p className="text-[11px] text-rose-600">{isSw ? 'Imeshindwa kupata eneo lako.' : "Unable to access your location."}</p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {loading && (
            <div className="p-3 flex-1 overflow-y-auto"><LoadingSkeleton rows={4} /></div>
          )}

          {!loading && error && (
            <div className="p-4 flex-1 flex items-center justify-center">
              <EmptyState icon={AlertTriangle} title={isSw ? 'Imeshindwa Kupakia' : 'Unable to Load Facilities'} description={error} />
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="p-4 flex-1 flex items-center justify-center">
              <EmptyState
                icon={Building2}
                title={isSw ? 'Hakuna Vituo' : 'No Facilities Found'}
                description={isSw ? 'Hatukupata vituo karibu. Jaribu utafutaji tofauti.' : "We couldn't find facilities matching this search."}
                action={{ label: isSw ? 'Futa Vichujio' : 'Clear Filters', onClick: () => { setQuery(''); setTypeFilter('all'); setSpecialtyFilter('all'); setNearMeOnly(false); } }}
              />
            </div>
          )}

          {!loading && !error && filtered.length > 0 && view === 'map' && (
            mapUnavailable ? (
              <div className="p-4 flex-1 flex items-center justify-center">
                <EmptyState
                  icon={AlertTriangle}
                  title={isSw ? 'Ramani Haipatikani kwa Sasa' : 'Map Temporarily Unavailable'}
                  description={isSw ? 'Tumia orodha badala yake.' : 'Use the facility list instead while we reconnect.'}
                  action={{ label: isSw ? 'Ona Orodha' : 'View Facilities List', onClick: () => setView('list') }}
                />
              </div>
            ) : (
              <div className={`relative flex-1 min-h-0 ${isDark && !satellite ? 'nc-map-dark-tiles' : ''}`}>
                <MapContainer center={TANZANIA_CENTER} zoom={TANZANIA_DEFAULT_ZOOM} className="h-full w-full" zoomControl={false}>
                  <TileLayer
                    key={activeTile.id}
                    url={activeTile.url}
                    attribution={activeTile.attribution}
                    maxZoom={activeTile.maxZoom}
                    subdomains={activeTile.subdomains as any}
                    eventHandlers={{ tileerror: handleTileError }}
                  />
                  <MapController flyTo={flyTarget} zoomAction={zoomAction} />
                  {geo.coords && <Marker position={[geo.coords.lat, geo.coords.lng]} icon={patientIcon} />}
                  {filtered.map((f) => (
                    <Marker
                      key={f.id}
                      position={[f.lat, f.lng]}
                      icon={facilityIcon(f.id === selectedId)}
                      eventHandlers={{ click: () => handleSelect(f) }}
                    />
                  ))}
                </MapContainer>

                <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-[400]">
                  <button type="button" onClick={() => setZoomAction((prev) => ({ dir: 1, nonce: (prev?.nonce || 0) + 1 }))} title={isSw ? 'Kuza' : 'Zoom in'} className={`w-8 h-8 rounded-lg shadow-md flex items-center justify-center ${isDark ? 'bg-[#0B1522] text-white' : 'bg-white text-slate-700'}`}>
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setZoomAction((prev) => ({ dir: -1, nonce: (prev?.nonce || 0) + 1 }))} title={isSw ? 'Punguza' : 'Zoom out'} className={`w-8 h-8 rounded-lg shadow-md flex items-center justify-center ${isDark ? 'bg-[#0B1522] text-white' : 'bg-white text-slate-700'}`}>
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNearMe}
                    title={isSw ? 'Nionyeshe' : 'Locate me'}
                    className={`w-8 h-8 rounded-lg shadow-md flex items-center justify-center ${geo.state === 'requesting' ? 'opacity-60' : ''} ${isDark ? 'bg-[#0B1522] text-white' : 'bg-white text-slate-700'}`}
                    disabled={geo.state === 'requesting'}
                  >
                    {geo.state === 'requesting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Locate className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSatellite((s) => !s)}
                    title={isSw ? 'Satelaiti' : 'Satellite'}
                    className={`w-8 h-8 rounded-lg shadow-md flex items-center justify-center ${satellite ? 'bg-[var(--nc-primary)] text-white' : isDark ? 'bg-[#0B1522] text-white' : 'bg-white text-slate-700'}`}
                  >
                    <Layers className="w-4 h-4" />
                  </button>
                </div>

                {selected && (
                  <div className={`absolute left-2 right-2 bottom-2 rounded-2xl border shadow-2xl p-3.5 z-[400] ${isDark ? 'bg-[#0B1522] border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{selected.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-wrap">
                          <ShieldCheck className="w-3 h-3 text-primary flex-shrink-0" /> {facilityTypeLabel(selected.type)}
                          {selected.distanceKm !== null && <span>• ~{selected.distanceKm} km {isSw ? '(makadirio)' : '(estimate)'}</span>}
                          {selected.nhifEnabled && <span>• NHIF</span>}
                        </p>
                      </div>
                      <button type="button" onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {selected.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selected.specialties.slice(0, 4).map((s) => (
                          <span key={s} className="text-[10px] font-bold rounded-md bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light px-1.5 py-0.5">{s}</span>
                        ))}
                      </div>
                    )}
                    {onViewFacilityProfile && selected.doctorCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onViewFacilityProfile(selected)}
                        className="text-[11px] font-bold text-primary dark:text-primary-light underline underline-offset-2 mb-2 block"
                      >
                        {isSw
                          ? `Madaktari ${selected.doctorCount} · Angalia Wasifu wa Kituo`
                          : `${selected.doctorCount} doctor${selected.doctorCount === 1 ? '' : 's'} · View Facility Profile`}
                      </button>
                    )}
                    {route?.facilityId === selected.id && (
                      <p className="text-[11px] text-primary dark:text-primary-light font-bold mb-2">
                        {isSw ? 'Njia ya barabara' : 'Road route'}: {route.result.distanceKm} km • ~{route.result.durationMin} min
                      </p>
                    )}
                    {routeError && <p className="text-[11px] text-rose-600 mb-2">{routeError}</p>}
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleGetDirections(selected)}
                        disabled={routeLoading}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-2 text-[11px] font-bold disabled:opacity-50"
                      >
                        {routeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />} {isSw ? 'Njia' : 'Directions'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartExternalDirections(selected)}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-2 text-[11px] font-bold"
                      >
                        {isSw ? 'Fungua Ramani' : 'Open in Maps'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onBookAtFacility(selected.name)}
                        className="flex-1 rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-2 py-2 text-[11px] font-bold"
                      >
                        {isSw ? 'Weka Miadi' : 'Book'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {!loading && !error && filtered.length > 0 && view === 'list' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filtered.map((f) => (
                <div key={f.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-bold text-slate-900 dark:text-white">{f.name}</p>
                    {f.distanceKm !== null && <span className="text-slate-400 flex-shrink-0">~{f.distanceKm} km</span>}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 mb-1.5">{facilityTypeLabel(f.type)} • {f.region}</p>
                  {f.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {f.specialties.slice(0, 4).map((s) => (
                        <span key={s} className="text-[10px] font-bold rounded-md bg-primary/5 dark:bg-primary/10 text-primary dark:text-primary-light px-1.5 py-0.5">{s}</span>
                      ))}
                    </div>
                  )}
                  {onViewFacilityProfile && f.doctorCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onViewFacilityProfile(f)}
                      className="text-[11px] font-bold text-primary dark:text-primary-light underline underline-offset-2 mb-2 block"
                    >
                      {isSw
                        ? `Madaktari ${f.doctorCount} · Angalia Wasifu wa Kituo`
                        : `${f.doctorCount} doctor${f.doctorCount === 1 ? '' : 's'} · View Facility Profile`}
                    </button>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setView('map'); handleSelect(f); }}
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1.5 font-bold"
                    >
                      {isSw ? 'Angalia' : 'View'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartExternalDirections(f)}
                      className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1.5 font-bold"
                    >
                      {isSw ? 'Njia' : 'Directions'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onBookAtFacility(f.name)}
                      className="flex-1 rounded-lg bg-[var(--nc-primary)] dark:bg-primary text-white dark:text-[#041D34] px-2 py-1.5 font-bold"
                    >
                      {isSw ? 'Weka Miadi' : 'Book'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
