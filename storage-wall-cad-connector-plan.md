# Storage-wall CAD connector app — provisional implementation plan

Status: design direction agreed; implementation has not started.

## Decisions from the interview

- Public, free web app for makers; model processing stays in the browser, with no model upload to a server.
- First release: HSW; later add IKEA SKÅDIS and Multiboard in the same product after physical validation.
- STL input and single fused STL output initially. “Any CAD file” is a long-term aspiration, not an MVP guarantee.
- User selects a mounting face/region, adjusts orientation/position, and previews before exporting.
- Light-duty small printed objects only; no load rating. Reject invalid input or failed merge with a useful diagnostic; enforce an empirically chosen input-size/triangle limit.
- Use the original HSW project as the connector source, per the user’s license decision. Record the exact source file, its stated license, version, and required attribution in the repository and app. Do not ask the user to reconfirm this choice.
- Test HSW physically first; obtain SKÅDIS/Multiboard boards or recruit print-fit testers before enabling their export options.

## Architecture

Static TypeScript web app, deployable on a static host. Three.js for input and connector preview; a Web Worker runs STL parsing, topology checks, connector positioning, solid union, export and post-export validation. Evaluate Manifold WASM as the browser geometry engine: its project describes browser WASM solid operations and specifically cautions that STL roundtrips can lose topology.[6] Thus re-import the actual exported STL and test it, not only the in-memory mesh. No account, model retention, analytics of raw geometry, or server compute.

Treat each target as a versioned `ConnectorDefinition`: geometry or reproducible generator, source/license/attribution record, mounting normal, insertion direction, anchor plane, clearance range, board variant, and physical-test record. The pipeline is import → parse/units confirmation (STL units are not encoded) → manifold/bounds checks → choose surface/point → place connector with intentional overlap or printable pad → detect board/object collisions → boolean union → validate shell/bounds → export/re-import → download. “Fused” means connected, watertight geometry, not concatenated meshes.

## Delivery stages and gates

1. **Connector/fit preparation.** Select the object-mount plug from the original HSW project, record its file/version/license attribution with the shipped asset, and obtain a physical HSW tile. Gate: a reproducible reference print. No further user confirmation of the source choice is needed. An independently MIT-licensed OpenSCAD HWS generator remains an optional engineering fallback if the selected file cannot be integrated technically.[4]
2. **Geometry spike.** In a small browser prototype, import a simple STL, combine a candidate plug with overlap, re-import exported STL, and test watertightness/connectedness and slicer acceptance. Profile several real sizes and deliberately broken/concave/curved inputs before choosing the file and triangle limits. Gate: real exported files and timings, not screenshots.
3. **HSW MVP.** Build drag/drop, board and connector selection (one verified HSW preset), units confirmation, face/point selection, transform controls with snap/clearance display, intersection/printability warnings, worker progress/cancel, and a single STL download. Fail explicitly on non-manifold inputs, failed union, absent overlap, collisions, and budget overrun.
4. **Validation.** Automated fixtures: cube, curved shell, thin wall, multi-shell, malformed/non-watertight, reversed normals, near-coplanar overlap, very large mesh; check import/export/union invariants and graceful errors. Print fit samples with tolerance variants and common FDM materials, and collect reproducible fit results. Gate: no unsupported compatibility or load claims; documented known limitations.
5. **Public beta.** Static deployment with a privacy statement (“models stay in your browser”), source/attribution notice, printable calibration sample, feedback channel, and performance/error telemetry only if opt-in and geometry-free. Measure completion rate and failure classes, then prioritize repairs.
6. **Expand by adapter.** SKÅDIS then Multiboard each get independently licensed geometry, variant-specific wall fixtures, collision checks, physical test matrix, and preset enablement gate. A second input format or STEP/B-rep handling is a separate pipeline, not just another extension toggle.

## Risks / non-goals

- A clicked triangle on a curved surface is not automatically a printable attachment plane: add an explicit pad/footprint and preview interference, or reject.
- Filament, orientation, wall dimensions and printer tolerances affect fit and strength; use calibration rather than asserting a universal connector.
- STL carries no reliably specified units, so require explicit millimetre confirmation and bounds sanity checks.
- Browser WASM can exhaust memory; cap input and allow cancellation. Do not silently upload private models as fallback.
- No automatic repair, load certification, heavy-object claims, or arbitrary CAD formats in the first release.

## Acceptance criteria for first public release

A user can import an in-budget, valid STL, confirm its scale, select an HSW attachment region, see placement and interference, export a **single** connected/watertight STL, and import it in a slicer. Unsupported inputs fail with actionable error text rather than a corrupt download. The connector source/attribution and fit test are recorded. At least one physical HSW print fits; SKÅDIS/Multiboard are labeled planned, not supported.
## Sources

[4] https://github.com/neclimdul/hws_openscad_attachments_and_connectors — OpenSCAD HWS connector generator
[6] https://github.com/elalish/manifold/blob/master/bindings/wasm/README.md — Manifold WASM README
