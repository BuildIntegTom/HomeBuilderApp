import { describe, expect, it } from "vitest";
import {
  buildMultiplexFootprint,
  buildRectangleFootprint,
  computeWallVerticalBandsForSlotWithMaxHeight,
  interiorBearingWallBuilds,
  isWholeEighthIn,
  interiorRoofBearingWalls,
  panelSlotBoxes3D,
  retile,
  roofBearingBands,
  simpleRoofPlanes,
  tileInteriorWalls,
} from "@building-integrity/geometry";
import {
  computeSharedRooflineBearingHeightIn,
  interiorBearingWallOnePanelPeakLimitIn,
  panelHeightInRange,
} from "@building-integrity/panel-catalog";
import { allPanelInstances } from "./panelInstances";

/* ──────────────────────────────────────────────────────────────────────────
   B34 stride 3b — A WALL THAT CARRIES THE ROOF IS BUILT UP TO IT

   ⚠ Since stride 3 the Multiplex's centre wall has BEEN the ridge beam — no
   beam is built over it, every load goes down it — and its panels were tiled
   at the story height while the ridge it holds up is a full rise above the
   eave. The part of the wall doing the carrying was the part that was not
   built. Strides 3 and 3c said so in the Review Log; this is the build.

   His rule, 2026-11-18, asked how the row above the ceiling should be built:

     "One panel whatever its height up until 16 ft tall peak. Otherwise break
      it down to 10 ft wall with another section above it"

   ⚠ The trap these tests exist for: the HEIGHT and the COURSE LIMIT have to
   travel together. `courseMaxHeightIn` is Infinity under a 16ft peak, so such
   a wall is deliberately exempt from the project's max panel height — hand one
   path the height and not the limit and the 3D model grows a joint the cut
   list has not got.
   ────────────────────────────────────────────────────────────────────────── */

const THICKNESS_IN = 15.5;
const STANDARD_IN = 48;
const STORY_IN = 96;
const MAX_PANEL_HEIGHT_IN = 120;
const ASSEMBLY_IN = computeSharedRooflineBearingHeightIn();

const multiplex = () =>
  buildMultiplexFootprint({ widthFt: 36, depthFt: 36, wallThicknessIn: THICKNESS_IN, roofBearingWalls: true });

function modelFor(
  fp: ReturnType<typeof multiplex>,
  form: "peaked" | "shed" = "peaked",
  pitchIn12 = 8,
  storyIn = STORY_IN,
) {
  const roof = simpleRoofPlanes(fp, { form, pitchIn12, eaveHeightFt: (storyIn + ASSEMBLY_IN) / 12 });
  const bands = roofBearingBands(fp, roof);
  const bearing = interiorRoofBearingWalls(fp, roof, bands);
  const builds = interiorBearingWallBuilds(bearing, {
    storyHeightIn: storyIn,
    bearingAssemblyHeightIn: ASSEMBLY_IN,
    maxPanelHeightIn: MAX_PANEL_HEIGHT_IN,
    onePanelPeakLimitIn: interiorBearingWallOnePanelPeakLimitIn.value,
  });
  const byWallId = Object.fromEntries(builds.map((b) => [b.wallId, b]));
  return { roof, bands, bearing, builds, byWallId };
}

const slotsFor = (fp: ReturnType<typeof multiplex>) => ({
  ...retile(fp, "A", new Set(["A", "B", "C", "D"]), STANDARD_IN, THICKNESS_IN, THICKNESS_IN),
  ...tileInteriorWalls(fp, STANDARD_IN, "A"),
});

