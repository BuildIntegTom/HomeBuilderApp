import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { retile, wallGeometryFor } from "./retile";
import {
  MIN_SPLIT_REMNANT_FT,
  allWallPanelJoints,
  insertCornerAtWallOffset,
  splitSlotsAtJoint,
  wallPanelJoints,
} from "./wallJoints";
import { isSplitRefusal, splitFootprintByChord } from "./splitFootprint";
import type { Footprint, PanelSlot } from "./types";

const THICKNESS_IN = 15.5;
const SEED = { spacingIn: 100_000, defaultPattern: "chevron" as const, defaultMirrored: false };
const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

/** A real building, tiled the way the app tiles it. */
function tiled(fp: Footprint) {
  const slots = retile(fp, "A", allPrimary(fp), 40, 24, THICKNESS_IN, SEED);
  const runStart: Record<string, number> = {};
  for (const w of fp.walls) {
    runStart[w.id] = wallGeometryFor(fp, w.id, allPrimary(fp), "A", THICKNESS_IN)!.runStartOffsetIn;
  }
  return { slots, runStart };
}

const shape = (s: readonly PanelSlot[]) => s.map((x) => `${x.type}:${x.widthIn}`).join("|");

describe("⚠ the joint is where a landing costs nothing", () => {
  it("every joint sits on a real panel boundary, measured from the run's own origin", () => {
    const fp = buildRectangleFootprint(40, 24);
    const { slots, runStart } = tiled(fp);
    const joints = wallPanelJoints(fp, "AB", slots["AB"]!, runStart["AB"]!);
    expect(joints.length).toBeGreaterThan(0);
    // Rebuild the offsets independently and check they agree.
    let alongIn = runStart["AB"]!;
    const expected: number[] = [];
    for (let i = 0; i < slots["AB"]!.length - 1; i++) {
      alongIn += slots["AB"]![i]!.widthIn;
      expected.push(alongIn / 12);
    }
    for (const j of joints) {
      expect(expected.some((e) => Math.abs(e - j.offsetFt) < 1e-9)).toBe(true);
    }
  });

  it("⚠ the slots divide with NOTHING cut, resized or re-tiled", () => {
    /* The claim the whole feature rests on. Asserted as identity: the two
       halves concatenated are the original list, slot for slot. */
    const fp = buildRectangleFootprint(40, 24);
    const { slots, runStart } = tiled(fp);
    for (const j of wallPanelJoints(fp, "AB", slots["AB"]!, runStart["AB"]!)) {
      const { before, after } = splitSlotsAtJoint(slots["AB"]!, j.slotIndex);
      expect(shape([...before, ...after])).toBe(shape(slots["AB"]!));
      expect(before.length).toBeGreaterThan(0);
      expect(after.length).toBeGreaterThan(0);
    }
  });

  it("the point really is on the wall, at the offset it claims", () => {
    const fp = buildRectangleFootprint(40, 24);
    const { slots, runStart } = tiled(fp);
    const wall = fp.walls.find((w) => w.id === "AB")!;
    const start = fp.corners.find((c) => c.id === wall.startCorner)!.point;
    for (const j of wallPanelJoints(fp, "AB", slots["AB"]!, runStart["AB"]!)) {
      expect(Math.hypot(j.point.x - start.x, j.point.y - start.y)).toBeCloseTo(j.offsetFt, 9);
    }
  });

  it("⚠ the wall's own CORNERS are not offered as joints", () => {
    /* They are already pickable as corners. Offering them here would give one
       point two identities, one of which is a zero-length split. */
    const fp = buildRectangleFootprint(40, 24);
    const { slots, runStart } = tiled(fp);
    const wall = fp.walls.find((w) => w.id === "AB")!;
    for (const j of wallPanelJoints(fp, "AB", slots["AB"]!, runStart["AB"]!)) {
      expect(j.offsetFt).toBeGreaterThan(0);
      expect(j.offsetFt).toBeLessThan(wall.lengthFt);
    }
  });

  it("nothing is offered that would leave a stub too short to be a wall", () => {
    const fp = buildRectangleFootprint(40, 24);
    const { slots, runStart } = tiled(fp);
    for (const j of allWallPanelJoints(fp, slots, runStart)) {
      const wall = fp.walls.find((w) => w.id === j.wallId)!;
      expect(j.offsetFt).toBeGreaterThanOrEqual(MIN_SPLIT_REMNANT_FT);
      expect(wall.lengthFt - j.offsetFt).toBeGreaterThanOrEqual(MIN_SPLIT_REMNANT_FT);
    }
  });

  it("a wall with one panel has no joints, and neither does an unknown wall", () => {
    const fp = buildRectangleFootprint(40, 24);
    expect(wallPanelJoints(fp, "AB", [{ type: "standard", widthIn: 40 }], 0)).toEqual([]);
    expect(wallPanelJoints(fp, "ZZ", [], 0)).toEqual([]);
  });

  it("an octagon's walls offer them too — nothing here is rectangle-shaped", () => {
    const fp = buildOctagonFootprint(50, 50);
    const { slots, runStart } = tiled(fp);
    expect(allWallPanelJoints(fp, slots, runStart).length).toBeGreaterThan(0);
  });
});

