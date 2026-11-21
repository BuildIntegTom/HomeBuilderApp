import { describe, expect, it } from "vitest";
import {
  chooseRoofBracingBays,
  roofBayBracingSegments,
  roofBraceSegmentAngleDeg,
  roofBraceSegmentLengthIn,
  roofPlaneBracing,
  ROOF_BRACE_MAX_ANGLE_DEG,
  ROOF_BRACE_MIN_ANGLE_DEG,
  ROOF_BRACE_ANGLE_EPSILON_DEG,
  ROOF_BRACE_SEGMENTS_PER_BAY,
} from "./roofPlaneBracing";

/** A gable plane's slope length from its horizontal run and rise, in feet. */
const slopeIn = (runFt: number, riseFt: number) => Math.hypot(runFt, riseFt) * 12;

describe("Tommy's 30-45deg band", () => {
  it("is the band he stated, not a single threshold", () => {
    expect(ROOF_BRACE_MIN_ANGLE_DEG).toBe(30);
    expect(ROOF_BRACE_MAX_ANGLE_DEG).toBe(45);
  });

  /* ⚠ The lever the whole rule turns on. If this ever inverts, the chooser
     would be walking away from the band instead of toward it. */
  it("makes a diagonal STEEPER as bays are added, never shallower", () => {
    const width = 48 * 12;
    const slope = slopeIn(12, 4);
    let previous = 0;
    for (let bays = 1; bays <= 6; bays += 1) {
      const angle = roofBraceSegmentAngleDeg(
        roofBayBracingSegments(0, 0, width / bays, slope)[0],
      );
      expect(angle).toBeGreaterThan(previous);
      previous = angle;
    }
  });

  /* ⚠ BOTH ENDS OF THE BAND ARE INCLUSIVE, and a mutation run is what forced
     these in: swapping `>=` for `>` at the floor survived every other test.
     It matters because a plane sitting exactly on 30deg would otherwise take
     an extra bay and jump to a needlessly steeper angle — "between 30 and 45"
     reads as including them, and a boundary nobody tests is a boundary that
     drifts. The planes below are constructed to land exactly on each end. */
  it("keeps a plane sitting exactly on 30deg at one bay", () => {
    const width = 480;
    const slope = width * Math.tan((30 * Math.PI) / 180);
    const choice = chooseRoofBracingBays(width, slope);
    expect(choice.angleDeg).toBeCloseTo(30, 9);
    expect(choice.bays).toBe(1);
    expect(choice.inBand).toBe(true);
  });

  it("keeps a plane sitting exactly on 45deg inside the band", () => {
    const choice = chooseRoofBracingBays(480, 480);
    expect(choice.angleDeg).toBeCloseTo(45, 9);
    expect(choice.bays).toBe(1);
    expect(choice.inBand).toBe(true);
  });

  /* ⚠ The ceiling carries the same tolerance as the floor, and this is the
     only way to exercise it: no plane this app builds computes a hair OVER 45
     by rounding, so the band's own ceiling is driven instead. Without the
     tolerance a plane sitting on the ceiling would be reported as a miss and
     logged as one — cosmetic rather than structural, unlike the floor, but
     wrong in a document written to be handed to an engineer. */
  it("treats a plane a hair over the ceiling as still inside it", () => {
    const justUnder = 45 - 5e-8;
    const choice = chooseRoofBracingBays(480, 480, 30, justUnder);
    expect(choice.angleDeg).toBeCloseTo(45, 9);
    expect(choice.angleDeg).toBeGreaterThan(justUnder);
    expect(choice.inBand).toBe(true);
  });

  it("takes the FLATTEST count that reaches 30deg, not merely any count", () => {
    const choice = chooseRoofBracingBays(48 * 12, slopeIn(12, 4));
    expect(choice.bays).toBe(3);
    expect(choice.angleDeg).toBeCloseTo(38.3, 1);
    expect(choice.inBand).toBe(true);
    /* One fewer is below the band, which is what makes 3 the flattest. */
    expect(choice.oneFewerDeg).toBeLessThan(30);
  });
});

describe("the real templates", () => {
  const cases: { name: string; widthFt: number; runFt: number; riseFt: number; bays: number; deg: number }[] = [
    { name: "The Tank, 48ft plane", widthFt: 48, runFt: 12, riseFt: 4, bays: 3, deg: 38.3 },
    { name: "Multiplex, 36ft plane", widthFt: 36, runFt: 13, riseFt: 4, bays: 2, deg: 37.1 },
    { name: "a 60ft shed", widthFt: 60, runFt: 16, riseFt: 5, bays: 3, deg: 40.0 },
    { name: "Tiny House, 16ft plane", widthFt: 16, runFt: 12, riseFt: 4, bays: 1, deg: 38.3 },
  ];

  it.each(cases)("$name lands inside the band at $bays bays", ({ widthFt, runFt, riseFt, bays, deg }) => {
    const choice = chooseRoofBracingBays(widthFt * 12, slopeIn(runFt, riseFt));
    expect(choice.bays).toBe(bays);
    expect(choice.angleDeg).toBeCloseTo(deg, 1);
    expect(choice.inBand).toBe(true);
  });
});