describe("⚠ which interior walls carry the roof, and how far above the eave", () => {
  it("all three of a Multiplex's dividing walls, tallest first", () => {
    const { bearing } = modelFor(multiplex());
    expect(bearing.map((b) => b.wallId)).toEqual(["CTR", "BRG-E", "BRG-W"]);
    /* The centre wall carries the RIDGE: the full rise, 18ft of run at 8:12. */
    expect(bearing[0]!.aboveEaveIn).toBeCloseTo(144, 9);
    /* Each purlin wall sits 9'-3⅞" up its own plane's run. */
    expect(bearing[1]!.aboveEaveIn).toBeCloseTo(74.5833333, 6);
    expect(bearing[2]!.aboveEaveIn).toBeCloseTo(74.5833333, 6);
  });

  it("⚠ a SHED has no ridge wall, even with a wall on the midline", () => {
    /* `ridgeBearingWallFor` answers a question about a peak. A shed's high
       edge is a wall of the OUTLINE, so a midline wall is picked up as an
       ordinary bearing line part way up the one plane — never at the full
       rise, which is what it would get if the ridge branch ran here.

       ⚠ **Asserted against the PLANE's own rise, not against a number.** The
       first version of this test compared the shed's centre wall to 144in and
       failed: a shed over 36ft at 8:12 rises 288in and the midline is exactly
       half way up it, so the wall reads 144in either way. Two different
       buildings agreeing by arithmetic accident is exactly the shape of test
       that passes while the rule is broken. */
    const { roof, bearing } = modelFor(multiplex(), "shed");
    expect(roof.planes).toHaveLength(1);
    const planeRiseIn = (roof.planes[0]!.highHeightFt - roof.planes[0]!.lowHeightFt) * 12;
    expect(planeRiseIn).toBeCloseTo(288, 6);
    const centre = bearing.find((b) => b.wallId === "CTR");
    expect(centre).toBeDefined();
    expect(centre!.aboveEaveIn).toBeLessThan(planeRiseIn);
    expect(centre!.aboveEaveIn).toBeCloseTo(planeRiseIn / 2, 6);
  });

  it("a building with no interior walls carries nothing, which is every building before B34", () => {
    const fp = buildRectangleFootprint(24, 20);
    expect(modelFor(fp).bearing).toEqual([]);
  });
});

