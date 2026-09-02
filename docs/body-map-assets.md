# Body Map — anatomical asset research

Status: **no external anatomical asset is in use.** The Body Map's 3D
viewer is still the procedural mannequin in `src/lib/bodyMap3d.ts`. This
document records the license research done before considering a
real-anatomy upgrade, and what's still needed to actually make that
upgrade.

## Candidates investigated

### BodyParts3D

- Source: The Database Center for Life Science (DBCLS), Japan.
- **License: UNVERIFIED — the source directly contradicts itself.**
  - The current website (`/en/bodyparts3d/lic.html`, the download page,
    and even the "LATEST" archive's own separate `README_e.html`) all
    state **CC BY 4.0**: commercial use, redistribution, and derivative
    works explicitly permitted, attribution required.
  - **But**: the actual `.obj` data file inside that same "LATEST"
    (release 4.0) download — verified first-hand by downloading
    `partof_BP3D_4.0_obj_99.zip` and reading `FJ2810.obj`'s own header,
    not a secondhand summary — embeds this text instead:
    > "The license for this database is specified in the Creative
    > Commons Attribution-Share Alike 2.1 Japan. ... 'BodyParts3D, (c)
    > The Database Center for Life Science licensed under CC
    > Attribution-Share Alike 2.1 Japan'."
  - So the file you actually get when you download today's "LATEST"
    release carries the *old* CC BY-SA 2.1 Japan notice in its own
    header, while every webpage describing that same release says CC BY
    4.0. This is a real, first-hand-confirmed discrepancy, not a
    guess — and per this project's own rule ("if unclear, write
    UNVERIFIED, do not guess"), BodyParts3D's license is being treated
    as **UNVERIFIED** until DBCLS confirms which one actually governs
    redistribution, or the discrepancy is otherwise resolved.
  - Practical note: even the more restrictive reading (CC BY-SA 2.1
    Japan) still permits commercial use and redistribution — it just
    adds a ShareAlike condition and a different attribution string. It
    is not a hard blocker either way; it's an open question worth a
    direct email to DBCLS (bodyparts [at] dbcls.rois.ac.jp, listed on
    their download page) before shipping anything derived from this
    data.
- **Format**: OBJ only (no GLB/glTF export provided directly).
- **Structure**: individual anatomical parts/organs (1,258 files in the
  PART-OF archive alone), related through IS-A / PART-OF hierarchies.
  The external body surface is **one single unified "skin" mesh**
  (concept FMA7163, file `FJ2810.obj`, ~14.4MB as OBJ text even at the
  archive's own "99% polygon reduction" preset) — not subdivided by
  region. Practical implication: real per-region *selection* on a real
  skin mesh can't come from mesh-name mapping (there's only one mesh);
  it would reuse this project's existing position-based hotspot system
  (`HOTSPOTS_3D_FRONT`/`_BACK` in `bodyMap3d.ts`) aimed at real geometry
  instead of the procedural one. Individually-named structures (e.g.
  "right femur") do exist for a possible future optional skeletal layer.

### Z-Anatomy

- Built on top of BodyParts3D data.
- License: **CC BY-SA 4.0**. Commercial use is fine; the ShareAlike
  clause means a redistributed/modified copy of *this specific asset*
  must stay under the same license (this does not put the rest of the
  NiaCare codebase under CC BY-SA — only the asset file(s) themselves).
- Distributed as a **Blender project (.blend)** plus a **Unity-based
  standalone viewer app**. No pre-exported, web-ready GLB "full body"
  file was found sitting in the repository.

### "Vantome"

- Searched and could not find this as an identifiable, real anatomical-
  asset project. Not used, not further evaluated. If this refers to
  something specific, it needs a corrected name/URL to investigate.

## Why nothing has been integrated yet

Updated conclusion after actually downloading and inspecting the data
(not just reading webpages about it):

- **Tooling turned out not to be the blocker.** `obj2gltf` (CesiumGS,
  Apache-2.0, on npm) converts OBJ → GLB directly —
  `obj2gltf -i FJ2810.obj -o skin.glb -b` — with no Blender required.
  This was verified: the skin OBJ was actually downloaded and extracted
  from the official archive in this session.
- **Licensing is now the actual blocker**, and specifically the
  BodyParts3D-vs-embedded-file contradiction documented above. Shipping
  a derived GLB into a real product before that's resolved would mean
  committing to a license this project can't currently state with
  confidence — exactly what "do not fabricate a license" rules out.
- Z-Anatomy's CC BY-SA 4.0 is comparatively unambiguous (same
  ShareAlike-applies-to-the-asset caveat as always), but it has no
  ready web GLB either — same Blender-project situation as before.

Nothing was committed to the repository. The downloaded archive and
extracted skin mesh exist only in a local scratch directory outside the
project, never staged or pushed.

## What's ready on the code side

`src/components/body-map/anatomicalModel.ts` and
`anatomicalRegionMap.ts` exist and are ready to receive a prepared
asset, but are **not wired into `BodyMapModal`/`Mannequin3DView` yet** —
wiring them in before a real asset exists would mean writing untestable
code against a guessed mesh structure.

### If/when a GLB is ready

1. Drop the file somewhere servable (e.g. `public/models/body.glb`, or
   host it and set `VITE_ANATOMICAL_MODEL_URL`).
2. Sanity-check it loads and normalizes correctly and get the real mesh
   names, with a throwaway script — e.g.:

   ```ts
   import { loadAnatomicalModel, normalizeAnatomicalModel, listMeshNames } from './src/components/body-map/anatomicalModel';

   const model = await loadAnatomicalModel('/models/body.glb');
   normalizeAnatomicalModel(model);
   console.log(listMeshNames(model));
   ```

3. Use that mesh-name list to fill in
   `ANATOMICAL_REGION_MAP` in `anatomicalRegionMap.ts` — one entry per
   mesh, mapped to an existing key from `src/data/bodyRegions.ts` (never
   a new region identifier). Leave any mesh with no confident mapping
   out of the table; it stays non-interactive rather than guessed.
4. From there, wiring the loaded/normalized/mapped model into
   `Mannequin3DView.tsx` alongside (or in place of) the procedural
   mannequin is the remaining, now well-scoped, step — with the current
   procedural model and the 2D fallback both staying available as the
   fallback chain if the anatomical asset fails to load.

## Attribution (to include if/when an asset ships — pending license resolution)

If the CC BY 4.0 reading is confirmed correct:
> BodyParts3D, © The Database Center for Life Science licensed under CC
> Attribution 4.0 International

If the CC BY-SA 2.1 Japan reading (the one embedded in the actual file)
turns out to be the one that applies:
> BodyParts3D, (c) The Database Center for Life Science licensed under
> CC Attribution-Share Alike 2.1 Japan

Do not ship either attribution string, or the asset itself, until the
discrepancy between them is actually resolved.