describe("the two planes the band cannot reach", () => {
  /* ⚠ "Where possible" is load-bearing in his sentence, and these are the
     cases it covers. Both were found by computing the band against real
     geometry before any of it was built. */

  it("accepts a tall narrow plane it can never bring into the band", () => {
    const choice = chooseRoofBracingBays(12 * 12, slopeIn(12, 8));
    expect(choice.bays).toBe(1);
    expect(choice.angleDeg).toBeCloseTo(50.2, 1);
    expect(choice.inBand).toBe(false);
    expect(choice.why).toMatch(/too tall and narrow/);
    /* And it says why nothing helps: more bays go the wrong way. */
    expect(choice.oneMoreDeg).toBeGreaterThan(choice.angleDeg);
  });

  it("names the straddle when no whole number of bays lands inside", () => {
    const choice = chooseRoofBracingBays(24 * 12, slopeIn(12, 4));
    expect(choice.oneFewerDeg).toBeCloseTo(27.8, 1);
    expect(choice.angleDeg).toBeCloseTo(46.5, 1);
    expect(choice.inBand).toBe(false);
    expect(choice.why).toMatch(/straddles the band/);
  });

  /* ⚠ Which side to miss on is a building decision, not a rounding one. A
     diagonal that is too shallow is heading for the direction the research
     called useless; one slightly too steep still carries. */
  it("misses on the STEEP side when it has to choose", () => {
    const choice = chooseRoofBracingBays(24 * 12, slopeIn(12, 4));
    expect(choice.angleDeg).toBeGreaterThan(ROOF_BRACE_MAX_ANGLE_DEG);
    expect(choice.why).toMatch(/the direction a diagonal stops working/);
  });

  it("refuses a degenerate plane rather than returning a figure for it", () => {
    expect(() => chooseRoofBracingBays(0, 120)).toThrow(/no diagonal to brace/);
    expect(() => chooseRoofBracingBays(480, 0)).toThrow(/no diagonal to brace/);
  });
});

describe("the figure in one bay", () => {
  const segments = roofBayBracingSegments(0, 0, 192, 152);

  it("is an X of two full diagonals plus a PAIR of diagonals in each region", () => {
    expect(segments).toHaveLength(ROOF_BRACE_SEGMENTS_PER_BAY);
    expect(segments.filter((s) => s.figure === "x")).toHaveLength(2);
    expect(segments.filter((s) => s.figure === "carrot")).toHaveLength(8);
  });

  it("runs both X legs corner to corner, so they cross at the centre", () => {
    const [a, b] = segments.filter((s) => s.figure === "x");
    expect([a.x1In, a.y1In, a.x2In, a.y2In]).toEqual([0, 0, 192, 152]);
    expect([b.x1In, b.y1In, b.x2In, b.y2In]).toEqual([192, 0, 0, 152]);
    expect(roofBraceSegmentLengthIn(a)).toBeCloseTo(roofBraceSegmentLengthIn(b), 10);
  });

  /* ⚠ THE FAULT THE FIRST DRAFT HAD. Axis-aligned members carry nothing in
     the direction a brace exists for, and they dropped the per-panel count to
     exactly 3.0. Every segment in this figure must be a true diagonal. */
  it("has no axis-aligned member anywhere in it", () => {
    for (const s of segments) {
      expect(Math.abs(s.x2In - s.x1In), "a vertical member is not a brace").toBeGreaterThan(0);
      expect(Math.abs(s.y2In - s.y1In), "a horizontal member is not a brace").toBeGreaterThan(0);
    }
  });

  /* ⚠ Each carrot segment spans a quarter bay across and a quarter slope up,
     so it comes out at the X's own angle. That is what makes Tommy's band
     govern EVERY member in the figure and not only the two long ones. */
  it("sets every carrot parallel to a leg of the X", () => {
    const xAngle = roofBraceSegmentAngleDeg(segments.filter((s) => s.figure === "x")[0]);
    for (const carrot of segments.filter((s) => s.figure === "carrot")) {
      expect(roofBraceSegmentAngleDeg(carrot)).toBeCloseTo(xAngle, 9);
    }
  });

  it("puts each carrot's two feet on the two legs of the X", () => {
    const carrots = segments.filter((s) => s.figure === "carrot");
    /* A foot sits on a leg when its coordinates satisfy that leg's line. */
    const onLeg1 = (x: number, y: number) => Math.abs(y / 152 - x / 192) < 1e-9;
    const onLeg2 = (x: number, y: number) => Math.abs(y / 152 - (192 - x) / 192) < 1e-9;
    for (const c of carrots) {
      expect(onLeg1(c.x2In, c.y2In) || onLeg2(c.x2In, c.y2In), `foot of ${JSON.stringify(c)}`).toBe(
        true,
      );
    }
  });

  it("keeps every segment inside the bay", () => {
    for (const s of segments) {
      for (const x of [s.x1In, s.x2In]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(192);
      }
      for (const y of [s.y1In, s.y2In]) {
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(152);
      }
    }
  });

  it("gives every segment a real length", () => {
    for (const s of segments) {
      expect(roofBraceSegmentLengthIn(s)).toBeGreaterThan(0);
    }
  });
});

