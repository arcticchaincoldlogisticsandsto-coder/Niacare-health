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
  // RENDERED QA FINDING: every marker radius below was originally a
  // leftover from the old capsule-chain geometry's own proportions and
  // was never re-checked against the new lathe body's actual surface
  // width — 'chest'/'abdomen'/'back' at 0.13-0.16 were as large as or
  // LARGER than the torso itself, rendering as a giant disc covering
  // most of the upper body rather than a localized highlight. All
  // shrunk to roughly a quarter to a third of the local body radius.
  { key: 'chest', position: [0, 1.42, 0.155], radius: 0.05 },
  { key: 'heart', position: [-0.06, 1.42, 0.17], radius: 0.035 },
  { key: 'lungs', side: 'left', position: [-0.11, 1.44, 0.14], radius: 0.04 },
  { key: 'lungs', side: 'right', position: [0.11, 1.44, 0.14], radius: 0.04 },
  { key: 'abdomen', position: [0, 1.16, 0.15], radius: 0.05 },
  // Limb marker x/y below are computed from the arm/leg lathe profiles in
  // bodyMap3d.ts's buildMannequinBody(), including the arm's shoulder
  // pivot/lean — see that function's header comment (and its "RENDERED QA
  // FINDING" note on the shoulder width) for the derivation. Radii are
  // also shrunk from the first pass for the same reason as the torso
  // markers above — sized to the actual (fairly slim) limb thickness.
  { key: 'shoulder', side: 'left', position: [-0.17, 1.47, 0.04], radius: 0.05 },
  { key: 'shoulder', side: 'right', position: [0.17, 1.47, 0.04], radius: 0.05 },
  { key: 'arm', side: 'left', position: [-0.192, 1.312, 0.02], radius: 0.04 },
  { key: 'arm', side: 'right', position: [0.192, 1.312, 0.02], radius: 0.04 },
  { key: 'elbow', side: 'left', position: [-0.213, 1.168, 0.01], radius: 0.032 },
  { key: 'elbow', side: 'right', position: [0.213, 1.168, 0.01], radius: 0.032 },
  { key: 'wrist', side: 'left', position: [-0.249, 0.911, 0], radius: 0.024 },
  { key: 'wrist', side: 'right', position: [0.249, 0.911, 0], radius: 0.024 },
  { key: 'hand', side: 'left', position: [-0.256, 0.861, 0.01], radius: 0.03 },
  { key: 'hand', side: 'right', position: [0.256, 0.861, 0.01], radius: 0.03 },
  { key: 'hip', side: 'left', position: [-0.09, 0.9, 0.09], radius: 0.045 },
  { key: 'hip', side: 'right', position: [0.09, 0.9, 0.09], radius: 0.045 },
  { key: 'thigh', side: 'left', position: [-0.09, 0.7, 0.05], radius: 0.04 },
  { key: 'thigh', side: 'right', position: [0.09, 0.7, 0.05], radius: 0.04 },
  { key: 'knee', side: 'left', position: [-0.09, 0.5, 0.06], radius: 0.032 },
  { key: 'knee', side: 'right', position: [0.09, 0.5, 0.06], radius: 0.032 },
  { key: 'leg', side: 'left', position: [-0.09, 0.35, 0.02], radius: 0.03 },
  { key: 'leg', side: 'right', position: [0.09, 0.35, 0.02], radius: 0.03 },
  { key: 'ankle', side: 'left', position: [-0.09, 0.085, 0.02], radius: 0.022 },
  { key: 'ankle', side: 'right', position: [0.09, 0.085, 0.02], radius: 0.022 },
  { key: 'foot', side: 'left', position: [-0.09, 0.075, 0.08], radius: 0.032 },
  { key: 'foot', side: 'right', position: [0.09, 0.075, 0.08], radius: 0.032 },
];

