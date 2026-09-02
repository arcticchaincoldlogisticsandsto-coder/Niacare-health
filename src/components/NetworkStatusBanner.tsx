import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Language } from '../types';
import { useNetworkStatus } from '../lib/useNetworkStatus';

interface NetworkStatusBannerProps {
  language: Language;
}

// Mounted once, globally (see App.tsx) — a subtle top banner, not a modal
// or a blocking overlay, so the rest of the app stays usable while offline
// (already-loaded screens, cached reads, local navigation all still work;
// only actions that need the network will surface their own error when
// attempted).
export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({ language }) => {
  const status = useNetworkStatus();
  const isSw = language === 'sw';

  if (status === 'online') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[200] flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white ${
        status === 'offline' ? 'bg-rose-600' : 'bg-amber-500'
      }`}
    >
      {status === 'offline' ? (
        <>
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{isSw ? 'Huna mtandao. Baadhi ya taarifa haziwezi kupatikana.' : "You're offline. Some information may be unavailable until your connection returns."}</span>
        </>
      ) : (
        <>
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
          <span>{isSw ? 'Inaunganisha tena...' : 'Reconnecting…'}</span>
        </>
      )}
    </div>
  );
};