describe("inserting the corner the new wall lands on", () => {
  it("splits the host wall in two and leaves every other wall alone", () => {
    const fp = buildRectangleFootprint(40, 24);
    const out = insertCornerAtWallOffset(fp, "AB", 15)!;
    expect(out.footprint.corners).toHaveLength(5);
    expect(out.footprint.walls).toHaveLength(5);
    expect(out.footprint.walls.some((w) => w.id === "AB")).toBe(false);
    for (const id of ["BC", "CD", "DA"]) {
      expect(out.footprint.walls.find((w) => w.id === id)).toEqual(fp.walls.find((w) => w.id === id));
    }
  });

  it("the two halves add up to the wall they replaced", () => {
    const fp = buildRectangleFootprint(40, 24);
    const out = insertCornerAtWallOffset(fp, "AB", 15)!;
    const before = out.footprint.walls.find((w) => w.id === out.beforeWallId)!;
    const after = out.footprint.walls.find((w) => w.id === out.afterWallId)!;
    expect(before.lengthFt + after.lengthFt).toBeCloseTo(40, 9);
    expect(before.lengthFt).toBeCloseTo(15, 9);
  });

  it("⚠ keeps the ring closed, which is what makes it composable", () => {
    const fp = buildRectangleFootprint(40, 24);
    const out = insertCornerAtWallOffset(fp, "AB", 15)!;
    for (const wall of out.footprint.walls) {
      expect(out.footprint.walls.find((w) => w.startCorner === wall.endCorner)).toBeDefined();
    }
  });

  it("⚠ does NOT renumber the existing corners", () => {
    /* Renumbering here would destroy the caller's correlation map before it
       could be built. `splitFootprintByChord` renumbers once, afterwards. */
    const fp = buildRectangleFootprint(40, 24);
    const out = insertCornerAtWallOffset(fp, "AB", 15)!;
    for (const c of fp.corners) {
      expect(out.footprint.corners.some((x) => x.id === c.id)).toBe(true);
    }
    expect(out.cornerId).not.toBe("A");
  });

  it("refuses an offset at or past either end", () => {
    const fp = buildRectangleFootprint(40, 24);
    expect(insertCornerAtWallOffset(fp, "AB", 0)).toBeNull();
    expect(insertCornerAtWallOffset(fp, "AB", 40)).toBeNull();
    expect(insertCornerAtWallOffset(fp, "AB", 41)).toBeNull();
    expect(insertCornerAtWallOffset(fp, "ZZ", 10)).toBeNull();
  });
});