describe("⚠ his 16ft rule decides whether it is one panel or courses", () => {
  const { byWallId } = modelFor(multiplex());

  it("the centre wall's peak is past 16ft, so it breaks into courses", () => {
    const ctr = byWallId.CTR!;
    /* Floor to the plate's underside: the story plus the full rise. The
       bearing assembly does NOT come off here — the plate's TOP is the plane,
       exactly as on an eave wall, where `gableEaveHeightIn` is the wall height
       PLUS the same assembly. */
    expect(ctr.panelTopIn).toBeCloseTo(240, 9);
    expect(ctr.peakIn).toBeCloseTo(240 + ASSEMBLY_IN, 9);
    expect(ctr.peakIn).toBeGreaterThan(interiorBearingWallOnePanelPeakLimitIn.value);
    expect(ctr.courseMaxHeightIn).toBe(MAX_PANEL_HEIGHT_IN);
  });

  it("⚠ a purlin wall is under 16ft, so it is ONE panel — exempt from the max panel height", () => {
    const brg = byWallId["BRG-W"]!;
    /* ⚠ **170⅝in, not 170.58333…** A purlin wall's rise is the plane's over a
       fraction of its run, so it lands wherever it lands — and this is a CUT
       HEIGHT. Snapped to the eighth grid the rest of the app works on, or the
       sheet rounds to an eighth while the model holds a figure 1/24in away.
       Found in the browser, where the elevation printed the raw float. */
    expect(brg.panelTopIn).toBeCloseTo(170.625, 9);
    expect(brg.peakIn).toBeLessThanOrEqual(interiorBearingWallOnePanelPeakLimitIn.value);
    /* The exemption, which is the new part of his rule: 170.58in is well past
       the 120in max panel height and it is still one panel. */
    expect(brg.courseMaxHeightIn).toBe(Number.POSITIVE_INFINITY);
    expect(brg.panelTopIn).toBeGreaterThan(MAX_PANEL_HEIGHT_IN);
  });

  it("⚠ every bearing wall's height sits ON the eighth grid", () => {
    /* The assertion the browser asked for: a cut height off the grid is a
       drawing and a part that disagree. The ridge wall's is whole either way;
       the purlin walls' are the ones that needed snapping. */
    for (const build of Object.values(byWallId)) {
      expect({ wall: build.wallId, onGrid: isWholeEighthIn(build.panelTopIn) }).toEqual({
        wall: build.wallId,
        onGrid: true,
      });
    }
  });

  it("⚠ and that one panel is past the CATALOG's own panel height maximum, which the Review Log reports", () => {
    /* Both numbers are his: 144in (`panelHeightInRange.maxIn`, raised from the
       manufacturer's 118⅛in) and the 16ft peak. They disagree, and a purlin
       wall is where. Pinned so the conflict cannot stop being reported by
       accident. */
    expect(byWallId["BRG-W"]!.panelTopIn).toBeGreaterThan(panelHeightInRange.maxIn);
  });

  it("⚠ the limit is measured to the PEAK, which decides a 2.25in-wide band of buildings", () => {
    /* ⚠ **The mutation this test exists for**: gating on the top of the
       panels instead of on the peak. Everywhere else the two agree about the
       answer, because they differ by the bearing assembly's own 2¼in — so the
       only buildings that can tell them apart are the ones whose panel top
       lands inside that 2¼in below the limit. 191in of panel puts the peak at
       193.25in, which is past 16ft, so his rule says courses.

       Driven straight through the pure function with a made-up rise, because
       no template lands in a 2¼in window and a test that waits for one to
       appear is a test that never runs. */
    const edge = interiorBearingWallBuilds([{ wallId: "X", aboveEaveIn: 95 }], {
      storyHeightIn: STORY_IN,
      bearingAssemblyHeightIn: ASSEMBLY_IN,
      maxPanelHeightIn: MAX_PANEL_HEIGHT_IN,
      onePanelPeakLimitIn: interiorBearingWallOnePanelPeakLimitIn.value,
    })[0]!;
    expect(edge.panelTopIn).toBeCloseTo(191, 9);
    expect(edge.panelTopIn).toBeLessThanOrEqual(interiorBearingWallOnePanelPeakLimitIn.value);
    expect(edge.peakIn).toBeGreaterThan(interiorBearingWallOnePanelPeakLimitIn.value);
    expect(edge.courseMaxHeightIn).toBe(MAX_PANEL_HEIGHT_IN);

    /* And one inch shorter is on the other side of it. */
    const under = interiorBearingWallBuilds([{ wallId: "X", aboveEaveIn: 93 }], {
      storyHeightIn: STORY_IN,
      bearingAssemblyHeightIn: ASSEMBLY_IN,
      maxPanelHeightIn: MAX_PANEL_HEIGHT_IN,
      onePanelPeakLimitIn: interiorBearingWallOnePanelPeakLimitIn.value,
    })[0]!;
    expect(under.courseMaxHeightIn).toBe(Number.POSITIVE_INFINITY);
  });

  it("a lower pitch keeps the whole thing one panel", () => {
    /* 4:12 over 18ft is a 72in rise, so even the centre wall's peak lands
       under the limit and the wall is a single panel. */
    const { byWallId: low } = modelFor(multiplex(), "peaked", 4);
    expect(low.CTR!.courseMaxHeightIn).toBe(Number.POSITIVE_INFINITY);
    expect(low.CTR!.peakIn).toBeLessThanOrEqual(interiorBearingWallOnePanelPeakLimitIn.value);
  });
});

