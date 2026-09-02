export interface BodyRegion {
  key: string;
  en: string;
  sw: string;
  sideAware: boolean; // whether left/right/bilateral applies (e.g. "head" doesn't, "knee" does)
}

export const BODY_REGIONS: BodyRegion[] = [
  { key: 'head', en: 'Head', sw: 'Kichwa', sideAware: false },
  { key: 'eye', en: 'Eye', sw: 'Jicho', sideAware: true },
  { key: 'ear', en: 'Ear', sw: 'Sikio', sideAware: true },
  { key: 'neck', en: 'Neck', sw: 'Shingo', sideAware: false },
  { key: 'chest', en: 'Chest', sw: 'Kifua', sideAware: false },
  { key: 'heart', en: 'Heart', sw: 'Moyo', sideAware: false },
  { key: 'lungs', en: 'Lungs', sw: 'Mapafu', sideAware: true },
  { key: 'abdomen', en: 'Abdomen', sw: 'Tumbo', sideAware: false },
  { key: 'spine', en: 'Spine', sw: 'Uti wa Mgongo', sideAware: false },
  { key: 'back', en: 'Back', sw: 'Mgongo', sideAware: false },
  { key: 'shoulder', en: 'Shoulder', sw: 'Bega', sideAware: true },
  { key: 'arm', en: 'Arm', sw: 'Mkono', sideAware: true },
  { key: 'elbow', en: 'Elbow', sw: 'Kiwiko', sideAware: true },
  { key: 'wrist', en: 'Wrist', sw: 'Kifundo cha Mkono', sideAware: true },
  { key: 'hand', en: 'Hand', sw: 'Mkono (Kiganja)', sideAware: true },
  { key: 'hip', en: 'Hip', sw: 'Nyonga', sideAware: true },
  { key: 'thigh', en: 'Thigh', sw: 'Paja', sideAware: true },
  { key: 'knee', en: 'Knee', sw: 'Goti', sideAware: true },
  { key: 'leg', en: 'Leg', sw: 'Mguu', sideAware: true },
  { key: 'ankle', en: 'Ankle', sw: 'Kifundo cha Mguu', sideAware: true },
  { key: 'foot', en: 'Foot', sw: 'Wayo', sideAware: true },
  { key: 'other', en: 'Other', sw: 'Nyingine', sideAware: false },
];

export const bodyRegionLabel = (key: string, isSw: boolean): string =>
  BODY_REGIONS.find((r) => r.key === key)?.[isSw ? 'sw' : 'en'] || key;
