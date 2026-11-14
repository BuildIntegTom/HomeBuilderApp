import { describe, expect, it } from "vitest";
import {
  GABLE_PEAK_WEDGE_MAX_STOCK_IN,
  buildGablePeakWedgeTopMembers,
  gablePeakLidVerticalThicknessIn,
  gablePeakWedgeBodyTopZIn,
  gablePeakWedgeStockFor,
  type GablePeakTopProfile,
} from "./gablePeakPanelMembers";
import { COLUMN_TOTAL_WIDTH_IN } from "./columnPanelMembers";
import type { PanelMember } from "./componentSchema";

const DEPTH_IN = 15.5;
const EDGE_TOP_IN = 48;

/** ⚠ Corners, never `memberBoxIn` — a bounding box cannot see a sloped
 * board, and reading one is how an earlier version of this work reported a
 * cap poking 11in above its own ridge. */
const zsOf = (m: PanelMember) => (m.position.trapezoidCornersIn ?? []).map((p) => p.zIn);
const xsOf = (m: PanelMember) => (m.position.trapezoidCornersIn ?? []).map((p) => p.xIn);

const symmetric = (widthIn: number, pitchIn12: number): GablePeakTopProfile => ({
  apexOffsetXIn: widthIn / 2,
  leftRiseIn: 0,
  apexRiseIn: (widthIn / 2) * (pitchIn12 / 12),
  rightRiseIn: 0,
});

