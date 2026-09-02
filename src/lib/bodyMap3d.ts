// Procedural 3D mannequin viewer for the patient Body Map — raw three.js
// (no @react-three/fiber; matches the reference architecture inspected at
// github.com/thebuggeddev/anatomy's app/lib/three/viewer.ts: an imperative
// class owning its own scene/renderer/RAF loop, not a React-managed scene
// graph, since a reconciler adds overhead this app doesn't need for one
// static mesh). That reference repo's own 3D assets are per-*organ*
// education models (brain.glb, heart.glb, etc.) with no whole-body figure
// in it at all, so nothing was copied from it — only the *pattern*
// (render-on-demand, low-power detection, careful disposal) is reused.
//
// This is a stylized capsule/primitive mannequin, not a downloaded
// anatomical mesh — NiaCare has no licensed 3D body model, and one was not
// fabricated. It exists purely to give the existing body-region ->
// records navigation (unchanged, see src/lib/bodyMap.ts) a real rotatable
// 3D presentation instead of a flat SVG, per spec ("depth, lighting,
// subtle shadows... but keep the design restrained").
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface Hotspot3D {
  key: string;
  side?: 'left' | 'right';
  /** Position in mannequin-local units — a standing figure ~1.8 units tall, feet at y=0. */
  position: [number, number, number];
  /** Marker radius, in the same units. */
  radius: number;
}

// Front-facing hotspots. Coordinates are hand-authored directly in 3D
// (not mechanically derived from the 2D SVG's viewBox) for a self-consistent
// standing figure — same region keys as data/bodyRegions.ts and the 2D
// viewer's HOTSPOTS, so entriesByRegion grouping in BodyMapModal is shared
// verbatim between both viewers.
export const HOTSPOTS_3D_FRONT: Hotspot3D[] = [
  { key: 'head', position: [0, 1.66, 0.02], radius: 0.115 },
  { key: 'neck', position: [0, 1.535, 0.05], radius: 0.05 },
  { key: 'chest', position: [0, 1.42, 0.155], radius: 0.14 },
  { key: 'heart', position: [-0.06, 1.42, 0.17], radius: 0.055 },
  { key: 'lungs', side: 'left', position: [-0.11, 1.44, 0.14], radius: 0.06 },
  { key: 'lungs', side: 'right', position: [0.11, 1.44, 0.14], radius: 0.06 },
  { key: 'abdomen', position: [0, 1.16, 0.15], radius: 0.13 },
  { key: 'shoulder', side: 'left', position: [-0.245, 1.51, 0.03], radius: 0.065 },
  { key: 'shoulder', side: 'right', position: [0.245, 1.51, 0.03], radius: 0.065 },
  { key: 'arm', side: 'left', position: [-0.275, 1.34, 0.02], radius: 0.055 },
  { key: 'arm', side: 'right', position: [0.275, 1.34, 0.02], radius: 0.055 },
  { key: 'elbow', side: 'left', position: [-0.285, 1.19, 0.01], radius: 0.045 },
  { key: 'elbow', side: 'right', position: [0.285, 1.19, 0.01], radius: 0.045 },
  { key: 'wrist', side: 'left', position: [-0.29, 0.945, 0], radius: 0.035 },
  { key: 'wrist', side: 'right', position: [0.29, 0.945, 0], radius: 0.035 },
  { key: 'hand', side: 'left', position: [-0.295, 0.87, 0.01], radius: 0.045 },
  { key: 'hand', side: 'right', position: [0.295, 0.87, 0.01], radius: 0.045 },
  { key: 'hip', side: 'left', position: [-0.11, 0.99, 0.1], radius: 0.075 },
  { key: 'hip', side: 'right', position: [0.11, 0.99, 0.1], radius: 0.075 },
  { key: 'thigh', side: 'left', position: [-0.1, 0.72, 0.05], radius: 0.075 },
  { key: 'thigh', side: 'right', position: [0.1, 0.72, 0.05], radius: 0.075 },
  { key: 'knee', side: 'left', position: [-0.1, 0.5, 0.06], radius: 0.06 },
  { key: 'knee', side: 'right', position: [0.1, 0.5, 0.06], radius: 0.06 },
  { key: 'leg', side: 'left', position: [-0.095, 0.29, 0.02], radius: 0.05 },
  { key: 'leg', side: 'right', position: [0.095, 0.29, 0.02], radius: 0.05 },
  { key: 'ankle', side: 'left', position: [-0.09, 0.085, 0.02], radius: 0.04 },
  { key: 'ankle', side: 'right', position: [0.09, 0.085, 0.02], radius: 0.04 },
  { key: 'foot', side: 'left', position: [-0.09, 0.035, 0.08], radius: 0.05 },
  { key: 'foot', side: 'right', position: [0.09, 0.035, 0.08], radius: 0.05 },
];

