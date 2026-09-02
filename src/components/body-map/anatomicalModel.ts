// Loader + runtime normalizer for an external anatomical GLB asset — the
// planned upgrade path from the current procedural mannequin
// (src/lib/bodyMap3d.ts) to a real anatomical model (BodyParts3D/
// Z-Anatomy-derived, see docs/body-map-assets.md for the license
// research behind that choice).
//
// STATUS: this module is NOT wired into BodyMapModal/Mannequin3DView yet.
// It exists so integration can start the moment a properly prepared GLB
// is available, without touching the current, already-QA-verified
// procedural viewer in the meantime. Wiring it in before a real asset
// exists would mean writing untestable code against a guessed mesh
// structure — exactly what this project's own instructions say not to do.
//
// Deliberately kept separate from patient-data fetching (bodyMap.ts) and
// from the procedural viewer (bodyMap3d.ts) — this file only knows how to
// load and geometrically normalize a 3D asset, nothing about diagnoses,
// records, or Supabase.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export interface LoadAnatomicalModelOptions {
  /** 0-1 fraction of the object's own bytes downloaded, when the server/response exposes Content-Length. Best-effort — glTF's own internal buffer count means this is an approximation, not a precise multi-asset progress bar. */
  onProgress?: (fraction: number) => void;
  /** Draco-compressed meshes need their decoder's WASM/JS assets served from somewhere — defaults to the same CDN path three.js's own examples use. Override only if self-hosting the decoder. */
  dracoDecoderPath?: string;
}

/** Raw load only — no normalization, no region mapping. Throws on failure; the caller decides the fallback (existing 2D Body Map, or the procedural mannequin). */
export const loadAnatomicalModel = (url: string, options: LoadAnatomicalModelOptions = {}): Promise<THREE.Group> => {
  const draco = new DRACOLoader();
  draco.setDecoderPath(options.dracoDecoderPath ?? 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        draco.dispose();
        resolve(gltf.scene);
      },
      (event) => {
        if (options.onProgress && event.lengthComputable) {
          options.onProgress(event.loaded / event.total);
        }
      },
      (error) => {
        draco.dispose();
        reject(error instanceof Error ? error : new Error('Failed to load anatomical model'));
      }
    );
  });
};

export interface NormalizeResult {
  /** The uniform scale factor actually applied — useful for converting any asset-authored metadata (e.g. a skeleton rig's own units) into scene units after the fact. */
  appliedScale: number;
}

// Runtime-only normalization (never mutates/re-exports the source file) so
// an asset authored at any scale/origin/orientation lands consistently:
// centered on X/Z, feet at y=0, a fixed target height so the existing
// camera/hotspot distances in bodyMap3d.ts stay meaningful without
// per-asset camera tuning. TARGET_HEIGHT matches the current procedural
// mannequin's own height (see buildMannequinBody in bodyMap3d.ts) so the
// two are visually interchangeable from the camera's point of view.
const TARGET_HEIGHT = 1.73;

export const normalizeAnatomicalModel = (model: THREE.Group): NormalizeResult => {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  if (size.y <= 0) {
    // A degenerate/empty bounding box means the loaded scene has no real
    // geometry — surface this as a normalization failure rather than
    // silently producing a zero-scale, invisible model.
    throw new Error('Anatomical model has no measurable height — nothing to normalize.');
  }

  const scale = TARGET_HEIGHT / size.y;
  model.scale.setScalar(scale);

  // Re-measure post-scale (cheaper and more exact than pre-computing the
  // post-scale offset by hand) and re-center/ground it.
  const scaledBox = new THREE.Box3().setFromObject(model);
  model.position.x -= scaledBox.min.x + (scaledBox.max.x - scaledBox.min.x) / 2;
  model.position.z -= scaledBox.min.z + (scaledBox.max.z - scaledBox.min.z) / 2;
  model.position.y -= scaledBox.min.y;

  void center; // retained for callers that want the pre-scale center (e.g. debugging an off-origin source asset); intentionally unused here
  return { appliedScale: scale };
};

/** Every mesh's own name in a loaded model, in traversal order — the practical starting point for building anatomicalRegionMap.ts's lookup table against a real asset (there is no way to know real mesh names before one exists). Not used by the app at runtime; a debugging/authoring aid only. */
export const listMeshNames = (model: THREE.Group): string[] => {
  const names: string[] = [];
  model.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) names.push(obj.name || '(unnamed mesh)');
  });
  return names;
};

/** Disposes every geometry/material/texture owned by a loaded anatomical model. Safe to call even if the group was never added to a scene. MannequinViewer's own dispose() already traverses its whole scene generically (so it covers a model added via a BodyModelSource without needing this), but this is exposed separately for anyone loading/discarding a model outside that viewer. */
export const disposeAnatomicalModel = (model: THREE.Group): void => {
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      for (const key of Object.keys(material) as (keyof THREE.Material)[]) {
        const value = material[key];
        if (value && typeof value === 'object' && 'isTexture' in value && (value as THREE.Texture).isTexture) {
          (value as THREE.Texture).dispose();
        }
      }
      material.dispose();
    }
  });
};
