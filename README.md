# Connector — STL wall mount prototype

Browser-only Vite + TypeScript + Three.js workspace for attaching an HSW insert, SKÅDIS-compatible peg, or experimental Multiboard snap to one STL solid. Manifold WASM runs in a dedicated Web Worker. No models are uploaded, stored on a server, or persisted by this app. No remote fonts or analytics.

## License and hosting

The original app code is MIT-licensed (see `LICENSE`). Third-party code and fonts keep their own licenses: the HSW-derived source is MIT (`vendor/LICENSE`), the SKÅDIS peg is derived from John Mylchreest’s MIT OpenSCAD module (`public/licenses/SKADIS-peg-MIT.txt`), the experimental Multiboard snap is adapted from haliphax’s MIT OpenSCAD module (`public/licenses/Multiboard-snap-MIT.txt`), Manifold is Apache-2.0, Three.js is MIT, and IBM Plex Sans is OFL-1.1. Copies of required notices are included in the static build under `licenses/` and `IBM-Plex-OFL.txt`. The user-provided STL reference is not published or deployed.

The site needs no server-side model processing or Node process. Run `npm ci && npm run build`, then serve only `dist/` as static files with Caddy. For a personal VPS, point a dedicated DNS hostname to the server, add a Caddy `root` and `file_server` block, and preserve existing sites and mail records.

## Run

Requires Node 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

Open the URL printed by Vite. `dist/` is a static deployment; serve over HTTP(S), including its worker and WASM assets. Do not open `index.html` with `file://`.

## Use

1. In **Basic**, upload a binary or ASCII STL. Choose Honeycomb Storage Wall, IKEA SKÅDIS or Multiboard (prototype). The preview shows the interpreted dimensions in millimetres. STL has no unit metadata, so Auto guesses between millimetres and metres; **visually check the size before exporting**. If wrong, choose a unit in **Advanced**. The user-supplied squid test file imports at approximately 22.0 × 22.6 × 8.1 mm when Auto suggests metres.
2. Choose **Choose face center**, then click any flat face in the viewport. The app groups connected, nearly coplanar STL triangles and centers the selected connector on that patch (highlighted orange). On curved or irregular surfaces, inspect the preview and use **Advanced** to adjust XYZ, axial rotation or overlap; a local patch might be small. Advanced also holds the sample model, ±90° object rotations, reset orientation, top-center shortcut, and a universal connector-block thickness (0–10 mm, default 2 mm). It inserts a spacer between the model and connector for every wall system. Set it to 0 to fuse the connector directly to the model; this does not remove HSW’s structural floor or SKÅDIS’s behind-board retaining tail. Rotations transform the exported model.
3. Choose **Fuse & verify**, then **Download STL**. Only a successful union, validated by re-importing the exported binary STL, enables download. Changing placement, connector-block thickness, wall system, model, orientation or units invalidates the download. There is no separate dimension-confirmation checkbox.

**Fit view** sits above the preview and works from both Basic and Advanced. Cancel terminates the worker, including WASM work. A fresh worker starts for the next operation. Orbit: drag; zoom: wheel/pinch; pan: right-drag. Keyboard users can select Basic/Advanced tabs with Left/Right arrows and use the Advanced numeric placement controls. Bounding-box top centre may not lie on an irregular surface.

## Limits and release status

This is an **unverified-fit prototype**; publishing the source or site does not validate physical connector fit. No fit, load, or strength claims. Test a small print against your actual wall board before use; light-duty experimentation only. HSW, SKÅDIS and Multiboard can export validated geometry. Multiboard is experimental: its MIT-labelled third-party source does not establish the provenance of the mating dimensions or clear any rights MultiBuild might hold. Do not treat it as cleared for public distribution or commercial use without a rights/provenance review or permission.

Input: one connected, closed, outward-oriented solid, ≤10 MiB, ≤100,000 triangles, each axis 0.1–300 mm after unit conversion and coordinates within ±10,000 mm after conversion. These are conservative engineering caps, not measured device performance guarantees. No automatic repair, STEP, reliable unit metadata, board collision solver, support generation, or printer compensation. Manifold topology checks do not establish that arbitrary self-intersecting STL describes the intended physical solid. Curved/thin faces and placement near an edge may obscure reliefs or give inadequate adhesion. The preview and overlap check do not prove board clearance or attachment strength; a zero stand-off may let the model obstruct hook insertion or reduce joint strength. Face-center detection groups edge-connected triangles with normals within 5° and vertices within 0.1 mm of the selected plane; it is a geometric guide, not semantic CAD face recovery. Inspect the exported model in a slicer and check footprint/clearance yourself.

The result must have positive volume, valid Manifold status, one connected component and pass the same checks after binary STL serialization/re-import. No overlap and disconnected outcomes are rejected. Zero STL face normals are intentionally written; geometric winding carries orientation and normals can be recomputed by slicers. Large inputs may still exhaust device memory; cancel/reload and simplify your mesh.

