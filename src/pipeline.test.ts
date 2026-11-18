import { describe, it, expect } from "vitest";
import {
  initialize,
  sample,
  encode,
  parse,
  validate,
  fuse,
  connector,
  positions,
  toMillimetres,
  detectInputUnit,
} from "./pipeline";
describe("real Manifold STL pipeline", () => {
  it("exports a fused solid and validates actual binary STL re-import", async () => {
    await initialize();
    const base = sample();
    const result = fuse(base, {
      point: [0, 0, 10],
      normal: [0, 0, 1],
      rotation: 0,
      depth: 1,
    });
    const bytes = encode(result);
    expect(bytes.byteLength).toBe(84 + (result.length / 9) * 50);
    const solid = validate(parse(bytes));
    expect(solid.decompose()).toHaveLength(1);
    expect(solid.volume()).toBeGreaterThan(32000);
    solid.delete();
  });
  it("has a detailed connector with relief and snap geometry", async () => {
    await initialize();
    const c = connector();
    expect(c.numTri()).toBeGreaterThan(150);
    expect(c.decompose()).toHaveLength(1);
    c.delete();
  });
  it("rejects malformed, open and oversized input", async () => {
    await initialize();
    expect(() => parse(new ArrayBuffer(8))).toThrow();
    expect(() =>
      validate(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])),
    ).toThrow();
    expect(() => validate(sample().map((x) => x * 100))).toThrow(/size/i);
  });
  it("rejects a disconnected connector", async () => {
    await initialize();
    expect(() =>
      fuse(sample(), {
        point: [100, 0, 10],
        normal: [0, 0, 1],
        rotation: 0,
        depth: 1,
      }),
    ).toThrow(/overlap|disconnect/i);
  });
});

it("converts unitless metre coordinates to millimetres without changing topology", async () => {
  await initialize();
  const metres = sample().map((v) => v / 1000);
  expect(() => validate(metres)).toThrow(/Size guard/);
  const mm = toMillimetres(metres, "m");
  const solid = validate(mm);
  expect(solid.volume()).toBeCloseTo(32000, 0);
  solid.delete();
  expect(metres[0]).toBeLessThan(0.1); // original input is unchanged
});

it("suggests metres only when tiny coordinates have plausible print-scale dimensions", async () => {
  await initialize();
  expect(detectInputUnit(sample().map((v) => v / 1000)).unit).toBe("m");
  expect(detectInputUnit(sample()).unit).toBe("mm");
  expect(detectInputUnit(sample().map((v) => v / 40)).unit).toBe("mm");
});
it("keeps the HSW snap geometry while hollowing the wall-facing centre", async () => {
  await initialize();
  const c = connector("hsw", 0);
  expect(c.status()).toBe("NoError");
  expect(c.decompose()).toHaveLength(1);
  expect(c.volume()).toBeGreaterThan(1800);
  expect(c.volume()).toBeLessThan(2500);
  c.delete();
});


it("builds a single SKÅDIS peg with a stand-off and behind-board retainer", async () => {
  await initialize();
  const peg = connector("skadis");
  try {
    expect(peg.status()).toBe("NoError");
    const parts = peg.decompose();
    expect(parts).toHaveLength(1);
    parts.forEach((part) => part.delete());
    const coordinates = positions(peg);
    const extents = [0, 1, 2].map((axis) => {
      const values = Array.from(coordinates).filter((_, index) => index % 3 === axis);
      return [Math.min(...values), Math.max(...values)];
    });
    expect(extents[0][1] - extents[0][0]).toBeCloseTo(10, 1);
    expect(extents[1][1] - extents[1][0]).toBeCloseTo(15, 1);
    expect(extents[2][1]).toBeCloseTo(10.7, 1);
    expect(peg.volume()).toBeGreaterThan(350);
  } finally {
    peg.delete();
  }
});

it("fuses a SKÅDIS peg into a re-importable watertight STL", async () => {
  await initialize();
  const result = fuse(sample(), {
    point: [0, 0, 10], normal: [0, 0, 1], rotation: 0, depth: 1,
  }, "skadis");
  const solid = validate(parse(encode(result)));
  try {
    const parts = solid.decompose();
    expect(parts).toHaveLength(1);
    parts.forEach((part) => part.delete());
    expect(solid.volume()).toBeGreaterThan(32000);
    const coords = positions(solid);
    expect(Math.max(...coords.filter((_, i) => i % 3 === 2))).toBeCloseTo(19.7, 1);
  } finally {
    solid.delete();
  }
});


