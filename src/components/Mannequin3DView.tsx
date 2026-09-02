import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { descriptiveRegionLabel } from '../data/bodyRegionHierarchy';
import { bodyMapRegionKey } from '../lib/bodyMap';
import { MannequinViewer, HOTSPOTS_3D_FRONT, HOTSPOTS_3D_BACK, isWebGLAvailable, Hotspot3D } from '../lib/bodyMap3d';
import { resolveBodyModelSource } from './body-map/bodyModelAdapter';

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
      viewer = new MannequinViewer(
        containerRef.current,
        {
          onHover: (key) => setHoveredKey(key),
          onSelect: (h) => {
            if (!h) { onSelectKey(null); return; }
            const key = bodyMapRegionKey(h.key, h.side || null);
            onSelectKey(key);
          },
          onError: () => { setStatus('error'); onStatus('unavailable'); },
        },
        // undefined today (no VITE_ANATOMICAL_MODEL_URL configured — see
        // docs/body-map-assets.md for why) — MannequinViewer then builds
        // the procedural body exactly as it always has.
        resolveBodyModelSource()
      );
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
    <div
      className="relative w-full h-[360px] sm:h-[420px] lg:h-[440px] overflow-hidden"
      style={{ background: 'var(--nc-stage-bg)', border: '1px solid var(--nc-stage-border)', borderRadius: 'var(--nc-radius-card)' }}
    >
      <div
        ref={containerRef}
        role="img"
        aria-label={isSw ? 'Muundo wa mwili wa 3D unaozunguka' : 'Rotatable 3D body model'}
        className="absolute inset-0 touch-none"
      />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center gap-1.5" style={{ color: 'var(--nc-stage-text)' }}>
          <Loader2 className="w-4 h-4 animate-spin" /> {isSw ? 'Inapakia Ramani ya Afya...' : 'Loading Health Map…'}
        </div>
      )}

      {status === 'ready' && (
        <>
          {hoveredKey && (
            <div
              className="absolute top-3 left-3 rounded-md px-2 py-1 text-[11px] font-semibold bg-white/90 border"
              style={{ color: 'var(--nc-text)', borderColor: 'var(--nc-stage-border)' }}
            >
              {descriptiveRegionLabel(hoveredKey.split(':')[0], hoveredKey.split(':')[1], isSw)}
            </div>
          )}

          {/* Vertical control cluster — a small light instrument panel
              docked to the stage, not page chrome sitting below the
              model, and colored for a light stage rather than the
              earlier dark-overlay treatment. */}
          <div
            className="absolute top-3 right-3 flex flex-col items-center gap-0.5 rounded-lg bg-white/90 border p-0.5"
            style={{ borderColor: 'var(--nc-stage-border)' }}
          >
            <button
              type="button"
              onClick={() => viewerRef.current?.zoomStep('in')}
              aria-label={isSw ? 'Kuza' : 'Zoom in'}
              title={isSw ? 'Kuza' : 'Zoom in'}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => viewerRef.current?.resetView()}
              aria-label={isSw ? 'Rudisha Mwonekano' : 'Reset view'}
              title={isSw ? 'Rudisha Mwonekano' : 'Reset view'}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => viewerRef.current?.zoomStep('out')}
              aria-label={isSw ? 'Punguza' : 'Zoom out'}
              title={isSw ? 'Punguza' : 'Zoom out'}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Mannequin3DView;
