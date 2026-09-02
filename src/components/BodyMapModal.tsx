import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { X, PersonStanding, Scan, Stethoscope, Box, Squircle, Loader2 } from 'lucide-react';
import { Language } from '../types';
import { fetchBodyMapEntries, bodyMapRegionKey, BodyMapEntry } from '../lib/bodyMap';
import { descriptiveRegionLabel } from '../data/bodyRegionHierarchy';
import { withTimeout } from '../lib/useNetworkStatus';

// Lazily loaded — see Mannequin3DView.tsx's own header comment. This keeps
// `three` (and this whole viewer) out of the app's main bundle entirely
// until a patient actually opens the Body Map.
const Mannequin3DView = React.lazy(() => import('./Mannequin3DView'));

interface BodyMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string | null;
  language: Language;
  onViewHealthJourney?: () => void;
  /** Deep-link from a Health Journey entry — e.g. "knee:left" — pre-selects
   * that region as soon as the modal opens instead of landing on the blank
   * default state. Optimistic: set immediately, not held back until entries
   * finish loading — if it turns out to have no records, the existing empty
   * state ("No records are linked to this body area yet") covers it. */
  initialRegionKey?: string | null;
}

// 2D fallback hotspots — used when WebGL is unavailable, the 3D viewer
// fails to initialize, or the patient explicitly switches to 2D. Same
// simplified-outline convention as before: a documentation/navigation
// aid, not anatomy.
const HOTSPOTS: { key: string; side?: 'left' | 'right'; shape: 'circle' | 'rect'; x: number; y: number; w?: number; h?: number; r?: number }[] = [
  { key: 'head', shape: 'circle', x: 100, y: 32, r: 22 },
  { key: 'neck', shape: 'rect', x: 90, y: 54, w: 20, h: 14 },
  { key: 'chest', shape: 'rect', x: 68, y: 70, w: 64, h: 40 },
  { key: 'heart', shape: 'circle', x: 92, y: 92, r: 9 },
  { key: 'lungs', side: 'left', shape: 'circle', x: 78, y: 88, r: 10 },
  { key: 'lungs', side: 'right', shape: 'circle', x: 122, y: 88, r: 10 },
  { key: 'abdomen', shape: 'rect', x: 72, y: 112, w: 56, h: 40 },
  { key: 'shoulder', side: 'left', shape: 'circle', x: 58, y: 76, r: 11 },
  { key: 'shoulder', side: 'right', shape: 'circle', x: 142, y: 76, r: 11 },
  { key: 'arm', side: 'left', shape: 'rect', x: 38, y: 90, w: 18, h: 70 },
  { key: 'arm', side: 'right', shape: 'rect', x: 144, y: 90, w: 18, h: 70 },
  { key: 'elbow', side: 'left', shape: 'circle', x: 47, y: 164, r: 9 },
  { key: 'elbow', side: 'right', shape: 'circle', x: 153, y: 164, r: 9 },
  { key: 'wrist', side: 'left', shape: 'circle', x: 44, y: 218, r: 7 },
  { key: 'wrist', side: 'right', shape: 'circle', x: 156, y: 218, r: 7 },
  { key: 'hand', side: 'left', shape: 'circle', x: 43, y: 236, r: 9 },
  { key: 'hand', side: 'right', shape: 'circle', x: 157, y: 236, r: 9 },
  { key: 'hip', side: 'left', shape: 'rect', x: 72, y: 152, w: 24, h: 20 },
  { key: 'hip', side: 'right', shape: 'rect', x: 104, y: 152, w: 24, h: 20 },
  { key: 'thigh', side: 'left', shape: 'rect', x: 73, y: 174, w: 22, h: 60 },
  { key: 'thigh', side: 'right', shape: 'rect', x: 105, y: 174, w: 22, h: 60 },
  { key: 'knee', side: 'left', shape: 'circle', x: 84, y: 240, r: 10 },
  { key: 'knee', side: 'right', shape: 'circle', x: 116, y: 240, r: 10 },
  { key: 'leg', side: 'left', shape: 'rect', x: 76, y: 250, w: 18, h: 62 },
  { key: 'leg', side: 'right', shape: 'rect', x: 106, y: 250, w: 18, h: 62 },
  { key: 'ankle', side: 'left', shape: 'circle', x: 85, y: 316, r: 7 },
  { key: 'ankle', side: 'right', shape: 'circle', x: 115, y: 316, r: 7 },
  { key: 'foot', side: 'left', shape: 'circle', x: 85, y: 332, r: 9 },
  { key: 'foot', side: 'right', shape: 'circle', x: 115, y: 332, r: 9 },
];