## Connector provenance

The original [Honeycomb storage wall by rostap](https://makerworld.com/en/models/22521-honeycomb-storage-wall#profileId-27457) is listed in MakerWorld's model API as **BY-NC (Attribution-NonCommercial)**; the API does not specify a Creative Commons version. This link credits the original wall system as a compatibility target, **not** as the license source for this app. No original MakerWorld file is bundled, copied into the connector generator, or redistributed. The user-supplied `insert+M5.stl` was used only for local design reference; `references/` is ignored by Git and not deployed. If the connector geometry itself is determined to be an adaptation of the BY-NC model rather than an independent implementation, credit alone would not remove the noncommercial restriction; obtain permission before commercial use.

Fallback: [neclimdul/hws_openscad_attachments_and_connectors](https://github.com/neclimdul/hws_openscad_attachments_and_connectors), `hws_insert_util.scad`, MIT, copyright © 2023 James Gilliland. The exact source snapshot retrieved on 2026-11-12 and full license are preserved in `vendor/`. `src/pipeline.ts` independently ports the solid type-2 insert: 19.7 mm body across flats, 22.5 mm lip, 10 mm height, top taper, six wall reliefs and six rounded retention snaps. It now has an open 13.4 mm-across-flats interior cavity above a 2.5 mm floor to reduce material, retaining reliefs and snaps. The cavity is not an M5 fastener hole; it omits decorative and corner/base chamfer cuts, attachment holes and neighboring insert links. Standalone connector volume at 0 mm added block is about 2,282 mm³ versus about 3,449 mm³ for the earlier solid plug (about 34% less geometric volume, not a measured filament or strength result). It is not an original HSW asset, a generic hex plug, or a claim of certified compatibility.

The SKÅDIS-compatible peg is adapted from [John Mylchreest’s ikea-skadis.scad](https://github.com/jmylchreest/openscad-models/tree/edeea813c1f7941eea1e2d8fe9e1f844de0a227b/libraries/ikea-skadis), copyright © 2026 John Mylchreest, under MIT; its complete notice ships in `public/licenses/SKADIS-peg-MIT.txt`. `src/pipeline.ts` ports the single peg with an optional 10 × 15 mm stand-off (0–10 mm deep), 4.6 mm slot tab and behind-board retainer, using Manifold instead of OpenSCAD/BOSL2. This is a compatibility design, not an IKEA file or an IKEA endorsement. Physical fit, board thickness variation and load capacity have not been verified. The MIT source licence does not grant any separate rights IKEA may hold.

The experimental Multiboard snap is adapted from [haliphax/multiboard-openscad `parts/snap.scad`](https://github.com/haliphax/multiboard-openscad/blob/95a37a6b75fe3feaac61db63dfac0576480ac1df/parts/snap.scad), copyright © 2026 haliphax, under MIT; its complete notice ships in `public/licenses/Multiboard-snap-MIT.txt`. The Manifold port uses an octagonal body with four prongs and relief slots, rotated so its broad cap joins the model and its slotted snap fingers face the wall; no official MultiBuild CAD or BOSL2 dependency is bundled. The source's MIT notice covers the author's software grant, not necessarily any underlying MultiBuild design rights. We have **not established whether the mating profile was independently developed**. It is not endorsed by MultiBuild and has not been physical-fit tested; do not assume public distribution or commercial use is cleared. MultiBuild's own [design licence](https://multibuild.io/license) is separate from the haliphax code licence.

IBM Plex Sans (self-hosted WOFF2 from `@ibm/plex-sans` 1.1.0): SIL Open Font License 1.1. Font files are included in the build; the required copyright notice and license are shipped as `IBM-Plex-OFL.txt`.

Manifold: Apache-2.0. Three.js: MIT. Other dependency license notices are included in their npm packages.

## Verification

`npm test` uses actual Manifold WASM in Node, real solid geometry and exported binary STL re-import. It verifies connected watertight fused output, detailed connector geometry, malformed/open/oversized input rejection and disconnected placement rejection.

HSW, SKÅDIS and Multiboard connector geometry, fusion, thickness variation, and binary STL re-import have automated tests. Build warnings concern bundle size and Manifold's guarded Node import.

Browser integration checks (after building):

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/.browsers" npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH="$PWD/.browsers" npm run test:browser
```

Chromium tests cover switching between HSW, SKÅDIS and Multiboard, changing universal block thickness, and downloading a validated fused STL, the Basic/Advanced disclosure, confirmation-free STL import/face selection/fusion/download path, real worker/WASM union, disconnected placement and stale-download rejection, unit override, face-center picking, orientation and mobile overflow. Production-browser tests also confirm the bundled worker and WASM load without page errors.

The two original planning Markdown documents remain unchanged; their original physical print-fit gate is still outstanding.
