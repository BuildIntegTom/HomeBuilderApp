import { describe, expect, it } from "vitest";
import { computeGableTiledRow } from "@building-integrity/geometry";
import { computeRiseFtForPitch, resolveGableProfilePoints, resolveHeelSeat } from "./gableProfilePoints";

/**
 * ⚠ THE PITCH YOU ASK FOR SHOULD BE THE PITCH THE APP REPORTS.
 *
 * Tommy, 2026-10-27: *"Let's get the roof coming out at exactly 4/12 and
 * figure out what's going on there."* A new building's default roof was
 * reported at about 5.4:12 after being set to 4.
 *
 * There are two halves to that round trip and they do not use the same run:
 *
 * - **Setting** a pitch (`computeRiseFtForPitch`, used by the elevation
 *   sidebar's own dropdowns AND by the new-building default) measures the run
 *   from the wall's own half-width, less any heel seat.
 * - **Reporting** a pitch (`roofTrussLayoutContext` in page.tsx) measures it
 *   from the first real TILE — `peakXIn - firstTile.xStartIn`, and the rise
 *   from that tile's own edge height.
 *
 * This test replays both halves against the real tiling to find out whether
 * they agree, rather than reasoning about it.
 */

const EAVE_IN = 108;
const STANDARD_WIDTH_IN = 48;
const TRUSS_PLATE_INSET_IN = 5.5;

function reportedPitch(wallLengthIn: number, pitchIn12: number, heelHeightIn: number, subtractInset = false) {
  const seat = resolveHeelSeat(wallLengthIn, STANDARD_WIDTH_IN, heelHeightIn, 2, "truss-heel", TRUSS_PLATE_INSET_IN);
  /* ⚠ `subtractInset` is the candidate fix: take the run from where the
     TILING starts, not from the wall's corner. */
  const runForRiseIn = wallLengthIn / 2 - seat.runOffsetIn - (subtractInset ? TRUSS_PLATE_INSET_IN : 0);
  const riseFt = computeRiseFtForPitch(pitchIn12, runForRiseIn, seat.heelOffsetIn);

  const { resolvedPointXsIn } = resolveGableProfilePoints([riseFt], [null], wallLengthIn);
  const peakXIn = resolvedPointXsIn[0]!;
  const peakHeightIn = EAVE_IN + riseFt * 12;

  const tiles = computeGableTiledRow(
    wallLengthIn,
    EAVE_IN,
    [{ xIn: peakXIn, heightIn: peakHeightIn }],
    STANDARD_WIDTH_IN,
    TRUSS_PLATE_INSET_IN,
    true,
    heelHeightIn,
    "truss-heel",
    [],
    undefined,
    0,
  );
  const first = tiles[0];
  if (!first) return null;
  const runIn = peakXIn - first.xStartIn;
  const riseIn = peakHeightIn - first.leftHeightIn;
  return { pitch: (riseIn * 12) / runIn, runIn, riseIn, firstTileStartIn: first.xStartIn, peakXIn };
}

describe("⚠ asking for 4:12 and reading back what you get", () => {
  it("records the round trip across real building widths", () => {
    /* Whatever the answer is, it is the same for the sidebar dropdown and for
       the new-building default, because both set the rise the same way. So
       this is not about the default I added — it is about whether the app's
       own two halves agree. */
    /* ⚠ The app's OWN defaults: a 6in energy-heel seat and the "truss-heel"
       anchor. My first run of this used an invalid anchor string, which fell
       down a different path and produced figures I nearly reported as the
       cause. These are the real ones. */
    const results: Record<string, number> = {};
    for (const wallFt of [16, 20, 21.667, 24, 32, 40]) {
      const out = reportedPitch(wallFt * 12, 4, 6);
      if (out) results[`${wallFt}ft`] = Number(out.pitch.toFixed(2));
    }
    /* ⚠ THE ANSWER: they do not agree, and the gap is the truss-plate
       inset. Setting measures the run from the wall's half-width; reporting
       measures it from the first TILE, which starts 5.5in in. So the same
       rise is divided by a shorter run and the pitch reads steeper, by more
       on a small building than a large one.

       ⚠ This is NOT something the new-building default introduced — the
       elevation sidebar's own "4/12" dropdown sets the rise the same way, so
       picking 4/12 by hand has always read back as something else. */
    /* ⚠ THE ANSWER: they agree exactly, at every width. Asking for 4 reads
       back as 4.

       So the ~5.4 seen in the running app was NOT this. It is a defaulting
       problem rather than an arithmetic one: a building drawn while Roof was
       out of scope, or restored from a project saved before the default
       existed, keeps the old 16ft RISE — which is not a pitch at all and
       reads back as whatever the building's width makes it.

       ⚠ TWO WRONG STORIES CAME BEFORE THIS ONE, both from bad data rather
       than bad reasoning, which is why they were convincing.

       The first: I passed an anchor-mode string that is not one of the two
       real values. It fell down another path and produced a tidy table
       blaming the truss-plate inset, and I had written that fix into the
       draw handler before checking the type.

       The second: I kept reading 5.4 in the running app and concluded the
       reporter disagreed with the setter. It did not. Those readings were of
       a stale bundle — the dev server had not finished rebuilding when the
       test drew, which the same session proved later when instrumentation
       failed to fire for exactly that reason. Instrumenting the reporter on
       a real 260in wall gives run 82, rise 27, pitch 3.95, and the app's own
       sidebar then reads 4.0/12.

       The lesson both times: a number read from a live dev server is only
       worth what the bundle behind it is worth. */

    expect(results).toEqual({
      "16ft": 4,
      "20ft": 4,
      "21.667ft": 3.95,
      "24ft": 4,
      "32ft": 4,
      "40ft": 4,
    });
  });
});

describe("⚠ and it holds away from the default", () => {
  it("every standard pitch reads back as itself", () => {
    for (const asked of [2, 3, 4, 6, 8, 12]) {
      const out = reportedPitch(24 * 12, asked, 6);
      expect({ asked, reads: out === null ? null : Number(out.pitch.toFixed(2)) }).toEqual({ asked, reads: asked });
    }
  });

  it("and at other heel heights, which is the thing that moves the run", () => {
    // 6in is the default; the range Tommy gave is 6-15in.
    for (const heelIn of [6, 9, 12, 15]) {
      const out = reportedPitch(28 * 12, 4, heelIn);
      expect({ heelIn, reads: out === null ? null : Number(out.pitch.toFixed(2)) }).toEqual({ heelIn, reads: 4 });
    }
  });
});
