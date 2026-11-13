import { describe, expect, it } from "vitest";
import {
  GABLE_SHED_SNAP_THRESHOLD_IN,
  buildOctagonFootprint,
  buildRectangleFootprint,
  type Footprint,
} from "@building-integrity/geometry";
import {
  HANDLE_STANDOFF_FT,
  MIN_HANDLE_VALUE_FT,
  PEAK_HANDLE_ENABLED,
  clampHandleValueFt,
  dimensionHandles,
  snapPeakPositionFt,
  wallFrame,
  type DimensionHandle,
  type DimensionHandleInput,
} from "./dimensionHandles";

const RECTANGLE = buildRectangleFootprint(24, 16);
const OCTAGON = buildOctagonFootprint(30, 20);

function input(over: Partial<DimensionHandleInput> = {}): DimensionHandleInput {
  return {
    footprint: RECTANGLE,
    shapeKind: "rectangle",
    wallHeightFt: 9,
    eaveHeightFt: 10,
    roofRiseFt: 4,
    gableWallId: "BC",
    peakPositionFt: null,
    /* ⚠ The peak slider is HELD BACK in the app (`PEAK_HANDLE_ENABLED`), but
       its geometry stays measured here so it comes back working rather than
       rotting — see that constant for the crash that holds it. */
    includePeakHandle: true,
    ...over,
  };
}

function byId(handles: DimensionHandle[], id: string): DimensionHandle | undefined {
  return handles.find((h) => h.id === id);
}

/** Is this point outside the footprint's plan polygon? Ray-casting, so it is
 * an independent answer rather than a re-run of `wallFrame`'s own normal. */
function outsidePlan(footprint: Footprint, x: number, z: number): boolean {
  let inside = false;
  const pts = footprint.corners.map((c) => c.point);
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.y > z !== b.y > z && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return !inside;
}

describe("a wall's own frame", () => {
  it("the midpoint really is the middle and the direction is a unit vector", () => {
    const frame = wallFrame(RECTANGLE, "AB")!;
    expect(frame.midX).toBeCloseTo(12, 9);
    expect(frame.midZ).toBeCloseTo(0, 9);
    expect(Math.hypot(frame.dirX, frame.dirZ)).toBeCloseTo(1, 9);
    expect(frame.lengthFt).toBeCloseTo(24, 9);
  });

  it("⚠ the outward normal points OUT, on every wall of both shapes", () => {
    for (const fp of [RECTANGLE, OCTAGON]) {
      for (const wall of fp.walls) {
        const frame = wallFrame(fp, wall.id)!;
        const probeX = frame.midX + frame.outX * 0.5;
        const probeZ = frame.midZ + frame.outZ * 0.5;
        expect(outsidePlan(fp, probeX, probeZ), `${wall.id}'s normal points inward`).toBe(true);
      }
    }
  });

  it("the normal is perpendicular to the wall and a unit vector", () => {
    for (const wall of OCTAGON.walls) {
      const f = wallFrame(OCTAGON, wall.id)!;
      expect(Math.hypot(f.outX, f.outZ)).toBeCloseTo(1, 9);
      expect(f.dirX * f.outX + f.dirZ * f.outZ).toBeCloseTo(0, 9);
    }
  });

  it("answers null for a wall that is not there", () => {
    expect(wallFrame(RECTANGLE, "ZZ")).toBeNull();
  });
});