// Back-facing hotspots — same limb keys mirrored onto the rear surface
// (z negated / small rear offset), plus 'back' and 'spine' which only ever
// exist on this side. Matches the 2D viewer's BACK_HOTSPOTS concept.
export const HOTSPOTS_3D_BACK: Hotspot3D[] = [
  { key: 'head', position: [0, 1.66, -0.02], radius: 0.115 },
  { key: 'neck', position: [0, 1.535, -0.05], radius: 0.05 },
  { key: 'back', position: [0, 1.3, -0.155], radius: 0.16 },
  { key: 'spine', position: [0, 1.25, -0.17], radius: 0.035 },
  { key: 'shoulder', side: 'left', position: [-0.245, 1.51, -0.03], radius: 0.065 },
  { key: 'shoulder', side: 'right', position: [0.245, 1.51, -0.03], radius: 0.065 },
  { key: 'arm', side: 'left', position: [-0.275, 1.34, -0.02], radius: 0.055 },
  { key: 'arm', side: 'right', position: [0.275, 1.34, -0.02], radius: 0.055 },
  { key: 'elbow', side: 'left', position: [-0.285, 1.19, -0.01], radius: 0.045 },
  { key: 'elbow', side: 'right', position: [0.285, 1.19, -0.01], radius: 0.045 },
  { key: 'wrist', side: 'left', position: [-0.29, 0.945, 0], radius: 0.035 },
  { key: 'wrist', side: 'right', position: [0.29, 0.945, 0], radius: 0.035 },
  { key: 'hand', side: 'left', position: [-0.295, 0.87, -0.01], radius: 0.045 },
  { key: 'hand', side: 'right', position: [0.295, 0.87, -0.01], radius: 0.045 },
  { key: 'hip', side: 'left', position: [-0.11, 0.99, -0.1], radius: 0.075 },
  { key: 'hip', side: 'right', position: [0.11, 0.99, -0.1], radius: 0.075 },
  { key: 'thigh', side: 'left', position: [-0.1, 0.72, -0.05], radius: 0.075 },
  { key: 'thigh', side: 'right', position: [0.1, 0.72, -0.05], radius: 0.075 },
  { key: 'knee', side: 'left', position: [-0.1, 0.5, -0.06], radius: 0.06 },
  { key: 'knee', side: 'right', position: [0.1, 0.5, -0.06], radius: 0.06 },
  { key: 'leg', side: 'left', position: [-0.095, 0.29, -0.02], radius: 0.05 },
  { key: 'leg', side: 'right', position: [0.095, 0.29, -0.02], radius: 0.05 },
  { key: 'ankle', side: 'left', position: [-0.09, 0.085, -0.02], radius: 0.04 },
  { key: 'ankle', side: 'right', position: [0.09, 0.085, -0.02], radius: 0.04 },
  { key: 'foot', side: 'left', position: [-0.09, 0.035, -0.08], radius: 0.05 },
  { key: 'foot', side: 'right', position: [0.09, 0.035, -0.08], radius: 0.05 },
];

/** WebGL support check — cheap, synchronous, no context left open. */
export const isWebGLAvailable = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

const clinicalMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: 0xd7e2ec,
    roughness: 0.55,
    metalness: 0.04,
  });

// A capsule's total physical extent along its axis is length + 2*radius
// (two hemisphere caps beyond the cylindrical middle). OVERLAP_EPS is
// added on top of that so neighboring segments deliberately interpenetrate
// by a few millimeters at every joint, rather than mathematically
// touching-but-not-quite — the thing that made the previous version read
// as "disconnected capsules" instead of one figure. A sphere joint fillet
// (radius = the larger of the two meeting segment radii) then sits exactly
// at the shared boundary and hides the seam entirely.
const OVERLAP_EPS = 0.028;

