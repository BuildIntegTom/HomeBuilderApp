import { describe, expect, it } from "vitest";
import {
  GABLE_PEAK_WEDGE_MAX_STOCK_IN,
  buildGablePeakPanelMembers,
  buildGablePeakWedgeTopMembers,
  gablePeakLidVerticalThicknessIn,
  gablePeakBeamTopBelowRidgeIn,
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
      /* ⚠ Its deep end is the ridge's rise OR a 2x4, whichever is smaller —
         his ruling, 2026-11-13: *"if the 2x4 is not deep enough to cap it
         off - that's fine. just have that space exposed and i can stuff it
         worth straw."* At 4:12 on a 25.5in panel the rise is 4.25in, so this
         is the 3.5in case. */
      expect(Math.max(...zs) - bodyTopZIn, w.memberId).toBeCloseTo(
        Math.min(top.apexRiseIn, GABLE_PEAK_WEDGE_MAX_STOCK_IN),
        9,
      );
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

  it("⚠ the wedge STAYS a 2x4 and stops short, leaving the deep corner open — his ruling", () => {
    /* > *"if the 2x4 is not deep enough to cap it off - that's fine. just
       > have that space exposed and i can stuff it worth straw."*
       > — Tommy, 2026-11-13

       ⚠ This assertion is the inverse of what it was, and the flip is his
       decision. His sketch (19in panel) and his stock (a 2x4) agree with each
       other at 4:12 — 3.17in of rise rips out of 3.5in. The 25.5in ridge
       column this app builds needs 4.25in at the same pitch, and the first
       resolution was "geometry wins, the stock follows", which quietly
       promoted the board to a 2x6. He would rather keep the 2x4.

       The lid still lies on the true roof plane, so the wedge can only sit
       where the gap under it is 3 1/2in or less: the outer `3.5 x run / rise`
       of the slope. The rest is open. */
    const hisPanelIn = 19;
    const hisRiseIn = (hisPanelIn / 2) * (4 / 12);
    expect(hisRiseIn).toBeCloseTo(3.1667, 3);
    expect(hisRiseIn).toBeLessThanOrEqual(GABLE_PEAK_WEDGE_MAX_STOCK_IN);

    const oursIn = (COLUMN_TOTAL_WIDTH_IN / 2) * (4 / 12);
    expect(oursIn).toBeCloseTo(4.25, 6);
    expect(oursIn).toBeGreaterThan(GABLE_PEAK_WEDGE_MAX_STOCK_IN);

    const wedge = buildGablePeakWedgeTopMembers(
      COLUMN_TOTAL_WIDTH_IN,
      DEPTH_IN,
      EDGE_TOP_IN,
      symmetric(COLUMN_TOTAL_WIDTH_IN, 4),
    ).find((m) => m.memberId.startsWith("gable_peak_wedge_"))!;
    /* Still a 2x4, never silently promoted. */
    expect(wedge.nominalSize).toBe("2x4");
    expect(wedge.actualDimsIn.widthIn).toBeCloseTo(GABLE_PEAK_WEDGE_MAX_STOCK_IN, 9);
    /* And it stops at 3.5 x 12.75 / 4.25 = 10.5in of the 12.75in run. */
    expect(wedge.actualDimsIn.lengthIn).toBeCloseTo(10.5, 6);
    /* The part carries the open run on its own cut note, so the shop is told
       rather than left to discover a gap. */
    expect(wedge.notes).toContain("OPEN");
    expect(wedge.notes).toContain("2.25in");
    expect(wedge.notes).toContain("straw");
  });

  it("⚠ a shallow enough pitch still gets a wedge over the WHOLE slope, with nothing open", () => {
    /* 3:12 on a 25.5in panel needs 3.19in, which a 2x4 covers — so there is
       no void and the note must not claim one. */
    const wedge = buildGablePeakWedgeTopMembers(
      COLUMN_TOTAL_WIDTH_IN,
      DEPTH_IN,
      EDGE_TOP_IN,
      symmetric(COLUMN_TOTAL_WIDTH_IN, 3),
    ).find((m) => m.memberId.startsWith("gable_peak_wedge_"))!;
    expect(wedge.actualDimsIn.widthIn).toBeCloseTo((COLUMN_TOTAL_WIDTH_IN / 2) * (3 / 12), 9);
    expect(wedge.actualDimsIn.lengthIn).toBeCloseTo(COLUMN_TOTAL_WIDTH_IN / 2, 9);
    expect(wedge.notes).not.toContain("OPEN");
  });

  it("⚠ the open run grows with pitch, and the wedge never floats off the lid", () => {
    /* The property that makes the open corner safe rather than sloppy: the
       wedge's deep end always MEETS the lid, it is just shorter. If it ever
       sat at the ridge end instead, it would hang below the lid by the
       difference and support nothing. */
    for (const pitch of [3, 4, 6, 8, 12]) {
      const top = symmetric(COLUMN_TOTAL_WIDTH_IN, pitch);
      const out = buildGablePeakWedgeTopMembers(COLUMN_TOTAL_WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, top);
      const bodyTopZIn = gablePeakWedgeBodyTopZIn(COLUMN_TOTAL_WIDTH_IN, EDGE_TOP_IN, top);
      const runIn = COLUMN_TOTAL_WIDTH_IN / 2;
      const expectDeep = Math.min(top.apexRiseIn, GABLE_PEAK_WEDGE_MAX_STOCK_IN);
      const expectRun = (expectDeep / top.apexRiseIn) * runIn;
      for (const w of out.filter((m) => m.memberId.startsWith("gable_peak_wedge_"))) {
        expect(w.actualDimsIn.lengthIn, `pitch ${pitch} ${w.memberId}`).toBeCloseTo(expectRun, 6);
        const zs = zsOf(w);
        /* Deep end height == the roof plane at that x, i.e. it touches the
           lid rather than floating under it. */
        const xs = xsOf(w);
        const deepXIn = zs.indexOf(Math.max(...zs)) >= 0 ? xs[zs.indexOf(Math.max(...zs))]! : 0;
        const distFromEdgeIn = Math.min(Math.abs(deepXIn - 0), Math.abs(deepXIn - COLUMN_TOTAL_WIDTH_IN));
        const rooflineRiseHere = (distFromEdgeIn / runIn) * top.apexRiseIn;
        expect(Math.max(...zs) - bodyTopZIn, `pitch ${pitch} ${w.memberId}`).toBeCloseTo(rooflineRiseHere, 6);
      }
    }
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

  it("⚠ the ridge beam still lands IN its box once the panel is five-sided", () => {
    /* ⚠ B9's fault, one design later. `GABLE_PEAK_BEAM_TOP_BELOW_PANEL_TOP_IN`
       measures from the PANEL'S top, and that was the ridge while the panel
       was flat-topped — so `Building3DView` placed the beam off the roof
       plane with that constant and the two agreed.

       They stopped agreeing the moment the body dropped to its lower edge:
       the box is now `apexRise + lid` further down. This asserts the renderer's
       derivation against the box the BUILDER actually makes, which is the
       only comparison that catches a drift between the model and the shop. */
    for (const pitch of [3, 4, 6, 8]) {
      const top = symmetric(COLUMN_TOTAL_WIDTH_IN, pitch);
      /* The panel as the 3D view builds it: height = the LOWER edge, with no
         extra roofline offset so the frames line up. */
      const members = buildGablePeakPanelMembers(DEPTH_IN, EDGE_TOP_IN, false, undefined, COLUMN_TOTAL_WIDTH_IN, 0, top);
      const lid = members.find((m) => m.memberId === "gable_peak_box_lid")!;
      const boxTopZIn = Math.max(...(lid.position.trapezoidCornersIn ?? []).map((p) => p.zIn), lid.position.zIn + 0.75);
      /* The beam's top is the box's lid underside less his quarter inch. */
      const beamTopZIn = boxTopZIn - 0.75 - 0.25;

      /* The ridge, in the same panel-local frame. */
      const ridgeZIn = EDGE_TOP_IN + top.apexRiseIn;
      const measuredDropIn = ridgeZIn - beamTopZIn;

      expect(gablePeakBeamTopBelowRidgeIn(COLUMN_TOTAL_WIDTH_IN, pitch), `pitch ${pitch}:12`).toBeCloseTo(
        measuredDropIn,
        6,
      );
    }
  });

  it("⚠ and that drop is NOT the old flat-top constant — 5.04in out at 4:12", () => {
    /* The number that would have gone unnoticed. 3.25in was right for a flat
       top and is 5.04in wrong for his five-sided one. */
    const flatTopConstantIn = 3.25;
    const fiveSidedIn = gablePeakBeamTopBelowRidgeIn(COLUMN_TOTAL_WIDTH_IN, 4);
    expect(fiveSidedIn - flatTopConstantIn).toBeCloseTo(4.25 + 0.7906, 3);
    expect(fiveSidedIn).toBeCloseTo(8.2906, 3);
    /* Flat really does collapse to the old constant, so nothing moved for a
       peak that lands on this panel's own edge. */
    expect(gablePeakBeamTopBelowRidgeIn(COLUMN_TOTAL_WIDTH_IN, 0)).toBeCloseTo(flatTopConstantIn, 9);
  });

  it("a flat top asks for no wedges and no lids", () => {
    const flat: GablePeakTopProfile = { apexOffsetXIn: COLUMN_TOTAL_WIDTH_IN / 2, leftRiseIn: 0, apexRiseIn: 0, rightRiseIn: 0 };
    expect(buildGablePeakWedgeTopMembers(COLUMN_TOTAL_WIDTH_IN, DEPTH_IN, EDGE_TOP_IN, flat)).toHaveLength(0);
  });
});
