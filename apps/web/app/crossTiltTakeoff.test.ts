import { describe, expect, it } from "vitest";
import { buildRectangleFootprint, shedTallWallId, simpleRoofPlanes } from "@building-integrity/geometry";
import { buildCrossTiltPanelMembers } from "@building-integrity/panel-catalog";
import { crossTiltMinimumLowHeightIn } from "@building-integrity/panel-catalog";
import { computeCrossTiltTakeoff, crossTiltWallIdsFor, type CrossTiltTakeoffInput } from "./crossTiltTakeoff";

/**
 * ⚠ **THE JUNCTION between the tilted gable row and the documents**, which is
 * where this row had nothing at all.
 *
 * `buildCrossTiltPanelMembers` was already tested, thoroughly, on its own
 * geometry. What nothing tested was that the row existed anywhere outside the
 * 3D view: his *"tilted gable panels populating upon draw, material counts,
 * screw counts, etc, along with shop fabrication pages."*
 *
 * So these tests are about what a drawing and a sheet have to AGREE on — that
 * every panel on screen is a panel some group accounts for, at its own width,
 * and that the row the documents count is the row the wall actually carries.
 */

const IN_PER_FT = 12;
const DEPTH_IN = 15.5;
const WIDE_FT = 40;
const DEEP_FT = 20;

const footprint = buildRectangleFootprint(WIDE_FT, DEEP_FT);
const tallWallId = shedTallWallId(footprint, { form: "shed", pitchIn12: 4, eaveHeightFt: 10 })!;

/** The roofline: the wall's top plate PLUS the roof-bearing plate that rings
 * it, which is the height the roof itself is laid from. */
const EAVE_FT = 10 + 2.25 / IN_PER_FT;

const input = (over: Partial<CrossTiltTakeoffInput> = {}): CrossTiltTakeoffInput => ({
  footprint,
  crossTiltWallIds: new Set([tallWallId]),
  depthIn: DEPTH_IN,
  roofPitchIn12: 4,
  roofEaveHeightFt: EAVE_FT,
  /* The app's own default: gable ends run full height, so the roof is held
     back from the floor plan by one wall depth at each gable end. */
  roofGableEndInsetIn: DEPTH_IN,
  wallHeightFt: 10,
  ...over,
});

/** The roof's own high edge, off the same planes the deck is laid on. */
function roofHighEdgeIn(fp = footprint, pitchIn12 = 4, eaveHeightFt = EAVE_FT): number {
  return simpleRoofPlanes(fp, { form: "shed", pitchIn12, eaveHeightFt }).planes[0]!.highHeightFt * IN_PER_FT;
}

