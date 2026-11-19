import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Placement, InputUnit, WallSystem } from "./pipeline";
import "./style.css";
document.querySelector("#app")!.innerHTML = `
  <main class="map-layout">
    <div id="viewport" aria-label="Interactive 3D model preview">
      <div id="pickHint" class="pick-hint" hidden>Click any face on the model · Esc to cancel</div>
      <div id="dropOverlay" class="drop-overlay" hidden>Drop .stl file to open</div>
      <div class="legend"><i></i> Object <i class="orange"></i> Insert · mm</div>
    </div>

    <aside class="map-card" aria-label="Connector controls">
      <div class="card-header">
        <a class="brand" href="./" aria-label="Connector workspace home">
          <span class="brand-badge">C</span>
          <span>Connector</span>
        </a>
        <h1>Attach your model</h1>
      </div>
      <div id="mobileNotice" class="mobile-notice" role="note">
        <span>Best used on a desktop computer for 3D picking &amp; STL export.</span>
        <button id="mobileNoticeClose" type="button" aria-label="Dismiss desktop recommendation">✕</button>
      </div>
      <div class="tabs" role="tablist" aria-label="Configuration">
        <button id="basicTab" type="button" role="tab" aria-selected="true" aria-controls="basicPanel">Basic</button>
        <button id="advancedTab" type="button" role="tab" aria-selected="false" aria-controls="advancedPanel" tabindex="-1">Advanced</button>
      </div>
      <div id="basicPanel" role="tabpanel" aria-labelledby="basicTab">
        <div class="step">
          <label class="upload">
            <span class="upload-title">Open an STL</span>
            <span class="upload-sub">Drop or browse .stl file</span>
            <input id="file" type="file" accept=".stl" />
          </label>
          <a href="#sample" id="quickSample" class="quick-sample">or try a sample solid</a>
        </div>
        <div class="step">
          <label class="field-label" for="wallSystem">Wall system</label>
          <select id="wallSystem" aria-label="Wall system"><option value="hsw">Honeycomb Storage Wall (HSW)</option><option value="skadis">IKEA SKÅDIS</option><option value="multiboard">Multiboard (prototype)</option></select>
          <p id="systemNote" class="muted" hidden>Experimental Multiboard snap: source-code licence does not establish mating-profile provenance or physical fit. Verify rights before sharing.</p>
        </div>
        <div class="step step-last">
          <button id="pick" disabled>Choose face center</button>
          <p class="muted">Click, then select a face on the model.</p>
        </div>
      </div>
      <div id="advancedPanel" role="tabpanel" aria-labelledby="advancedTab" hidden>
        <div class="adv-section">
          <div class="adv-row">
            <h2>Model &amp; units</h2>
            <button id="sample" type="button">Try a sample solid</button>
          </div>
          <label class="units">STL coordinate units<select id="units"><option value="auto">Auto (suggest units)</option><option value="mm">Millimetres (mm)</option><option value="cm">Centimetres (cm)</option><option value="m">Metres (m)</option><option value="in">Inches (in)</option></select></label>
          <p id="unitInfo" class="muted">Auto-detects mm or m · 0.1–300 mm</p>
        </div>

        <div class="adv-section adv-section-last">
          <div class="adv-row">
            <h2>Placement</h2>
            <button id="top" disabled>Use top centre (+Z)</button>
          </div>
          <div class="fields">${["x", "y", "z"].map((x) => `<label>${x.toUpperCase()} / mm<input id="${x}" type="number" step="0.1" value="0"></label>`).join("")}
            <label>Rot X / °<input id="rotX" type="number" step="5" value="0"></label>
            <label>Rot Y / °<input id="rotY" type="number" step="5" value="0"></label>
            <label>Rot Z / °<input id="rotation" type="number" step="5" value="0"></label>
          </div>
          <div class="adv-row" style="margin: 0 0 10px;">
            <span class="field-label" style="margin:0;">Quick rotate</span>
            <div class="rotate-row">
              <button id="connRotX90" aria-label="Rotate connector X +90°" title="Rotate connector X +90°" disabled>X +90°</button>
              <button id="connRotY90" aria-label="Rotate connector Y +90°" title="Rotate connector Y +90°" disabled>Y +90°</button>
              <button id="connRotZ90" aria-label="Rotate connector +90°" title="Rotate connector Z +90°" disabled>Z +90°</button>
              <button id="connRotReset" aria-label="Reset connector rotation" title="Reset connector rotation (0°)" disabled>0°</button>
            </div>
          </div>
          <div class="fields fields-2">
            <label>Overlap / mm<input id="depth" type="number" min="0.1" max="2" step="0.1" value="1"></label>
            <label>Block / mm<input id="blockThickness" type="number" min="0" max="10" step="0.5" value="2"></label>
          </div>
          <p id="normal" class="muted">No mounting face selected</p>
        </div>
      </div>
    </aside>

    <div class="map-top-right">
      <span id="modelInfo" class="info-pill">One Object · ≤10 MiB · ≤100k triangles</span>
      <button id="reset" type="button">Fit view</button>
      <button id="helpBtn" type="button" aria-label="Help & instructions" title="Help & instructions">?</button>
    </div>

    <dialog id="helpDialog" class="help-dialog" aria-labelledby="helpTitle">
      <div class="help-header">
        <h2 id="helpTitle">How to use Connector</h2>
        <button id="helpClose" type="button" aria-label="Close help">✕</button>
      </div>
      <div class="help-body">
        <section>
          <h3>Quick start</h3>
          <ol>
            <li><strong>Open an STL</strong> in <strong>Basic</strong> (or click <strong>Try a sample solid</strong> in <strong>Advanced</strong>). Everything runs locally in your browser (<code>0.1–300 mm</code>, <code>≤10 MiB</code>, <code>≤100k triangles</code>).</li>
            <li>Select your <strong>Wall system</strong> (HSW, IKEA SKÅDIS, or Multiboard).</li>
            <li>Click <strong>Choose face center</strong>, then click a face on the 3D model to preview the orange connector.</li>
            <li>Click <strong>Fuse &amp; verify</strong>, then <strong>Download STL ↓</strong>.</li>
          </ol>
        </section>
        <section>
          <h3>Controls &amp; shortcuts</h3>
          <ul>
            <li><strong>Orbit / Pan / Zoom:</strong> Left-drag · Right-drag · Scroll</li>
            <li><strong>Undo / Redo:</strong> <kbd>Ctrl</kbd>+<kbd>Z</kbd> (<kbd>⌘</kbd>+<kbd>Z</kbd>) · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd></li>
            <li><strong>Cancel face pick:</strong> <kbd>Esc</kbd></li>
          </ul>
        </section>
        <section>
          <h3>Advanced placement</h3>
          <ul>
            <li><strong>STL coordinate units:</strong> STL files have no unit metadata. Override auto-detection if dimensions look off.</li>
            <li><strong>Rot X / Y / Z (°):</strong> Rotates the connector piece relative to the selected face.</li>
            <li><strong>Overlap (0.1–2 mm):</strong> Embed depth into your model for a watertight Boolean union.</li>
            <li><strong>Block (0–10 mm):</strong> Spacer pad between your model and the insert (<code>0</code> = flush).</li>
          </ul>
        </section>
      </div>
    </dialog>

    <div class="map-bottom-dock">
      <div class="status-wrap">
        <span id="spinner" class="spinner" hidden aria-hidden="true"></span>
        <p id="status" role="status" aria-live="polite">Open an STL to begin.</p>
      </div>
      <div class="actions">
        <button id="cancel" disabled>Cancel</button>
        <button id="fuse" disabled>Fuse & verify</button>
        <button id="download" disabled>Download STL ↓</button>
      </div>
    </div>

    <footer class="map-attribution">Browser only. No upload or server storage. Prototype: fit untested. · <a href="https://makerworld.com/en/models/22521-honeycomb-storage-wall#profileId-27457">Honeycomb storage wall by rostap</a> (CC BY-NC) · <a href="https://github.com/neclimdul/hws_openscad_attachments_and_connectors">MIT HWS generator</a> · <a href="https://github.com/jmylchreest/openscad-models/tree/edeea813c1f7941eea1e2d8fe9e1f844de0a227b/libraries/ikea-skadis">SKÅDIS MIT</a> · <a href="https://github.com/haliphax/multiboard-openscad/blob/95a37a6b75fe3feaac61db63dfac0576480ac1df/parts/snap.scad">Multiboard MIT</a></footer>
  </main>`;