describe("⚠ a joint landing composes with the chord split, end to end", () => {
  it("corner to joint cuts the building in two", () => {
    const fp = buildRectangleFootprint(40, 24);
    const { slots, runStart } = tiled(fp);
    const joint = wallPanelJoints(fp, "AB", slots["AB"]!, runStart["AB"]!)[2]!;
    const withCorner = insertCornerAtWallOffset(fp, joint.wallId, joint.offsetFt)!;
    const result = splitFootprintByChord(withCorner.footprint, withCorner.cornerId, "C");
    expect(isSplitRefusal(result)).toBe(false);
    if (isSplitRefusal(result)) return;
    for (const region of result.regions) {
      expect(region.footprint.corners.length).toBeGreaterThanOrEqual(3);
      expect(region.areaSqFt).toBeGreaterThan(0);
    }
    // Together they are still the whole building.
    const total = result.regions[0].areaSqFt + result.regions[1].areaSqFt;
    expect(Math.abs(total - 40 * 24)).toBeLessThan(0.5);
  });

  it("joint to joint on opposite walls does too", () => {
    const fp = buildRectangleFootprint(40, 24);
    const { slots, runStart } = tiled(fp);
    const a = wallPanelJoints(fp, "AB", slots["AB"]!, runStart["AB"]!)[1]!;
    const first = insertCornerAtWallOffset(fp, a.wallId, a.offsetFt)!;
    const { slots: slots2, runStart: runStart2 } = { slots, runStart }; // CD is untouched by the first insert
    const b = wallPanelJoints(first.footprint, "CD", slots2["CD"]!, runStart2["CD"]!)[1]!;
    const second = insertCornerAtWallOffset(first.footprint, b.wallId, b.offsetFt)!;
    const result = splitFootprintByChord(second.footprint, first.cornerId, second.cornerId);
    expect(isSplitRefusal(result)).toBe(false);
    if (isSplitRefusal(result)) return;
    const total = result.regions[0].areaSqFt + result.regions[1].areaSqFt;
    expect(Math.abs(total - 40 * 24)).toBeLessThan(0.5);
    // Four-sided halves: two original walls, one remnant each, and the chord.
    for (const region of result.regions) expect(region.footprint.walls.length).toBeGreaterThanOrEqual(4);
  });

  it("the slots either side of the joint are exactly the slots that were there", () => {
    const fp = buildRectangleFootprint(40, 24);
    const { slots, runStart } = tiled(fp);
    const joint = wallPanelJoints(fp, "AB", slots["AB"]!, runStart["AB"]!)[2]!;
    const { before, after } = splitSlotsAtJoint(slots["AB"]!, joint.slotIndex);
    expect(shape([...before, ...after])).toBe(shape(slots["AB"]!));
  });

  it("⚠ BUT the remnant can lose a corner at its FAR end, and then its panels do NOT fit", () => {
    /* ⚠ I wrote this test the other way round first — asserting the panels fit
       the remnant — and it PASSED, because it compared them against the wall's
       NOMINAL length instead of its RUN. Measuring the run is what showed the
       claim was wrong, and the wrong version is the reason this one is here.

       Nothing goes wrong at the joint. What goes wrong is at the other end:
       AB is 40ft and runs through the corner it shares with the 24ft wall DA,
       under the app's own rule that THE LONGER WALL RUNS THROUGH. Cut AB at
       8'8" and the remnant is shorter than DA, so DA takes that corner and the
       remnant is inset by one wall thickness. Its panels are then 15.5in too
       long for the run they sit in.

       That is not a defect to fix here — it is the ownership rule doing what it
       says, and `retilePreservingOpenings` resizes that end on the way through,
       carrying the openings. It IS a correction to what a joint landing
       promises: no panel is cut, which is the point; the wall is not
       necessarily untouched, which I had claimed. */
    const fp = buildRectangleFootprint(40, 24);
    const { slots, runStart } = tiled(fp);
    const joint = wallPanelJoints(fp, "AB", slots["AB"]!, runStart["AB"]!)[2]!;
    const { before } = splitSlotsAtJoint(slots["AB"]!, joint.slotIndex);
    const panelsIn = before.reduce((n, s) => n + s.widthIn, 0);

    const withCorner = insertCornerAtWallOffset(fp, joint.wallId, joint.offsetFt)!;
    const result = splitFootprintByChord(withCorner.footprint, withCorner.cornerId, "C");
    expect(isSplitRefusal(result)).toBe(false);
    if (isSplitRefusal(result)) return;

    for (const region of result.regions) {
      const newId = Object.keys(region.wallIdMap).find((k) => region.wallIdMap[k] === withCorner.beforeWallId);
      if (!newId) continue;
      const geom = wallGeometryFor(
        region.footprint,
        newId,
        new Set(region.footprint.corners.map((c) => c.id)),
        region.footprint.corners[0]!.id,
        THICKNESS_IN,
      )!;
      // The joint end is his butt joint: the remnant owns that corner outright.
      expect(geom.hasCornerEnd).toBe(true);
      expect(geom.endInsetIn).toBe(0);
      // The far end is where it lost one, and the numbers say so.
      expect(geom.hasCornerStart).toBe(false);
      expect(geom.startInsetIn).toBeGreaterThan(0);
      expect(panelsIn - geom.lengthIn).toBeCloseTo(geom.startInsetIn, 6);
    }
  });
});
