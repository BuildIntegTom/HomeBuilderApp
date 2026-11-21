import { describe, expect, it } from "vitest";
import {
  roofBracePanelBandsFromWidths,
  sliceRoofBraceSegment,
  sliceRoofPlaneBracing,
  type RoofBracePanelBand,
} from "./roofBracePanelSlices";
import {
  roofBraceSegmentLengthIn,
  roofPlaneBracing,
  type RoofBraceSegment,
} from "./roofPlaneBracing";

/** A gable plane's slope length from its horizontal run and rise, in feet. */
const slopeIn = (runFt: number, riseFt: number) => Math.hypot(runFt, riseFt) * 12;

/** Bands on an exact 24in module, which is the case stride 1 measured. */
const alignedBands = (planeWidthIn: number): RoofBracePanelBand[] =>
  roofBracePanelBandsFromWidths(Array.from({ length: planeWidthIn / 24 }, () => 24));

/**
 * The SHAPE of a real roof run: a 15.5in edge panel at each end (the wall
 * thickness, Tommy's 2026-10-23 rule), 24in field panels between, and
 * whatever is left over as a tail before the far edge.
 *
 * ⚠ It mirrors `planFloorRoofPanelRun` rather than calling it — this package
 * has no dependency on `@building-integrity/panel-catalog` and must not grow
 * one. So this is a stand-in for the run's shape, and no claim here depends
 * on it being that planner's exact output.
 */
const realRunWidths = (planeWidthIn: number): number[] => {
  const field = planeWidthIn - 2 * 15.5;
  const fieldCount = Math.floor(field / 24);
  const tail = field - fieldCount * 24;
  const widths = [15.5, ...Array.from({ length: fieldCount }, () => 24)];
  if (tail > 1e-9) widths.push(tail);
  widths.push(15.5);
  return widths;
};

describe("the bands have to tile the plane exactly", () => {
  /* ⚠ Tommy's dimensional-tightness rule, applied where it can still be
     applied: a gap drops brace pieces silently and an overlap has the shop
     cut one twice. Both are invisible on screen, which is why each refusal
     names the delta rather than saying the run is wrong. */
  it("refuses a gap between two bands, and says how big it is", () => {
    const bracing = roofPlaneBracing(480, slopeIn(10, 4));
    const bands: RoofBracePanelBand[] = [
      { name: "R1", atIn: 0, widthIn: 100 },
      { name: "R2", atIn: 110, widthIn: 370 },
    ];
    expect(() => sliceRoofPlaneBracing(bracing, bands)).toThrow(/gap of 10in/);
    expect(() => sliceRoofPlaneBracing(bracing, bands)).toThrow(/R1 ends at 100in/);
  });

  it("refuses an overlap, and calls it an overlap rather than a gap", () => {
    const bracing = roofPlaneBracing(480, slopeIn(10, 4));
    const bands: RoofBracePanelBand[] = [
      { name: "R1", atIn: 0, widthIn: 100 },
      { name: "R2", atIn: 90, widthIn: 390 },
    ];
    expect(() => sliceRoofPlaneBracing(bracing, bands)).toThrow(/overlap by 10in/);
  });

  it("refuses a run that does not start at the eave", () => {
    const bracing = roofPlaneBracing(480, slopeIn(10, 4));
    expect(() =>
      sliceRoofPlaneBracing(bracing, [{ name: "R1", atIn: 12, widthIn: 468 }]),
    ).toThrow(/starts at 12in, not at the eave/);
  });

  /* ⚠ The case a caller is most likely to hit by accident: bands planned for
     a run of one length against a plane of another, which is what an
     overhang setting or a stale footprint would produce. */
  it("refuses a run shorter than the plane it is bracing", () => {
    const bracing = roofPlaneBracing(480, slopeIn(10, 4));
    expect(() =>
      sliceRoofPlaneBracing(bracing, roofBracePanelBandsFromWidths([240, 228])),
    ).toThrow(/covers 468in but the braced plane is 480in wide, a difference of 12in/);
  });

  it("refuses an empty run rather than returning no pieces", () => {
    const bracing = roofPlaneBracing(480, slopeIn(10, 4));
    expect(() => sliceRoofPlaneBracing(bracing, [])).toThrow(/zero panel bands/);
  });

  it("refuses a band with no width", () => {
    const bracing = roofPlaneBracing(480, slopeIn(10, 4));
    expect(() =>
      sliceRoofPlaneBracing(bracing, [
        { name: "R1", atIn: 0, widthIn: 0 },
        { name: "R2", atIn: 0, widthIn: 480 },
      ]),
    ).toThrow(/R1\) is 0in wide/);
  });

  /* ⚠ The arithmetic that produces these positions is an accumulation of
     panel widths on one side and the plane's own width on the other, so exact
     equality is NOT available and the tolerance has to absorb real noise.
     Seven sevenths of 1000in accumulate to 1000in plus 1.1e-13in — genuinely
     not equal, and nothing a roof is built to. A tolerance of zero refuses
     this run, which is what makes this a measurement of the tolerance rather
     than a restatement of it: `480 / 3` is exact in binary and would pass
     either way. */
  it("accepts a run that only tiles the plane to within floating-point noise", () => {
    const planeWidthIn = 1000;
    const widths = Array.from({ length: 7 }, () => planeWidthIn / 7);
    const covered = widths.reduce((sum, w) => sum + w, 0);
    expect(covered).not.toBe(planeWidthIn);
    expect(Math.abs(covered - planeWidthIn)).toBeLessThan(1e-9);
    const bracing = roofPlaneBracing(planeWidthIn, slopeIn(10, 4));
    expect(() =>
      sliceRoofPlaneBracing(bracing, roofBracePanelBandsFromWidths(widths)),
    ).not.toThrow();
  });
});