const BACK_HOTSPOTS: typeof HOTSPOTS = [
  { key: 'head', shape: 'circle', x: 100, y: 32, r: 22 },
  { key: 'neck', shape: 'rect', x: 90, y: 54, w: 20, h: 14 },
  { key: 'back', shape: 'rect', x: 68, y: 70, w: 64, h: 82 },
  { key: 'spine', shape: 'rect', x: 96, y: 72, w: 8, h: 130 },
  { key: 'shoulder', side: 'left', shape: 'circle', x: 58, y: 76, r: 11 },
  { key: 'shoulder', side: 'right', shape: 'circle', x: 142, y: 76, r: 11 },
  { key: 'arm', side: 'left', shape: 'rect', x: 38, y: 90, w: 18, h: 70 },
  { key: 'arm', side: 'right', shape: 'rect', x: 144, y: 90, w: 18, h: 70 },
  { key: 'elbow', side: 'left', shape: 'circle', x: 47, y: 164, r: 9 },
  { key: 'elbow', side: 'right', shape: 'circle', x: 153, y: 164, r: 9 },
  { key: 'wrist', side: 'left', shape: 'circle', x: 44, y: 218, r: 7 },
  { key: 'wrist', side: 'right', shape: 'circle', x: 156, y: 218, r: 7 },
  { key: 'hand', side: 'left', shape: 'circle', x: 43, y: 236, r: 9 },
  { key: 'hand', side: 'right', shape: 'circle', x: 157, y: 236, r: 9 },
  { key: 'hip', side: 'left', shape: 'rect', x: 72, y: 152, w: 24, h: 20 },
  { key: 'hip', side: 'right', shape: 'rect', x: 104, y: 152, w: 24, h: 20 },
  { key: 'thigh', side: 'left', shape: 'rect', x: 73, y: 174, w: 22, h: 60 },
  { key: 'thigh', side: 'right', shape: 'rect', x: 105, y: 174, w: 22, h: 60 },
  { key: 'knee', side: 'left', shape: 'circle', x: 84, y: 240, r: 10 },
  { key: 'knee', side: 'right', shape: 'circle', x: 116, y: 240, r: 10 },
  { key: 'leg', side: 'left', shape: 'rect', x: 76, y: 250, w: 18, h: 62 },
  { key: 'leg', side: 'right', shape: 'rect', x: 106, y: 250, w: 18, h: 62 },
  { key: 'ankle', side: 'left', shape: 'circle', x: 85, y: 316, r: 7 },
  { key: 'ankle', side: 'right', shape: 'circle', x: 115, y: 316, r: 7 },
  { key: 'foot', side: 'left', shape: 'circle', x: 85, y: 332, r: 9 },
  { key: 'foot', side: 'right', shape: 'circle', x: 115, y: 332, r: 9 },
];

