# Storage-wall CAD connector app

## Original idea

A web app that uploads a CAD file (e.g. STL), lets the user choose a storage-wall surface and/or connector type (Multiboard, Honeycomb Storage Wall, IKEA SKÅDIS), then outputs the original piece with a connector so it mounts on that system.

## User-defined features

- Upload a CAD/model file.
- Choose a target wall system and/or compatible connector type.
- Export a modified model with the connector attached.

## Agreed design direction

- Build a free browser-only public app with HSW and STL input/output first, then add SKÅDIS and Multiboard after print-fit validation; STEP is later scope.
- Provide a 3D preview and explicit connector placement/orientation; reject invalid or non-manifold uploads rather than promising every file works.
- Export one fused, printable mesh. Use the original HSW project as the chosen connector source; no further user confirmation of this license choice is needed.

## Plan

- [Provisional implementation plan](storage-wall-cad-connector-plan.md) — Based on the grill-me interview and the chosen original HSW connector source.

## Still open

- Exact original HSW connector asset to integrate, attribution metadata, fit tolerance, and tested board variant.
- Browser geometry performance budgets and board-specific connectors for SKÅDIS and Multiboard.
- Measured geometry performance limits and physical connector fit remain engineering work, not further licensing questions for the user.