describe("one segment, cut at the seams", () => {
  const bands = alignedBands(480);

  it("puts every piece inside its own panel's band", () => {
    const bracing = roofPlaneBracing(480, slopeIn(10, 4));
    const { slices } = sliceRoofPlaneBracing(bracing, bands);
    for (const slice of slices) {
      const band = bands[slice.panelIndex]!;
      for (const x of [slice.x1In, slice.x2In]) {
        expect(x).toBeGreaterThanOrEqual(band.atIn - 1e-6);
        expect(x).toBeLessThanOrEqual(band.atIn + band.widthIn + 1e-6);
      }
    }
  });

  /* ⚠ Conservation, piece by piece: the parent is covered from end to end
     with no gap and no overlap, so nothing is lost at a seam and nothing is
     counted twice across one. */
  it("covers its parent from 0 to 1 with no gap between pieces", () => {
    const bracing = roofPlaneBracing(480, slopeIn(10, 4));
    bracing.segments.forEach((segment, index) => {
      const pieces = sliceRoofBraceSegment(segment, index, bands);
      expect(pieces.length).toBeGreaterThan(0);
      expect(pieces[0]!.startFraction).toBeCloseTo(0, 9);
      expect(pieces[pieces.length - 1]!.endFraction).toBeCloseTo(1, 9);
      for (let i = 1; i < pieces.length; i += 1) {
        expect(pieces[i]!.startFraction).toBeCloseTo(pieces[i - 1]!.endFraction, 9);
      }
    });
  });

  /* ⚠ One leg of every X runs eave-RIGHT to ridge-LEFT, so its x decreases
     as the brace is walked. Emitting pieces in x order would hand the
     installer a reversed member and make "piece 1 of 3" count from the wrong
     end. */
  it("walks a right-to-left brace in its own direction, not in x order", () => {
    const bracing = roofPlaneBracing(480, slopeIn(10, 4));
    const leg = bracing.segments.find((s) => s.figure === "x" && s.x2In < s.x1In)!;
    const pieces = sliceRoofBraceSegment(leg, 0, bands);
    expect(pieces.length).toBeGreaterThan(1);
    for (let i = 1; i < pieces.length; i += 1) {
      /* Fractions rise while x falls — the two orders are opposite here. */
      expect(pieces[i]!.startFraction).toBeGreaterThan(pieces[i - 1]!.startFraction);
      expect(pieces[i]!.x1In).toBeLessThan(pieces[i - 1]!.x1In);
    }
    expect(pieces[0]!.x1In).toBeCloseTo(leg.x1In, 9);
    expect(pieces[pieces.length - 1]!.x2In).toBeCloseTo(leg.x2In, 9);
  });

  /* A seam landing exactly on a brace's end is the common case, not an edge
     case: every X leg starts on a bay edge, and a bay edge often IS a seam.
     A zero-length piece there would be an unbuildable member in the takeoff. */
  it("emits no zero-length piece where a seam lands on a brace's end", () => {
    const bracing = roofPlaneBracing(480, slopeIn(10, 4));
    const { slices } = sliceRoofPlaneBracing(bracing, bands);
    for (const slice of slices) {
      expect(roofBraceSegmentLengthIn(slice)).toBeGreaterThan(1e-6);
    }
  });

  /* ⚠ Not a case stride 1's figure produces — its own test asserts nothing in
     it is axis-aligned. It is a guard against a later figure, and the failure
     it prevents is NaN rather than a wrong position: dividing by a zero dx
     would make every fraction NaN and the brace length NaN with it. */
  it("gives a brace with no run along the eave one piece, not a NaN", () => {
    const vertical: RoofBraceSegment = {
      x1In: 100,
      y1In: 0,
      x2In: 100,
      y2In: 120,
      figure: "carrot",
      bayIndex: 0,
    };
    const pieces = sliceRoofBraceSegment(vertical, 0, bands);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.panelName).toBe("R5");
    expect(Number.isFinite(roofBraceSegmentLengthIn(pieces[0]!))).toBe(true);
    expect(roofBraceSegmentLengthIn(pieces[0]!)).toBeCloseTo(120, 9);
  });

  /* ⚠ A band owns its NEAR edge, so a brace standing exactly on a seam
     belongs to the panel that starts there rather than to the one that ends
     there. An exclusive near edge sent it to the last panel on the plane
     instead — a brace reported on the far end of the roof from where it
     stands, which no position test would notice because the position is
     still right. */
  it("gives a brace standing exactly on a seam to the panel starting there", () => {
    const onSeam: RoofBraceSegment = {
      x1In: 96,
      y1In: 0,
      x2In: 96,
      y2In: 120,
      figure: "carrot",
      bayIndex: 0,
    };
    expect(bands[4]!.atIn).toBe(96);
    expect(sliceRoofBraceSegment(onSeam, 0, bands)[0]!.panelName).toBe("R5");
  });
});