describe("⚠ his five-sided peak: flat top plate, tapered wedges, two lids", () => {
  /* > *"The long cut triangles are 3.5" in depth/cut from a 2x4. This is a
     > 1'7" panel. I forgot to plumb cut the edges of the plywood."*
     > — Tommy, 2026-11-13, with three SketchUp drawings

     He confirmed directly that the panel's top plate stays FLAT and the
     wedges make the slope. That is what makes this additive: the column body
     underneath is unmodified. */

  it("⚠ two lids and four wedges — his two pieces, one wedge per wythe per slope", () => {
    const top = symmetric(COLUMN_TOTAL_WIDTH_IN, 4);
    const out = buildGablePeakWedgeTopMembers(COLUMN_TOTAL_WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, top);
    expect(out.filter((m) => m.memberId.startsWith("gable_peak_lid_"))).toHaveLength(2);
    expect(out.filter((m) => m.memberId.startsWith("gable_peak_wedge_"))).toHaveLength(4);
  });

  it("⚠ each wedge is a TRIANGLE — flat on the deck, feathering to nothing at the panel edge", () => {
    const top = symmetric(COLUMN_TOTAL_WIDTH_IN, 4);
    const bodyTopZIn = gablePeakWedgeBodyTopZIn(COLUMN_TOTAL_WIDTH_IN, EDGE_TOP_IN, top);
    const wedges = buildGablePeakWedgeTopMembers(COLUMN_TOTAL_WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, top).filter((m) =>
      m.memberId.startsWith("gable_peak_wedge_"),
    );
    for (const w of wedges) {
      const zs = zsOf(w);
      /* Its underside is the body's flat top — three of the four corners
         touch it on a symmetric peak, which is what makes it a triangle
         rather than a wedge floating on something. */
      expect(Math.min(...zs), w.memberId).toBeCloseTo(bodyTopZIn, 9);
      /* And its deep end is exactly the ridge's rise. */
      expect(Math.max(...zs) - bodyTopZIn, w.memberId).toBeCloseTo(top.apexRiseIn, 9);
      /* Two corners coincide at the feather edge: a triangle written as a
         quad. */
      const atDeck = zs.filter((z) => Math.abs(z - bodyTopZIn) < 1e-9);
      expect(atDeck.length, w.memberId).toBeGreaterThanOrEqual(2);
    }
  });

  it("⚠ the lids meet at the ridge and reach the panel's own top surface", () => {
    for (const pitch of [2, 3, 4, 6, 8]) {
      const top = symmetric(COLUMN_TOTAL_WIDTH_IN, pitch);
      const out = buildGablePeakWedgeTopMembers(COLUMN_TOTAL_WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, top);
      const lids = out.filter((m) => m.memberId.startsWith("gable_peak_lid_"));
      const highest = Math.max(...lids.flatMap(zsOf));
      /* The ridge, measured to the panel's top SURFACE — the tile's own
         apex height, which is what the roof sits on. */
      expect(highest, `pitch ${pitch}`).toBeCloseTo(EDGE_TOP_IN + top.apexRiseIn, 6);
      /* And at the outer edge the surface is exactly the edge height, so the
         panel stops standing proud of the roof plane. */
      const lowest = Math.min(...lids.flatMap(zsOf));
      const bodyTopZIn = gablePeakWedgeBodyTopZIn(COLUMN_TOTAL_WIDTH_IN, EDGE_TOP_IN, top);
      expect(lowest, `pitch ${pitch}`).toBeCloseTo(bodyTopZIn, 6);
      /* Both lids reach the ridge's x. */
      for (const lid of lids) {
        const xs = xsOf(lid);
        expect(Math.max(...xs) >= top.apexOffsetXIn - 1e-6 && Math.min(...xs) <= top.apexOffsetXIn + 1e-6).toBe(true);
      }
    }
  });

  it("⚠ the lid's thickness is VERTICAL, not perpendicular — 3/4in becomes 0.79in at 4:12", () => {
    const runIn = COLUMN_TOTAL_WIDTH_IN / 2;
    const riseIn = runIn * (4 / 12);
    expect(gablePeakLidVerticalThicknessIn(runIn, riseIn)).toBeCloseTo(0.7906, 3);
    /* Flat is exactly 3/4. */
    expect(gablePeakLidVerticalThicknessIn(runIn, 0)).toBeCloseTo(0.75, 9);
    /* Steeper is taller, always. */
    let last = 0;
    for (const pitch of [0, 2, 4, 6, 8, 12]) {
      const v = gablePeakLidVerticalThicknessIn(runIn, runIn * (pitch / 12));
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("⚠ A 2x4 CANNOT MAKE THIS WEDGE ON A 25.5in PANEL AT 4:12 — his two numbers disagree", () => {
    /* His sketch is a 19in panel and his stock is a 2x4, and those two agree
       with each other: at 4:12 a 19in panel needs 3.17in of rise, which rips
       out of a 2x4's 3.5in. The ridge column this app actually builds is
       25.5in wide, and at the same pitch it needs 4.25in — three quarters of
       an inch MORE than a 2x4 has.

       The geometry wins: a wedge sized to anything but the real rise puts the
       lid off the roof plane, which is the defect this whole change exists to
       fix. So the wedge is as deep as the roof says and the stock follows.
       This test is here so that trade is never made silently. */
    const hisPanelIn = 19;
    const hisRiseIn = (hisPanelIn / 2) * (4 / 12);
    expect(hisRiseIn).toBeCloseTo(3.1667, 3);
    expect(hisRiseIn).toBeLessThanOrEqual(GABLE_PEAK_WEDGE_MAX_STOCK_IN);
    expect(gablePeakWedgeStockFor(hisRiseIn)).toBe("2x4");

    const oursIn = (COLUMN_TOTAL_WIDTH_IN / 2) * (4 / 12);
    expect(oursIn).toBeCloseTo(4.25, 6);
    expect(oursIn).toBeGreaterThan(GABLE_PEAK_WEDGE_MAX_STOCK_IN);
    expect(gablePeakWedgeStockFor(oursIn)).toBe("2x6");

    /* And the built part says so on its own cut note, rather than claiming a
       2x4 and handing the shop a board that cannot be ripped that way. */
    const wedge = buildGablePeakWedgeTopMembers(
      COLUMN_TOTAL_WIDTH_IN,
      DEPTH_IN,
      EDGE_TOP_IN,
      symmetric(COLUMN_TOTAL_WIDTH_IN, 4),
    ).find((m) => m.memberId.startsWith("gable_peak_wedge_"))!;
    expect(wedge.nominalSize).toBe("2x6");
    expect(wedge.notes).toContain("2x6");
  });

  it("the stock ladder names a real board at every depth", () => {
    expect(gablePeakWedgeStockFor(1)).toBe("2x4");
    expect(gablePeakWedgeStockFor(3.5)).toBe("2x4");
    expect(gablePeakWedgeStockFor(3.51)).toBe("2x6");
    expect(gablePeakWedgeStockFor(5.5)).toBe("2x6");
    expect(gablePeakWedgeStockFor(9.25)).toBe("2x10");
    expect(gablePeakWedgeStockFor(99)).toBe("built-up");
  });

  it("⚠ an OFF-CENTRE ridge still gives two lids and four wedges, none of negative length", () => {
    /* Measured on the real placement path the apex is dead centre on every
       wall from 12ft to 40ft — he was right about that. This is the case the
       TYPE still allows. */
    const lopsided: GablePeakTopProfile = {
      apexOffsetXIn: COLUMN_TOTAL_WIDTH_IN * 0.25,
      leftRiseIn: 0,
      apexRiseIn: 5,
      rightRiseIn: 1,
    };
    const out = buildGablePeakWedgeTopMembers(COLUMN_TOTAL_WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, lopsided);
    expect(out.filter((m) => m.memberId.startsWith("gable_peak_lid_"))).toHaveLength(2);
    expect(out.filter((m) => m.memberId.startsWith("gable_peak_wedge_"))).toHaveLength(4);
    for (const m of out) expect(m.actualDimsIn.lengthIn, m.memberId).toBeGreaterThan(0);
    /* The two slopes keep to their own sides of the ridge. */
    const left = out.filter((m) => m.memberId.includes("_left"));
    expect(Math.max(...left.flatMap(xsOf))).toBeLessThanOrEqual(lopsided.apexOffsetXIn + 1e-6);
  });

  it("a flat top asks for no wedges and no lids", () => {
    const flat: GablePeakTopProfile = { apexOffsetXIn: COLUMN_TOTAL_WIDTH_IN / 2, leftRiseIn: 0, apexRiseIn: 0, rightRiseIn: 0 };
    expect(buildGablePeakWedgeTopMembers(COLUMN_TOTAL_WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, flat)).toHaveLength(0);
  });
});
