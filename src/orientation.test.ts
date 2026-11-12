import { it, expect } from "vitest";
import { initialize, sample, validate } from "./pipeline";
import { rotateMesh } from "./orientation";
import { findPlanarFaceCenter } from "./face-center";

it("rotates a real solid so a side face becomes the upward attachment face", async () => {
  await initialize();
  const original = sample();
  const rotated = rotateMesh(original, "x", 1);
  const solid = validate(rotated);
  expect(solid.volume()).toBeCloseTo(32000, 0);
  solid.delete();
  const topTriangle = Array.from({length: rotated.length/9}, (_,i)=>i)
    .find(i => rotated[i*9+2] === 20 && rotated[i*9+5] === 20 && rotated[i*9+8] === 20);
  expect(topTriangle).toBeDefined();
  const face = findPlanarFaceCenter(rotated, topTriangle!);
  face.point.forEach((n,i) => expect(n).toBeCloseTo([0,0,20][i], 3));
  face.normal.forEach((n,i) => expect(n).toBeCloseTo([0,0,1][i], 3));
  expect(original[2]).not.toBe(20); // input did not mutate
});
it("four quarter turns restore coordinates", async () => {
  await initialize();
  let rotated: Float32Array = sample();
  const original = new Float32Array(rotated);
  for (let i=0; i<4; i++) rotated = rotateMesh(rotated, "y", 1);
  expect(rotated).toEqual(original);
});
