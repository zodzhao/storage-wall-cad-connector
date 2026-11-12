import { rotateMesh } from "./orientation";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Placement, InputUnit } from "./pipeline";
import "./style.css";
document.querySelector("#app")!.innerHTML = `
  <header><a href="./" aria-label="HSW workspace home"><strong>Connector</strong> Attach to all your utility walls</a></header>
  <main>
    <aside>
      <h1>Attach your model</h1>
      <div class="tabs" role="tablist" aria-label="Configuration">
        <button id="basicTab" type="button" role="tab" aria-selected="true" aria-controls="basicPanel">Basic</button>
        <button id="advancedTab" type="button" role="tab" aria-selected="false" aria-controls="advancedPanel" tabindex="-1">Advanced</button>
      </div>
      <div id="basicPanel" role="tabpanel" aria-labelledby="basicTab">
        <div class="step"><h2><span>1</span> Upload</h2>
          <label class="upload">Open an STL<input id="file" type="file" accept=".stl" /></label>
        </div>
        <div class="step"><h2><span>2</span> Wall system</h2>
          <select id="wallSystem" aria-label="Wall system"><option value="hsw">Honeycomb Storage Wall (HSW)</option><option disabled>SKÅDIS — coming later</option><option disabled>Multiboard — coming later</option></select>
        </div>
        <div class="step"><h2><span>3</span> Choose face center</h2>
          <button id="pick" disabled>Choose face center</button>
          <p class="muted">Click, then select a face on the model.</p>
        </div>
      </div>
      <div id="advancedPanel" role="tabpanel" aria-labelledby="advancedTab" hidden>
        <h2>Model & scale</h2><button id="sample">Try a sample solid</button>
        <label class="units">STL coordinate units<select id="units"><option value="auto">Auto (suggest units)</option><option value="mm">Millimetres (mm)</option><option value="cm">Centimetres (cm)</option><option value="m">Metres (m)</option><option value="in">Inches (in)</option></select></label>
        <p id="unitInfo" class="muted">Auto suggests mm or metres from dimensions. STL has no unit metadata; review the converted size.</p>
        <p class="muted">Size guard: 0.1-300 mm per axis. Scale in your CAD tool before import.</p>
        <h2>Orient object</h2><p class="muted">Rotation changes the exported STL, not just the view.</p>
        <div class="rotate-grid"><button id="rotateXp" disabled>Rotate X +90°</button><button id="rotateXm" disabled>Rotate X -90°</button><button id="rotateYp" disabled>Rotate Y +90°</button><button id="rotateYm" disabled>Rotate Y -90°</button></div>
        <button id="resetOrientation" disabled>Reset orientation</button>
        <h2>Precise placement</h2>
        <div class="fields">${["x", "y", "z"].map((x) => `<label>${x.toUpperCase()} / mm<input id="${x}" type="number" step="0.1" value="0"></label>`).join("")}
          <label>Rotation / °<input id="rotation" type="number" step="5" value="0"></label>
          <label>Overlap / mm<input id="depth" type="number" min="0.1" max="2" step="0.1" value="1"></label>
        </div>
        <button id="top" disabled>Use top centre (+Z)</button>
        <p id="normal" class="muted">No mounting face selected</p>
        <p class="muted">On curved or uneven surfaces, adjust the coordinates manually. Orange is the placement preview; check clearance.</p>
        <div class="warning">Unverified-fit prototype<br><small>Print-fit and load capacity have not been tested.</small></div>
      </div>
    </aside>
    <section class="operate">
      <div class="toolbar"><div><h2>Assembly preview</h2><p id="modelInfo" class="muted">One Object · ≤10 MiB · ≤100k triangles</p></div><button id="reset">Fit view</button></div>
      <div id="viewport" aria-label="Interactive 3D model preview"><div class="legend"><i></i> Object <i class="orange"></i> Insert · mm</div></div>
      <div class="bottom"><p id="status" role="status" aria-live="polite">Open an STL to begin.</p>
        <div class="actions"><button id="cancel" disabled>Cancel</button><button id="fuse" disabled>Fuse & verify</button><button id="download" disabled>Download STL ↓</button></div>
      </div>
      <footer>Browser only. No model upload, account or server storage. Prototype: physical fit and load capacity untested.<br>Insert derived from <a href="https://github.com/neclimdul/hws_openscad_attachments_and_connectors">James Gilliland’s MIT HWS generator</a>.</footer>
    </section>
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
  output: ArrayBuffer | undefined,
  selected = false,
  picking = false;
let placement: Placement = {
  point: [0, 0, 0],
  normal: [0, 0, 1],
  rotation: 0,
  depth: 1,
};
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
  picking = false;
  renderer.domElement.style.cursor = "";
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
  for (const id of ["file", "sample", "x", "y", "z", "rotation", "depth", "units"])
    ($(id) as HTMLInputElement).disabled = busy;
  for (const id of ["rotateXp", "rotateXm", "rotateYp", "rotateYm", "resetOrientation"])
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
  worker.postMessage({ id, type, placement, ...extra });
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
      clearPlacement();
      $("unitInfo").textContent = d.autoDetected ? `${d.unit === "m" ? "Metres" : "Millimetres"} detected (suggestion only). Review the displayed mm dimensions; change units in Advanced if needed.` : `${d.unit === "m" ? "Metres" : d.unit === "cm" ? "Centimetres" : d.unit === "in" ? "Inches" : "Millimetres"} selected. Review the displayed mm dimensions; change units in Advanced if needed.`;
      invalidate();
      remove(plug);
      plug = undefined;
      show(model!);
      fit();
      setModelInfo();
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
      ["x", "y", "z"].forEach((axis, i) => {
        $<HTMLInputElement>(axis).value = face.point[i].toFixed(3);
      });
      $("normal").textContent =
        `Face center · ${face.triangles.length} triangles · normal ${face.normal.map((v) => v.toFixed(2)).join(", ")}`;
      markFace(face.triangles, face.normal);
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
    $<HTMLSelectElement>("units").value = "auto";
    invalidate();
    send("sample");
  }
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
$<HTMLSelectElement>("units").onchange = () => {
  if (!busy && rawBytes) importRaw();
};
$<HTMLInputElement>("file").onchange = async (e) => {
  if (busy) return;
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  rawBytes = undefined;
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
};
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
  ["x", "y", "z"].forEach((x, i) => {
    $<HTMLInputElement>(x).value = String(placement.point[i]);
  });
  $("normal").textContent =
    "Face normal: 0, 0, 1. Adjust coordinates for your surface.";
  preview();
};
function orient(axis: "x" | "y", direction: -1 | 1) {
  if (!model || busy) return;
  model = rotateMesh(model, axis, direction);
  clearPlacement();
  invalidate();
  remove(plug);
  plug = undefined;
  show(model);
  fit();
  setModelInfo();
  status(`Rotated ${axis.toUpperCase()} ${direction > 0 ? "+" : "-"}90°. Choose a face center or use top centre.`);
  buttons();
}
$("rotateXp").onclick = () => orient("x", 1);
$("rotateXm").onclick = () => orient("x", -1);
$("rotateYp").onclick = () => orient("y", 1);
$("rotateYm").onclick = () => orient("y", -1);
$("resetOrientation").onclick = () => {
  if (!sourceModel || busy) return;
  model = sourceModel;
  clearPlacement();
  invalidate();
  remove(plug);
  plug = undefined;
  show(model);
  fit();
  setModelInfo();
  status("Original orientation restored. Choose a face center.");
  buttons();
};
$("pick").onclick = () => {
  picking = true;
  status("Click a face to center the connector on its planar patch.");
  renderer.domElement.style.cursor = "crosshair";
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
  picking = false;
  renderer.domElement.style.cursor = "";
  send("faceCenter", { model, faceIndex: hit.faceIndex });
};
function preview() {
  invalidate();
  if (model) show(model);
  if (selected && !busy) send("preview");
}
for (const id of ["x", "y", "z", "rotation", "depth"])
  $(id).onchange = () => {
    placement = {
      ...placement,
      point: ["x", "y", "z"].map((x) =>
        Number($<HTMLInputElement>(x).value),
      ) as Placement["point"],
      rotation: Number($<HTMLInputElement>("rotation").value),
      depth: Number($<HTMLInputElement>("depth").value),
    };
    preview();
  };
$("reset").onclick = fit;
$("fuse").onclick = () => {
  invalidate();
  send("fuse", { model });
};
$("download").onclick = () => {
  if (!output) return;
  const url = URL.createObjectURL(new Blob([output], { type: "model/stl" })),
    a = document.createElement("a");
  a.href = url;
  a.download = "hsw-prototype-fused-mm.stl";
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
