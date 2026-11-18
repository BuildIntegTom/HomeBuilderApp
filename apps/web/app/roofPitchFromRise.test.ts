import { describe, expect, it } from "vitest";
import {
  pitchFromStoredRiseFt,
  riseFtForPitch,
  roofFormFromProfilePositions,
  roofPitchRunAndHeel,
  type RoofPitchSeatContext,
} from "./roofPitchFromRise";

/* ──────────────────────────────────────────────────────────────────────────
   B34 STRIDE 4 — READING A PITCH BACK OUT OF A STORED RISE

   ⚠ Why this exists: `refreshRoofForShapeChange` re-derives the roof when a
   shape change invalidates it, and it re-derived at the app's 4:12 DEFAULT.
   A roof set to 8:12 by hand came back 4:12 after one drag, silently, with
   every gable tile, every roof panel and the price following it down.

   Nobody had hit it because every building was DRAWN at 4:12, so the default
   was the right answer by accident. His Multiplex ships at 8:12.
   ────────────────────────────────────────────────────────────────────────── */

/** Heel off, which is the plain case and the one the round trip is exact in. */
const NO_HEEL: RoofPitchSeatContext = {
  standardWidthIn: 48,
  heelHeightIn: 0,
  anchorMode: "truss-heel",
  trussPlateInsetIn: 0,
};

/** A real truss heel, which shortens the run AND raises its start — the case
 *  where two copies of the arithmetic would drift apart. */
const WITH_HEEL: RoofPitchSeatContext = {
  standardWidthIn: 48,
  heelHeightIn: 12,
  anchorMode: "truss-heel",
  trussPlateInsetIn: 0,
};

/** Panel-depth anchoring: the inset shortens the run and there is no riser. */
const PANEL_DEPTH: RoofPitchSeatContext = {
  standardWidthIn: 48,
  heelHeightIn: 12,
  anchorMode: "panel-depth",
  trussPlateInsetIn: 15.5,
};

describe("⚠ the round trip, which is the whole point", () => {
  it("a pitch survives rise-and-back on every shape, pitch and seat", () => {
    for (const ctx of [NO_HEEL, WITH_HEEL, PANEL_DEPTH]) {
      for (const acrossFt of [16, 24, 32, 36, 48, 55.25]) {
        for (const isShed of [false, true]) {
          for (const pitchIn12 of [2, 3, 4, 6, 8, 12]) {
            const riseFt = riseFtForPitch(acrossFt, isShed, pitchIn12, ctx);
            const back = pitchFromStoredRiseFt(acrossFt, isShed, riseFt, ctx);
            /* ⚠ **Bounded, not exact, and the bound is the ROUNDING.**
               `computeRiseFtForPitch` rounds the rise to a whole inch, so the
               pitch comes back within half an inch of rise over the run —
               about 0.03:12 on an 18ft run, and more on a short one. Asserted
               as a rise tolerance rather than a pitch one, because that is
               what the rounding is actually in. */
            const { runForPitchIn } = roofPitchRunAndHeel(acrossFt, isShed, ctx);
            const driftIn = (Math.abs(back! - pitchIn12) / 12) * runForPitchIn;
            /* ⚠ The epsilon is float representation, not slack: 55.25ft at
               4:12 lands on 0.5000000000000052, which IS the half-inch bound
               and not a hair over it. */
            expect(driftIn, `${acrossFt}ft ${isShed ? "shed" : "peak"} ${pitchIn12}:12`).toBeLessThanOrEqual(
              0.5 + 1e-9,
            );
          }
        }
      }
    }
  });

  it("⚠ his 8:12 on his 36ft Multiplex comes back as 8:12", () => {
    /* The case the whole stride is for, spelled out rather than left inside a
       sweep: a 36ft peak at 8:12 rises 12ft over an 18ft half-span. */
    const riseFt = riseFtForPitch(36, false, 8, NO_HEEL);
    expect(riseFt).toBeCloseTo(12, 9);
    expect(pitchFromStoredRiseFt(36, false, riseFt, NO_HEEL)).toBeCloseTo(8, 9);
  });

  it("⚠ 4:12 and 8:12 do NOT read back as each other — the defect, stated", () => {
    /* The resize bug was that a stored 8:12 rise was replaced by a 4:12 one.
       If this helper could not tell them apart it would be no fix at all. */
    const at8 = riseFtForPitch(36, false, 8, NO_HEEL);
    const at4 = riseFtForPitch(36, false, 4, NO_HEEL);
    expect(at8).not.toBeCloseTo(at4, 1);
    expect(pitchFromStoredRiseFt(36, false, at4, NO_HEEL)).toBeCloseTo(4, 9);
  });
});

