import { describe, expect, it } from "vitest";
import {
  BIRDS_EYE_AZIMUTH_DEG,
  BIRDS_EYE_ELEVATION_DEG,
  birdsEyeCameraPosition,
  type BirdsEyeFitInputs,
} from "./birdsEyeCamera";

/**
 * ⚠ **THE CUT-OFF BIRD'S EYE, 2026-11-10.**
 *
 * > *"part of the 3d birds eye of the building is usually cut off"* — Tommy
 *
 * The distance was `maxDim * 1.6`, where `maxDim` is the larger of the
 * footprint's two PLAN dimensions. Nothing in that sum was the building's
 * height, so a tall building on a small footprint ran out of the frame every
 * time. These tests are the property that was missing: every corner of the
 * building's own box lands inside the frustum, whatever its shape.
 */

const fit = (over: Partial<BirdsEyeFitInputs> = {}): BirdsEyeFitInputs => ({
  box: { minX: 0, maxX: 48, minZ: 0, maxZ: 24 },
  centerX: 24,
  centerZ: 12,
  yMinFt: 0,
  yMaxFt: 14,
  targetYFt: 7,
  fovDeg: 50,
  aspect: 720 / 480,
  ...over,
});

/** Every box corner, projected into the camera's own frame. Returns the
 * worst |x|/depth and |y|/depth seen, as a fraction of what the frustum
 * allows: 1.0 is exactly on the frame edge, over 1.0 is cut off. */
function worstFrameFraction(f: BirdsEyeFitInputs): { h: number; v: number } {
  const camera = birdsEyeCameraPosition(f);
  const target: [number, number, number] = [f.centerX, f.targetYFt, f.centerZ];
  const fwd = [target[0] - camera[0], target[1] - camera[1], target[2] - camera[2]];
  const fwdLen = Math.hypot(fwd[0], fwd[1], fwd[2]);
  const forward = [fwd[0] / fwdLen, fwd[1] / fwdLen, fwd[2] / fwdLen];
  /* right = normalize(forward x worldUp); up = right x forward. */
  const rRaw = [forward[2] * 1, 0, -forward[0] * 1];
  const rLen = Math.hypot(rRaw[0], rRaw[1], rRaw[2]);
  const right = [rRaw[0] / rLen, rRaw[1] / rLen, rRaw[2] / rLen];
  const up = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  const tanV = Math.tan((f.fovDeg * Math.PI) / 180 / 2);
  const tanH = tanV * f.aspect;

  let h = 0;
  let v = 0;
  for (const cx of [f.box.minX, f.box.maxX]) {
    for (const cy of [f.yMinFt, f.yMaxFt]) {
      for (const cz of [f.box.minZ, f.box.maxZ]) {
        const vx = cx - camera[0];
        const vy = cy - camera[1];
        const vz = cz - camera[2];
        const depth = vx * forward[0] + vy * forward[1] + vz * forward[2];
        /* Behind the camera would be a catastrophic fit, not a near miss. */
        expect(depth).toBeGreaterThan(0);
        const across = Math.abs(vx * right[0] + vy * right[1] + vz * right[2]);
        const upward = Math.abs(vx * up[0] + vy * up[1] + vz * up[2]);
        h = Math.max(h, across / (depth * tanH));
        v = Math.max(v, upward / (depth * tanV));
      }
    }
  }
  return { h, v };
}

