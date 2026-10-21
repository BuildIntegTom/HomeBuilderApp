import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { insertBumpOut } from "./bumpOut";
import { computeFootprintAreaSqFt } from "./footprintArea";
import { isSplitRefusal, splitFootprintByChord, splitRefusalMessage } from "./splitFootprint";
import { miteredCornerIds } from "./miteredCorners";
import type { Footprint } from "./types";

const allCorners = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));
const split = (fp: Footprint, a: string, b: string) => {
  const out = splitFootprintByChord(fp, a, b);
  if (isSplitRefusal(out)) throw new Error(`refused: ${out.reason}`);
  return out;
};

describe("⚠ his trapezoid, which is the whole point of step 2", () => {
  it("a diagonal across a rectangle gives two triangles, and you keep one", () => {
    /* Tommy, 2026-10-20: "if a user makes new wall tool and adds an enclosed
       space - so they can delete the other wall and have a trapezoid
       building". Corner to corner across a rectangle is the simplest case. */
    const fp = buildRectangleFootprint(40, 20);
    const { regions } = split(fp, "A", "C");
    expect(regions).toHaveLength(2);
    for (const r of regions) {
      expect(r.footprint.corners).toHaveLength(3);
      expect(r.footprint.walls).toHaveLength(3);
    }
  });

  it("cutting a corner off gives the trapezoid itself", () => {
    // B..D across a 40x20 rectangle: a triangle off one end, a trapezoid left.
    const fp = buildRectangleFootprint(40, 20);
    const { regions } = split(fp, "B", "D");
    const sizes = regions.map((r) => r.footprint.corners.length).sort();
    expect(sizes).toEqual([3, 3]);
  });

  it("⚠ the kept shape has MITERED corners where the building had none", () => {
    /* The link back to step 1, and the reason it had to land first. A
       rectangle is uniformly square; cut it corner to corner and the chord
       meets the old walls at angles that are not 90 degrees. So the very first
       thing the draw-wall tool produces is the MIXED building — some square
       corners, some mitered — that `isMiteredShape` would have called
       uniformly mitered, re-conventioning the corners nobody touched.

       ⚠ My first version of this test built a bump-out and guessed a corner
       pair; the pair it guessed was refused for crossing a wall. The bump-out
       was never needed to make the point, and guessing indices on a shape
       whose corner order I had not checked is how a test ends up asserting
       something about the fixture instead of about the code. */
    const fp = buildRectangleFootprint(40, 20);
    expect(miteredCornerIds(fp).size).toBe(0);
    for (const r of split(fp, "A", "C").regions) {
      expect(miteredCornerIds(r.footprint).size).toBeGreaterThan(0);
    }
  });
});

describe("⚠ nothing is created or destroyed — the two halves are the whole", () => {
  it("the regions' areas sum to the original, on every shape", () => {
    /* The one property that catches a chord taking the wrong arc, pointing the
       wrong way round, or dropping a corner: both halves must add up. */
    for (const [name, fp, a, b] of [
      ["rectangle", buildRectangleFootprint(40, 20), "A", "C"],
      ["square", buildRectangleFootprint(30, 30), "B", "D"],
      ["octagon", buildOctagonFootprint(40, 24), "0", "4"],
      ["octagon short chord", buildOctagonFootprint(30, 30), "1", "5"],
      ["octagon asymmetric", buildOctagonFootprint(30, 30), "0", "3"],
    ] as [string, Footprint, string, string][]) {
      const { regions } = split(fp, a, b);
      const total = regions[0].areaSqFt + regions[1].areaSqFt;
      const expected = computeFootprintAreaSqFt(fp);
      // Within a quarter square foot: every corner is re-snapped to the
      // eighth grid, so the halves cannot be bit-exact.
      expect({ name, ok: Math.abs(total - expected) < 0.25 }).toEqual({ name, ok: true });
    }
  });

  it("every region is a properly closed ring", () => {
    const fp = buildOctagonFootprint(30, 30);
    for (const r of split(fp, "0", "4").regions) {
      for (const wall of r.footprint.walls) {
        const next = r.footprint.walls.find((w) => w.startCorner === wall.endCorner);
        expect(next).toBeDefined();
      }
      expect(r.footprint.walls).toHaveLength(r.footprint.corners.length);
    }
  });
});