describe("the tilted gable row reaches the documents", () => {
  it("spawns a row the moment the roof form says shed — no toggle, no draw-time snapshot", () => {
    /* ⚠ The regression this pins: the wall ids were STATE, set once in the
       fresh-draw effect off the drawn form and the default pitch. Edit the
       roofline profile to a shed afterwards and no row appeared; edit it away
       and the row stayed on a wall that had become a gable end. Derived from
       the live roof, both cases answer themselves. */
    const shed = crossTiltWallIdsFor(footprint, "shed", 4, 10);
    expect(shed.size).toBe(1);
    expect(shed.has(tallWallId)).toBe(true);

    // A peak has no tall side, so it has no row.
    expect(crossTiltWallIdsFor(footprint, "peaked", 4, 10).size).toBe(0);
    expect(crossTiltWallIdsFor(footprint, "flat", 4, 10).size).toBe(0);
  });

  it("every placed panel belongs to exactly one group, at that group's own width", () => {
    const takeoff = computeCrossTiltTakeoff(input());
    expect(takeoff.instances.length).toBeGreaterThan(0);

    const grouped = takeoff.groups.flatMap((g) => g.instances.map((i) => i.id));
    expect(grouped.slice().sort()).toEqual(takeoff.instances.map((i) => i.id).sort());
    expect(new Set(grouped).size).toBe(takeoff.instances.length);

    for (const group of takeoff.groups) {
      for (const i of group.instances) {
        expect({ id: i.id, w: i.widthIn }).toEqual({ id: i.id, w: group.widthIn });
      }
    }
  });

  it("⚠ every group's members were built from the options the group reports", () => {
    /* A group that carries its own options can be checked against itself —
       the one thing that stops a sheet describing a panel the view does not
       build. */
    const takeoff = computeCrossTiltTakeoff(input());
    expect(takeoff.groups.length).toBeGreaterThan(0);
    for (const group of takeoff.groups) {
      const rebuilt = buildCrossTiltPanelMembers(group.options);
      expect(rebuilt.refusal).toBeNull();
      expect(group.members.map((m) => m.memberId)).toEqual(rebuilt.members.map((m) => m.memberId));
      expect(group.highHeightIn).toBeCloseTo(rebuilt.highHeightIn, 9);
      expect(group.tiltDeg).toBeCloseTo(rebuilt.tiltDeg, 9);
      expect(group.options.widthIn).toBe(group.widthIn);
      expect(group.options.depthIn).toBe(DEPTH_IN);
    }
  });

  it("⚠ the row sums to its ROOFED span EXACTLY, and the gable ends own the rest", () => {
    /* His standing rule, the one three overflow bugs came out of: wall
       lengths are exact, and the parts sum to the whole. The whole is the
       roofed span now — see the test below for why — and the two gable ends
       account for every inch of the difference. */
    const takeoff = computeCrossTiltTakeoff(input());
    const run = takeoff.runs[0]!;
    const row = takeoff.instances.filter((i) => i.runIndex === 0);
    expect(row[0]!.atIn).toBe(0);
    expect(row.reduce((sum, i) => sum + i.widthIn, 0)).toBeCloseTo(run.runIn, 9);
    const last = row[row.length - 1]!;
    expect(last.atIn + last.widthIn).toBeCloseTo(run.runIn, 9);
    // Nothing is lost: the row plus the two gable ends IS the wall.
    expect(run.runIn + 2 * DEPTH_IN).toBeCloseTo(WIDE_FT * IN_PER_FT, 9);
    // And no panel starts where the one before it has not finished.
    for (let i = 1; i < row.length; i++) {
      expect(row[i]!.atIn).toBeCloseTo(row[i - 1]!.atIn + row[i - 1]!.widthIn, 9);
    }
  });

  it("⚠ the row ENDS WITH THE ROOF — it does not run through the gable end panels", () => {
    /* > *"on a small shed building (or other shapes maybe too), the roof
       >  supporting panels overlap the gable end panels, where as the roof
       >  support ones should end with the roof."* — Tommy, 2026-11-03

       The row ran its wall's full centreline length, corner to corner, while
       the gable row on each perpendicular wall runs *"corner to corner, the
       full width of the floor plan"* whenever gable ends are full height. Both
       claimed the same corner square in the same band above the eave. This row
       gives way, by exactly the number the ROOF is held back by. */
    const wall = footprint.walls.find((w) => w.id === tallWallId)!;
    const corner = (id: string) => footprint.corners.find((c) => c.id === id)!.point;
    const a = corner(wall.startCorner);
    const b = corner(wall.endCorner);
    const lengthFt = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / lengthFt;
    const uy = (b.y - a.y) / lengthFt;
    const insetFt = DEPTH_IN / IN_PER_FT;

    const row = computeCrossTiltTakeoff(input()).instances.filter((i) => i.runIndex === 0);
    const first = row[0]!;
    // The first panel starts one gable-end depth in from the corner, not at it.
    expect(first.world.anchorX).toBeCloseTo(a.x + ux * insetFt, 9);
    expect(first.world.anchorZ).toBeCloseTo(a.y + uy * insetFt, 9);
    // And the last panel finishes one gable-end depth short of the far corner.
    const last = row[row.length - 1]!;
    const endAlongFt = (last.atIn + last.widthIn) / IN_PER_FT + insetFt;
    expect(endAlongFt).toBeCloseTo(lengthFt - insetFt, 9);
  });

  it("with the gable ends NOT full height, the row is the whole wall again", () => {
    /* The toggle's other side: *"Roof panels run right out to both exterior
       edges of the floor plan, over the top of the gable ends, which stop
       under them."* The roof is not held back, so neither is this row — the
       inset is the roof's own number, and when it is 0 the old behaviour is
       exactly what comes back. */
    const takeoff = computeCrossTiltTakeoff(input({ roofGableEndInsetIn: 0 }));
    const run = takeoff.runs[0]!;
    expect(run.runIn).toBeCloseTo(WIDE_FT * IN_PER_FT, 9);
    const row = takeoff.instances.filter((i) => i.runIndex === 0);
    const wall = footprint.walls.find((w) => w.id === tallWallId)!;
    const a = footprint.corners.find((c) => c.id === wall.startCorner)!.point;
    expect(row[0]!.world.anchorX).toBeCloseTo(a.x, 9);
    expect(row[0]!.world.anchorZ).toBeCloseTo(a.y, 9);
  });

  it("the two end panels are the WALL's depth, not a catalog default", () => {
    const takeoff = computeCrossTiltTakeoff(input({ depthIn: 18 }));
    const row = takeoff.instances.filter((i) => i.runIndex === 0);
    expect(row[0]!.widthIn).toBe(18);
    expect(row[row.length - 1]!.widthIn).toBe(18);
  });

  it("the row sits on the ROOFLINE, and falls back to the wall top only when there is no roof", () => {
    /* ⚠ This asserted `anchorYFt === wallHeightFt` until 2026-11-01, which
       is 2 1/4in below the top of the roof-bearing plate that rings every
       wall — so the row's own bottom skin and plate ran through it. The row
       is referenced to the same roofline the roof is laid from. */
    const onTheRoofline = computeCrossTiltTakeoff(input({ wallHeightFt: 9 }));
    for (const i of onTheRoofline.instances) expect(i.world.anchorYFt).toBeCloseTo(EAVE_FT, 9);

    const noRoofline = computeCrossTiltTakeoff(input({ wallHeightFt: 9, roofEaveHeightFt: undefined }));
    for (const i of noRoofline.instances) expect(i.world.anchorYFt).toBe(9);
  });

  it("⚠ a panel is named by its place in the row, and no two share a name or an id", () => {
    const takeoff = computeCrossTiltTakeoff(input());
    expect(takeoff.instances.map((i) => i.name)).toEqual(takeoff.instances.map((_, idx) => `T${idx + 1}`));
    expect(new Set(takeoff.instances.map((i) => i.id)).size).toBe(takeoff.instances.length);
  });

  it("⚠ the priced face is each panel's own AVERAGE height, not its low face", () => {
    /* This panel's two faces are different heights, so pricing it on either
       one alone is wrong by the whole rise. The trapezoid average is the same
       reading the gable row's area takes across its width. */
    const takeoff = computeCrossTiltTakeoff(input());
    const expected = takeoff.groups.reduce(
      (sum, g) =>
        sum + g.instances.length * (g.widthIn / IN_PER_FT) * ((g.lowHeightIn + g.highHeightIn) / 2 / IN_PER_FT),
      0,
    );
    expect(takeoff.faceAreaSqFt).toBeCloseTo(expected, 9);
    expect(takeoff.faceAreaSqFt).toBeGreaterThan(0);

    // The low face alone would under-charge: the rise is real material.
    const lowOnly = takeoff.groups.reduce(
      (sum, g) => sum + g.instances.length * (g.widthIn / IN_PER_FT) * (g.lowHeightIn / IN_PER_FT),
      0,
    );
    expect(takeoff.faceAreaSqFt).toBeGreaterThan(lowOnly);
  });

  it("the tilt follows the ROOF's pitch, because it is the surface the roof lands on", () => {
    /* ⚠ 3:12 against 5:12, not 8:12. Past about 5.1:12 the rip across the
       top plate's own 3 1/2in takes more than a 2x4 has, and the panel
       refuses rather than emitting a board of negative thickness. */
    const flatter = computeCrossTiltTakeoff(input({ roofPitchIn12: 3 }));
    const steeper = computeCrossTiltTakeoff(input({ roofPitchIn12: 5 }));
    expect(steeper.groups[0]!.tiltDeg).toBeGreaterThan(flatter.groups[0]!.tiltDeg);
    expect(steeper.groups[0]!.highHeightIn).toBeGreaterThan(flatter.groups[0]!.highHeightIn);
    // Every group on one building reads one plane.
    for (const g of steeper.groups) expect(g.tiltDeg).toBeCloseTo(steeper.groups[0]!.tiltDeg, 9);
  });

  it("⚠ the row's low edge is floored at the panel's own layers, and the panel never refuses", () => {
    /* THE B8 FIX, seen from the takeoff. The row used to be built at a flat
       3 1/2in whatever the pitch; on a flatter roof the top plate's rip leaves
       more board standing and the panel needs to be taller. */
    for (const roofPitchIn12 of [1, 2, 3, 4, 5]) {
      const takeoff = computeCrossTiltTakeoff(input({ roofPitchIn12 }));
      expect({ roofPitchIn12, refusal: takeoff.refusal }).toEqual({ roofPitchIn12, refusal: null });
      expect(takeoff.instances.length).toBeGreaterThan(0);
      const group = takeoff.groups[0]!;
      expect(group.lowHeightIn).toBeGreaterThanOrEqual(crossTiltMinimumLowHeightIn(roofPitchIn12) - 1e-9);
      /* ⚠ **The minimum is now a REFUSAL THRESHOLD, not a floor the row is
         clamped to** — and on any real shed it is met with room to spare,
         because the row is a full storey tall rather than a 12in cap. At
         4:12 on this 20ft-deep shed the interior face is 74.83in against a
         6.874in minimum. This line read `toBeCloseTo(6.874)` while the row's
         height was a function of the pitch alone; that constant is exactly
         what left the tall wall 38in short of its roof. */
      if (roofPitchIn12 === 4) {
        expect(group.lowHeightIn).toBeCloseTo(roofHighEdgeIn() - EAVE_FT * IN_PER_FT - DEPTH_IN / 3, 6);
        expect(group.lowHeightIn).toBeCloseTo(74.833, 3);
      }
    }
  });

  it("no row at all — rather than a guessed one — where there is nothing to read", () => {
    for (const over of [
      { footprint: null },
      { crossTiltWallIds: new Set<string>() },
      { crossTiltWallIds: undefined },
      { roofPitchIn12: undefined },
    ] as Partial<CrossTiltTakeoffInput>[]) {
      const takeoff = computeCrossTiltTakeoff(input(over));
      expect({ over: JSON.stringify(Object.keys(over)), n: takeoff.instances.length }).toEqual({
        over: JSON.stringify(Object.keys(over)),
        n: 0,
      });
      expect(takeoff.groups).toEqual([]);
      expect(takeoff.faceAreaSqFt).toBe(0);
    }
  });

  it("⚠ a wall too short to divide refuses IN WORDS, and draws nothing", () => {
    /* Refuse, do not guess — and say why on screen, which is why the refusal
       is a sentence rather than an empty array.
       The case is a wall whose two end panels alone overrun it: a footprint
       cannot be drawn shorter than 8ft (`MIN_DIMENSION_FT`), so the way to
       reach it is a wall thicker than half that. */
    const small = buildRectangleFootprint(8, 8);
    const smallTall = shedTallWallId(small, { form: "shed", pitchIn12: 4, eaveHeightFt: 10 })!;
    const takeoff = computeCrossTiltTakeoff(
      input({ footprint: small, crossTiltWallIds: new Set([smallTall]), depthIn: 60 }),
    );
    expect(takeoff.instances).toEqual([]);
    expect(takeoff.refusal).toMatch(/too short/);
  });

  it("⚠ every member of the row has real geometry, so nothing exports as a blob", () => {
    /* The row goes into the OBJ and COLLADA downloads now, which it could
       not do while it lived in the view's own loop. Every ripped piece
       carries its shape in `sectionCornersIn`; a member with neither that nor
       a plain box would land in the file as nothing. */
    const takeoff = computeCrossTiltTakeoff(input());
    for (const group of takeoff.groups) {
      expect(group.members.length).toBeGreaterThan(0);
      for (const m of group.members) {
        expect({ id: m.memberId, len: m.actualDimsIn.lengthIn > 0 }).toEqual({ id: m.memberId, len: true });
      }
      // Both lids and both pairs of plates, which is what the fastener
      // schedule is counted off.
      expect(group.members.filter((m) => m.role === "skin").length).toBe(2);
      expect(group.members.filter((m) => m.role === "plate").length).toBe(4);
      /* ⚠ BOTH wythes are framed. Until 2026-11-01 the row was built at a
         3 1/2in low edge, which left the exterior wythe about 1/8in of clear
         space — not a stud, so the roof's load reached the wall's outer
         wythe through plates and skins rather than through framing. */
      const studs = group.members.filter((m) => m.role === "stud");
      expect(studs.some((m) => m.memberId.includes("exterior"))).toBe(true);
      expect(studs.some((m) => m.memberId.includes("interior"))).toBe(true);
      for (const stud of studs) expect(stud.actualDimsIn.lengthIn).toBeGreaterThanOrEqual(3.5 - 1e-9);
    }
  });
});