const $ = <E extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as E;
const status = (s: string, error = false) => {
  $("status").textContent = s;
  $("status").classList.toggle("error", error);
};
let worker: Worker;
let seq = 0,
  busy = false,
  model: Float32Array | undefined,
  sourceModel: Float32Array | undefined,
  rawBytes: ArrayBuffer | undefined,
  modelName: string | undefined,
  output: ArrayBuffer | undefined,
  selected = false,
  picking = false;
function setPicking(active: boolean) {
  picking = active;
  renderer.domElement.style.cursor = active ? "crosshair" : "";
  $("pick").classList.toggle("is-picking", active);
  $("pickHint").hidden = !active;
}
let placement: Placement = {
  point: [0, 0, 0],
  normal: [0, 0, 1],
  rotation: 0,
  rotationX: 0,
  rotationY: 0,
  depth: 1,
};
type Snapshot = {
  model: Float32Array | undefined;
  sourceModel: Float32Array | undefined;
  selected: boolean;
  placement: Placement;
  wallSystem: WallSystem;
  blockThickness: string;
  normalText: string;
  faceTriangles?: number[];
};
let lastFaceTriangles: number[] | undefined;
const undoStack: Snapshot[] = [];
const redoStack: Snapshot[] = [];
function takeSnapshot(): Snapshot {
  return {
    model,
    sourceModel,
    selected,
    placement: {
      point: [...placement.point],
      normal: [...placement.normal],
      rotation: placement.rotation,
      rotationX: placement.rotationX ?? 0,
      rotationY: placement.rotationY ?? 0,
      depth: placement.depth,
    },
    wallSystem: $<HTMLSelectElement>("wallSystem").value as WallSystem,
    blockThickness: $<HTMLInputElement>("blockThickness").value,
    normalText: $("normal").textContent ?? "",
    faceTriangles: lastFaceTriangles ? [...lastFaceTriangles] : undefined,
  };
}
let lastCommitted: Snapshot = takeSnapshot();
function resetHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
  lastCommitted = takeSnapshot();
}
function recordHistory() {
  undoStack.push(lastCommitted);
  if (undoStack.length > 30) undoStack.shift();
  redoStack.length = 0;
  lastCommitted = takeSnapshot();
}
function applySnapshot(s: Snapshot) {
  const meshChanged = s.model !== model;
  model = s.model;
  sourceModel = s.sourceModel;
  selected = s.selected;
  placement = {
    point: [...s.placement.point],
    normal: [...s.placement.normal],
    rotation: s.placement.rotation,
    rotationX: s.placement.rotationX ?? 0,
    rotationY: s.placement.rotationY ?? 0,
    depth: s.placement.depth,
  };
  lastFaceTriangles = s.faceTriangles ? [...s.faceTriangles] : undefined;
  $<HTMLSelectElement>("wallSystem").value = s.wallSystem;
  syncSystemNote();
  $<HTMLInputElement>("blockThickness").value = s.blockThickness;
  ["x", "y", "z"].forEach((axis, i) => {
    $<HTMLInputElement>(axis).value = String(placement.point[i]);
  });
  $<HTMLInputElement>("rotX").value = String(placement.rotationX ?? 0);
  $<HTMLInputElement>("rotY").value = String(placement.rotationY ?? 0);
  $<HTMLInputElement>("rotation").value = String(placement.rotation);
  $<HTMLInputElement>("depth").value = String(placement.depth);
  $("normal").textContent = s.normalText;
  invalidate();
  if (model && meshChanged) {
    show(model);
    fit();
    setModelInfo();
  }
  remove(faceHighlight);
  faceHighlight = undefined;
  if (selected && lastFaceTriangles) markFace(lastFaceTriangles, placement.normal);
  if (selected && model) preview();
  else {
    remove(plug);
    plug = undefined;
  }
  buttons();
}
function undo() {
  if (busy || undoStack.length === 0) return;
  const prev = undoStack.pop()!;
  redoStack.push(lastCommitted);
  applySnapshot(prev);
  lastCommitted = prev;
  status("Undid last change.");
}
function redo() {
  if (busy || redoStack.length === 0) return;
  const next = redoStack.pop()!;
  undoStack.push(lastCommitted);
  applySnapshot(next);
  lastCommitted = next;
  status("Redid change.");
}
const scene = new T.Scene();
scene.background = new T.Color("#e8edea");
const camera = new T.PerspectiveCamera(40, 1, 0.1, 10000);
camera.position.set(65, -90, 70);
camera.up.set(0, 0, 1);
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
$("viewport").append(renderer.domElement);
renderer.domElement.setAttribute(
  "aria-label",
  "3D preview: drag to orbit, scroll to zoom; use numeric controls for placement",
);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new T.HemisphereLight(0xffffff, 0x59695e, 3));
const light = new T.DirectionalLight(0xffffff, 3);
light.position.set(30, -50, 100);
scene.add(light);
const grid = new T.GridHelper(300, 30, 0xbac7bd, 0xd3dbd5);
grid.rotateX(Math.PI / 2);
grid.position.z = -10.1;
scene.add(grid);
let object: T.Mesh | undefined, plug: T.Mesh | undefined, faceHighlight: T.Mesh | undefined;
function mesh(a: Float32Array, color: number) {
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(a, 3));
  g.computeVertexNormals();
  return new T.Mesh(
    g,
    new T.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.1 }),
  );
}
function remove(m: T.Mesh | undefined) {
  if (m) {
    scene.remove(m);
    m.geometry.dispose();
    (m.material as T.Material).dispose();
  }
}
function show(a: Float32Array) {
  remove(object);
  object = mesh(a, 0x547b70);
  scene.add(object);
}
function markFace(triangles: number[], normal: number[]) {
  remove(faceHighlight);
  faceHighlight = undefined;
  if (!model || triangles.length > 100000) return;
  const points = new Float32Array(triangles.length * 9);
  for (let i = 0; i < triangles.length; i++) {
    const offset = triangles[i] * 9;
    for (let j = 0; j < 9; j++)
      points[i * 9 + j] = model[offset + j] + normal[j % 3] * 0.025;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(points, 3));
  faceHighlight = new T.Mesh(geometry, new T.MeshBasicMaterial({
    color: 0xf3b648, transparent: true, opacity: 0.35,
    side: T.DoubleSide, depthWrite: false,
  }));
  scene.add(faceHighlight);
}
function setModelInfo() {
  if (!object || !model) return;
  const size = new T.Box3().setFromObject(object).getSize(new T.Vector3());
  $("modelInfo").textContent =
    `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm · ${model.length / 9} triangles`;
}
function clearPlacement() {
  selected = false;
  setPicking(false);
  remove(faceHighlight);
  faceHighlight = undefined;
  $("normal").textContent = "No mounting face selected";
}
function fit() {
  if (!object) return;
  const box = new T.Box3().setFromObject(object),
    center = box.getCenter(new T.Vector3()),
    size = box.getSize(new T.Vector3()).length();
  controls.target.copy(center);
  camera.position
    .copy(center)
    .add(new T.Vector3(1, -1.5, 1.1).normalize().multiplyScalar(size * 1.8));
  camera.far = Math.max(1000, size * 20);
  camera.updateProjectionMatrix();
}
function buttons() {
  $("spinner").hidden = !busy;
  for (const id of ["file", "sample", "x", "y", "z", "rotX", "rotY", "rotation", "depth", "units", "wallSystem", "blockThickness"])
    ($(id) as HTMLInputElement).disabled = busy;
  for (const id of ["connRotX90", "connRotY90", "connRotZ90", "connRotReset"])
    $<HTMLButtonElement>(id).disabled = busy || !model;
  $<HTMLButtonElement>("top").disabled = busy || !model;
  $<HTMLButtonElement>("fuse").disabled =
    busy || !model || !selected;
  $<HTMLButtonElement>("pick").disabled = busy || !model;
  $<HTMLButtonElement>("download").disabled = busy || !output;
  $<HTMLButtonElement>("cancel").disabled = !busy;
}
function invalidate() {
  output = undefined;
  buttons();
}
function send(type: string, extra: object = {}) {
  const id = ++seq;
  busy = true;
  buttons();
  worker.postMessage({ id, type, placement, wallSystem: $<HTMLSelectElement>("wallSystem").value as WallSystem, blockThickness: $<HTMLInputElement>("blockThickness").valueAsNumber, ...extra });
}
function boot() {
  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (e) => {
    const d = e.data;
    if (d.id !== seq) return;
    if (d.progress) {
      status(d.progress);
      return;
    }
    busy = false;
    if (d.error) {
      invalidate();
      status(d.error, true);
    } else if (d.model) {
      model = d.model;
      sourceModel = d.model;
      lastFaceTriangles = undefined;
      clearPlacement();
      $("unitInfo").textContent = d.autoDetected ? `${d.unit === "m" ? "Metres" : "Millimetres"} detected (auto)` : `${d.unit === "m" ? "Metres" : d.unit === "cm" ? "Centimetres" : d.unit === "in" ? "Inches" : "Millimetres"} selected`;
      invalidate();
      remove(plug);
      plug = undefined;
      show(model!);
      fit();
      setModelInfo();
      resetHistory();
      status("Solid validated. Check the model size, then choose a face center.");
    } else if (d.faceCenter) {
      const face = d.faceCenter as {
        point: [number, number, number];
        normal: [number, number, number];
        triangles: number[];
      };
      placement.point = face.point;
      placement.normal = face.normal;
      selected = true;
      lastFaceTriangles = face.triangles;
      ["x", "y", "z"].forEach((axis, i) => {
        $<HTMLInputElement>(axis).value = face.point[i].toFixed(3);
      });
      $("normal").textContent =
        `Face center · ${face.triangles.length} triangles · normal ${face.normal.map((v) => v.toFixed(2)).join(", ")}`;
      markFace(face.triangles, face.normal);
      recordHistory();
      preview();
    } else if (d.plug) {
      remove(plug);
      plug = mesh(d.plug, 0xe19b44);
      scene.add(plug);
      status("Placement preview ready. Fuse to verify the final solid.");
    } else if (d.result) {
      output = d.bytes;
      show(d.result);
      remove(faceHighlight);
      faceHighlight = undefined;
      remove(plug);
      plug = undefined;
      status(
        "Verified: one connected, watertight solid. Exported binary STL re-import passed.",
      );
    }
    buttons();
  };
  worker.onerror = () => {
    busy = false;
    invalidate();
    status(
      "Geometry worker failed. Reload or cancel and retry with a smaller STL.",
      true,
    );
  };
}
boot();
function selectTab(which: "basic" | "advanced") {
  for (const tab of ["basic", "advanced"] as const) {
    const active = tab === which;
    $<HTMLButtonElement>(`${tab}Tab`).setAttribute("aria-selected", String(active));
    $<HTMLButtonElement>(`${tab}Tab`).tabIndex = active ? 0 : -1;
    $(`${tab}Panel`).hidden = !active;
  }
}
for (const tab of ["basic", "advanced"] as const) {
  $(`${tab}Tab`).onclick = () => selectTab(tab);
  $(`${tab}Tab`).onkeydown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = tab === "basic" ? "advanced" : "basic";
    selectTab(next);
    $(`${next}Tab`).focus();
  };
}
$("sample").onclick = () => {
  if (!busy) {
    rawBytes = undefined;
    modelName = undefined;
    $<HTMLSelectElement>("units").value = "auto";
    invalidate();
    send("sample");
  }
};
$("quickSample").onclick = (e) => {
  e.preventDefault();
  $("sample").click();
};
function clearForImport() {
  invalidate();
  model = undefined;
  sourceModel = undefined;
  clearPlacement();
  $("modelInfo").textContent = "One watertight solid · ≤10 MiB · ≤100k triangles";
  $("unitInfo").textContent = "Auto suggests mm or metres from dimensions. STL has no unit metadata; review the converted size.";
  remove(object);
  object = undefined;
  remove(plug);
  plug = undefined;
  buttons();
}
function importRaw() {
  if (!rawBytes) return;
  clearForImport();
  send("import", {
    bytes: rawBytes,
    unit: $<HTMLSelectElement>("units").value as InputUnit | "auto",
  });
}
function syncSystemNote() {
  $("systemNote").hidden = $<HTMLSelectElement>("wallSystem").value !== "multiboard";
}
syncSystemNote();
$<HTMLSelectElement>("wallSystem").onchange = () => {
  if (busy) return;
  syncSystemNote();
  recordHistory();
  if (selected && model) preview();
  else { invalidate(); status("Wall system changed. Choose a face center to preview the connector."); }
};
$<HTMLInputElement>("blockThickness").onchange = () => {
  if (busy) return;
  recordHistory();
  preview();
};
$<HTMLSelectElement>("units").onchange = () => {
  if (!busy && rawBytes) importRaw();
};
async function loadFile(f: File) {
  if (busy) return;
  if (!f.name.toLowerCase().endsWith(".stl") && f.type && f.type !== "model/stl" && f.type !== "application/sla") {
    status("Please choose a .stl file.", true);
    return;
  }
  rawBytes = undefined;
  modelName = f.name.replace(/\.stl$/i, "") || undefined;
  clearForImport();
  if (f.size > 10 * 1024 * 1024) {
    status("File exceeds 10 MiB.", true);
    return;
  }
  busy = true;
  buttons();
  try {
    rawBytes = await f.arrayBuffer();
    busy = false;
    importRaw();
  } catch {
    busy = false;
    buttons();
    status("Could not read the STL file.", true);
  }
}
$<HTMLInputElement>("file").onchange = (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) void loadFile(f);
};
let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  if (!e.dataTransfer?.types.includes("Files")) return;
  e.preventDefault();
  dragDepth++;
  $("dropOverlay").hidden = false;
});
window.addEventListener("dragover", (e) => {
  if (!e.dataTransfer?.types.includes("Files")) return;
  e.preventDefault();
});
window.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) $("dropOverlay").hidden = true;
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  $("dropOverlay").hidden = true;
  const f = e.dataTransfer?.files?.[0];
  if (f) void loadFile(f);
});
$("cancel").onclick = () => {
  worker.terminate();
  seq++;
  busy = false;
  boot();
  invalidate();
  status("Operation cancelled. Adjust placement or load another model.");
};
$("top").onclick = () => {
  if (!object) return;
  const box = new T.Box3().setFromObject(object),
    c = box.getCenter(new T.Vector3());
  placement.point = [c.x, c.y, box.max.z];
  placement.normal = [0, 0, 1];
  selected = true;
  lastFaceTriangles = undefined;
  ["x", "y", "z"].forEach((x, i) => {
    $<HTMLInputElement>(x).value = String(placement.point[i]);
  });
  $("normal").textContent =
    "Face normal: 0, 0, 1. Adjust coordinates for your surface.";
  recordHistory();
  preview();
};
function wrapAngle(deg: number) {
  const w = ((((deg + 180) % 360) + 360) % 360) - 180;
  return w === -180 ? 180 : w;
}
function rotateConnector(axis: "x" | "y" | "z" | "all", delta: number) {
  if (!model || busy) return;
  if (axis === "all") {
    placement.rotationX = 0;
    placement.rotationY = 0;
    placement.rotation = 0;
  } else if (axis === "x") {
    placement.rotationX = wrapAngle((placement.rotationX ?? 0) + delta);
  } else if (axis === "y") {
    placement.rotationY = wrapAngle((placement.rotationY ?? 0) + delta);
  } else {
    placement.rotation = wrapAngle(placement.rotation + delta);
  }
  $<HTMLInputElement>("rotX").value = String(placement.rotationX ?? 0);
  $<HTMLInputElement>("rotY").value = String(placement.rotationY ?? 0);
  $<HTMLInputElement>("rotation").value = String(placement.rotation);
  recordHistory();
  if (selected) preview();
  else {
    invalidate();
    buttons();
    status(`Connector rotation: ${placement.rotationX ?? 0}°, ${placement.rotationY ?? 0}°, ${placement.rotation}°. Choose a face center.`);
  }
}
$("connRotX90").onclick = () => rotateConnector("x", 90);
$("connRotY90").onclick = () => rotateConnector("y", 90);
$("connRotZ90").onclick = () => rotateConnector("z", 90);
$("connRotReset").onclick = () => rotateConnector("all", 0);
$("pick").onclick = () => {
  setPicking(true);
  status("Click a face to center the connector on its planar patch.");
};
let down = [0, 0];
renderer.domElement.onpointerdown = (e) => {
  down = [e.clientX, e.clientY];
};
renderer.domElement.onpointerup = (e) => {
  if (
    !picking ||
    !object ||
    Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5
  )
    return;
  const r = renderer.domElement.getBoundingClientRect(),
    ray = new T.Raycaster();
  ray.setFromCamera(
    new T.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    ),
    camera,
  );
  const hit = ray.intersectObject(object)[0];
  if (hit?.faceIndex === undefined) return;
  setPicking(false);
  send("faceCenter", { model, faceIndex: hit.faceIndex });
};
function preview() {
  invalidate();
  if (model) show(model);
  if (selected && !busy) send("preview");
}
for (const id of ["x", "y", "z", "rotX", "rotY", "rotation", "depth"])
  $(id).onchange = () => {
    placement = {
      ...placement,
      point: ["x", "y", "z"].map((x) =>
        Number($<HTMLInputElement>(x).value),
      ) as Placement["point"],
      rotationX: Number($<HTMLInputElement>("rotX").value),
      rotationY: Number($<HTMLInputElement>("rotY").value),
      rotation: Number($<HTMLInputElement>("rotation").value),
      depth: Number($<HTMLInputElement>("depth").value),
    };
    recordHistory();
    preview();
  };
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && picking) {
    setPicking(false);
    status("Face selection cancelled.");
    return;
  }
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const key = e.key.toLowerCase();
  if (key === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
  } else if (key === "y" || (key === "z" && e.shiftKey)) {
    e.preventDefault();
    redo();
  }
});
$("reset").onclick = fit;
$("mobileNoticeClose").onclick = () => {
  $("mobileNotice").hidden = true;
};
const helpDialog = $<HTMLDialogElement>("helpDialog");
$("helpBtn").onclick = () => helpDialog.showModal();
$("helpClose").onclick = () => helpDialog.close();
helpDialog.onclick = (e) => {
  if (e.target === helpDialog) helpDialog.close();
};
$("fuse").onclick = () => {
  invalidate();
  send("fuse", { model });
};
$("download").onclick = () => {
  if (!output) return;
  const url = URL.createObjectURL(new Blob([output], { type: "model/stl" })),
    a = document.createElement("a");
  a.href = url;
  const sys = $<HTMLSelectElement>("wallSystem").value;
  a.download = modelName ? `${modelName}-${sys}-mm.stl` : `${sys}-prototype-fused-mm.stl`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
new ResizeObserver(() => {
  const el = $("viewport");
  renderer.setSize(el.clientWidth, el.clientHeight);
  camera.aspect = el.clientWidth / el.clientHeight;
  camera.updateProjectionMatrix();
}).observe($("viewport"));
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
