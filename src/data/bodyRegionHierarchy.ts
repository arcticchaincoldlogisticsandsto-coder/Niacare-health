// A structured, human-readable hierarchy layered ON TOP of the existing
// flat BODY_REGIONS list (bodyRegions.ts) — it maps common descriptive
// anatomical names (e.g. "Left Upper Arm", "Left Forearm") onto NiaCare's
// existing region keys/side values. It does NOT add new region identifiers:
// every `regionKey` below is one of the exact keys already in
// BODY_REGIONS, and nothing here is ever written to the database — this
// file exists purely so the 3D viewer's code and any future region-picker
// UI can reason about "arm" as "shoulder -> arm -> elbow -> wrist -> hand"
// without a second, incompatible body-region vocabulary.
//
// Where the everyday name is finer-grained than NiaCare's model, it
// collapses onto the nearest existing key rather than inventing one:
//   - "Upper Arm" and "Forearm" both -> 'arm' (no separate forearm key)
//   - "Lower Leg" -> 'leg' (the existing key already means shin/calf)
//   - "Pelvis" -> 'hip' (no separate pelvis key)
//   - "Upper Back" and "Lower Back" both -> 'back' (spine still exists
//     separately for the literal spine hotspot)
import { BodyRegion, BODY_REGIONS, bodyRegionLabel } from './bodyRegions';

export interface HierarchyNode {
  /** Display name for this branch — not itself a region key when it's a group (e.g. "Left Arm"). */
  label: { en: string; sw: string };
  /** Set only on a leaf that maps directly to one BODY_REGIONS entry. */
  regionKey?: string;
  side?: 'left' | 'right';
  children?: HierarchyNode[];
}

const leaf = (regionKey: string, side?: 'left' | 'right'): HierarchyNode => {
  const region = BODY_REGIONS.find((r) => r.key === regionKey) as BodyRegion;
  return {
    label: { en: region.en, sw: region.sw },
    regionKey,
    side,
  };
};

const limb = (side: 'left' | 'right', enName: string, swName: string): HierarchyNode => ({
  label: { en: enName, sw: swName },
  children:
    enName.includes('Arm')
      ? [leaf('shoulder', side), leaf('arm', side), leaf('elbow', side), leaf('wrist', side), leaf('hand', side)]
      : [leaf('hip', side), leaf('thigh', side), leaf('knee', side), leaf('leg', side), leaf('ankle', side), leaf('foot', side)],
});

// The MMSkeleton-style joint tree from the spec, rebuilt around NiaCare's
// own region keys instead of a new skeleton vocabulary.
export const BODY_HIERARCHY: HierarchyNode[] = [
  leaf('head'),
  leaf('neck'),
  { label: { en: 'Torso', sw: 'Kiwiliwili' }, children: [leaf('chest'), leaf('heart'), leaf('lungs'), leaf('abdomen'), leaf('back'), leaf('spine')] },
  limb('left', 'Left Arm', 'Mkono wa Kushoto'),
  limb('right', 'Right Arm', 'Mkono wa Kulia'),
  limb('left', 'Left Leg', 'Mguu wa Kushoto'),
  limb('right', 'Right Leg', 'Mguu wa Kulia'),
];

// Everyday descriptive names -> existing NiaCare region key/side, exactly
// as asked for in the Body Map 2.0 brief ("map these to the existing
// NiaCare region identifiers"). Not used for storage — only for any UI
// copy that wants the more specific everyday name (e.g. "Left Forearm")
// while still resolving to the one real underlying record key ('arm').
export const DESCRIPTIVE_NAME_MAP: { en: string; sw: string; regionKey: string; side?: 'left' | 'right' }[] = [
  { en: 'Head', sw: 'Kichwa', regionKey: 'head' },
  { en: 'Neck', sw: 'Shingo', regionKey: 'neck' },
  { en: 'Chest', sw: 'Kifua', regionKey: 'chest' },
  { en: 'Upper Back', sw: 'Mgongo wa Juu', regionKey: 'back' },
  { en: 'Lower Back', sw: 'Mgongo wa Chini', regionKey: 'back' },
  { en: 'Abdomen', sw: 'Tumbo', regionKey: 'abdomen' },
  { en: 'Pelvis', sw: 'Nyonga', regionKey: 'hip' },
  ...(['left', 'right'] as const).flatMap((side) => [
    { en: `${side === 'left' ? 'Left' : 'Right'} Shoulder`, sw: `Bega la ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'shoulder', side },
    { en: `${side === 'left' ? 'Left' : 'Right'} Upper Arm`, sw: `Mkono wa Juu wa ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'arm', side },
    { en: `${side === 'left' ? 'Left' : 'Right'} Elbow`, sw: `Kiwiko cha ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'elbow', side },
    { en: `${side === 'left' ? 'Left' : 'Right'} Forearm`, sw: `Mkono wa Chini wa ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'arm', side },
    { en: `${side === 'left' ? 'Left' : 'Right'} Wrist`, sw: `Kifundo cha Mkono cha ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'wrist', side },
    { en: `${side === 'left' ? 'Left' : 'Right'} Hand`, sw: `Kiganja cha ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'hand', side },
    { en: `${side === 'left' ? 'Left' : 'Right'} Hip`, sw: `Nyonga ya ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'hip', side },
    { en: `${side === 'left' ? 'Left' : 'Right'} Thigh`, sw: `Paja la ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'thigh', side },
    { en: `${side === 'left' ? 'Left' : 'Right'} Knee`, sw: `Goti la ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'knee', side },
    { en: `${side === 'left' ? 'Left' : 'Right'} Lower Leg`, sw: `Mguu wa Chini wa ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'leg', side },
    { en: `${side === 'left' ? 'Left' : 'Right'} Ankle`, sw: `Kifundo cha Mguu cha ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'ankle', side },
    { en: `${side === 'left' ? 'Left' : 'Right'} Foot`, sw: `Wayo la ${side === 'left' ? 'Kushoto' : 'Kulia'}`, regionKey: 'foot', side },
  ]),
];

/** The everyday descriptive label for a region+side, falling back to the plain BODY_REGIONS label when no finer name exists (e.g. 'head', 'chest'). */
export const descriptiveRegionLabel = (regionKey: string, side: string | null | undefined, isSw: boolean): string => {
  const match = DESCRIPTIVE_NAME_MAP.find((d) => d.regionKey === regionKey && (d.side || null) === (side || null));
  if (match) return isSw ? match.sw : match.en;
  return bodyRegionLabel(regionKey, isSw);
};