export const BodyMapModal: React.FC<BodyMapModalProps> = ({ isOpen, onClose, patientId, language, onViewHealthJourney, initialRegionKey }) => {
  const isSw = language === 'sw';
  const [entries, setEntries] = useState<BodyMapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [view, setView] = useState<'front' | 'back'>('front');
  // 3D is preferred; falls back to the existing 2D SVG on unsupported WebGL,
  // a viewer init failure, or the patient's own choice. Never silently
  // blank — one of the two always renders.
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [viewer3dStatus, setViewer3dStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking');

  useEffect(() => {
    if (!isOpen) { setSelectedKey(null); setView('front'); setViewMode('3d'); setViewer3dStatus('checking'); return; }
    setSelectedKey(initialRegionKey || null);
    // Regions that only exist on the back silhouette — everything else
    // (shoulders, limbs, etc.) is reachable from either facing, so 'front'
    // stays the default there.
    const region = initialRegionKey?.split(':')[0];
    setView(region === 'back' || region === 'spine' ? 'back' : 'front');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    withTimeout(fetchBodyMapEntries(patientId), 15000)
      .then(({ entries: fetched, error: err }) => {
        if (err) setError(err); else { setEntries(fetched); setError(''); }
        setLoading(false);
      })
      .catch(() => {
        setError(isSw ? 'Imeshindwa kupakia. Angalia mtandao wako.' : 'Unable to load the body map. Check your connection.');
        setLoading(false);
      });
  }, [isOpen, patientId, retryToken]);

  const entriesByRegion = useMemo(() => {
    const map = new Map<string, BodyMapEntry[]>();
    for (const e of entries) {
      const k = bodyMapRegionKey(e.bodyRegion, e.bodySide);
      map.set(k, [...(map.get(k) || []), e]);
    }
    return map;
  }, [entries]);

  if (!isOpen) return null;

  const activeEntries = selectedKey ? entriesByRegion.get(selectedKey) || [] : [];
  const markedKeys = new Set(entriesByRegion.keys());
  // Record COUNT per region, not just presence — feeds the 3D viewer's
  // "health activity" gradation (1 record vs. 2+ gets a marginally
  // stronger highlight; see setMarkedKeys in bodyMap3d.ts). Never a
  // severity signal, purely how many records are tagged there.
  const markedCounts = new Map<string, number>([...entriesByRegion].map(([k, v]) => [k, v.length]));
  const activeHotspots = view === 'front' ? HOTSPOTS : BACK_HOTSPOTS;
  const activeHotspotKeys = new Set(activeHotspots.map((h) => h.key));
  const offSilhouetteKeys = [...markedKeys].filter((k) => !activeHotspotKeys.has(k.split(':')[0]));
  // Every region with a real record, keyboard/screen-reader reachable
  // regardless of viewer mode — the 3D canvas has no native focusable DOM
  // element per hotspot, so this list is what actually satisfies "keyboard
  // users must be able to access the record system without requiring 3D
  // interaction."
  const allMarkedKeys = [...markedKeys];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="nc-card w-full max-w-lg lg:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 flex items-center justify-between bg-primary text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <PersonStanding className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">{isSw ? 'Ramani ya Mwili' : 'Body Map'}</h3>
              <p className="text-xs text-white/80">{isSw ? 'Gusa eneo kuona rekodi zake' : 'Tap a body area to view related health records'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={isSw ? 'Funga' : 'Close'} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto text-xs">
          {error && (
            <div role="alert" className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 dark:border-rose-900 p-2.5 mb-2">
              <p className="text-rose-600">{error}</p>
              <button type="button" onClick={() => setRetryToken((t) => t + 1)} className="font-bold text-primary dark:text-primary-light flex-shrink-0">
                {isSw ? 'Jaribu Tena' : 'Retry'}
              </button>
            </div>
          )}

          {/* Desktop (lg+): viewer dominant on the left, a real side panel
              on the right (Phase 18). Mobile: the same content stacks in
              document order — the side panel becomes the last section on
              the page, reading like a bottom sheet without a second
              overlay system. */}
          <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-5 lg:items-start">
          <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex gap-1.5">
              {(['front', 'back'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`rounded-lg px-4 py-1.5 font-semibold ${
                    view === v
                      ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {v === 'front' ? (isSw ? 'Mbele' : 'Front') : (isSw ? 'Nyuma' : 'Back')}
                </button>
              ))}
            </div>
            {viewer3dStatus === 'ready' && (
              <button
                type="button"
                onClick={() => setViewMode((m) => (m === '3d' ? '2d' : '3d'))}
                aria-pressed={viewMode === '3d'}
                title={viewMode === '3d' ? (isSw ? 'Tumia Ramani ya 2D' : 'Use 2D Body Map') : (isSw ? 'Tumia Muundo wa 3D' : 'Use 3D Model')}
                className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 font-semibold text-slate-500 dark:text-slate-400"
              >
                {viewMode === '3d' ? <Squircle className="w-3.5 h-3.5" /> : <Box className="w-3.5 h-3.5" />}
                {viewMode === '3d' ? '2D' : '3D'}
              </button>
            )}
          </div>

          {viewMode === '3d' ? (
            <Suspense
              fallback={
                <div className="flex items-center justify-center gap-1.5 text-slate-400 py-24">
                  <Loader2 className="w-4 h-4 animate-spin" /> {isSw ? 'Inapakia Ramani ya Afya...' : 'Loading Health Map…'}
                </div>
              }
            >
              <Mannequin3DView
                view={view}
                markedCounts={markedCounts}
                selectedKey={selectedKey}
                onSelectKey={setSelectedKey}
                onStatus={setViewer3dStatus}
                isSw={isSw}
              />
            </Suspense>
          ) : (
            <div className="flex justify-center mb-3">
              <svg viewBox="0 0 200 350" width="220" height="385" className="select-none">
                <g
                  fill="color-mix(in srgb, var(--nc-primary) 7%, var(--nc-surface-elevated))"
                  stroke="var(--nc-border-strong)"
                  strokeWidth="1.25"
                >
                  <ellipse cx="100" cy="30" rx="19" ry="21" />
                  <rect x="93" y="47" width="14" height="13" rx="5" />
                  <rect x="64" y="63" width="72" height="50" rx="22" />
                  <rect x="70" y="103" width="60" height="54" rx="18" />
                  <rect x="40" y="68" width="17" height="62" rx="8.5" />
                  <rect x="143" y="68" width="17" height="62" rx="8.5" />
                  <rect x="41" y="126" width="15" height="58" rx="7.5" />
                  <rect x="144" y="126" width="15" height="58" rx="7.5" />
                  <rect x="66" y="148" width="68" height="32" rx="16" />
                  <rect x="73" y="172" width="24" height="64" rx="12" />
                  <rect x="103" y="172" width="24" height="64" rx="12" />
                  <rect x="77" y="230" width="16" height="80" rx="8" />
                  <rect x="107" y="230" width="16" height="80" rx="8" />
                  <ellipse cx="85" cy="322" rx="10" ry="7" />
                  <ellipse cx="115" cy="322" rx="10" ry="7" />
                </g>
                {view === 'back' && (
                  <line x1="100" y1="66" x2="100" y2="195" stroke="var(--nc-border-strong)" strokeWidth="1.25" strokeDasharray="2,4" strokeLinecap="round" />
                )}

                {activeHotspots.map((h) => {
                  const key = bodyMapRegionKey(h.key, h.side || null);
                  const marked = markedKeys.has(key);
                  const isSelected = selectedKey === key;
                  const fill = isSelected
                    ? 'var(--nc-primary)'
                    : marked
                    ? 'color-mix(in srgb, var(--nc-primary) 30%, transparent)'
                    : 'transparent';
                  const stroke = isSelected || marked ? 'var(--nc-primary)' : 'transparent';
                  const label = descriptiveRegionLabel(h.key, h.side || null, isSw);
                  const activate = () => setSelectedKey(marked ? key : null);
                  const a11yProps = {
                    role: 'button' as const,
                    tabIndex: marked ? 0 : -1,
                    'aria-label': label,
                    'aria-pressed': isSelected,
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
                    },
                  };
                  const hoverClass = marked ? '' : 'hover:fill-primary/10 dark:hover:fill-primary/15';
                  return h.shape === 'circle' ? (
                    <circle
                      key={key}
                      cx={h.x}
                      cy={h.y}
                      r={h.r}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={1.5}
                      className={`cursor-pointer transition-colors focus:outline focus:outline-2 focus:outline-primary ${hoverClass}`}
                      onClick={activate}
                      {...a11yProps}
                    >
                      <title>{label}</title>
                    </circle>
                  ) : (
                    <rect
                      key={key}
                      x={h.x}
                      y={h.y}
                      width={h.w}
                      height={h.h}
                      rx={Math.min(10, (h.w || 0) / 2, (h.h || 0) / 2)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={1.5}
                      className={`cursor-pointer transition-colors focus:outline focus:outline-2 focus:outline-primary ${hoverClass}`}
                      onClick={activate}
                      {...a11yProps}
                    >
                      <title>{label}</title>
                    </rect>
                  );
                })}
              </svg>
            </div>
          )}

          {!loading && entries.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-2">
              {isSw ? 'Hakuna hali zilizoandikwa kwenye ramani bado.' : 'No conditions tagged on the map yet.'}
            </p>
          )}

          {entries.length > 0 && (
            <p className="text-slate-400 text-center mb-3">
              {isSw ? 'Maeneo yenye rangi yana rekodi. Gusa kuona.' : 'Highlighted areas have records — tap to view.'}
            </p>
          )}

          {/* Accessible region list — keyboard/screen-reader access to every
              marked region without requiring pointer interaction with the
              3D canvas (or, in 2D mode, a supplement for regions not on the
              current silhouette). */}
          {allMarkedKeys.length > 0 && (
            <div role="group" aria-label={isSw ? 'Chagua Eneo la Mwili' : 'Select Body Area'} className="flex flex-wrap gap-1.5 justify-center lg:justify-start mb-3">
              {(viewMode === '3d' ? allMarkedKeys : offSilhouetteKeys).map((k) => {
                const [region, side] = k.split(':');
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedKey(k)}
                    aria-pressed={selectedKey === k}
                    className={`rounded-lg px-2.5 py-1.5 font-semibold ${
                      selectedKey === k
                        ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                        : 'bg-primary/10 text-primary dark:text-primary-light'
                    }`}
                  >
                    {descriptiveRegionLabel(region, side, isSw)}
                  </button>
                );
              })}
            </div>
          )}
          </div>

          {/* Right column on desktop (a real side panel); on mobile this
              is simply the next section down the page — the closest
              practical equivalent of a bottom sheet without adding a
              second overlay/portal system for one screen. */}
          <div className="mt-4 lg:mt-0">
            {selectedKey ? (
              <div className="space-y-2 border-t nc-border pt-3 lg:border lg:rounded-xl lg:p-3.5 lg:pt-3.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {isSw ? 'Shughuli za Afya' : 'Health Activity'}
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {descriptiveRegionLabel(selectedKey.split(':')[0], selectedKey.split(':')[1], isSw)}
                  </p>
                  <p className="text-slate-400">
                    {activeEntries.length} {isSw ? 'rekodi' : activeEntries.length === 1 ? 'record' : 'records'}
                  </p>
                </div>
                {activeEntries.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                    {isSw
                      ? 'Hakuna rekodi zilizounganishwa na eneo hili bado.'
                      : 'No records are linked to this body area yet. This does not mean there is no medical condition.'}
                  </p>
                ) : (
                  activeEntries.map((e) => (
                    <div key={e.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-900 dark:text-white">{e.diagnosis}</p>
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold flex-shrink-0 ${e.kind === 'imaging' ? 'bg-primary/10 text-primary dark:text-primary-light' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                          {e.kind === 'imaging' ? <Scan className="w-3 h-3" /> : <Stethoscope className="w-3 h-3" />}
                          {e.kind === 'imaging' ? (isSw ? 'Picha' : 'Imaging') : (isSw ? 'Utambuzi' : 'Diagnosis')}
                        </span>
                      </div>
                      {e.notes && <p className="text-slate-600 dark:text-slate-300 mt-1">{e.notes}</p>}
                      <p className="text-slate-400 mt-1">{e.doctorName} • {new Date(e.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))
                )}
                {onViewHealthJourney && (
                  <button
                    type="button"
                    onClick={onViewHealthJourney}
                    className="w-full rounded-xl bg-primary/10 text-primary dark:text-primary-light px-3 py-2 font-semibold"
                  >
                    {isSw ? 'Angalia Historia ya Afya' : 'View Health History'}
                  </button>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex items-center justify-center text-slate-400 text-center border nc-border rounded-xl p-6 h-full min-h-[200px]">
                {isSw ? 'Chagua eneo la mwili kuona shughuli zake za afya.' : 'Select a body area to view its health activity.'}
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};