describe("⚠ the run is the thing both directions have to agree about", () => {
  it("a shed measures the WHOLE span, a peak half of it", () => {
    expect(roofPitchRunAndHeel(36, true, NO_HEEL).runForPitchIn).toBeCloseTo(432, 9);
    expect(roofPitchRunAndHeel(36, false, NO_HEEL).runForPitchIn).toBeCloseTo(216, 9);
  });

  it("⚠ so the same rise means DIFFERENT pitches on a shed and a peak", () => {
    /* Which is why `isShed` is a parameter rather than something guessed: a
       12ft rise is 8:12 across half a 36ft building and 4:12 across all of
       it. Reading a shed's rise as a peak's would halve the roof. */
    const riseFt = 12;
    expect(pitchFromStoredRiseFt(36, false, riseFt, NO_HEEL)).toBeCloseTo(8, 9);
    expect(pitchFromStoredRiseFt(36, true, riseFt, NO_HEEL)).toBeCloseTo(4, 9);
  });

  it("a heel shortens the run and lifts its start, and both are carried", () => {
    const plain = roofPitchRunAndHeel(36, false, NO_HEEL);
    const heeled = roofPitchRunAndHeel(36, false, WITH_HEEL);
    expect(heeled.runForPitchIn).toBeLessThan(plain.runForPitchIn);
    expect(heeled.heelOffsetIn).toBeGreaterThan(0);
    expect(plain.heelOffsetIn).toBe(0);
  });

  it("⚠ panel-depth anchoring shortens the run with NO riser", () => {
    const seat = roofPitchRunAndHeel(36, false, PANEL_DEPTH);
    expect(seat.runForPitchIn).toBeCloseTo(216 - 15.5, 9);
    expect(seat.heelOffsetIn).toBe(0);
  });
});

describe("⚠ it refuses rather than guessing", () => {
  it("returns null with no rise to read", () => {
    expect(pitchFromStoredRiseFt(36, false, undefined, NO_HEEL)).toBeNull();
    expect(pitchFromStoredRiseFt(36, false, 0, NO_HEEL)).toBeNull();
    /* A flat roof is a real thing, but it is not a pitch this can recover —
       and the caller's fallback to the app default is the honest answer. */
    expect(pitchFromStoredRiseFt(36, false, -1, NO_HEEL)).toBeNull();
  });

  it("returns null with no run to measure over", () => {
    expect(pitchFromStoredRiseFt(0, false, 12, NO_HEEL)).toBeNull();
  });
});

describe("⚠ shed or peak, from the stored profile positions", () => {
  /* > "I slid the peak to the middle of a tiny house and it didn't change the
     >  roof into a gable roof." — Tommy, 2026-11-14 */
  const walls = [
    { id: "AB", lengthFt: 24 },
    { id: "CD", lengthFt: 24 },
  ];

  it("a point at either END of its wall is a SHED", () => {
    expect(roofFormFromProfilePositions(walls, ["AB"], { AB: [0] })).toBe("shed");
    expect(roofFormFromProfilePositions(walls, ["AB"], { AB: [24 * 12] })).toBe("shed");
  });

  it("⚠ a point in the MIDDLE is a PEAK — the thing he reported", () => {
    expect(roofFormFromProfilePositions(walls, ["AB"], { AB: [12 * 12] })).toBe("peaked");
  });

  it("no stored position at all is a peak, which is the default roof", () => {
    expect(roofFormFromProfilePositions(walls, ["AB", "CD"], {})).toBe("peaked");
    expect(roofFormFromProfilePositions(walls, ["AB"], { AB: [null] })).toBe("peaked");
  });

  it("⚠ ONE shed end is enough, because a roof has one form", () => {
    expect(roofFormFromProfilePositions(walls, ["AB", "CD"], { AB: [12 * 12], CD: [0] })).toBe("shed");
  });

  it("⚠ a wall with no length cannot declare a shed", () => {
    /* It cannot be measured along, so a stored 0 on it means nothing. */
    expect(roofFormFromProfilePositions([{ id: "AB", lengthFt: 0 }], ["AB"], { AB: [0] })).toBe("peaked");
  });

  it("⚠ the SAME positions read against a DIFFERENT building can differ", () => {
    /* Which is the whole reason this is a pure function taking its walls: a
       resize asks it about the OLD footprint, because that is the building the
       stored rise was measured under. 144in is the middle of a 24ft wall and
       the far END of a 12ft one. */
    const positions = { AB: [144] };
    expect(roofFormFromProfilePositions([{ id: "AB", lengthFt: 24 }], ["AB"], positions)).toBe("peaked");
    expect(roofFormFromProfilePositions([{ id: "AB", lengthFt: 12 }], ["AB"], positions)).toBe("shed");
  });
});
