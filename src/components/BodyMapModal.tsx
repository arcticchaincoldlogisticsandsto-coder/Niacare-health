import React, { useEffect, useMemo, useState } from 'react';
import { X, PersonStanding, Scan, Stethoscope } from 'lucide-react';
import { Language, Theme } from '../types';
import { fetchBodyMapEntries, BodyMapEntry } from '../lib/bodyMap';
import { BODY_REGIONS, bodyRegionLabel } from '../data/bodyRegions';
import { withTimeout } from '../lib/useNetworkStatus';

interface BodyMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string | null;
  language: Language;
  theme: Theme;
  onViewHealthJourney?: () => void;
}

// Front-view hotspots only — regions that aren't visible from the front
// (back, spine, ear) are offered as a chip row below the diagram instead of
// forced onto a silhouette that can't show them. This is a documentation/
// visualization aid (spec: "not a diagnostic tool"), so a clean simplified
// outline is the right level of fidelity, not an anatomical illustration.
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

// Back-view hotspots — a mirror-layout schematic (same simplified-outline
// convention as the front view, not real anatomy) so 'back' and 'spine'
// become real tappable regions instead of only a fallback chip, and limb
// joints (shoulder/arm/elbow/etc.) remain reachable from either view since
// the same joint is visible from front and back.
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