describe("which handles a building gets", () => {
  it("a rectangle with a roof gets all five", () => {
    expect(dimensionHandles(input()).map((h) => h.id).sort()).toEqual([
      "depth",
      "roofHeight",
      "roofPeak",
      "wallHeight",
      "width",
    ]);
  });

  it("⚠ and the app now SHIPS all five — Tommy re-enabled the peak slider 2026-11-13", () => {
    /* ⚠ This assertion is deliberately the inverse of what it was, and the
       flip is the record of a decision rather than a tidy-up.

       It read `expect(PEAK_HANDLE_ENABLED).toBe(false)` from 2026-11-07, with
       the note *"if this ever reads true, the gable zero-height-tile crash has
       been fixed and `includePeakHandle` and this test should both go."* The
       band it guarded no longer reproduces — swept inch by inch across all
       three gable templates in `gablePeakSweep.test.ts`, and driven in the
       browser — and Tommy made the call: *"Let's re-enable it then."*

       ⚠ **`includePeakHandle` and `PEAK_HANDLE_ENABLED` both STAY**, against
       that old note. They are the switch that takes the handle back out
       without touching anything else, and the reason to keep it is that the
       crash's root cause was never pinned to a commit — see
       `PEAK_HANDLE_ENABLED`'s own doc comment. A control that went back on for
       reasons we only partly understand keeps its off switch. */
    expect(PEAK_HANDLE_ENABLED).toBe(true);
    const shipped = dimensionHandles({ ...input(), includePeakHandle: undefined });
    expect(shipped.map((h) => h.id).sort()).toEqual(["depth", "roofHeight", "roofPeak", "wallHeight", "width"]);
  });

  it("⚠ the override still takes the peak handle back out", () => {
    /* The off switch, exercised — so it cannot rot while it is unused. */
    const withheld = dimensionHandles({ ...input(), includePeakHandle: false });
    expect(withheld.map((h) => h.id).sort()).toEqual(["depth", "roofHeight", "wallHeight", "width"]);
  });

  it("an octagon gets all five too — its straight walls drive the box", () => {
    const handles = dimensionHandles(input({ footprint: OCTAGON, shapeKind: "octagon", gableWallId: "23" }));
    expect(handles.map((h) => h.id).sort()).toEqual(["depth", "roofHeight", "roofPeak", "wallHeight", "width"]);
  });

  it("⚠ a FREEFORM plan gets no width or depth handle, because it has no box to drag", () => {
    const handles = dimensionHandles(input({ shapeKind: "freeform" }));
    expect(byId(handles, "width")).toBeUndefined();
    expect(byId(handles, "depth")).toBeUndefined();
    /* Wall height is still a single number on any shape, so it stays. */
    expect(byId(handles, "wallHeight")).toBeDefined();
  });

  it("⚠ no roof means no ridge and no peak — a control that refuses on contact is worse than none", () => {
    const noRoof = dimensionHandles(input({ roofRiseFt: null }));
    expect(byId(noRoof, "roofHeight")).toBeUndefined();
    expect(byId(noRoof, "roofPeak")).toBeUndefined();

    const noGable = dimensionHandles(input({ gableWallId: null }));
    expect(byId(noGable, "roofHeight")).toBeUndefined();
    expect(byId(noGable, "roofPeak")).toBeUndefined();
  });

  it("every handle names the wall its commit needs, or honestly has none", () => {
    for (const handle of dimensionHandles(input())) {
      if (handle.id === "wallHeight") continue;
      expect(handle.wallId, `${handle.id} has no wall to commit against`).not.toBeNull();
    }
  });
});

