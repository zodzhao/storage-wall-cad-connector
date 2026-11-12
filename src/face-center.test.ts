import { describe, it, expect } from "vitest";
import { initialize, sample } from "./pipeline";
import { findPlanarFaceCenter } from "./face-center";

function triangleFacing(a: Float32Array, axis: 0 | 1 | 2, sign: number) {
  for (let i = 0; i < a.length; i += 9) {
    const ux = a[i + 3] - a[i], uy = a[i + 4] - a[i + 1], uz = a[i + 5] - a[i + 2];
    const vx = a[i + 6] - a[i], vy = a[i + 7] - a[i + 1], vz = a[i + 8] - a[i + 2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    if (n[axis] * sign > 0 && Math.abs(n[axis]) > Math.hypot(...n) * 0.99) return i / 9;
  }
  throw Error("No matching triangle");
}
const close = (actual: number[], expected: number[]) => expected.forEach((v, i) => expect(actual[i]).toBeCloseTo(v, 3));

describe("guided planar face center", () => {
  it("selects the center of a cube side, not the clicked triangle center", async () => {
    await initialize();
    const mesh = sample();
    const face = findPlanarFaceCenter(mesh, triangleFacing(mesh, 0, 1));
    close(face.point, [20, 0, 0]);
    close(face.normal, [1, 0, 0]);
    expect(face.triangles).toHaveLength(2);
  });
  it("centers the opposite side and the top independently", async () => {
    await initialize();
    const mesh = sample();
    const side = findPlanarFaceCenter(mesh, triangleFacing(mesh, 1, -1));
    close(side.point, [0, -20, 0]);
    close(side.normal, [0, -1, 0]);
    const top = findPlanarFaceCenter(mesh, triangleFacing(mesh, 2, 1));
    close(top.point, [0, 0, 10]);
    expect(side.triangles).toHaveLength(2);
    expect(top.triangles).toHaveLength(2);
  });
  it("rejects an out-of-range face index", async () => {
    await initialize();
    expect(() => findPlanarFaceCenter(sample(), 100000)).toThrow(/face/i);
  });
});

it("keeps a concave face-center anchor on the face near the true center", () => {
  const values: number[] = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    if (x >= 1 && x <= 2 && y >= 1 && y <= 2) continue;
    values.push(x,y,0, x+1,y,0, x+1,y+1,0);
    values.push(x,y,0, x+1,y+1,0, x,y+1,0);
  }
  const result=findPlanarFaceCenter(new Float32Array(values),0);
  expect(result.triangles).toHaveLength(24);
  const [x,y,z]=result.point;
  expect(z).toBeCloseTo(0);
  expect(x < 1 || x > 3 || y < 1 || y > 3).toBe(true);
  expect(Math.hypot(x-2,y-2)).toBeLessThan(1.5);
});
