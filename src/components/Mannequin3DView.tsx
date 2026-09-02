import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { bodyRegionLabel } from '../data/bodyRegions';
import { MannequinViewer, HOTSPOTS_3D_FRONT, HOTSPOTS_3D_BACK, isWebGLAvailable, Hotspot3D } from '../lib/bodyMap3d';

// Split into its own module (default export, dynamically imported via
// React.lazy from BodyMapModal) specifically so `three` and this component
// only ever download when a patient actually opens the Body Map — bundled
// statically, this pulled ~530KB (133KB gzipped) into the app's main
// chunk, loaded on every single page view regardless of whether Body Map
// is ever opened. That's a real cost for the low-end-device/slow-network
// audience this app targets, not a hypothetical one.

const regionKey = (region: string, side: string | null) => `${region}:${side || 'none'}`;

interface Mannequin3DViewProps {
  view: 'front' | 'back';
  markedKeys: Set<string>;
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
  onStatus: (status: 'checking' | 'ready' | 'unavailable') => void;
  isSw: boolean;
}

const Mannequin3DView: React.FC<Mannequin3DViewProps> = ({ view, markedKeys, selectedKey, onSelectKey, onStatus, isSw }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<MannequinViewer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!isWebGLAvailable()) {
      setStatus('error');
      onStatus('unavailable');
      return;
    }
    let viewer: MannequinViewer | null = null;
    try {
      viewer = new MannequinViewer(containerRef.current, {
        onHover: (key) => setHoveredKey(key),
        onSelect: (h) => {
          if (!h) { onSelectKey(null); return; }
          const key = regionKey(h.key, h.side || null);
          onSelectKey(key);
        },
        onError: () => { setStatus('error'); onStatus('unavailable'); },
      });
      viewerRef.current = viewer;
      setStatus('ready');
      onStatus('ready');
    } catch {
      setStatus('error');
      onStatus('unavailable');
    }
    return () => {
      viewer?.dispose();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!viewerRef.current) return;
    const hotspots: Hotspot3D[] = view === 'front' ? HOTSPOTS_3D_FRONT : HOTSPOTS_3D_BACK;
    viewerRef.current.setHotspots(hotspots, (key, side) => regionKey(key, side || null));
    viewerRef.current.setMarkedKeys(markedKeys);
    viewerRef.current.setCameraFacing(view);
  }, [view, markedKeys]);

  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.setSelectedKey(selectedKey);
    viewerRef.current.setMarkedKeys(markedKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  if (status === 'error') {
    return (
      <p className="text-center text-slate-400 py-6">
        {isSw ? 'Muundo wa 3D haupatikani kwenye kifaa hiki.' : '3D Body Map unavailable on this device — showing the 2D Body Map instead.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center mb-3">
      <div
        ref={containerRef}
        role="img"
        aria-label={isSw ? 'Muundo wa mwili wa 3D unaozunguka' : 'Rotatable 3D body model'}
        className="relative w-full max-w-[280px] h-[340px] rounded-xl overflow-hidden touch-none"
        style={{ background: 'color-mix(in srgb, var(--nc-primary) 4%, var(--nc-surface-elevated))' }}
      >
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-1.5 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> {isSw ? 'Inapakia muundo...' : 'Loading body model…'}
          </div>
        )}
      </div>
      {status === 'ready' && (
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => viewerRef.current?.resetView()}
            className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {isSw ? 'Rudisha Mwonekano' : 'Reset View'}
          </button>
          {hoveredKey && (
            <span className="text-primary dark:text-primary-light font-semibold">
              {bodyRegionLabel(hoveredKey.split(':')[0], isSw)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Mannequin3DView;
