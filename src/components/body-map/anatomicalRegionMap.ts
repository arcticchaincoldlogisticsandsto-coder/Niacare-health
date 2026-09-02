// Maps an anatomical GLB's own mesh names to NiaCare's existing body-region
// identifiers (src/data/bodyRegions.ts) — for a FUTURE multi-mesh asset
// (e.g. separate "left_femur"/"right_knee" meshes). This is the "mesh
// selection" mode.
//
// IMPORTANT — this is NOT the only region-selection mode, and for the one
// real asset actually investigated so far (BodyParts3D, see
// docs/body-map-assets.md), it isn't even the relevant one: that source's
// entire external body surface is ONE unified "skin" mesh, not subdivided
// per region. There is nothing to look up a mesh NAME against in that
// case. Region selection there — same as the current procedural model —
// comes from the existing world-space hotspot system
// (HOTSPOTS_3D_FRONT/_BACK + raycasting in bodyMap3d.ts), which already
// works identically no matter what geometry is in the scene, since it
// hit-tests its own marker meshes, not the body mesh itself. No code
// change was needed to support that mode — it already does.
//
// So: a multi-mesh asset would resolve regions through this file
// (resolveRegionForMesh); a single-skin-mesh asset (or the current
// procedural model) resolves them through the hotspot system instead.
// Both are valid; which one applies depends entirely on the asset that
// eventually ships.
//
// EMPTY BY DESIGN. There is no way to know a source asset's real mesh
// names before that asset exists in this project, and guessing them would
// violate the explicit "do not rely only on mesh names if the source
// asset has inconsistent names... if a mesh cannot be safely mapped,
// leave it non-interactive, do not guess its body region" requirement
// this file was written against. Populate ANATOMICAL_REGION_MAP once a
// real, multi-mesh GLB is added:
//   1. Load it once through loadAnatomicalModel() (anatomicalModel.ts).
//   2. Call listMeshNames(model) and log the result.
//   3. For every mesh that should be selectable, add one entry below
//      mapping that exact mesh name to one of the keys already in
//      BODY_REGIONS (bodyRegions.ts) — never a new key.
//   4. Leave meshes with no confident mapping out of the table entirely;
//      resolveRegionForMesh() already treats "not present" as
//      "non-interactive," which is the correct behavior for them.
import { BODY_REGIONS } from '../../data/bodyRegions';

export interface AnatomicalRegionMapping {
  /** Must be one of BODY_REGIONS' existing `key` values — never a new region identifier. */
  regionKey: string;
  side?: 'left' | 'right';
}

/** meshName -> NiaCare region mapping. Empty until a real asset's mesh names are known — see the file header for how to populate it. */
export const ANATOMICAL_REGION_MAP: Record<string, AnatomicalRegionMapping> = {};

const VALID_REGION_KEYS = new Set(BODY_REGIONS.map((r) => r.key));

// Exact match only — deliberately no fuzzy/substring matching, which is
// exactly the kind of guess this mapping layer exists to avoid.
export const resolveRegionForMesh = (meshName: string): AnatomicalRegionMapping | null => {
  const mapping = ANATOMICAL_REGION_MAP[meshName];
  if (!mapping) return null;
  if (!VALID_REGION_KEYS.has(mapping.regionKey)) {
    // A programming error in this table (a typo'd regionKey), not a
    // missing-asset situation — fail loudly in development rather than
    // silently treating a real mesh as unmapped.
    if (import.meta.env.DEV) {
      console.error(`anatomicalRegionMap: "${meshName}" maps to unknown region key "${mapping.regionKey}"`);
    }
    return null;
  }
  return mapping;
};