// Back-facing hotspots — same limb keys mirrored onto the rear surface
// (z negated / small rear offset), plus 'back' and 'spine' which only ever
// exist on this side. Matches the 2D viewer's BACK_HOTSPOTS concept.
export const HOTSPOTS_3D_BACK: Hotspot3D[] = [
  { key: 'head', position: [0, 1.66, -0.02], radius: 0.115 },
  { key: 'neck', position: [0, 1.535, -0.05], radius: 0.05 },
  { key: 'back', position: [0, 1.3, -0.155], radius: 0.06 },
  { key: 'spine', position: [0, 1.25, -0.17], radius: 0.025 },
  { key: 'shoulder', side: 'left', position: [-0.17, 1.47, -0.04], radius: 0.05 },
  { key: 'shoulder', side: 'right', position: [0.17, 1.47, -0.04], radius: 0.05 },
  { key: 'arm', side: 'left', position: [-0.192, 1.312, -0.02], radius: 0.04 },
  { key: 'arm', side: 'right', position: [0.192, 1.312, -0.02], radius: 0.04 },
  { key: 'elbow', side: 'left', position: [-0.213, 1.168, -0.01], radius: 0.032 },
  { key: 'elbow', side: 'right', position: [0.213, 1.168, -0.01], radius: 0.032 },
  { key: 'wrist', side: 'left', position: [-0.249, 0.911, 0], radius: 0.024 },
  { key: 'wrist', side: 'right', position: [0.249, 0.911, 0], radius: 0.024 },
  { key: 'hand', side: 'left', position: [-0.256, 0.861, -0.01], radius: 0.03 },
  { key: 'hand', side: 'right', position: [0.256, 0.861, -0.01], radius: 0.03 },
  { key: 'hip', side: 'left', position: [-0.09, 0.9, -0.09], radius: 0.045 },
  { key: 'hip', side: 'right', position: [0.09, 0.9, -0.09], radius: 0.045 },
  { key: 'thigh', side: 'left', position: [-0.09, 0.7, -0.05], radius: 0.04 },
  { key: 'thigh', side: 'right', position: [0.09, 0.7, -0.05], radius: 0.04 },
  { key: 'knee', side: 'left', position: [-0.09, 0.5, -0.06], radius: 0.032 },
  { key: 'knee', side: 'right', position: [0.09, 0.5, -0.06], radius: 0.032 },
  { key: 'leg', side: 'left', position: [-0.09, 0.35, -0.02], radius: 0.03 },
  { key: 'leg', side: 'right', position: [0.09, 0.35, -0.02], radius: 0.03 },
  { key: 'ankle', side: 'left', position: [-0.09, 0.085, -0.02], radius: 0.022 },
  { key: 'ankle', side: 'right', position: [0.09, 0.085, -0.02], radius: 0.022 },
  { key: 'foot', side: 'left', position: [-0.09, 0.075, -0.08], radius: 0.032 },
  { key: 'foot', side: 'right', position: [0.09, 0.075, -0.08], radius: 0.032 },
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

// Neutral matte clinical surface — desaturated cool gray, not a pale-blue
// plastic tint, and high roughness / near-zero metalness so it never
// picks up the shiny "toy figurine" specular highlight a glossier
// material would under the key light below. DoubleSide is a deliberate
// safety net for the lathe-revolved meshes below: a lathe's face winding
// depends on point-array order, and this project has no way to preview a
// render and catch an inverted-normal "hole" before shipping — rendering
// both sides costs nothing on a model this size and guarantees there is
// never an invisible patch of body.
const clinicalMaterial = () =>
  new THREE.MeshStandardMaterial({
    color: 0xd6dbe1,
    roughness: 0.7,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

/** One (radius, height) profile point for a THREE.LatheGeometry silhouette. */
const pt = (radius: number, y: number) => new THREE.Vector2(radius, y);

/** Builds the static mannequin geometry as one connected group.
 *
 * Previous version: the torso was three stacked capsules (chest/abdomen/
 * pelvis) plus a separate neck cylinder and head sphere, and every limb
 * was a chain of capsule segments bridged by visible sphere "joint
 * fillets." That reads as an assembly of primitives no matter how well
 * the seams are hidden, because it structurally IS one — a viewer's eye
 * catches the repeated ball-at-every-bend rhythm.
 *
 * This version: the torso+neck is ONE THREE.LatheGeometry — a silhouette
 * profile (pelvis -> waist -> ribcage -> chest -> shoulder line -> neck)
 * revolved 360 degrees around the spine axis, so there are no seams to
 * hide because there are no separate segments. Each arm and each leg is
 * likewise ONE lathe profile (shoulder/hip -> limb -> wrist/ankle), built
 * in local space and positioned so its own top radius overlaps into the
 * torso's surface radius at the attachment height — a real, deliberate
 * overlap (not a bridging sphere) is what makes the limb read as
 * continuous with the body. Only the head (an oval sphere), hands, and
 * feet — none of which are radially symmetric the way a lathe requires —
 * are separate primitives, and they're small, terminal, and overlapped
 * into their own limb's end rather than resting flush against it.
 *
 * No per-region hotspot markers here — those are separate meshes in
 * setHotspots() so they can be styled/hit-tested independently.
 *
 * IMPORTANT CAVEAT: this geometry was authored entirely from profile
 * math, with no way to render and visually inspect it in this
 * environment. The proportions below are a reasoned best effort against
 * the brief's explicit measurements (narrower neck, wider torso than
 * waist, subtle joints, tapered limbs) — they have not been visually
 * verified and may need real adjustment once someone can actually look
 * at the rendered model. See MannequinViewer's own header/report notes.
 */
const buildMannequinBody = (): THREE.Group => {
  const group = new THREE.Group();
  const mat = clinicalMaterial();

  const addMesh = (geo: THREE.BufferGeometry, x: number, y: number, z = 0, material = mat) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // ---- Torso + neck: one continuous revolved silhouette -------------
  // Pelvis (widest lower point) -> natural waist (narrowest) -> ribcage
  // -> chest (widest upper point) -> shoulder line -> neck (narrower
  // than the shoulders) -> a near-closed cap the head sphere overlaps.
  // The pelvis-floor (0.83->0.87) and the very top cap (1.6->1.615) are
  // both steep, but neither is a visual risk: the former sits right where
  // the legs' hip attachment (embedded, radius 0.085, centered y=0.9)
  // covers it, and the latter is fully inside the head sphere (bottom
  // surface at y~1.547, well past 1.615). The shoulder-to-neck taper
  // (1.39 -> 1.535) is genuinely visible and unoccluded, so it's built
  // from more, smaller steps with a gradually INCREASING slope
  // (~11 -> 19 -> 31 -> 45 -> 53 -> 57 degrees) rather than one jump from
  // a ~13 degree chest taper straight into a ~55 degree collar — a sudden
  // slope change between adjacent rows is what reads as a crease on a
  // lathe surface, not the raw steepness of any one row by itself.
  // RENDERED QA FINDING (first real screenshot, not just profile math):
  // with the shoulder line NARROWER than the chest and the arm pivot
  // tucked in close (x=0.09) to guarantee a seamless join, the arm never
  // actually separated from the torso's own silhouette — two convex
  // shapes with no concavity between them just read as "one slightly
  // wider torso," not "a torso plus an arm." Real shoulders are closer to
  // the WIDEST point of the upper torso (deltoid), wider than the chest
  // below them — that width difference is what creates the armpit
  // concavity an arm needs to read as a separate limb. Shoulder line
  // widened accordingly; the arm pivot below was moved out to match.
  const torsoProfile = [
    pt(0.02, 0.83),
    pt(0.115, 0.87),
    pt(0.135, 0.97),
    pt(0.118, 1.04),
    pt(0.1, 1.11),
    pt(0.115, 1.19),
    pt(0.14, 1.3),
    pt(0.148, 1.39),
    pt(0.165, 1.42),
    pt(0.185, 1.45),
    pt(0.19, 1.47),
    pt(0.15, 1.49),
    pt(0.1, 1.505),
    pt(0.07, 1.52),
    pt(0.052, 1.535),
    pt(0.049, 1.6),
    pt(0.008, 1.615),
  ];
  // RENDERED QA FINDING: 20 radial segments showed a faint faceted seam
  // at oblique (three-quarter) viewing angles, most visible around the
  // shoulder-to-neck curve where the profile changes fastest. Raised to
  // 32 — still a trivial polygon count for a mesh this size.
  addMesh(new THREE.LatheGeometry(torsoProfile, 32), 0, 0);

  // ---- Head: a restrained oval, not a perfect ball or a face -------
  const head = addMesh(new THREE.SphereGeometry(0.105, 20, 16), 0, 1.665);
  head.scale.set(1, 1.12, 0.97);

  // ---- Arms: one lathe profile per side, local y=0 at the shoulder,
  // rotated outward from vertical so the limb drifts naturally away
  // from the torso going down (a relaxed hanging arm, not a T-pose) —
  // the rotation pivot IS the shoulder attachment point, so the whole
  // limb sweeps around it correctly. Built for the right side (s=+1)
  // then mirrored by negating x for the left.
  const armProfile = [
    pt(0.075, 0),
    pt(0.066, -0.04),
    pt(0.058, -0.16),
    pt(0.05, -0.28),
    pt(0.045, -0.305),
    pt(0.047, -0.335),
    pt(0.041, -0.44),
    pt(0.034, -0.545),
    pt(0.03, -0.565),
    pt(0.01, -0.58),
  ];
  // RENDERED QA FINDING: the calf bulge here was originally only 2mm
  // (0.05 -> 0.052), imperceptible in the screenshot — the whole lower
  // leg read as one long taper to a point rather than a calf-into-ankle
  // shape. Widened the bulge and kept the ankle from thinning as much.
  const legProfile = [
    pt(0.085, 0),
    pt(0.08, -0.05),
    pt(0.068, -0.2),
    pt(0.058, -0.36),
    pt(0.05, -0.4),
    pt(0.06, -0.43),
    pt(0.05, -0.55),
    pt(0.04, -0.68),
    pt(0.034, -0.79),
    pt(0.03, -0.815),
    pt(0.01, -0.83),
  ];
  const ARM_LEAN = 0.14; // radians, outward lean from vertical

  for (const s of [-1, 1] as const) {
    const arm = new THREE.Group();
    arm.position.set(0.17 * s, 1.47, 0.02);
    arm.rotation.z = ARM_LEAN * s;
    const armMesh = new THREE.Mesh(new THREE.LatheGeometry(armProfile, 18), mat);
    armMesh.castShadow = true;
    armMesh.receiveShadow = true;
    arm.add(armMesh);
    // Hand: a flattened capsule (a paddle-like palm silhouette, not
    // individual fingers) — a child of the rotated arm group so it
    // inherits the same outward lean automatically, attached just past
    // the wrist end with enough overlap to hide that seam too.
    const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.05, 4, 10), mat);
    hand.scale.set(1, 1, 0.55);
    // y=-0.615 (not tight to the -0.58 wrist cap) gives roughly 16mm of
    // real overlap into the arm lathe's end, not the ~3mm the first pass
    // had — a margin this thin is asking for a visible gap I have no way
    // to catch without rendering it.
    hand.position.set(0, -0.615, 0);
    hand.castShadow = true;
    hand.receiveShadow = true;
    arm.add(hand);
    group.add(arm);

    const leg = new THREE.Group();
    leg.position.set(0.09 * s, 0.9, 0.06);
    const legMesh = new THREE.Mesh(new THREE.LatheGeometry(legProfile, 18), mat);
    legMesh.castShadow = true;
    legMesh.receiveShadow = true;
    leg.add(legMesh);
    // Foot: a flattened, elongated capsule for the midfoot/forefoot,
    // plus a small heel bump behind it — heel, midfoot, and forefoot as
    // three blended forms rather than one box or sphere standing in for
    // the whole foot.
    //
    // Three.js composes a mesh's local matrix as position * rotation *
    // scale, i.e. scale is applied in the geometry's OWN unrotated frame
    // first, then rotated. This capsule's native axis is Y (length) with
    // a circular X/Z cross-section (radius 0.03); rotation.x=90 degrees
    // then remaps that already-scaled shape as (x,y,z) -> (x,-z,y). So to
    // land on a target of roughly 0.05 wide (X) x 0.036 tall (Y) x 0.16
    // long front-to-back (Z) in the FINAL, rotated orientation, the scale
    // has to be chosen in the PRE-rotation frame: scale.x drives final
    // width directly (unaffected by this rotation), scale.z drives final
    // height (it becomes -Y after rotating), and scale.y drives final
    // length (it becomes Z after rotating) — not the more intuitive
    // "scale.z for depth" a non-rotated mesh would use. Getting this
    // backwards was the actual cause of the first pass's foot looking
    // more like a squat blob than a flat elongated foot.
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 10), mat);
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(0.85, 0.9, 0.6);
    foot.position.set(0, -0.825, 0.05);
    foot.castShadow = true;
    foot.receiveShadow = true;
    leg.add(foot);
    const heel = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), mat);
    heel.scale.set(1, 0.7, 0.85);
    heel.position.set(0, -0.828, -0.045);
    heel.castShadow = true;
    heel.receiveShadow = true;
    leg.add(heel);
    group.add(leg);
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

    // Soft, controlled three-point-style setup: a wide ambient fill so no
    // side of the figure ever goes fully dark, a moderate key light (not
    // a dramatic single hard source), and a cool rim/fill opposite it —
    // professional product-visualization lighting, not game lighting.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc7d2e0, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 0.95);
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

  // counts: regionKey -> number of health records tagged there. This is a
  // "health activity" indicator, never a severity/risk signal — a region
  // with 2+ records gets a marginally stronger (not alarming) highlight
  // than one with exactly 1, and an unmarked region gets none at all. No
  // color here is ever driven by diagnosis content, only by record count.
  setMarkedKeys(counts: Map<string, number>) {
    for (const [regionKey, mesh] of this.markers) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const isSelected = regionKey === this.selectedKey;
      const count = counts.get(regionKey) || 0;
      const color = isSelected ? this.markerColors.selected : this.markerColors.marked;
      mat.color.set(color);
      mat.emissive.set(color);
      mat.emissiveIntensity = isSelected ? 0.7 : count > 1 ? 0.42 : count === 1 ? 0.3 : 0;
      mat.opacity = isSelected ? 0.6 : count > 1 ? 0.34 : count === 1 ? 0.24 : 0;
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

  // Discrete step for the compact Zoom In/Out buttons — same clamp
  // (minDistance/maxDistance) OrbitControls already enforces for
  // scroll/pinch, so a button tap can never zoom past what a gesture could.
  zoomStep(direction: 'in' | 'out') {
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    const distance = dir.length();
    const factor = direction === 'in' ? 0.85 : 1 / 0.85;
    const nextDistance = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, distance * factor));
    dir.setLength(nextDistance);
    this.camera.position.copy(this.controls.target).add(dir);
    this.controls.update();
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
    const wasMarked = mat.opacity >= 0.2;
    if (wasMarked) return;
    mat.opacity = hoverOn ? 0.14 : 0;
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
