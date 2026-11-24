import Factory, { type Manifold, type ManifoldToplevel } from "manifold-3d";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { Euler, Quaternion, Vector3, Matrix4 } from "three";
let api: ManifoldToplevel;
export async function initialize(options?: Parameters<typeof Factory>[0]) {
  api = await Factory(options);
  api.setup();
}
export type Placement = {
  point: [number, number, number];
  normal: [number, number, number];
  rotation: number;
  rotationX?: number;
  rotationY?: number;
  depth: number;
};
export const MAX_BYTES = 10 * 1024 * 1024,
  MAX_TRIANGLES = 100000;
export type InputUnit = "mm" | "cm" | "m" | "in";
const millimetresPerUnit: Record<InputUnit, number> = { mm: 1, cm: 10, m: 1000, in: 25.4 };
export function toMillimetres(a: Float32Array, unit: InputUnit): Float32Array {
  const factor = millimetresPerUnit[unit];
  if (!factor) throw Error("Unsupported STL coordinate unit.");
  return a.map((value) => value * factor);
}
// STL has no unit metadata. Prefer mm whenever plausible; suggest m only for
// sub-0.1 coordinates that become a plausible small print when multiplied.
// This is a proposal, not a certainty: the user must confirm displayed mm.
export function detectInputUnit(a: Float32Array): { unit: InputUnit; reason: string } {
  if (!a.length || a.length % 3 || !a.every(Number.isFinite))
    throw Error("Invalid mesh coordinates.");
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < a.length; i += 3)
    for (let j = 0; j < 3; j++) {
      lo[j] = Math.min(lo[j], a[i + j]);
      hi[j] = Math.max(hi[j], a[i + j]);
    }
  const sizes = hi.map((v, i) => v - lo[i]);
  const largest = Math.max(...sizes);
  if (largest < 0.1 && sizes.every((v) => v * 1000 >= 0.1 && v * 1000 <= 300))
    return { unit: "m", reason: "Likely metres: raw coordinates are unusually small for a printable model." };
  return { unit: "mm", reason: "Assumed millimetres; STL does not store units." };
}
export function parse(bytes: ArrayBuffer) {
  if (bytes.byteLength > MAX_BYTES || bytes.byteLength < 84)
    throw Error("STL file must be 84 bytes–10 MiB.");
  const g = new STLLoader().parse(bytes);
  const a = new Float32Array(g.getAttribute("position").array);
  g.dispose();
  if (!a.length || a.length / 9 > MAX_TRIANGLES)
    throw Error("Empty STL or exceeds 100,000 triangles.");
  return a;
}
function expand(m: ReturnType<Manifold["getMesh"]>) {
  const a: number[] = [];
  for (const i of m.triVerts)
    a.push(...m.vertProperties.slice(i * m.numProp, i * m.numProp + 3));
  return a;
}
export function positions(s: Manifold) {
  return new Float32Array(expand(s.getMesh()));
}
export function sample() {
  const s = api.Manifold.cube([40, 40, 20], true);
  const a = positions(s);
  s.delete();
  return a;
}
export function validate(a: Float32Array) {
  if (
    !a.length ||
    a.length % 9 ||
    a.length / 9 > MAX_TRIANGLES ||
    !a.every(Number.isFinite)
  )
    throw Error("Invalid mesh coordinates or triangle budget.");
  const vertices: number[] = [],
    indices: number[] = [],
    map = new Map<string, number>();
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < a.length; i += 3) {
    const p = Array.from(a.slice(i, i + 3));
    p.forEach((v, j) => {
      lo[j] = Math.min(lo[j], v);
      hi[j] = Math.max(hi[j], v);
    });
    const key = p.join(",");
    let idx = map.get(key);
    if (idx === undefined) {
      idx = vertices.length / 3;
      map.set(key, idx);
      vertices.push(...p);
    }
    indices.push(idx);
  }
  if (
    hi.some((v, j) => v - lo[j] > 300 || v - lo[j] < 0.1) ||
    lo.some((v, j) => Math.abs(v) > 10000 || Math.abs(hi[j]) > 10000)
  )
    throw Error(
      "Size guard: each dimension must be 0.1–300 mm; coordinates within ±10,000 mm.",
    );
  let s: Manifold;
  try {
    s = new api.Manifold(
      new api.Mesh({
        numProp: 3,
        vertProperties: new Float32Array(vertices),
        triVerts: new Uint32Array(indices),
      }),
    );
  } catch {
    throw Error(
      'Mesh must be watertight, consistently outward oriented and have positive volume. Try "Fix Model" in PrusaSlicer or OrcaSlicer first.',
    );
  }
  try {
    if (s.status() !== "NoError" || s.isEmpty() || s.volume() <= 0)
      throw Error(
        'Mesh must be watertight, consistently outward oriented and have positive volume. Try "Fix Model" in PrusaSlicer or OrcaSlicer first.',
      );
    const parts = s.decompose();
    const count = parts.length;
    parts.forEach((p) => p.delete());
    if (count !== 1)
      throw Error(
        'Disconnected mesh: supply one connected solid. Try "Fix Model" or "Split to Objects" in PrusaSlicer or OrcaSlicer first.',
      );
    return s;
  } catch (e) {
    s.delete();
    throw e;
  }
}
// Derived from James Gilliland's MIT hws_insert_util.scad. Solid type 2, no decoration.
function hswConnector() {
  const M = api.Manifold;
  const owned: Manifold[] = [];
  const keep = (s: Manifold) => {
    owned.push(s);
    return s;
  };
  const hex = (d: number, h: number, top = d) =>
    keep(M.cylinder(h, d / Math.sqrt(3), top / Math.sqrt(3), 6));
  let result: Manifold | undefined;
  try {
    let body = keep(
      hex(19.7, 9.6).add(keep(hex(19.7, 0.4, 19.3).translate([0, 0, 9.6]))),
    );
    body = keep(body.add(hex(22.5, 2.5)));
    // Open cavity toward the wall-facing end: use the original project's
    // 13.4 mm inner across-flats profile while retaining a 2.5 mm floor
    // where the insert joins the uploaded object. Unlike a through-bore,
    // fusion cannot quietly refill the cavity at its exposed end.
    body = keep(body.subtract(keep(hex(13.4, 8).translate([0, 0, 2.5]))));
    for (let i = 0; i < 6; i++) {
      const angle = i * 60;
      const lower = keep(
        keep(M.cylinder(2, 0.5, 0.5, 20, true).rotate([0, 90, 0])).translate([
          0, 9.85, 8,
        ]),
      );
      const upper = keep(
        keep(
          M.cylinder(2, 0.002, 0.002, 20, true).rotate([0, 90, 0]),
        ).translate([0, 9.85, 9.598]),
      );
      const snap = keep(keep(M.hull([lower, upper])).rotate([0, 0, angle]));
      body = keep(body.add(snap));
      const vertical = keep(
        keep(M.cube([8, 0.8, 3.502])).translate([-4, 8.25, 6.5]),
      );
      const horizontal = keep(
        keep(M.cube([8, 1.602, 1])).translate([-4, 8.25, 6.5]),
      );
      body = keep(
        body.subtract(
          keep(keep(vertical.add(horizontal)).rotate([0, 0, angle])),
        ),
      );
    }
    result = body;
    return result;
  } finally {
    owned.forEach((s) => {
      if (s !== result) s.delete();
    });
  }
}
// Geometry adapted from John Mylchreest's MIT ikea-skadis.scad (2026).
// Local +Z points into the board; +Y is board-up. The stand-off starts
// inside the uploaded face after the overlap translation in placed().
function skadisConnector(blockThickness = 2) {
  if (!Number.isFinite(blockThickness) || blockThickness < 0 || blockThickness > 10)
    throw Error("Connector block thickness must be 0–10 mm.");
  const M = api.Manifold;
  const owned: Manifold[] = [];
  const keep = (solid: Manifold) => { owned.push(solid); return solid; };
  let result: Manifold | undefined;
  try {
    // 10 × 15 mm parent-side block; its outer end meets the slot tab.
    const stand = blockThickness > 0
      ? keep(M.cube([10, 15, blockThickness + 0.05]).translate([-5, -7.5, 0]))
      : undefined;
    const tabStart = Math.max(0, blockThickness - 0.05);
    // 5 mm-tall, 4.6 mm-wide tab. The back and side edges taper by 0.3 mm
    // at its upper edge; the panel-facing front edge remains straight.
    // Hull should taper in board-up (Y), with 8.7 mm depth along +Z.
    const bottomSlice = keep(M.cube([4.6, 0.001, blockThickness + 8.7 - tabStart]).translate([-2.3, 2.5, tabStart]));
    const topSlice = keep(M.cube([4.0, 0.001, blockThickness + 8.4 - tabStart]).translate([-2, 7.499, tabStart]));
    const tab = keep(M.hull([bottomSlice, topSlice]));
    // The 6.5 mm tail hangs behind 5.7 mm of panel, retaining the peg.
    const tail = keep(M.cube([4.6, 6.55, 3]).translate([-2.3, -4, blockThickness + 5.7]));
    const body = stand ? keep(stand.add(tab)) : tab;
    result = keep(body.add(tail));
    return result;
  } finally {
    owned.forEach((solid) => { if (solid !== result) solid.delete(); });
  }
}
// Port of haliphax's MIT parts/snap.scad at 95a37a6b75fe3feaac61db63dfac0576480ac1df. No official MultiBuild mesh is bundled.
// This is a compatibility prototype; provenance of the mating profile and
// physical fit are not established by the upstream code license.
function multiboardConnector(blockThickness: number) {
  const M = api.Manifold;
  const owned: Manifold[] = [];
  const keep = (solid: Manifold) => { owned.push(solid); return solid; };
  const octagon = (radius: number, flat: number): [number, number][] => [
    [flat, -radius], [radius, -flat], [radius, flat], [flat, radius],
    [-flat, radius], [-radius, flat], [-radius, -flat], [-flat, -radius],
  ];
  let result: Manifold | undefined;
  try {
    const small = octagon(10.57, 4.38), big = octagon(11.43, 4.73);
    const core = keep(M.extrude([small], 4));
    const lower = keep(keep(M.extrude([small], 0.02)).translate([0, 0, 3.99]));
    const upper = keep(keep(M.extrude([big], 0.02)).translate([0, 0, 5.51]));
    const taper = keep(M.hull([lower, upper]));
    let body = keep(core.add(taper));
    const wedge = keep(M.extrude([[[2.24, 0], [1, 0.48], [0.6, 0.48], [0, 0]]], 3));
    const prong = keep(keep(wedge.rotate([0, -90, 0])).translate([1.5, 10.52, 0]));
    const firstNotch = keep(M.cube([7.16, 0.8, 3.41]).translate([-3.58, 8.97, -0.01]));
    const secondNotch = keep(M.cube([7.16, 1.61, 1]).translate([-3.58, 8.97, 2.4]));
    const notch = keep(firstNotch.add(secondNotch));
    for (const angle of [0, 90, 180, 270]) {
      body = keep(body.add(keep(prong.rotate([0, 0, angle]))));
      body = keep(body.subtract(keep(notch.rotate([0, 0, angle]))));
    }
    // In the source, the broad +Z cap attaches to the model and the slotted
    // small -Z face enters the board. placed() expects local +Z toward the wall.
    // A half-turn about X makes the smooth cap model-side without mirroring.
    const turned = keep(body.rotate([180, 0, 0]));
    body = keep(turned.translate([0, 0, 5.53]));
    if (blockThickness > 0) {
      const raised = keep(body.translate([0, 0, blockThickness]));
      const pad = keep(M.extrude([big], blockThickness + 0.05));
      body = keep(raised.add(pad));
    }
    result = body;
    return result;
  } finally {
    owned.forEach((solid) => { if (solid !== result) solid.delete(); });
  }
}
export type WallSystem = "hsw" | "skadis" | "multiboard";
export function connector(system: WallSystem = "hsw", blockThickness = 2) {
  if (!Number.isFinite(blockThickness) || blockThickness < 0 || blockThickness > 10) {
    throw Error("Connector block thickness must be 0–10 mm.");
  }
  if (system === "skadis") return skadisConnector(blockThickness);
  if (system === "multiboard") return multiboardConnector(blockThickness);
  if (system === "hsw") {
    const snap = hswConnector();
    if (blockThickness === 0) return snap;
    let raised: Manifold | undefined, pad: Manifold | undefined;
    try {
      raised = snap.translate([0, 0, blockThickness]);
      // Match the six-sided HSW base rather than obstructing its wall-facing cavity.
      const radius = 22.5 / Math.sqrt(3);
      pad = api.Manifold.cylinder(blockThickness + 0.05, radius, radius, 6);
      return raised.add(pad);
    } finally {
      snap.delete();
      raised?.delete();
      pad?.delete();
    }
  }
  throw Error("Unsupported wall system.");
}
export function placed(p: Placement, system: WallSystem = "hsw", blockThickness = 2) {
  const rx = p.rotationX ?? 0;
  const ry = p.rotationY ?? 0;
  if (
    ![...p.point, ...p.normal, p.rotation, rx, ry, p.depth].every(Number.isFinite) ||
    p.depth < 0.1 ||
    p.depth > 2
  )
    throw Error("Placement requires finite values and 0.1–2 mm overlap.");
  const n = new Vector3(...p.normal);
  if (n.length() < 0.99) throw Error("Select a valid surface normal.");
  n.normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n);
  q.multiply(
    new Quaternion().setFromEuler(
      new Euler(
        (rx * Math.PI) / 180,
        (ry * Math.PI) / 180,
        (p.rotation * Math.PI) / 180,
        "XYZ",
      ),
    ),
  );
  const origin = new Vector3(...p.point).addScaledVector(n, -p.depth);
  const matrix = new Matrix4().compose(origin, q, new Vector3(1, 1, 1));
  const c = connector(system, blockThickness);
  const s = c.transform(
    matrix.elements as Parameters<Manifold["transform"]>[0],
  );
  c.delete();
  return s;
}
export function fuse(a: Float32Array, p: Placement, system: WallSystem = "hsw", blockThickness = 2) {
  const base = validate(a);
  let plug: Manifold | undefined,
    result: Manifold | undefined,
    overlap: Manifold | undefined;
  try {
    plug = placed(p, system, blockThickness);
    overlap = base.intersect(plug);
    if (overlap.volume() < 0.01)
      throw Error(
        "Disconnected connector: increase overlap or select another face.",
      );
    result = base.add(plug);
    const bytes = encode(positions(result));
    const verified = validate(parse(bytes));
    verified.delete();
    return parse(bytes);
  } finally {
    base.delete();
    plug?.delete();
    result?.delete();
    overlap?.delete();
  }
}
export function encode(a: Float32Array) {
  const count = a.length / 9;
  const buffer = new ArrayBuffer(84 + count * 50),
    v = new DataView(buffer);
  const header = "Connector binary STL (mm)";
  for (let i = 0; i < header.length; i++) v.setUint8(i, header.charCodeAt(i));
  v.setUint32(80, count, true);
  for (let i = 0; i < count; i++) {
    const base = i * 9;
    const ax = a[base],
      ay = a[base + 1],
      az = a[base + 2];
    const ux = a[base + 3] - ax,
      uy = a[base + 4] - ay,
      uz = a[base + 5] - az;
    const vx = a[base + 6] - ax,
      vy = a[base + 7] - ay,
      vz = a[base + 8] - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 0) {
      nx /= len;
      ny /= len;
      nz /= len;
    }
    const off = 84 + i * 50;
    v.setFloat32(off, nx, true);
    v.setFloat32(off + 4, ny, true);
    v.setFloat32(off + 8, nz, true);
    for (let j = 0; j < 9; j++)
      v.setFloat32(off + 12 + j * 4, a[base + j], true);
  }
  return buffer;
}
