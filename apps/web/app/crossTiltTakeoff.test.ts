import { describe, expect, it } from "vitest";
import { buildRectangleFootprint, shedTallWallId } from "@building-integrity/geometry";
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

const input = (over: Partial<CrossTiltTakeoffInput> = {}): CrossTiltTakeoffInput => ({
  footprint,
  crossTiltWallIds: new Set([tallWallId]),
  depthIn: DEPTH_IN,
  roofPitchIn12: 4,
  wallHeightFt: 10,
  ...over,
});

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

  it("⚠ the row sums to the wall EXACTLY, and starts at its corner", () => {
    /* His standing rule, the one three overflow bugs came out of: wall
       lengths are exact, and the parts sum to the whole. */
    const takeoff = computeCrossTiltTakeoff(input());
    const run = takeoff.runs[0]!;
    const row = takeoff.instances.filter((i) => i.runIndex === 0);
    expect(row[0]!.atIn).toBe(0);
    expect(row.reduce((sum, i) => sum + i.widthIn, 0)).toBeCloseTo(run.runIn, 9);
    const last = row[row.length - 1]!;
    expect(last.atIn + last.widthIn).toBeCloseTo(run.runIn, 9);
    // And no panel starts where the one before it has not finished.
    for (let i = 1; i < row.length; i++) {
      expect(row[i]!.atIn).toBeCloseTo(row[i - 1]!.atIn + row[i - 1]!.widthIn, 9);
    }
  });

  it("the two end panels are the WALL's depth, not a catalog default", () => {
    const takeoff = computeCrossTiltTakeoff(input({ depthIn: 18 }));
    const row = takeoff.instances.filter((i) => i.runIndex === 0);
    expect(row[0]!.widthIn).toBe(18);
    expect(row[row.length - 1]!.widthIn).toBe(18);
  });

  it("the row sits ON the wall, at the wall's own height", () => {
    const takeoff = computeCrossTiltTakeoff(input({ wallHeightFt: 9 }));
    for (const i of takeoff.instances) expect(i.world.anchorYFt).toBe(9);
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
      /* ⚠ At the default 4:12 it is 6 7/8in, not the old 3 1/2in stand-in.
         Tommy, 2026-11-01, asked how much straight exterior face this row
         should have: *"tall enough for a real stud in both wythes."* */
      if (roofPitchIn12 === 4) expect(group.lowHeightIn).toBeCloseTo(6.874, 3);
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
