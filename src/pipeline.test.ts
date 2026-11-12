import { describe, it, expect } from "vitest";
import {
  initialize,
  sample,
  encode,
  parse,
  validate,
  fuse,
  connector,
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
  const c = connector();
  expect(c.status()).toBe("NoError");
  expect(c.decompose()).toHaveLength(1);
  expect(c.volume()).toBeGreaterThan(1800);
  expect(c.volume()).toBeLessThan(2500);
  c.delete();
});