describe("cut length is conserved", () => {
  /* ⚠ The invariant the whole stride rests on. Slicing MOVES cut length
     between panels; it never creates or destroys any. If this drifts, a
     takeoff built from the pieces no longer matches the figure it was cut
     from, and the error would be a quiet few inches rather than a visible
     fault. */
  it("totals the pieces to the unsliced plane's own total", () => {
    for (const widthFt of [16, 24, 32, 40, 48, 60, 72]) {
      const bracing = roofPlaneBracing(widthFt * 12, slopeIn(12, 4));
      const sliced = sliceRoofPlaneBracing(
        bracing,
        roofBracePanelBandsFromWidths(realRunWidths(widthFt * 12)),
      );
      expect(sliced.totalLengthIn, `${widthFt}ft plane`).toBeCloseTo(bracing.totalLengthIn, 6);
      const summed = sliced.slices.reduce((n, s) => n + roofBraceSegmentLengthIn(s), 0);
      expect(summed).toBeCloseTo(bracing.totalLengthIn, 6);
    }
  });

  it("totals each panel's own pieces to that panel's total", () => {
    const bracing = roofPlaneBracing(576, slopeIn(12, 4));
    const { perPanel } = sliceRoofPlaneBracing(
      bracing,
      roofBracePanelBandsFromWidths(realRunWidths(576)),
    );
    for (const group of perPanel) {
      const summed = group.slices.reduce((n, s) => n + roofBraceSegmentLengthIn(s), 0);
      expect(summed, group.panelName).toBeCloseTo(group.totalLengthIn, 9);
    }
  });
});

