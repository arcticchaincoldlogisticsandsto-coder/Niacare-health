import { supabase } from './supabaseClient';

export interface MapFacility {
  id: string;
  name: string;
  region: string;
  type: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  nhifEnabled: boolean;
  lat: number;
  lng: number;
  specialties: string[];
  doctorCount: number;
}

// Real providers only — rows with no coordinates are excluded rather than
// plotted at (0,0)/null island, since a facility with an unset lat/lng in
// the database is a data-entry gap, not a real location.
export const fetchMapFacilities = async (): Promise<{ facilities: MapFacility[]; error?: string }> => {
  const { data: providers, error: providerErr } = await supabase
    .from('providers')
    .select('id, name, region, type, address, phone, emergency_phone, nhif_enabled, lat, lng')
    .eq('is_active', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null);
  if (providerErr) return { facilities: [], error: providerErr.message };

  const providerIds = (providers || []).map((p) => p.id);
  const specialtiesByProvider = new Map<string, Set<string>>();
  const doctorCountByProvider = new Map<string, number>();
  if (providerIds.length > 0) {
    const { data: doctors } = await supabase
      .from('doctor_profiles')
      .select('provider_id, specialty')
      .in('provider_id', providerIds)
      .eq('is_active', true);
    for (const d of doctors || []) {
      if (!d.provider_id) continue;
      if (!specialtiesByProvider.has(d.provider_id)) specialtiesByProvider.set(d.provider_id, new Set());
      specialtiesByProvider.get(d.provider_id)!.add(d.specialty);
      doctorCountByProvider.set(d.provider_id, (doctorCountByProvider.get(d.provider_id) || 0) + 1);
    }
  }

  return {
    facilities: (providers || []).map((p) => ({
      id: p.id,
      name: p.name,
      region: p.region,
      type: p.type,
      address: p.address || '',
      phone: p.phone || '',
      emergencyPhone: p.emergency_phone || '',
      nhifEnabled: p.nhif_enabled,
      lat: p.lat as number,
      lng: p.lng as number,
      specialties: [...(specialtiesByProvider.get(p.id) || [])].sort(),
      doctorCount: doctorCountByProvider.get(p.id) || 0,
    })),
  };
};

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Straight-line ("as the crow flies") distance — used only as a fast
// client-side sort key and as an explicitly-labeled estimate when the real
// OSRM road-routing lookup (src/lib/routing.ts) hasn't resolved yet or
// fails. Never presented to the patient as a driving distance on its own.
export const haversineDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
};