describe("⚠ the panels that come out of it", () => {
  const fp = multiplex();
  const { byWallId } = modelFor(fp);
  const slots = slotsFor(fp);
  const instances = allPanelInstances(
    fp,
    slots,
    STANDARD_IN,
    "plywood",
    undefined,
    undefined,
    STORY_IN,
    undefined,
    MAX_PANEL_HEIGHT_IN,
    undefined,
    byWallId,
  );
  const forWall = (wallId: string) => instances.filter((i) => i.wallId === wallId);

  it("the centre wall is TWO panels per column, each 10ft, and they sum to the wall's height", () => {
    const ctr = forWall("CTR");
    const bySlot = new Map<number, typeof ctr>();
    for (const inst of ctr) bySlot.set(inst.slotIndexInWall, [...(bySlot.get(inst.slotIndexInWall) ?? []), inst]);
    expect(bySlot.size).toBeGreaterThan(0);
    for (const [, column] of bySlot) {
      expect(column).toHaveLength(2);
      expect(column.map((i) => i.heightOverrideIn)).toEqual([120, 120]);
      expect(column.map((i) => i.midWallBandIndex)).toEqual([0, 1]);
      expect(column.reduce((sum, i) => sum + (i.heightOverrideIn ?? 0), 0)).toBeCloseTo(byWallId.CTR!.panelTopIn, 9);
    }
  });

  it("⚠ a purlin wall is ONE panel per column, at its real 14ft-2 5/8in height", () => {
    const brg = forWall("BRG-W");
    const columns = new Set(brg.map((i) => i.slotIndexInWall));
    expect(brg).toHaveLength(columns.size);
    for (const inst of brg) {
      /* ⚠ `heightOverrideIn` is SET even though there is only one band, and
         that is the whole point: every reader downstream resolves a panel's
         height as `heightOverrideIn ?? wallHeightFt * 12`, so an empty field
         here would have this panel drawn, weighed, cut and stencilled as an
         8ft one. */
      expect(inst.heightOverrideIn).toBeCloseTo(byWallId["BRG-W"]!.panelTopIn, 6);
      expect(inst.midWallBandIndex).toBeUndefined();
    }
  });

  it("the OUTLINE's panels are untouched by any of this", () => {
    const outline = instances.filter((i) => fp.walls.some((w) => w.id === i.wallId));
    expect(outline.length).toBeGreaterThan(0);
    for (const inst of outline) expect(inst.heightOverrideIn).toBeUndefined();
  });

  it("⚠ and with no bearing record the dividing walls are exactly what stride 2 built", () => {
    const before = allPanelInstances(
      fp,
      slots,
      STANDARD_IN,
      "plywood",
      undefined,
      undefined,
      STORY_IN,
      undefined,
      MAX_PANEL_HEIGHT_IN,
    );
    const plain = before.filter((i) => i.wallId === "CTR");
    expect(plain).toHaveLength(new Set(plain.map((i) => i.slotIndexInWall)).size);
    for (const inst of plain) expect(inst.heightOverrideIn).toBeUndefined();
  });
});

describe("⚠ the 3D model is built from the same two numbers the cut list is", () => {
  const fp = multiplex();
  const { byWallId } = modelFor(fp);
  const slots = slotsFor(fp);

  it("an interior wall's boxes are as tall as its panels, in feet", () => {
    const heightFtByWallId = Object.fromEntries(Object.entries(byWallId).map(([id, b]) => [id, b.panelTopIn / 12]));
    const boxes = panelSlotBoxes3D(
      fp,
      slots,
      THICKNESS_IN,
      STORY_IN / 12,
      new Set(["A", "B", "C", "D"]),
      undefined,
      heightFtByWallId,
    );
    for (const wallId of ["CTR", "BRG-W", "BRG-E"]) {
      const mine = boxes.filter((b) => b.wallId === wallId);
      expect(mine.length).toBeGreaterThan(0);
      for (const box of mine) expect(box.heightFt).toBeCloseTo(byWallId[wallId]!.panelTopIn / 12, 9);
    }
    /* And every outline box still stands at the story height. */
    for (const box of boxes.filter((b) => fp.walls.some((w) => w.id === b.wallId))) {
      expect(box.heightFt).toBeCloseTo(STORY_IN / 12, 9);
    }
  });

  it("⚠ the bands the view splits into are the bands the instances were named from", () => {
    /* The view calls `computeWallVerticalBandsForSlotWithMaxHeight` with the
       SAME wall height and the SAME course limit the instance builder does.
       This is the assertion that catches handing one path the height and not
       the limit — the failure that would draw a joint nothing is cut for. */
    const instances = allPanelInstances(
      fp,
      slots,
      STANDARD_IN,
      "plywood",
      undefined,
      undefined,
      STORY_IN,
      undefined,
      MAX_PANEL_HEIGHT_IN,
      undefined,
      byWallId,
    );
    for (const wallId of ["CTR", "BRG-W", "BRG-E"]) {
      const build = byWallId[wallId]!;
      const column = instances.filter((i) => i.wallId === wallId && i.slotIndexInWall === 0);
      const bands = computeWallVerticalBandsForSlotWithMaxHeight(
        0,
        build.panelTopIn,
        [],
        build.courseMaxHeightIn,
        panelHeightInRange.minIn,
      );
      expect(column).toHaveLength(bands.length);
      bands.forEach((band, i) => {
        expect(column[i]!.heightOverrideIn).toBeCloseTo(band.topIn - band.bottomIn, 9);
      });
    }
  });
});
