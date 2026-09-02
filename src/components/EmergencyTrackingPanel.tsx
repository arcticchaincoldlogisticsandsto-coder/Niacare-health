import React, { useEffect, useRef, useState } from 'react';
import { PhoneCall, X, RadioTower } from 'lucide-react';
import { Language } from '../types';
import {
  fetchDispatch,
  subscribeToDispatch,
  cancelDispatch,
  DispatchRecord,
  DISPATCH_STATUS_ORDER,
} from '../lib/emergency';

interface EmergencyTrackingPanelProps {
  dispatchId: string;
  dispatchRef: string;
  language: Language;
  canCancel: boolean;
  onCancelled: () => void;
}

const STATUS_LABEL: Record<string, { en: string; sw: string }> = {
  dispatched: { en: 'Dispatch logged', sw: 'Ombi limepokelewa' },
  requested: { en: 'Ambulance requested', sw: 'Gari limeombwa' },
  accepted: { en: 'Request accepted', sw: 'Ombi limekubaliwa' },
  assigned: { en: 'Ambulance assigned', sw: 'Gari limepangwa' },
  en_route: { en: 'Ambulance en route', sw: 'Gari liko njiani' },
  arrived: { en: 'Ambulance arrived', sw: 'Gari limefika' },
  transporting: { en: 'Transporting patient', sw: 'Wanasafirisha mgonjwa' },
  completed: { en: 'Completed', sw: 'Imekamilika' },
  cancelled: { en: 'Cancelled', sw: 'Imesitishwa' },
};

// Conservative for low-end Android / slow networks — realtime (if it
// connects) makes this feel instant; polling is only the backstop.
const POLL_INTERVAL_MS = 12000;

export const EmergencyTrackingPanel: React.FC<EmergencyTrackingPanelProps> = ({
  dispatchId, dispatchRef, language, canCancel, onCancelled,
}) => {
  const isSw = language === 'sw';
  const [dispatch, setDispatch] = useState<DispatchRecord | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const poll = () => {
      if (document.hidden) return;
      fetchDispatch(dispatchId).then(({ dispatch: d }) => {
        if (mountedRef.current && d) setDispatch(d);
      });
    };

    poll();
    pollTimer = setInterval(poll, POLL_INTERVAL_MS);

    const { unsubscribe } = subscribeToDispatch(
      dispatchId,
      (d) => { if (mountedRef.current) setDispatch(d); },
      (connected) => { if (mountedRef.current) setLiveConnected(connected); }
    );

    const onVisibility = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      if (pollTimer) clearInterval(pollTimer);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [dispatchId]);

  const status = dispatch?.status || 'dispatched';
  const stepIndex = DISPATCH_STATUS_ORDER.indexOf(status as (typeof DISPATCH_STATUS_ORDER)[number]);
  const isCancelled = status === 'cancelled';
  const isTerminal = status === 'completed' || isCancelled;
  const cancelAllowed = canCancel && !isTerminal && (status === 'dispatched' || status === 'requested');

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError('');
    const { error } = await cancelDispatch(dispatchId);
    setCancelling(false);
    if (error) {
      setCancelError(isSw ? 'Imeshindwa kusitisha. Jaribu tena.' : 'Unable to cancel. Try again.');
      return;
    }
    onCancelled();
  };

  return (
    <div className="bg-white border-2 border-slate-900 rounded-xl p-4 text-left space-y-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {isSw ? 'Nambari ya Rejea' : 'Reference'}
          </span>
          <p className="font-mono text-sm font-bold text-slate-900">{dispatchRef}</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
          {liveConnected ? (
            <span className="flex items-center gap-1 text-emerald-700">
              <RadioTower className="w-3 h-3" /> {isSw ? 'Moja kwa moja' : 'Live'}
            </span>
          ) : (
            <span className="text-slate-400">{isSw ? 'Inasasishwa kila sekunde 12' : 'Updating every 12s'}</span>
          )}
        </div>
      </div>

      <div>
        <p className={`font-bold text-sm ${isCancelled ? 'text-slate-500' : 'text-slate-900'}`}>
          {(STATUS_LABEL[status] || STATUS_LABEL.dispatched)[isSw ? 'sw' : 'en']}
        </p>
        {!isCancelled && (
          <div className="flex items-center gap-1 mt-2" role="img" aria-label={`${isSw ? 'Hatua' : 'Stage'} ${stepIndex + 1} / ${DISPATCH_STATUS_ORDER.length}`}>
            {DISPATCH_STATUS_ORDER.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-sm ${i <= stepIndex ? 'bg-red-600' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs border-t border-slate-100 pt-3">
        <div>
          <span className="block text-slate-400">{isSw ? 'Kituo cha Marudio' : 'Destination Facility'}</span>
          <span className="font-semibold text-slate-900">{dispatch?.targetFacility || (isSw ? 'Inatafutwa...' : 'Being determined…')}</span>
        </div>
        <div>
          <span className="block text-slate-400">{isSw ? 'Umbali' : 'Distance'}</span>
          <span className="font-semibold text-slate-900">
            {dispatch?.facilityDistanceKm != null ? `${dispatch.facilityDistanceKm} km` : '—'}
          </span>
        </div>
        <div>
          <span className="block text-slate-400">{isSw ? 'Muda wa Ombi' : 'Requested'}</span>
          <span className="font-semibold text-slate-900">
            {dispatch ? new Date(dispatch.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </div>
        <div>
          <span className="block text-slate-400">{isSw ? 'Ilisasishwa' : 'Last Updated'}</span>
          <span className="font-semibold text-slate-900">
            {dispatch ? new Date(dispatch.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <span className="text-slate-500">{isSw ? 'Kituo cha Dharura' : 'Emergency Contact'}</span>
        <a href="tel:+255754112999" className="font-bold text-red-700 flex items-center gap-1">
          <PhoneCall className="w-3.5 h-3.5" /> +255 754 112 999
        </a>
      </div>

      {cancelAllowed && (
        <div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full border border-slate-300 text-slate-700 py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <X className="w-3.5 h-3.5" /> {cancelling ? (isSw ? 'Inasitisha...' : 'Cancelling…') : (isSw ? 'Sitisha Ombi' : 'Cancel Request')}
          </button>
          {cancelError && <p className="text-red-600 text-[11px] mt-1 text-center">{cancelError}</p>}
        </div>
      )}
    </div>
  );
};