/** Builds the static mannequin geometry (head/torso/limbs) as one connected
 *  group. No per-region parts here — those are separate marker meshes so
 *  they can be styled/hit-tested independently of the body's own shading. */
const buildMannequinBody = (): THREE.Group => {
  const group = new THREE.Group();
  const mat = clinicalMaterial();
  const jointMat = clinicalMaterial();
  jointMat.roughness = 0.5;

  const add = (mesh: THREE.Mesh, x: number, y: number, z = 0, material = mat) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (material !== mat) mesh.material = material;
    group.add(mesh);
  };

  const joint = (radius: number, x: number, y: number, z = 0) =>
    add(new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), jointMat), x, y, z, jointMat);

  // Torso stack — each segment's capsule already overlaps the one above/
  // below it (chest bottom sits inside abdomen top, etc.), so the spine
  // reads as one continuous form rather than three stacked pills.
  add(new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 18), mat), 0, 1.66);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.12, 16), mat), 0, 1.53);
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.21, 4, 16), mat), 0, 1.42);
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.17, 4, 16), mat), 0, 1.16);
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.07, 4, 16), mat), 0, 0.99);

  /** A limb segment between two joints, deliberately overlapping both. */
  const limb = (radius: number, yTop: number, yBottom: number, x: number, z = 0) => {
    const span = yTop - yBottom + OVERLAP_EPS * 2;
    const length = Math.max(span - radius * 2, 0.015);
    const geo = new THREE.CapsuleGeometry(radius, length, 4, 12);
    add(new THREE.Mesh(geo, mat), x, (yTop + yBottom) / 2, z);
  };

  for (const s of [-1, 1] as const) {
    joint(0.068, 0.245 * s, 1.505, 0.01);
    limb(0.055, 1.5, 1.2, 0.275 * s);
    joint(0.05, 0.285 * s, 1.2, 0.005);
    limb(0.04, 1.2, 0.94, 0.288 * s);
    joint(0.042, 0.29 * s, 0.94, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 10), mat), 0.295 * s, 0.87, 0.012);

    joint(0.083, 0.11 * s, 0.99, 0.09);
    limb(0.07, 0.98, 0.5, 0.1 * s, 0.05);
    joint(0.066, 0.1 * s, 0.5, 0.06);
    limb(0.05, 0.5, 0.1, 0.095 * s, 0.025);
    joint(0.048, 0.09 * s, 0.09, 0.02);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.055, 0.21), mat);
    foot.position.set(0.09 * s, 0.048, 0.08);
    foot.castShadow = true;
    foot.receiveShadow = true;
    group.add(foot);
  }

  return group;
};

export interface MannequinCallbacks {
  onHover: (key: string | null) => void;
  onSelect: (hotspot: Hotspot3D | null) => void;
  onError: (message: string) => void;
}