/**
 * ⚠ **THE ROW HAS TO REACH ITS ROOF, and for 1 1/2 months it did not.**
 *
 * The row's height was `max(3.5in, the panel's own minimum)` — a function of
 * the PITCH, with no term for the building. A shed's tall wall is the wall
 * under the roof's HIGH edge, so what it has to make up is the roof's whole
 * rise. Measured on drawn sheds at 4:12 on a 10ft wall, the roof's high edge
 * stood **38.21in** above the row on a 24x12, **46.21in** on a 30x14 and
 * **54.21in** on a 40x16 — a gap that grows with the building.
 *
 * ⚠ **And the tilt ran the wrong way.** A panel's depth is measured from its
 * EXTERIOR face, and this roof falls away inward, so the top must DESCEND
 * over the depth. It climbed. Nothing caught it because the row stopped so
 * far short that the two surfaces never came near enough to disagree —
 * which is the real lesson here: fixing the height alone would have bedded
 * the roof on one corner of every panel in the row.
 */
describe("⚠ the tilted row meets the roof it carries", () => {
  it("⚠ its top lands exactly on the roof's high edge, on a shed of any depth", () => {
    for (const deepFt of [12, 14, 16, 20]) {
      const fp = buildRectangleFootprint(WIDE_FT, deepFt);
      const wallId = shedTallWallId(fp, { form: "shed", pitchIn12: 4, eaveHeightFt: EAVE_FT })!;
      const takeoff = computeCrossTiltTakeoff(input({ footprint: fp, crossTiltWallIds: new Set([wallId]) }));
      expect(takeoff.refusal).toBeNull();
      expect(takeoff.groups.length).toBeGreaterThan(0);

      for (const group of takeoff.groups) {
        /* Base + the panel's EXTERIOR height, against the roof's own plane.
           Both read off `roofEaveHeightFt`, so they cannot be referenced to
           different heights. */
        const topIn = EAVE_FT * IN_PER_FT + group.highHeightIn;
        expect(topIn).toBeCloseTo(roofHighEdgeIn(fp), 6);
      }
    }
  });

  it("⚠ the row grows with the building, because the rise does", () => {
    /* The regression in one assertion: a constant height cannot do this. At
       4:12 a shed rises a third of its depth, so 12ft of building is 48in of
       row and 16ft is 64in. */
    const heightOf = (deepFt: number): number => {
      const fp = buildRectangleFootprint(WIDE_FT, deepFt);
      const wallId = shedTallWallId(fp, { form: "shed", pitchIn12: 4, eaveHeightFt: EAVE_FT })!;
      return computeCrossTiltTakeoff(input({ footprint: fp, crossTiltWallIds: new Set([wallId]) })).groups[0]!.highHeightIn;
    };
    expect(heightOf(12)).toBeCloseTo(48, 6);
    expect(heightOf(16)).toBeCloseTo(64, 6);
    expect(heightOf(16) - heightOf(12)).toBeCloseTo(16, 6);
  });

  it("⚠ the top FALLS inward: the exterior face is the tall one", () => {
    const group = computeCrossTiltTakeoff(input()).groups[0]!;
    expect(group.highHeightIn).toBeGreaterThan(group.lowHeightIn);
    expect(group.highHeightIn - group.lowHeightIn).toBeCloseTo(DEPTH_IN / 3, 6);

    /* ⚠ Read off the real member, not the reported pair, because the pair
       is symmetric about a reversal and would pass either way. The top
       skin's section corners carry the actual inclined surface. */
    const skin = group.members.find((m) => m.memberId === "cross_tilt_top_skin")!;
    const corners = skin.position.sectionCornersIn!;
    const atY = (yIn: number) => Math.max(...corners.filter((c) => Math.abs(c.yIn - yIn) < 1e-6).map((c) => c.zIn));
    expect(atY(0)).toBeGreaterThan(atY(DEPTH_IN));
    expect(atY(0) - atY(DEPTH_IN)).toBeCloseTo(DEPTH_IN / 3, 6);
  });

  it("⚠ it sits ON the roof-bearing plate, not inside it", () => {
    /* It anchored at the bare wall top, 2 1/4in below the top of the truss
       plate that rings EVERY wall — so the row's bottom skin and plate ran
       straight through the plate carrying the roof. */
    const takeoff = computeCrossTiltTakeoff(input());
    for (const instance of takeoff.instances) {
      expect(instance.world.anchorYFt).toBeCloseTo(EAVE_FT, 9);
      expect(instance.world.anchorYFt).toBeGreaterThan(10);
    }
  });

  it("refuses in words where the derived height will not hold the panel's layers", () => {
    /* ⚠ No clamp. A clamp would lift the panel through the roof it is
       meant to carry, which is a worse answer than an honest refusal: a very
       shallow shed rises less than this panel is thick. */
    const fp = buildRectangleFootprint(WIDE_FT, 8);
    const wallId = shedTallWallId(fp, { form: "shed", pitchIn12: 1, eaveHeightFt: EAVE_FT })!;
    const takeoff = computeCrossTiltTakeoff(
      input({ footprint: fp, crossTiltWallIds: new Set([wallId]), roofPitchIn12: 1 }),
    );
    expect(takeoff.refusal).toContain("cannot hold this panel's own layers");
    expect(takeoff.groups).toHaveLength(0);
  });
});
