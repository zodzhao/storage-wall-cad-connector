import { findPlanarFaceCenter } from "./face-center";
import wasmUrl from "manifold-3d/manifold.wasm?url";
import {
  initialize,
  sample,
  parse,
  validate,
  positions,
  placed,
  fuse,
  encode,
  toMillimetres,
  detectInputUnit,
  type InputUnit,
  type Placement,
  type WallSystem,
} from "./pipeline";
const ready = initialize({ locateFile: () => wasmUrl });
self.onmessage = async (
  e: MessageEvent<{
    id: number;
    type: string;
    bytes?: ArrayBuffer;
    model?: Float32Array;
    faceIndex?: number;
    placement: Placement;
    wallSystem?: WallSystem;
    blockThickness?: number;
    unit?: InputUnit | "auto";
  }>,
) => {
  const { id, type, placement, wallSystem = "hsw", blockThickness = 2 } = e.data;
  try {
    postMessage({ id, progress: "Loading geometry engine…" });
    await ready;
    postMessage({
      id,
      progress:
        type === "fuse"
          ? "Unioning and re-importing exported STL…"
          : "Checking watertight geometry…",
    });
    if (type === "faceCenter") {
      postMessage({ id, faceCenter: findPlanarFaceCenter(e.data.model!, e.data.faceIndex!) });
    } else if (type === "fuse") {
      const a = fuse(e.data.model!, placement, wallSystem, blockThickness);
      postMessage({ id, result: a, bytes: encode(a) });
    } else if (type === "preview") {
      const s = placed(placement, wallSystem, blockThickness);
      const a = positions(s);
      s.delete();
      postMessage({ id, plug: a });
    } else {
      const raw = type === "sample" ? sample() : parse(e.data.bytes!);
      const detected = type === "sample" ? undefined : detectInputUnit(raw);
      const unit = type === "sample" ? "mm" : e.data.unit && e.data.unit !== "auto" ? e.data.unit : detected!.unit;
      const a = toMillimetres(raw, unit);
      const s = validate(a);
      s.delete();
      postMessage({ id, model: a, unit, autoDetected: !!detected && (!e.data.unit || e.data.unit === "auto") });
    }
  } catch (error) {
    postMessage({
      id,
      error: error instanceof Error && error.message.startsWith("Size guard:")
        ? `${error.message} STL has no unit metadata; check STL coordinate units (e.g. metres).`
        : error instanceof Error ? error.message : String(error),
    });
  }
};
