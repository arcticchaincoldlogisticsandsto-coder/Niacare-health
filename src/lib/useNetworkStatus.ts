import { useEffect, useState } from 'react';

export type NetworkStatus = 'online' | 'offline' | 'reconnecting';

// Wraps the browser's own online/offline signal (navigator.onLine + the
// window online/offline events) rather than polling anything — this is
// accurate for "is there a network interface at all", which is the real
// question for "should I tell the patient they're offline", not a proxy
// for "can I reach Supabase" (a request-level retry/error is the right
// signal for that, handled separately per-request, not here).
export const useNetworkStatus = (): NetworkStatus => {
  const [status, setStatus] = useState<NetworkStatus>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'
  );

  useEffect(() => {
    const handleOffline = () => setStatus('offline');
    const handleOnline = () => {
      setStatus('reconnecting');
      // A brief "reconnecting" beat before settling to "online" — the
      // browser event fires the instant a network interface reappears,
      // which is often before real connectivity (e.g. a phone rejoining
      // wifi) is actually usable.
      window.setTimeout(() => setStatus('online'), 1500);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return status;
};

// Wraps a promise with a timeout so a hung request (common on weak mobile
// networks) fails fast with a clear error instead of spinning forever.
export const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number = 15000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
};