describe("his four diagonals per panel, measured on real panels", () => {
  /* ⚠ The tie back to stride 1. On bands that line up with the figure's own
     quarter-points, the piece count per panel is exactly his four — so
     slicing has not changed the figure, only written down where it is cut. */
  it("comes to exactly four pieces a panel when the seams line up", () => {
    const bracing = roofPlaneBracing(576, slopeIn(12, 4));
    const sliced = sliceRoofPlaneBracing(bracing, alignedBands(576));
    expect(sliced.meanSlicesPerPanel).toBeCloseTo(4, 10);
  });

  /* ⚠ **A 24in MODULE IS NOT WHAT MAKES IT FOUR — A QUARTER-BAY THAT IS A
     WHOLE NUMBER OF PANELS IS, and that is the sharper form of the rule.**
     Every x in the figure sits on a multiple of a quarter of the bay (the X
     starts and ends on bay edges, and a carrot's feet are a quarter in). So
     the figure's joints land on panel seams only when `bayWidth / 4` is a
     whole number of panels — and nothing in the bay chooser is aware of
     that, because it is choosing an ANGLE.

     Measured over the app's plane range on perfect 24in bands: a 48ft plane
     takes 3 bays, so a quarter-bay is 48in, two panels exactly, and the
     count is 4.00. A 24ft plane takes 2 bays, so a quarter-bay is 36in —
     one and a half panels — and the count is 4.67 on bands that are every
     bit as modular. The law below is asserted both ways round. */
  it("hits four only when a quarter-bay is a whole number of panels", () => {
    const slope = slopeIn(12, 4);
    let aligned = 0;
    let misaligned = 0;
    for (let panels = 4; panels <= 40; panels += 1) {
      const planeWidthIn = panels * 24;
      const bracing = roofPlaneBracing(planeWidthIn, slope);
      const sliced = sliceRoofPlaneBracing(bracing, alignedBands(planeWidthIn));
      const quarterBayIn = bracing.choice.bayWidthIn / 4;
      const landsOnSeams = Math.abs(quarterBayIn / 24 - Math.round(quarterBayIn / 24)) < 1e-9;
      const label = `${panels} panels, quarter-bay ${quarterBayIn}in`;
      if (landsOnSeams) {
        expect(sliced.meanSlicesPerPanel, label).toBeCloseTo(4, 9);
        aligned += 1;
      } else {
        expect(sliced.meanSlicesPerPanel, label).toBeGreaterThan(4);
        misaligned += 1;
      }
    }
    /* Both branches have to be exercised, or the law above is only half
       tested and a mutation to either arm would survive. */
    expect(aligned).toBeGreaterThan(0);
    expect(misaligned).toBeGreaterThan(0);
  });

  /* ⚠ **AND A REAL RUN IS NEVER THE ALIGNED CASE, because it opens with a
     15.5in edge panel.** Tommy's 2026-10-23 rule puts the wall's thickness at
     each end of the run, so every seam after the first is 15.5in off the
     module the figure's quarter-points sit on. A brace that would have
     stopped at a seam runs slightly past it, and the overhang is another
     piece in the next panel. Same braces, more pieces, and each extra piece
     needs its own two end connections. */
  it("rises above four once the seams no longer line up", () => {
    const bracing = roofPlaneBracing(576, slopeIn(12, 4));
    const sliced = sliceRoofPlaneBracing(
      bracing,
      roofBracePanelBandsFromWidths(realRunWidths(576)),
    );
    expect(sliced.meanSlicesPerPanel).toBeGreaterThan(4);
    expect(sliced.meanSlicesPerPanel).toBeLessThan(7);
    /* A panel can hold as many as eight pieces where the misalignment
       compounds, against the four his figure describes. */
    expect(sliced.maxSlicesPerPanel).toBeGreaterThan(4);
    /* The braces themselves are unchanged — only their division is. */
    expect(sliced.totalLengthIn).toBeCloseTo(bracing.totalLengthIn, 6);
  });

  it("reaches every panel on a real run, tail included", () => {
    for (const widthFt of [16, 24, 32, 40, 48, 60, 72]) {
      const bracing = roofPlaneBracing(widthFt * 12, slopeIn(12, 4));
      const sliced = sliceRoofPlaneBracing(
        bracing,
        roofBracePanelBandsFromWidths(realRunWidths(widthFt * 12)),
      );
      expect(sliced.unbracedPanelNames, `${widthFt}ft plane`).toEqual([]);
      expect(sliced.minSlicesPerPanel).toBeGreaterThan(0);
    }
  });

  /* A narrow tail is a real panel and the figure has to land in it. Nothing
     here says a 2in piece is buildable — see `shortestSliceIn`. */
  it("puts brace in a narrow tail panel as well as a wide field one", () => {
    const widths = [15.5, ...Array.from({ length: 10 }, () => 24), 12, 15.5];
    const planeWidthIn = widths.reduce((n, w) => n + w, 0);
    const bracing = roofPlaneBracing(planeWidthIn, slopeIn(12, 4));
    const sliced = sliceRoofPlaneBracing(bracing, roofBracePanelBandsFromWidths(widths));
    const tail = sliced.perPanel[widths.length - 2]!;
    expect(tail.slices.length).toBeGreaterThan(0);
    expect(tail.totalLengthIn).toBeGreaterThan(0);
  });

  /* ⚠ Reported as a MEASUREMENT with no limit attached: nobody has given a
     roof brace a minimum buildable length, so this states the number and
     stops. A threshold invented here would be the plausible-looking
     approximation the flags convention exists to prevent. */
  it("reports the shortest piece on the plane without judging it", () => {
    const bracing = roofPlaneBracing(576, slopeIn(12, 4));
    const sliced = sliceRoofPlaneBracing(
      bracing,
      roofBracePanelBandsFromWidths(realRunWidths(576)),
    );
    expect(sliced.shortestSliceIn).not.toBeNull();
    expect(sliced.shortestSliceIn!).toBeGreaterThan(0);
    const shortestOfAll = Math.min(
      ...sliced.slices.map((s) => roofBraceSegmentLengthIn(s)),
    );
    expect(sliced.shortestSliceIn!).toBeCloseTo(shortestOfAll, 9);
    /* ⚠ And it IS short: misalignment leaves pieces well under a foot, which
       is the cost of the figure and the panels disagreeing about their
       joints. The statement is the number, not a verdict on it. */
    expect(sliced.shortestSliceIn!).toBeLessThan(12);
  });

  /* ⚠ **HOW SHORT THE SHORT PIECES GET, pinned as a measurement so it cannot
     drift unnoticed.** On real runs across the app's plane range the shortest
     piece comes out at 3.06in (72ft plane), 4.14in (40ft and 60ft) and
     5.09in (24ft), with 26 to 36 pieces under a foot on the larger planes.
     Nothing here calls a 3in piece unbuildable — no minimum exists to call
     it against. It is written down because a figure that reads as four
     clean diagonals per panel in fact lands a three-inch offcut in some of
     them, and that is Tommy's to decide about. */
  it("lands pieces of only a few inches on real runs, across the range", () => {
    const shortestByPlane = [16, 24, 32, 40, 48, 60, 72].map((widthFt) => {
      const bracing = roofPlaneBracing(widthFt * 12, slopeIn(12, 4));
      const sliced = sliceRoofPlaneBracing(
        bracing,
        roofBracePanelBandsFromWidths(realRunWidths(widthFt * 12)),
      );
      return { widthFt, shortestIn: sliced.shortestSliceIn!, sliced };
    });
    for (const { widthFt, shortestIn } of shortestByPlane) {
      expect(shortestIn, `${widthFt}ft plane`).toBeGreaterThan(0);
    }
    /* The worst case in the range is a few inches, not a few feet. */
    expect(Math.min(...shortestByPlane.map((p) => p.shortestIn))).toBeLessThan(4);
    /* And short pieces are common rather than a single freak: the 48ft plane
       has well over twenty pieces under a foot. */
    const fortyEight = shortestByPlane.find((p) => p.widthFt === 48)!.sliced;
    const underAFoot = fortyEight.slices.filter((s) => roofBraceSegmentLengthIn(s) < 12);
    expect(underAFoot.length).toBeGreaterThan(20);
  });
});