export const BodyMapModal: React.FC<BodyMapModalProps> = ({ isOpen, onClose, patientId, language, theme, onViewHealthJourney }) => {
  const isSw = language === 'sw';
  const isDark = theme === 'dark';
  const [entries, setEntries] = useState<BodyMapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [view, setView] = useState<'front' | 'back'>('front');

  useEffect(() => {
    if (!isOpen) { setSelectedKey(null); setView('front'); }
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

  const regionKey = (region: string, side: string | null) => `${region}:${side || 'none'}`;

  const entriesByRegion = useMemo(() => {
    const map = new Map<string, BodyMapEntry[]>();
    for (const e of entries) {
      const k = regionKey(e.bodyRegion, e.bodySide);
      map.set(k, [...(map.get(k) || []), e]);
    }
    return map;
  }, [entries]);

  if (!isOpen) return null;

  const activeEntries = selectedKey ? entriesByRegion.get(selectedKey) || [] : [];
  const markedKeys = new Set(entriesByRegion.keys());
  const activeHotspots = view === 'front' ? HOTSPOTS : BACK_HOTSPOTS;
  const activeHotspotKeys = new Set(activeHotspots.map((h) => h.key));
  const offSilhouetteKeys = [...markedKeys].filter((k) => !activeHotspotKeys.has(k.split(':')[0]));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="nc-card w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 flex items-center justify-between bg-primary text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <PersonStanding className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">{isSw ? 'Ramani ya Mwili' : 'Body Map'}</h3>
              <p className="text-xs text-white/80">{isSw ? 'Gusa eneo kuona rekodi zake' : 'Tap an area to see related conditions'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto text-xs">
          {error && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 dark:border-rose-900 p-2.5 mb-2">
              <p className="text-rose-600">{error}</p>
              <button type="button" onClick={() => setRetryToken((t) => t + 1)} className="font-bold text-primary dark:text-primary-light flex-shrink-0">
                {isSw ? 'Jaribu Tena' : 'Retry'}
              </button>
            </div>
          )}

          <div className="flex justify-center gap-1.5 mb-3">
            {(['front', 'back'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-lg px-4 py-1.5 font-bold ${
                  view === v
                    ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                    : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {v === 'front' ? (isSw ? 'Mbele' : 'Front') : (isSw ? 'Nyuma' : 'Back')}
              </button>
            ))}
          </div>

          <div className="flex justify-center mb-3">
            <svg viewBox="0 0 200 350" width="220" height="385" className="select-none">
              {/* Simplified outline — a documentation aid, not anatomy. Front
                  and back share the same limb outline; only the torso
                  markup differs (chest/abdomen vs back/spine). */}
              <ellipse cx="100" cy="32" rx="22" ry="24" fill="none" stroke={isDark ? '#334155' : '#CBD5E1'} strokeWidth="1.5" />
              <rect x="65" y="66" width="70" height="90" rx="14" fill="none" stroke={isDark ? '#334155' : '#CBD5E1'} strokeWidth="1.5" />
              <rect x="72" y="172" width="56" height="64" rx="10" fill="none" stroke={isDark ? '#334155' : '#CBD5E1'} strokeWidth="1.5" />
              <rect x="76" y="234" width="18" height="80" rx="8" fill="none" stroke={isDark ? '#334155' : '#CBD5E1'} strokeWidth="1.5" />
              <rect x="106" y="234" width="18" height="80" rx="8" fill="none" stroke={isDark ? '#334155' : '#CBD5E1'} strokeWidth="1.5" />
              <rect x="36" y="88" width="20" height="150" rx="9" fill="none" stroke={isDark ? '#334155' : '#CBD5E1'} strokeWidth="1.5" />
              <rect x="144" y="88" width="20" height="150" rx="9" fill="none" stroke={isDark ? '#334155' : '#CBD5E1'} strokeWidth="1.5" />
              {view === 'back' && (
                <line x1="100" y1="70" x2="100" y2="200" stroke={isDark ? '#334155' : '#CBD5E1'} strokeWidth="1.5" strokeDasharray="3,3" />
              )}

              {activeHotspots.map((h) => {
                const key = regionKey(h.key, h.side || null);
                const marked = markedKeys.has(key);
                const isSelected = selectedKey === key;
                const fill = isSelected ? 'var(--nc-primary)' : marked ? 'color-mix(in srgb, var(--nc-primary) 35%, transparent)' : 'transparent';
                const stroke = marked || isSelected ? 'var(--nc-primary)' : (isDark ? '#475569' : '#94A3B8');
                const label = `${bodyRegionLabel(h.key, isSw)}${h.side ? ` (${h.side})` : ''}`;
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
                return h.shape === 'circle' ? (
                  <circle
                    key={key}
                    cx={h.x}
                    cy={h.y}
                    r={h.r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.5}
                    className="cursor-pointer transition-colors focus:outline focus:outline-2 focus:outline-primary"
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
                    rx={4}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.5}
                    className="cursor-pointer transition-colors focus:outline focus:outline-2 focus:outline-primary"
                    onClick={activate}
                    {...a11yProps}
                  >
                    <title>{label}</title>
                  </rect>
                );
              })}
            </svg>
          </div>

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

          {/* Regions not on the current view's silhouette (e.g. back/spine
              while viewing Front, or chest/abdomen while viewing Back; eye/
              ear/other never appear on either) — still reachable as chips. */}
          {offSilhouetteKeys.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center mb-3">
              {offSilhouetteKeys.map((k) => {
                const [region, side] = k.split(':');
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedKey(k)}
                    aria-pressed={selectedKey === k}
                    className={`rounded-lg px-2.5 py-1.5 font-bold ${
                      selectedKey === k
                        ? 'bg-[var(--nc-primary)] text-white dark:bg-primary dark:text-[#041D34]'
                        : 'bg-primary/10 text-primary dark:text-primary-light'
                    }`}
                  >
                    {bodyRegionLabel(region, isSw)}{side !== 'none' ? ` (${side})` : ''}
                  </button>
                );
              })}
            </div>
          )}

          {selectedKey && (
            <div className="space-y-2 border-t nc-border pt-3">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  {bodyRegionLabel(selectedKey.split(':')[0], isSw)}
                  {selectedKey.split(':')[1] !== 'none' ? ` (${selectedKey.split(':')[1]})` : ''}
                </p>
                <p className="text-slate-400">
                  {activeEntries.length} {isSw ? 'rekodi zinazohusiana' : activeEntries.length === 1 ? 'related record' : 'related records'}
                </p>
              </div>
              {activeEntries.map((e) => (
                <div key={e.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-900 dark:text-white">{e.diagnosis}</p>
                    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold flex-shrink-0 ${e.kind === 'imaging' ? 'bg-primary/10 text-primary dark:text-primary-light' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {e.kind === 'imaging' ? <Scan className="w-3 h-3" /> : <Stethoscope className="w-3 h-3" />}
                      {e.kind === 'imaging' ? (isSw ? 'Picha' : 'Imaging') : (isSw ? 'Utambuzi' : 'Diagnosis')}
                    </span>
                  </div>
                  {e.notes && <p className="text-slate-600 dark:text-slate-300 mt-1">{e.notes}</p>}
                  <p className="text-slate-400 mt-1">{e.doctorName} • {new Date(e.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
              {onViewHealthJourney && (
                <button
                  type="button"
                  onClick={onViewHealthJourney}
                  className="w-full rounded-xl bg-primary/10 text-primary dark:text-primary-light px-3 py-2 font-bold"
                >
                  {isSw ? 'Angalia Historia ya Afya' : 'View Health History'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