describe("⚠ the bird's-eye camera frames the WHOLE building", () => {
  it("opens at 30 degrees above flat, on the corner", () => {
    /* His number. 50 looked down INTO the building rather than at it. */
    expect(BIRDS_EYE_ELEVATION_DEG).toBe(30);
    expect(BIRDS_EYE_AZIMUTH_DEG).toBe(45);
    const camera = birdsEyeCameraPosition(fit());
    const dx = camera[0] - 24;
    const dy = camera[1] - 7;
    const dz = camera[2] - 12;
    const elevationDeg = (Math.asin(dy / Math.hypot(dx, dy, dz)) * 180) / Math.PI;
    expect(elevationDeg).toBeCloseTo(30, 6);
  });

  it("⚠ nothing is cut off, for any shape — including the tall-and-narrow one the old rule missed", () => {
    /* ⚠ The old fit was `maxDim * 1.6` off the PLAN alone. The last two rows
       are the ones it could not survive: a building taller than it is wide
       has no plan dimension that knows how tall it is. */
    const shapes: { name: string; over: Partial<BirdsEyeFitInputs> }[] = [
      { name: "The Tank, 48 x 24 x 14", over: {} },
      { name: "Tiny House, 24 x 16 x 13", over: { box: { minX: 0, maxX: 24, minZ: 0, maxZ: 16 }, centerX: 12, centerZ: 8, yMaxFt: 13, targetYFt: 6.5 } },
      { name: "a square octagon box, 16 x 16 x 18", over: { box: { minX: 0, maxX: 16, minZ: 0, maxZ: 16 }, centerX: 8, centerZ: 8, yMaxFt: 18, targetYFt: 9 } },
      { name: "TALL: 12 x 12 x 40", over: { box: { minX: 0, maxX: 12, minZ: 0, maxZ: 12 }, centerX: 6, centerZ: 6, yMaxFt: 40, targetYFt: 20 } },
      { name: "VERY TALL: 10 x 10 x 90", over: { box: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 }, centerX: 5, centerZ: 5, yMaxFt: 90, targetYFt: 45 } },
      { name: "The Cindy, 55.25 x 34.83 x 20", over: { box: { minX: 0, maxX: 55.25, minZ: 0, maxZ: 34.83 }, centerX: 55.25 / 2, centerZ: 34.83 / 2, yMaxFt: 20, targetYFt: 10 } },
    ];
    for (const { name, over } of shapes) {
      for (const aspect of [720 / 480, 1, 2.4, 0.75]) {
        const { h, v } = worstFrameFraction(fit({ ...over, aspect }));
        expect({ name, aspect, cutOffHorizontally: h > 1 }).toEqual({ name, aspect, cutOffHorizontally: false });
        expect({ name, aspect, cutOffVertically: v > 1 }).toEqual({ name, aspect, cutOffVertically: false });
      }
    }
  });

  it("⚠ and it is TIGHT — the building fills the frame rather than floating in it", () => {
    /* The bounding-sphere fit that was tried first passed the test above and
       still framed a 48 x 24 at about 60% of the width, which is what made
       the 3in thumbnail look like a mistake. One axis has to be nearly full
       for the picture to be worth its space. */
    for (const over of [
      {},
      { box: { minX: 0, maxX: 24, minZ: 0, maxZ: 16 }, centerX: 12, centerZ: 8, yMaxFt: 13, targetYFt: 6.5 },
      { box: { minX: 0, maxX: 12, minZ: 0, maxZ: 12 }, centerX: 6, centerZ: 6, yMaxFt: 40, targetYFt: 20 },
    ]) {
      const { h, v } = worstFrameFraction(fit(over));
      expect(Math.max(h, v)).toBeGreaterThan(0.85);
    }
  });

  it("⚠ a taller building is framed from further away — the height is IN the sum", () => {
    /* The one-line statement of the bug: this used to be the same number
       twice, because the fit read the plan and nothing else. */
    const short = birdsEyeCameraPosition(fit({ yMaxFt: 10, targetYFt: 5 }));
    const tall = birdsEyeCameraPosition(fit({ yMaxFt: 40, targetYFt: 20 }));
    const radius = (c: [number, number, number], targetY: number) =>
      Math.hypot(c[0] - 24, c[1] - targetY, c[2] - 12);
    expect(radius(tall, 20)).toBeGreaterThan(radius(short, 5));
  });

  it("a narrower canvas is framed from further away, not cropped", () => {
    const wide = birdsEyeCameraPosition(fit({ aspect: 2.4 }));
    const narrow = birdsEyeCameraPosition(fit({ aspect: 0.75 }));
    const radius = (c: [number, number, number]) => Math.hypot(c[0] - 24, c[1] - 7, c[2] - 12);
    expect(radius(narrow)).toBeGreaterThan(radius(wide));
  });

  it("never collapses onto the target, even for a building of no size", () => {
    const camera = birdsEyeCameraPosition(
      fit({ box: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }, centerX: 0, centerZ: 0, yMinFt: 0, yMaxFt: 0, targetYFt: 0 }),
    );
    expect(Math.hypot(camera[0], camera[1], camera[2])).toBeGreaterThanOrEqual(1);
  });
});