describe("the whole plane", () => {
  it("tiles its bays edge to edge with no gap and no overlap", () => {
    const width = 48 * 12;
    const { choice, segments } = roofPlaneBracing(width, slopeIn(12, 4));
    for (let bay = 0; bay < choice.bays; bay += 1) {
      const inBay = segments.filter((s) => s.bayIndex === bay);
      expect(inBay).toHaveLength(ROOF_BRACE_SEGMENTS_PER_BAY);
      const left = Math.min(...inBay.flatMap((s) => [s.x1In, s.x2In]));
      const right = Math.max(...inBay.flatMap((s) => [s.x1In, s.x2In]));
      expect(left).toBeCloseTo(bay * choice.bayWidthIn, 6);
      expect(right).toBeCloseTo((bay + 1) * choice.bayWidthIn, 6);
    }
    const spanned = Math.max(...segments.map((s) => Math.max(s.x1In, s.x2In)));
    expect(spanned).toBeCloseTo(width, 6);
  });

  /* ⚠ His "4 diagonals per roof panel" is an OUTPUT of this figure, not a
     separate instruction, and this is the check of that claim. A plane
     diagonal crosses each 24in panel band once, so the X leaves two segments
     in a panel and the carrots covering it add about two more. */
  it("averages about four segments crossing each 24in panel band", () => {
    const width = 48 * 12;
    const slope = slopeIn(12, 4);
    const { segments } = roofPlaneBracing(width, slope);
    const panels = width / 24;
    let crossings = 0;
    for (let panel = 0; panel < panels; panel += 1) {
      const lo = panel * 24;
      const hi = lo + 24;
      for (const s of segments) {
        const sLo = Math.min(s.x1In, s.x2In);
        const sHi = Math.max(s.x1In, s.x2In);
        if (sHi > lo && sLo < hi) crossings += 1;
      }
    }
    const perPanel = crossings / panels;
    /* ⚠ His figure exactly, not approximately: two legs of the X cross every
       panel in their bay, and the carrots covering a panel add two more. */
    expect(perPanel).toBeCloseTo(4, 10);
  });

  it("totals the cut length over every segment", () => {
    const { segments, totalLengthIn } = roofPlaneBracing(48 * 12, slopeIn(12, 4));
    const summed = segments.reduce((n, s) => n + roofBraceSegmentLengthIn(s), 0);
    expect(totalLengthIn).toBeCloseTo(summed, 6);
    expect(totalLengthIn).toBeGreaterThan(0);
  });

  /* His explicit condition was 2ft, 3ft and 4ft panels; the app's deck panel
     range is 12in to 48in, so the sweep runs the whole range. */
  it("produces a sane figure across the app's whole panel range", () => {
    const slope = slopeIn(12, 4);
    for (let panelIn = 12; panelIn <= 48; panelIn += 1) {
      for (const panels of [4, 8, 12, 24]) {
        const width = panelIn * panels;
        const { choice, segments } = roofPlaneBracing(width, slope);
        expect(choice.bays).toBeGreaterThanOrEqual(1);
        expect(segments).toHaveLength(choice.bays * ROOF_BRACE_SEGMENTS_PER_BAY);
        expect(choice.angleDeg).toBeGreaterThan(0);
        expect(choice.angleDeg).toBeLessThan(90);
        for (const s of segments) {
          expect(Number.isFinite(roofBraceSegmentLengthIn(s))).toBe(true);
          expect(roofBraceSegmentLengthIn(s)).toBeGreaterThan(0);
        }
      }
    }
  });

  /* ⚠ A wide, shallow plane is the case the proportion limit exists for: the
     plan measured a 40ft plane with a 12ft run at 17deg off the eave, "nearly
     along it, which section 2 of the research document already identified as
     the useless direction". */
  it("never leaves a plane braced below 30deg when bays could fix it", () => {
    const slope = slopeIn(12, 4);
    for (const widthFt of [16, 24, 32, 40, 48, 60, 72, 96]) {
      const choice = chooseRoofBracingBays(widthFt * 12, slope);
      expect(choice.angleDeg, `${widthFt}ft plane`).toBeGreaterThanOrEqual(
        30 - ROOF_BRACE_ANGLE_EPSILON_DEG,
      );
    }
  });

  /* ⚠ The tolerance must not be wide enough to swallow a real angle. A
     tenth of a degree below the floor is a genuine miss and has to stay one. */
  it("still splits a plane that is a tenth of a degree too shallow", () => {
    const width = 480;
    const slope = width * Math.tan(((30 - 0.1) * Math.PI) / 180);
    expect(chooseRoofBracingBays(width, slope).bays).toBeGreaterThan(1);
  });
});