it("allows a direct SKÅDIS hook with zero stand-off and a valid fused STL", async () => {
  await initialize();
  const hook = connector("skadis", 0);
  try {
    const coords = positions(hook);
    const x = coords.filter((_, i) => i % 3 === 0);
    const z = coords.filter((_, i) => i % 3 === 2);
    expect(Math.max(...x) - Math.min(...x)).toBeCloseTo(4.6, 1);
    expect(Math.max(...z)).toBeCloseTo(8.7, 1);
    expect(hook.status()).toBe("NoError");
  } finally {
    hook.delete();
  }
  const result = fuse(sample(), {
    point: [0, 0, 10], normal: [0, 0, 1], rotation: 0, depth: 1,
  }, "skadis", 0);
  const solid = validate(parse(encode(result)));
  const parts = solid.decompose();
  expect(parts).toHaveLength(1);
  parts.forEach((part) => part.delete());
  solid.delete();
});


it("rejects nonfinite or out-of-range SKÅDIS block thickness settings", async () => {
  await initialize();
  for (const thickness of [-0.1, 10.1, NaN, Infinity]) {
    expect(() => connector("skadis", thickness)).toThrow(/block thickness.*0–10/i);
  }
});


it("builds a single Multiboard snap with prongs and relief slots", async () => {
  await initialize();
  const snap = connector("multiboard", 0);
  try {
    expect(snap.status()).toBe("NoError");
    const pieces = snap.decompose();
    expect(pieces).toHaveLength(1);
    pieces.forEach((piece) => piece.delete());
    const coords = positions(snap);
    const extents = [0, 1, 2].map((axis) => {
      const values = coords.filter((_, i) => i % 3 === axis);
      return [Math.min(...values), Math.max(...values)];
    });
    expect(extents[0][0]).toBeCloseTo(-11.43, 1);
    expect(extents[0][1]).toBeCloseTo(11.43, 1);
    expect(extents[2][0]).toBeCloseTo(0, 1);
    expect(extents[2][1]).toBeCloseTo(5.53, 1);
    expect(snap.numTri()).toBeGreaterThan(100);
  } finally {
    snap.delete();
  }
});


it("puts the Multiboard broad attachment face against the model and snap fingers outward", async () => {
  await initialize();
  // Source snap.scad uses its +Z cap as the model side; placed() uses +Z as
  // the wall direction. Check both direct mounting and a raised block.
  const radiusAt = (solid: ReturnType<typeof connector>, z: number) => {
    const mesh = positions(solid);
    const radii: number[] = [];
    for (let i = 0; i < mesh.length; i += 3) {
      if (Math.abs(mesh[i + 2] - z) < 0.001)
        radii.push(Math.max(Math.abs(mesh[i]), Math.abs(mesh[i + 1])));
    }
    expect(radii.length).toBeGreaterThan(0);
    return Math.max(...radii);
  };
  for (const block of [0, 6]) {
    const snap = connector("multiboard", block);
    try {
      expect(radiusAt(snap, block)).toBeCloseTo(11.43, 1);
      expect(radiusAt(snap, block + 5.53)).toBeLessThan(11.2);
    } finally {
      snap.delete();
    }
  }
});

it("uses one universal block thickness for HSW, SKÅDIS and Multiboard", async () => {
  await initialize();
  for (const system of ["hsw", "skadis", "multiboard"] as const) {
    const direct = connector(system, 0);
    const spaced = connector(system, 6);
    const defaultBlock = connector(system);
    try {
      for (const solid of [direct, spaced, defaultBlock]) {
        expect(solid.status()).toBe("NoError");
        const parts = solid.decompose();
        expect(parts).toHaveLength(1);
        parts.forEach((part) => part.delete());
      }
      const maxZ = (solid: ReturnType<typeof connector>) => Math.max(...positions(solid).filter((_, i) => i % 3 === 2));
      expect(maxZ(spaced) - maxZ(direct)).toBeCloseTo(6, 1);
      expect(maxZ(defaultBlock) - maxZ(direct)).toBeCloseTo(2, 1);
      expect(spaced.volume()).toBeGreaterThan(direct.volume());
    } finally {
      direct.delete();
      spaced.delete();
      defaultBlock.delete();
    }
  }
});

it("rejects invalid block thickness for every wall system", async () => {
  await initialize();
  for (const system of ["hsw", "skadis", "multiboard"] as const) {
    for (const thickness of [-0.1, 10.1, NaN, Infinity]) {
      expect(() => connector(system, thickness)).toThrow(/block thickness must be 0–10 mm/i);
    }
  }
});

it("fuses a Multiboard snap to the model and re-imports the binary STL", async () => {
  await initialize();
  const result = fuse(sample(), {
    point: [0, 0, 10], normal: [0, 0, 1], rotation: 0, depth: 1,
  }, "multiboard", 0);
  const solid = validate(parse(encode(result)));
  try {
    expect(solid.status()).toBe("NoError");
    const parts = solid.decompose();
    expect(parts).toHaveLength(1);
    parts.forEach((part) => part.delete());
    expect(solid.volume()).toBeGreaterThan(32000);
  } finally {
    solid.delete();
  }
});
