// Real road-network driving distance & ETA via OSRM (Open Source Routing
// Machine)'s public demo server — no API key needed, actual road routing
// (not straight-line distance). Ambulances travel roads, not great circles.
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
}

const formatKm = (meters: number): number => Math.round((meters / 1000) * 10) / 10;
const formatMin = (seconds: number): number => Math.max(1, Math.round(seconds / 60));

/**
 * A rough ambulance-response speed factor: emergency vehicles run faster
 * than OSRM's default car-routing profile (which assumes ordinary traffic
 * conditions), so the raw OSRM ETA is scaled down a bit for a more
 * realistic emergency-response estimate.
 */
const EMERGENCY_SPEED_FACTOR = 0.8;

export const getDrivingRoute = async (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<{ route?: RouteResult; error?: string }> => {
  try {
    const url = `${OSRM_BASE_URL}/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) return { error: `Routing service returned ${res.status}` };

    const data = await res.json();
    const leg = data?.routes?.[0];
    if (!leg) return { error: 'No route found' };

    return {
      route: {
        distanceKm: formatKm(leg.distance),
        durationMin: formatMin(leg.duration * EMERGENCY_SPEED_FACTOR),
      },
    };
  } catch {
    return { error: 'Failed to reach routing service' };
  }
};

/**
 * Computes real routes from one origin to several destinations in parallel.
 * Any individual failed lookup is simply omitted from the result.
 */
export const getDrivingRoutesToMany = async (
  fromLat: number,
  fromLng: number,
  destinations: { lat: number; lng: number }[]
): Promise<(RouteResult | null)[]> => {
  const results = await Promise.all(
    destinations.map((d) => getDrivingRoute(fromLat, fromLng, d.lat, d.lng))
  );
  return results.map((r) => r.route || null);
};
