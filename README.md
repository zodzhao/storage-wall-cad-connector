# Connector

Attach a **Honeycomb Storage Wall (HSW)** insert, **IKEA SKÅDIS** peg, or **Multiboard** snap (experimental) to any 3D-printable STL model—entirely in your browser. No files are uploaded or stored on a server.

## How to use

1. **Open an STL** in the **Basic** tab (or click **Try a sample solid** in **Advanced**).
2. **Choose a wall system** (HSW, IKEA SKÅDIS, or Multiboard).
3. Click **Choose face center**, then click any face on your model to preview the orange connector.
4. Click **Fuse & verify**, then **Download STL ↓**.

### Controls & shortcuts

- **Orbit / Pan / Zoom:** Left-drag · Right-drag · Scroll (or pinch)
- **Undo / Redo:** `Ctrl+Z` (`⌘+Z`) · `Ctrl+Shift+Z` / `Ctrl+Y`
- **Cancel face pick:** `Esc`
- **Help (`?`):** Click `?` in the top-right bar for quick instructions inside the app.

### Advanced options

- **STL coordinate units:** STL files have no unit metadata; switch between `mm`, `cm`, `m`, or `in` if auto-detection guesses wrong.
- **Placement (`X / Y / Z`, `Rot X / Y / Z`, Quick rotate):** Fine-tune position (mm) and rotate the connector piece (`°`) around the selected face.
- **Overlap (`0.1–2 mm`):** Embed depth into your model for a solid Boolean union.
- **Block (`0–10 mm`):** Spacer pad between your model and the connector (`0` = flush).

## Limits & prototype notice

- **Supported input:** One closed, watertight solid, `≤ 10 MiB`, `≤ 100,000` triangles, `0.1–300 mm` per axis.
- **Unverified physical fit:** Connector geometry is watertight and slicer-ready, but physical print-fit and load capacity are untested. Do a small test print before load-bearing use.

## Run locally

Requires Node.js 20.19+ (or 22.12+).

```sh
npm install
npm run dev
```

## License & credits

MIT-licensed app ([`LICENSE`](LICENSE)). Built with Three.js (MIT), Manifold (Apache-2.0), and IBM Plex Sans (OFL-1.1).

- Original HSW listing: [Honeycomb storage wall by rostap](https://makerworld.com/en/models/22521-honeycomb-storage-wall#profileId-27457) (CC BY-NC; original files not bundled)
- HSW connector source: [neclimdul/hws_openscad_attachments_and_connectors](https://github.com/neclimdul/hws_openscad_attachments_and_connectors) (MIT)
- SKÅDIS peg source: [John Mylchreest’s `ikea-skadis.scad`](https://github.com/jmylchreest/openscad-models/tree/edeea813c1f7941eea1e2d8fe9e1f844de0a227b/libraries/ikea-skadis) (MIT; not affiliated with IKEA)
- Multiboard snap source: [haliphax/multiboard-openscad `parts/snap.scad`](https://github.com/haliphax/multiboard-openscad/blob/95a37a6b75fe3feaac61db63dfac0576480ac1df/parts/snap.scad) (MIT; experimental, not affiliated with MultiBuild)