describe("where the handles float", () => {
  it("⚠ every badge sits OUTSIDE the building, so none of them is inside a wall", () => {
    for (const handle of dimensionHandles(input())) {
      expect(outsidePlan(RECTANGLE, handle.anchorFt[0], handle.anchorFt[2]), `${handle.id} is inside the plan`).toBe(
        true,
      );
    }
  });

  it("and outside an octagon too, whose walls run at 45 degrees", () => {
    const handles = dimensionHandles(input({ footprint: OCTAGON, shapeKind: "octagon", gableWallId: "23" }));
    for (const handle of handles) {
      expect(outsidePlan(OCTAGON, handle.anchorFt[0], handle.anchorFt[2]), `${handle.id} is inside the plan`).toBe(
        true,
      );
    }
  });

  /**
   * ⚠ **This case was written by the browser, not by reasoning, and the
   * fixture above is why it had to be.** The height badge first hung off the
   * depth wall's top plate, and on a real one-storey building the eave is
   * within inches of the top plate — so it landed under the peak slider. The
   * fixture had the eave a foot above the wall and showed nothing. Every
   * configuration here now includes the one where they coincide.
   */
  const LAYOUTS: { name: string; over: Partial<DimensionHandleInput> }[] = [
    { name: "a shed, eave AT the top plate", over: { wallHeightFt: 9, eaveHeightFt: 9, peakPositionFt: 0 } },
    { name: "a peak, eave just above the top plate", over: { wallHeightFt: 9, eaveHeightFt: 9.6 } },
    { name: "a tall two-storey", over: { wallHeightFt: 9, eaveHeightFt: 19, roofRiseFt: 7 } },
    { name: "a long shallow plan", over: { footprint: buildRectangleFootprint(60, 14), gableWallId: "BC" } },
    { name: "a square plan", over: { footprint: buildRectangleFootprint(28, 28), gableWallId: "BC" } },
    {
      name: "an octagon",
      over: { footprint: OCTAGON, shapeKind: "octagon" as const, gableWallId: "23", eaveHeightFt: 9 },
    },
    { name: "no roof at all", over: { roofRiseFt: null } },
  ];

  it.each(LAYOUTS)("⚠ $name: no two badges land on top of each other", ({ over }) => {
    const handles = dimensionHandles(input(over));
    for (let i = 0; i < handles.length; i++) {
      for (let j = i + 1; j < handles.length; j++) {
        const a = handles[i]!.anchorFt;
        const b = handles[j]!.anchorFt;
        const apart = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        expect(apart, `${handles[i]!.id} and ${handles[j]!.id} are ${apart.toFixed(2)}ft apart`).toBeGreaterThan(1.5);
      }
    }
  });

  it("⚠ the height badge never shares a wall with the roof handles", () => {
    for (const { over } of LAYOUTS) {
      const handles = dimensionHandles(input(over));
      const height = byId(handles, "wallHeight");
      const peak = byId(handles, "roofPeak");
      if (!height || !peak) continue;
      expect(height.wallId, "the height badge is on the gable wall, where the roof handles live").not.toBe(
        peak.wallId,
      );
    }
  });

  it("the standoff really is the standoff — a badge clears the wall by it", () => {
    const width = byId(dimensionHandles(input()), "width")!;
    const frame = wallFrame(RECTANGLE, width.wallId!)!;
    const outFt =
      (width.anchorFt[0] - frame.midX) * frame.outX + (width.anchorFt[2] - frame.midZ) * frame.outZ;
    expect(outFt).toBeCloseTo(HANDLE_STANDOFF_FT, 9);
  });

  it("the length badges float above the ground, clear of U4's props and U5's lawn", () => {
    for (const id of ["width", "depth"] as const) {
      expect(byId(dimensionHandles(input()), id)!.anchorFt[1]).toBeGreaterThan(0.5);
    }
  });

  it("⚠ the ridge badge sits at the eave PLUS the rise, not at the rise", () => {
    const handles = dimensionHandles(input({ eaveHeightFt: 10, roofRiseFt: 4 }));
    expect(byId(handles, "roofHeight")!.anchorFt[1]).toBeCloseTo(14, 9);
    /* And the peak slider sits ON the eave, under it. */
    expect(byId(handles, "roofPeak")!.anchorFt[1]).toBeCloseTo(10, 9);
  });

  it("an unplaced peak is centred on its wall, which is what null means", () => {
    const centred = byId(dimensionHandles(input({ gableWallId: "BC" })), "roofPeak")!;
    expect(centred.valueFt).toBeCloseTo(16 / 2, 9);
    const placed = byId(dimensionHandles(input({ gableWallId: "BC", peakPositionFt: 3 })), "roofPeak")!;
    expect(placed.valueFt).toBeCloseTo(3, 9);
  });
});

describe("what a handle reads and which way it drags", () => {
  it("the width and depth handles read their own wall's length", () => {
    const handles = dimensionHandles(input());
    expect(byId(handles, "width")!.valueFt).toBeCloseTo(24, 9);
    expect(byId(handles, "depth")!.valueFt).toBeCloseTo(16, 9);
  });

  it("the height handles drag straight up and the plan handles drag along their wall", () => {
    const handles = dimensionHandles(input());
    for (const id of ["wallHeight", "roofHeight"] as const) {
      expect(byId(handles, id)!.axisFt).toEqual([0, 1, 0]);
    }
    for (const id of ["width", "depth", "roofPeak"] as const) {
      const handle = byId(handles, id)!;
      expect(handle.axisFt[1]).toBe(0);
      expect(Math.hypot(handle.axisFt[0], handle.axisFt[2])).toBeCloseTo(1, 9);
    }
  });

  it("⚠ a plan handle's drag axis runs ALONG its wall, so the gesture matches the number", () => {
    const width = byId(dimensionHandles(input()), "width")!;
    const frame = wallFrame(RECTANGLE, width.wallId!)!;
    expect(Math.abs(width.axisFt[0] * frame.dirX + width.axisFt[2] * frame.dirZ)).toBeCloseTo(1, 9);
  });

  it("every handle carries a step and a hint that says what else moves", () => {
    for (const handle of dimensionHandles(input())) {
      expect(handle.stepFt).toBeGreaterThan(0);
      expect(handle.hint.length).toBeGreaterThan(20);
      expect(handle.label.length).toBeGreaterThan(2);
    }
  });

  it("the octagon's hint admits the coupling instead of hiding it", () => {
    const handles = dimensionHandles(input({ footprint: OCTAGON, shapeKind: "octagon", gableWallId: "23" }));
    expect(byId(handles, "width")!.hint).toMatch(/corner walls/);
  });
});