// Marked/unmarked/selected colors are set from outside via setMarkedKeys /
// setSelectedKey — kept in NiaCare's own token colors (passed in as hex
// numbers by the caller), not hardcoded here, so light/dark theme and the
// app's actual brand blue stay the single source of truth.
export class MannequinViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private container: HTMLElement;
  private callbacks: MannequinCallbacks;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private markers = new Map<string, THREE.Mesh>();
  // Marked (has records): brand blue. Selected: brighter cyan, so the one
  // region the patient is actually looking at is unambiguous against every
  // other marked region, not just a shade darker.
  private markerColors = { base: 0xffffff, marked: 0x0066cc, selected: 0x18a8d8 };
  private hoveredKey: string | null = null;
  private selectedKey: string | null = null;
  private dirty = true;
  private disposed = false;
  private rafId = 0;
  private resizeObserver: ResizeObserver;
  private lowPower: boolean;
  private reducedMotion: boolean;
  private facingTween: { fromAngle: number; toAngle: number; distance: number; y: number; start: number; duration: number } | null = null;
  private lastPointerDownTime = 0;
  private lastPointerDownPos = { x: 0, y: 0 };

  constructor(container: HTMLElement, callbacks: MannequinCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.lowPower = window.innerWidth < 640 || (navigator.hardwareConcurrency ?? 8) < 4;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowPower, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.25 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !this.lowPower;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    this.camera.position.set(0, 1.0, 3.4);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.95, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 5.5;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.minPolarAngle = Math.PI * 0.15;
    this.controls.addEventListener('change', () => { this.dirty = true; });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc7d2e0, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(1.6, 3, 2.2);
    key.castShadow = !this.lowPower;
    if (key.castShadow) {
      key.shadow.mapSize.set(512, 512);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 8;
    }
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x9db9d6, 0.35);
    fill.position.set(-2, 1.2, -1.5);
    this.scene.add(fill);

    const body = buildMannequinBody();
    this.scene.add(body);

    if (!this.lowPower) {
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(0.85, 32),
        new THREE.ShadowMaterial({ opacity: 0.12 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.001;
      floor.receiveShadow = true;
      this.scene.add(floor);
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('pointerleave', this.handlePointerLeave);

    this.animate();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  setHotspots(hotspots: Hotspot3D[], regionKeyOf: (key: string, side?: string) => string) {
    for (const m of this.markers.values()) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      this.scene.remove(m);
    }
    this.markers.clear();

    for (const h of hotspots) {
      // Emissive standard material, not MeshBasicMaterial — a flat unlit
      // color reads as a pasted-on sticker; a soft emissive glow that still
      // responds to scene lighting reads as an actual highlighted patch of
      // the body, matching "subtle emissive effect, soft outline or glow."
      const geo = new THREE.SphereGeometry(h.radius * 1.08, 16, 12);
      const matr = new THREE.MeshStandardMaterial({
        color: this.markerColors.base,
        emissive: new THREE.Color(this.markerColors.base),
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(geo, matr);
      mesh.position.set(...h.position);
      mesh.userData = { key: h.key, side: h.side, regionKey: regionKeyOf(h.key, h.side) };
      this.scene.add(mesh);
      this.markers.set(regionKeyOf(h.key, h.side), mesh);
    }
    this.dirty = true;
  }

  setMarkedKeys(marked: Set<string>) {
    for (const [regionKey, mesh] of this.markers) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const isSelected = regionKey === this.selectedKey;
      const isMarked = marked.has(regionKey);
      const color = isSelected ? this.markerColors.selected : this.markerColors.marked;
      mat.color.set(color);
      mat.emissive.set(color);
      mat.emissiveIntensity = isSelected ? 0.9 : isMarked ? 0.5 : 0;
      mat.opacity = isSelected ? 0.65 : isMarked ? 0.4 : 0;
    }
    this.dirty = true;
  }

  setSelectedKey(key: string | null) {
    this.selectedKey = key;
    this.dirty = true;
  }

  // Smooth orbit to front/back rather than an instant camera snap, per
  // spec ("do not simply mirror the camera instantly — use a smooth
  // rotation animation"). Respects prefers-reduced-motion by snapping
  // instantly instead of tweening, matching this app's existing global
  // reduced-motion handling (see @media (prefers-reduced-motion) in
  // index.css) rather than a separate, inconsistent rule just for this view.
  setCameraFacing(facing: 'front' | 'back') {
    const distance = this.camera.position.distanceTo(this.controls.target);
    const y = this.camera.position.y;
    const currentAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
    let targetAngle = facing === 'front' ? 0 : Math.PI;
    // Always take the shorter arc (e.g. from a manually-rotated 200° back
    // toward 0°, go through 180°→360°/0°, not backward through 100°→0°
    // the long way) by picking whichever equivalent target angle is closer.
    while (targetAngle - currentAngle > Math.PI) targetAngle -= Math.PI * 2;
    while (targetAngle - currentAngle < -Math.PI) targetAngle += Math.PI * 2;

    if (this.reducedMotion) {
      this.camera.position.set(Math.sin(targetAngle) * distance, y, Math.cos(targetAngle) * distance);
      this.controls.update();
      this.dirty = true;
      return;
    }
    this.controls.enabled = false;
    this.facingTween = { fromAngle: currentAngle, toAngle: targetAngle, distance, y, start: performance.now(), duration: 550 };
    this.dirty = true;
  }

  resetView() {
    this.facingTween = null;
    this.controls.enabled = true;
    this.camera.position.set(0, 1.0, 3.4);
    this.controls.target.set(0, 0.95, 0);
    this.controls.update();
    this.dirty = true;
  }

  private raycastAt(clientX: number, clientY: number): THREE.Mesh | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.markers.values()], false);
    return (hits[0]?.object as THREE.Mesh) || null;
  }

  // Faint hover feedback for an otherwise-invisible (unmarked, no records)
  // region, so pointer users can tell it's interactive before tapping —
  // never overrides a marked/selected region's own stronger glow.
  private setHoverGlow(regionKey: string | null, hoverOn: boolean) {
    if (!regionKey) return;
    const mesh = this.markers.get(regionKey);
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const isSelected = regionKey === this.selectedKey;
    if (isSelected) return;
    const wasMarked = mat.opacity >= 0.35;
    if (wasMarked) return;
    mat.opacity = hoverOn ? 0.18 : 0;
  }

  private handlePointerMove = (e: PointerEvent) => {
    const hit = this.raycastAt(e.clientX, e.clientY);
    const key = (hit?.userData.regionKey as string) || null;
    if (key !== this.hoveredKey) {
      this.setHoverGlow(this.hoveredKey, false);
      this.hoveredKey = key;
      this.setHoverGlow(this.hoveredKey, true);
      this.callbacks.onHover(key);
      this.renderer.domElement.style.cursor = key ? 'pointer' : '';
      this.dirty = true;
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.lastPointerDownTime = Date.now();
    this.lastPointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerUp = (e: PointerEvent) => {
    // Only treat this as a "tap" (not the end of a drag-to-rotate) if it
    // was quick and didn't move far — OrbitControls already consumes the
    // drag itself, this just avoids also firing a selection.
    const moved = Math.hypot(e.clientX - this.lastPointerDownPos.x, e.clientY - this.lastPointerDownPos.y);
    if (moved > 6 || Date.now() - this.lastPointerDownTime > 500) return;
    const hit = this.raycastAt(e.clientX, e.clientY);
    if (hit) {
      const h = hit.userData as { key: string; side?: string; regionKey: string };
      this.callbacks.onSelect({ key: h.key, side: h.side as 'left' | 'right' | undefined, position: [0, 0, 0], radius: 0 });
    } else {
      this.callbacks.onSelect(null);
    }
  };

  private handlePointerLeave = () => {
    if (this.hoveredKey !== null) {
      this.setHoverGlow(this.hoveredKey, false);
      this.hoveredKey = null;
      this.callbacks.onHover(null);
      this.dirty = true;
    }
  };

  private stepFacingTween() {
    const t = this.facingTween;
    if (!t) return;
    const elapsed = performance.now() - t.start;
    const raw = Math.min(1, elapsed / t.duration);
    // Ease-in-out cubic — a smooth orbit, not a linear mechanical sweep.
    const eased = raw < 0.5 ? 4 * raw ** 3 : 1 - (-2 * raw + 2) ** 3 / 2;
    const angle = t.fromAngle + (t.toAngle - t.fromAngle) * eased;
    this.camera.position.set(Math.sin(angle) * t.distance, t.y, Math.cos(angle) * t.distance);
    // Drive the camera directly (lookAt), not via controls.update() —
    // OrbitControls tracks its own internal spherical state and would
    // otherwise fight a manually-set position. Controls are disabled for
    // the tween's duration and re-enabled once it lands, at which point
    // OrbitControls re-derives its internal state from the camera's actual
    // (now final) position on the next real interaction.
    this.camera.lookAt(this.controls.target);
    this.dirty = true;
    if (raw >= 1) {
      this.facingTween = null;
      this.controls.enabled = true;
    }
  }

  private animate = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.animate);
    if (this.facingTween) {
      // While a tween drives the camera directly, skip OrbitControls' own
      // damped update — calling both in the same frame fights the manual
      // position and reads as jitter, since damping tries to reconcile the
      // "moved" camera against its own last-known target state.
      this.stepFacingTween();
    } else {
      const changed = this.controls.update();
      if (changed) this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('pointerleave', this.handlePointerLeave);
    this.controls.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
