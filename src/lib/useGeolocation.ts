import { useCallback, useState } from 'react';

export type GeolocationState = 'idle' | 'requesting' | 'available' | 'denied' | 'unavailable' | 'error';

export interface GeolocationResult {
  state: GeolocationState;
  coords: { lat: number; lng: number } | null;
  errorMessage: string | null;
  request: () => void;
}

// Only requests permission when `request()` is actually called — per spec,
// geolocation should be asked for at the moment a feature needs it (the
// facility map), never on page load. Distinguishes "denied" from "other
// error" so the UI can give the right recovery action for each (denied ->
// point at browser settings, error/unavailable -> offer manual search).
export const useGeolocation = (): GeolocationResult => {
  const [state, setState] = useState<GeolocationState>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState('unavailable');
      setErrorMessage('Geolocation is not supported on this device.');
      return;
    }
    setState('requesting');
    setErrorMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setState('available');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState('denied');
          setErrorMessage('Location permission was denied.');
        } else {
          setState('error');
          setErrorMessage('Could not determine your location.');
        }
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  return { state, coords, errorMessage, request };
};