describe("what a thrown drag is allowed to become", () => {
  const handles = dimensionHandles(input());
  const width = byId(handles, "width")!;
  const peak = byId(handles, "roofPeak")!;

  it("a length never goes to zero or below", () => {
    expect(clampHandleValueFt(width, -40, 24)).toBe(MIN_HANDLE_VALUE_FT);
    expect(clampHandleValueFt(width, 0, 24)).toBe(MIN_HANDLE_VALUE_FT);
  });

  it("⚠ but it is NOT clamped to a made-up minimum building size — that refusal belongs to the panels", () => {
    /* `resizeWallRun`'s shortfall is the real floor and it knows the panels.
       Inventing one here would be guessing at a building number. */
    expect(clampHandleValueFt(width, 2, 24)).toBe(2);
    expect(clampHandleValueFt(width, 900, 24)).toBe(900);
  });

  it("a peak position stays on its own wall", () => {
    expect(clampHandleValueFt(peak, -5, 16)).toBe(0);
    expect(clampHandleValueFt(peak, 40, 16)).toBe(16);
  });

  it("⚠ and BOTH ends of a wall are legal for a peak, because that is how a shed is stored", () => {
    expect(clampHandleValueFt(peak, 0, 16)).toBe(0);
    expect(clampHandleValueFt(peak, 16, 16)).toBe(16);
  });
});

describe("⚠ the dead zone beside each end is not a place the roof can be", () => {
  const T_FT = GABLE_SHED_SNAP_THRESHOLD_IN / 12;
  const WALL_FT = 16;
  const peak = byId(dimensionHandles(input()), "roofPeak")!;

  it("nothing lands strictly inside the shed-snap zone, from any input", () => {
    for (let i = 0; i <= 2000; i++) {
      const raw = -3 + (i * (WALL_FT + 6)) / 2000;
      const out = snapPeakPositionFt(raw, WALL_FT);
      const insideLeft = out > 0 && out < T_FT - 1e-9;
      const insideRight = out > WALL_FT - T_FT + 1e-9 && out < WALL_FT;
      expect(insideLeft || insideRight, `${raw.toFixed(3)}ft snapped to ${out.toFixed(3)}ft, inside the zone`).toBe(
        false,
      );
    }
  });

  it("the ends and the whole legal middle are left exactly alone", () => {
    expect(snapPeakPositionFt(0, WALL_FT)).toBe(0);
    expect(snapPeakPositionFt(WALL_FT, WALL_FT)).toBe(WALL_FT);
    for (const ft of [T_FT, 4, WALL_FT / 2, 10, WALL_FT - T_FT]) {
      expect(snapPeakPositionFt(ft, WALL_FT)).toBeCloseTo(ft, 9);
    }
  });

  it("⚠ one chevron click leaves an end and lands clear of the zone, and one click comes back", () => {
    const step = peak.stepFt;
    expect(step).toBeCloseTo(T_FT, 9);
    const out = clampHandleValueFt(peak, 0 + step, WALL_FT);
    expect(out).toBeCloseTo(T_FT, 9);
    expect(clampHandleValueFt(peak, out - step, WALL_FT)).toBe(0);
  });

  it("⚠ a wall too short for a real peak either side offers only its two ends", () => {
    const shortFt = 3;
    for (const raw of [0.2, 1, 1.4, 1.6, 2, 2.9]) {
      const out = snapPeakPositionFt(raw, shortFt);
      expect([0, shortFt]).toContain(out);
    }
  });

  it("snapping is idempotent — a committed position never moves again", () => {
    for (let i = 0; i <= 200; i++) {
      const once = snapPeakPositionFt((i * WALL_FT) / 200, WALL_FT);
      expect(snapPeakPositionFt(once, WALL_FT)).toBe(once);
    }
  });

  it("a wall of no length cannot carry a peak anywhere but zero", () => {
    expect(snapPeakPositionFt(5, 0)).toBe(0);
  });
});
