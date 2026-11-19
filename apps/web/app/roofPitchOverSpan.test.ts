import { describe, expect, it } from "vitest";
import {
  buildOctagonFootprint,
  buildRectangleFootprint,
  gableEndWallIdsFor,
  roofSpanFt,
  simpleRoofPlanes,
} from "@building-integrity/geometry";
import { pitchFromStoredRiseFt, riseFtForPitch } from "./roofPitchFromRise";

/* ──────────────────────────────────────────────────────────────────────────
   THE PITCH IS MEASURED OVER THE BUILDING, NOT ALONG THE GABLE WALL

   Tommy, 2026-11-18: "i may be outdated on this, but at some point i noticed
   the shed roof of an octagon goes up till its tallest gable panels - and they
   are way taller than the rest of the dual bevel tilted gable panels."

   He was not outdated. `roofTrussLayoutContext` divided the rise by a run
   measured along the GABLE WALL, off that wall's own tiles, and every reader
   of the roof takes that number.

   ⚠ The reason it survived: on a box the gable wall IS the span, so a box can
   never catch it. These tests are the octagon.
   ────────────────────────────────────────────────────────────────────────── */

const SEAT = { standardWidthIn: 48, heelHeightIn: 0, anchorMode: "truss-heel" as const, trussPlateInsetIn: 15.5 };

const gableWallLengthFt = (fp: ReturnType<typeof buildRectangleFootprint>) => {
  const id = gableEndWallIdsFor(fp)[0]!;
  return fp.walls.find((w) => w.id === id)!.lengthFt;
};

describe("⚠ a gable wall's length is NOT the building's span", () => {
  it("they are equal on a box, which is why a box can never catch this", () => {
    const box = buildRectangleFootprint(24, 16);
    expect(gableWallLengthFt(box)).toBeCloseTo(roofSpanFt(box), 9);
  });

  it("⚠ and they are 2.4x apart on a 16ft octagon", () => {
    const oct = buildOctagonFootprint(16, 16);
    expect(roofSpanFt(oct)).toBeCloseTo(16, 9);
    /* One facet, not the building. This is the number the old code divided by. */
    expect(gableWallLengthFt(oct)).toBeCloseTo(6.625, 3);
    expect(roofSpanFt(oct) / gableWallLengthFt(oct)).toBeGreaterThan(2.4);
  });

  it("⚠ so the same rise reads 9.66:12 over the wall and 4:12 over the span", () => {
    const oct = buildOctagonFootprint(16, 16);
    const riseIn = 64;
    expect((riseIn * 12) / (gableWallLengthFt(oct) * 12)).toBeCloseTo(9.66, 2);
    expect((riseIn * 12) / (roofSpanFt(oct) * 12)).toBeCloseTo(4, 9);
  });
});

describe("⚠ the shared inverse is keyed on the span, and round-trips", () => {
  it("rise -> pitch -> rise returns where it started, on an octagon and a box", () => {
    for (const fp of [buildOctagonFootprint(16, 16), buildOctagonFootprint(32, 32), buildRectangleFootprint(24, 16)]) {
      for (const isShed of [true, false]) {
        const acrossFt = roofSpanFt(fp);
        const riseFt = riseFtForPitch(acrossFt, isShed, 4, SEAT);
        const back = pitchFromStoredRiseFt(acrossFt, isShed, riseFt, SEAT);
        /* Bounded rather than exact: `computeRiseFtForPitch` rounds the rise to
           a whole inch, so a pitch comes back within about 0.05:12. */
        expect(back).not.toBeNull();
        expect(back!).toBeCloseTo(4, 1);
      }
    }
  });

  it("⚠ and the run it uses is the run the ROOF PLANES use", () => {
    /* The argument that settles which line is right: `simpleRoofPlanes` takes
       `runFt = roofSpanFt / (peaked ? 2 : 1)` and never reads the peak's
       position, so a run measured along the gable wall is a measurement of a
       line the roof never uses. */
    const oct = buildOctagonFootprint(16, 16);
    for (const [form, divisor] of [
      ["shed", 1],
      ["peaked", 2],
    ] as const) {
      const roof = simpleRoofPlanes(oct, { form, pitchIn12: 4, eaveHeightFt: 10 });
      expect(roof.planes[0]!.runFt).toBeCloseTo(roofSpanFt(oct) / divisor, 9);
      /* And never the gable wall's own length. */
      expect(roof.planes[0]!.runFt).not.toBeCloseTo(gableWallLengthFt(oct), 3);
    }
  });
});
