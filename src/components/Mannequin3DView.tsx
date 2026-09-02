import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { descriptiveRegionLabel } from '../data/bodyRegionHierarchy';
import { bodyMapRegionKey } from '../lib/bodyMap';
import { MannequinViewer, HOTSPOTS_3D_FRONT, HOTSPOTS_3D_BACK, isWebGLAvailable, Hotspot3D } from '../lib/bodyMap3d';

// Split into its own module (default export, dynamically imported via
// React.lazy from BodyMapModal) specifically so `three` and this component
// only ever download when a patient actually opens the Body Map — bundled
// statically, this pulled ~530KB (133KB gzipped) into the app's main
// chunk, loaded on every single page view regardless of whether Body Map
// is ever opened. That's a real cost for the low-end-device/slow-network
// audience this app targets, not a hypothetical one.

interface Mannequin3DViewProps {
  view: 'front' | 'back';
  /** regionKey -> number of records tagged there. A "health activity" indicator only, never a severity signal — see setMarkedKeys in bodyMap3d.ts. */
  markedCounts: Map<string, number>;
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
  onStatus: (status: 'checking' | 'ready' | 'unavailable') => void;
  isSw: boolean;
}

const Mannequin3DView: React.FC<Mannequin3DViewProps> = ({ view, markedCounts, selectedKey, onSelectKey, onStatus, isSw }) => {
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
          const key = bodyMapRegionKey(h.key, h.side || null);
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
    viewerRef.current.setHotspots(hotspots, (key, side) => bodyMapRegionKey(key, side || null));
    viewerRef.current.setMarkedKeys(markedCounts);
    viewerRef.current.setCameraFacing(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.setMarkedKeys(markedCounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markedCounts]);

  useEffect(() => {
    if (!viewerRef.current) return;
    viewerRef.current.setSelectedKey(selectedKey);
    viewerRef.current.setMarkedKeys(markedCounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  if (status === 'error') {
    return (
      <p className="text-center text-slate-400 py-6">
        {isSw ? 'Ramani ya Afya ya 3D haipatikani kwenye kifaa hiki.' : '3D Health Map unavailable on this device — showing the 2D Body Map instead.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div
        ref={containerRef}
        role="img"
        aria-label={isSw ? 'Muundo wa mwili wa 3D unaozunguka' : 'Rotatable 3D body model'}
        className="relative w-full h-[360px] sm:h-[420px] overflow-hidden touch-none"
        style={{ background: 'color-mix(in srgb, var(--nc-primary) 3%, var(--nc-surface-elevated))', borderRadius: 'var(--nc-radius-card)' }}
      >
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-1.5 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> {isSw ? 'Inapakia Ramani ya Afya...' : 'Loading Health Map…'}
          </div>
        )}
      </div>
      {status === 'ready' && (
        <div className="flex items-center justify-between w-full mt-2">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => viewerRef.current?.zoomStep('out')}
              aria-label={isSw ? 'Punguza' : 'Zoom out'}
              title={isSw ? 'Punguza' : 'Zoom out'}
              className="nc-btn-icon"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => viewerRef.current?.zoomStep('in')}
              aria-label={isSw ? 'Kuza' : 'Zoom in'}
              title={isSw ? 'Kuza' : 'Zoom in'}
              className="nc-btn-icon"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => viewerRef.current?.resetView()}
              aria-label={isSw ? 'Rudisha Mwonekano' : 'Reset view'}
              title={isSw ? 'Rudisha Mwonekano' : 'Reset view'}
              className="nc-btn-icon"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          <span className="text-[11px] font-semibold text-primary dark:text-primary-light truncate max-w-[55%] text-right">
            {hoveredKey ? descriptiveRegionLabel(hoveredKey.split(':')[0], hoveredKey.split(':')[1], isSw) : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default Mannequin3DView;