describe("the plane carries its own dimensions", () => {
  /* So the slicer checks the run against the plane's one width rather than
     against a second opinion passed alongside it. */
  it("reports the width and slope it was built from", () => {
    const bracing = roofPlaneBracing(576, slopeIn(12, 4));
    expect(bracing.planeWidthIn).toBe(576);
    expect(bracing.planeSlopeIn).toBeCloseTo(slopeIn(12, 4), 9);
    expect(bracing.choice.bays * bracing.choice.bayWidthIn).toBeCloseTo(bracing.planeWidthIn, 6);
  });
});

describe("bands from widths", () => {
  it("accumulates positions once so no caller re-derives them", () => {
    const bands = roofBracePanelBandsFromWidths([15.5, 24, 24, 12]);
    expect(bands.map((b) => b.atIn)).toEqual([0, 15.5, 39.5, 63.5]);
    expect(bands.map((b) => b.name)).toEqual(["R1", "R2", "R3", "R4"]);
  });

  it("takes a prefix, so a floor run is not named like a roof one", () => {
    expect(roofBracePanelBandsFromWidths([24, 24], "F").map((b) => b.name)).toEqual(["F1", "F2"]);
  });
});

describe("the whole app's range", () => {
  /* The same sweep stride 1 runs, now with the slicing on top: conservation,
     no NaN, every piece inside its band, every panel reached. */
  it("slices sanely across every panel width and plane the app builds", () => {
    const slope = slopeIn(12, 4);
    for (let panelIn = 12; panelIn <= 48; panelIn += 4) {
      for (const panels of [4, 8, 12, 24]) {
        const planeWidthIn = panelIn * panels;
        const bracing = roofPlaneBracing(planeWidthIn, slope);
        const bands = roofBracePanelBandsFromWidths(
          Array.from({ length: panels }, () => panelIn),
        );
        const sliced = sliceRoofPlaneBracing(bracing, bands);
        const label = `${panels} x ${panelIn}in`;
        expect(sliced.totalLengthIn, label).toBeCloseTo(bracing.totalLengthIn, 6);
        expect(sliced.unbracedPanelNames, label).toEqual([]);
        for (const slice of sliced.slices) {
          const length = roofBraceSegmentLengthIn(slice);
          expect(Number.isFinite(length), label).toBe(true);
          expect(length, label).toBeGreaterThan(0);
          const band = bands[slice.panelIndex]!;
          expect(Math.min(slice.x1In, slice.x2In), label).toBeGreaterThanOrEqual(
            band.atIn - 1e-6,
          );
          expect(Math.max(slice.x1In, slice.x2In), label).toBeLessThanOrEqual(
            band.atIn + band.widthIn + 1e-6,
          );
        }
      }
    }
  });
});