describe("⚠ PANELS SURVIVE THE CUT, which is what wallIdMap is for", () => {
  it("every wall in a region maps back to the wall it was, and only the chord is new", () => {
    /* Without this map the corners renumber and every wall in the building
       silently loses its windows, doors and hand-set widths. */
    const fp = buildRectangleFootprint(40, 20);
    const { regions } = split(fp, "A", "C");
    for (const r of regions) {
      const sources = Object.values(r.wallIdMap);
      expect(sources.filter((s) => s === null)).toHaveLength(1); // exactly one chord
      const inherited = sources.filter((s): s is string => s !== null);
      expect(inherited.length).toBe(r.footprint.walls.length - 1);
      // Each inherited id is a real wall of the ORIGINAL building, used once.
      expect(new Set(inherited).size).toBe(inherited.length);
      for (const id of inherited) expect(fp.walls.some((w) => w.id === id)).toBe(true);
    }
  });

  it("the chord is named, and it is the one with no source", () => {
    const fp = buildRectangleFootprint(40, 20);
    for (const r of split(fp, "A", "C").regions) {
      expect(r.wallIdMap[r.chordWallId]).toBeNull();
      expect(r.footprint.walls.some((w) => w.id === r.chordWallId)).toBe(true);
    }
  });

  it("together the two regions account for every original wall exactly once", () => {
    const fp = buildOctagonFootprint(30, 30);
    const { regions } = split(fp, "0", "4");
    const inherited = regions.flatMap((r) => Object.values(r.wallIdMap)).filter((s): s is string => s !== null);
    expect([...inherited].sort()).toEqual(fp.walls.map((w) => w.id).sort());
  });
});

describe("what a chord is refused for, and what the user is told", () => {
  const refusal = (fp: Footprint, a: string, b: string) => {
    const out = splitFootprintByChord(fp, a, b);
    if (!isSplitRefusal(out)) throw new Error("expected a refusal");
    return out;
  };

  it("the same corner twice", () => {
    expect(refusal(buildRectangleFootprint(40, 20), "A", "A").reason).toBe("same-corner");
  });

  it("⚠ two ADJACENT corners — the chord would just retrace the wall already there", () => {
    const r = refusal(buildRectangleFootprint(40, 20), "A", "B");
    expect(r.reason).toBe("adjacent-corners");
    expect(splitRefusalMessage(r)).toContain("already have a wall");
  });

  it("a corner that is not on this building", () => {
    expect(refusal(buildRectangleFootprint(40, 20), "A", "Z").reason).toBe("not-on-footprint");
  });

  it("⚠ a chord that would run OUTSIDE, across a bump-out's notch", () => {
    /* On a convex shape every chord is interior. A bump-out makes reflex
       corners, and a chord between the right pair leaves the building through
       the notch — producing two regions that overlap and a building nobody
       drew. Found by sweeping every corner pair rather than by picking one. */
    const base = buildRectangleFootprint(40, 24);
    const fp = insertBumpOut(base, "AB", 10, 20, 8, allCorners(base)).footprint;
    const ids = fp.corners.map((c) => c.id);
    const refusals = new Set<string>();
    for (const a of ids) {
      for (const b of ids) {
        const out = splitFootprintByChord(fp, a, b);
        if (isSplitRefusal(out)) refusals.add(out.reason);
      }
    }
    expect(refusals.has("chord-outside") || refusals.has("chord-crosses-a-wall")).toBe(true);
  });

  it("every refusal has a sentence a person can act on", () => {
    const fp = buildRectangleFootprint(40, 20);
    for (const [a, b] of [
      ["A", "A"],
      ["A", "B"],
      ["A", "Z"],
    ]) {
      const message = splitRefusalMessage(refusal(fp, a!, b!));
      expect(message.length).toBeGreaterThan(20);
      expect(message).toMatch(/[.!]$/);
    }
  });

  it("⚠ no corner pair on ANY drawable shape produces an invalid region", () => {
    /* The sweep that matters: whatever the user clicks, the answer is either a
       refusal with a reason or two closed rings of at least three sides. There
       is no third outcome, and nothing downstream has to defend against one. */
    for (const fp of [
      buildRectangleFootprint(40, 20),
      buildRectangleFootprint(30, 30),
      buildOctagonFootprint(40, 24),
      buildOctagonFootprint(30, 30),
      insertBumpOut(buildRectangleFootprint(40, 24), "AB", 10, 20, 8, allCorners(buildRectangleFootprint(40, 24))).footprint,
    ]) {
      for (const a of fp.corners) {
        for (const b of fp.corners) {
          const out = splitFootprintByChord(fp, a.id, b.id);
          if (isSplitRefusal(out)) continue;
          for (const r of out.regions) {
            expect(r.footprint.corners.length).toBeGreaterThanOrEqual(3);
            expect(r.footprint.walls.length).toBe(r.footprint.corners.length);
            expect(r.areaSqFt).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
