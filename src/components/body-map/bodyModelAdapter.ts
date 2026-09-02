// The pluggable "where does the body geometry come from" seam
// MannequinViewer's constructor accepts as an optional third argument
// (see src/lib/bodyMap3d.ts). Deliberately a plain async factory function
// type, not a class hierarchy — a BodyModelSource IS just "a promise for
// a ready-to-add THREE.Group," and MannequinViewer already handles
// success/failure/fallback generically around whatever that promise does.
//
// This is what makes "procedural fallback OR future anatomical GLB"
// possible without duplicating the viewer: MannequinViewer doesn't know
// or care which source it got, it just awaits one function.
import * as THREE from 'three';
import { buildMannequinBody } from '../../lib/bodyMap3d';
import { loadAnatomicalModel, normalizeAnatomicalModel } from './anatomicalModel';

export type BodyModelSource = () => Promise<THREE.Group>;

/** The current, always-available body. Synchronous work wrapped in a resolved promise purely so it satisfies the same BodyModelSource type as the async GLB path — MannequinViewer treats both identically. */
export const proceduralBodySource: BodyModelSource = async () => buildMannequinBody();

/** An anatomical GLB at a given URL, loaded and normalized to match the procedural model's own scene scale (see TARGET_HEIGHT in anatomicalModel.ts) so the existing hotspot table stays meaningful either way. Rejects on any failure — MannequinViewer's constructor already falls back to proceduralBodySource's own logic when this rejects, so callers don't need their own try/catch. */
export const anatomicalBodySource = (url: string): BodyModelSource => async () => {
  const model = await loadAnatomicalModel(url);
  normalizeAnatomicalModel(model);
  return model;
};

/**
 * Picks a BodyModelSource from configuration:
 *  - VITE_ANATOMICAL_MODEL_URL set -> attempt that GLB (procedural is
 *    still the automatic fallback inside MannequinViewer if it fails).
 *  - unset (the only state that exists in this project today, since no
 *    asset has been cleared for shipping — see docs/body-map-assets.md)
 *    -> returns undefined, meaning "use MannequinViewer's own built-in
 *    procedural default," not "use proceduralBodySource explicitly." Both
 *    produce the exact same body; undefined is preferred here because it
 *    keeps the current, only real code path perfectly untouched rather
 *    than routing it through one more async hop for no reason.
 */
export const resolveBodyModelSource = (): BodyModelSource | undefined => {
  const url = import.meta.env.VITE_ANATOMICAL_MODEL_URL;
  return url ? anatomicalBodySource(url) : undefined;
};
