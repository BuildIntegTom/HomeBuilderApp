import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { insertBumpOut } from "./bumpOut";
import { editWallLength } from "./editWallLength";
import { cornerTurnAngleRad, isRightAngleCorner } from "./cornerAngle";
import type { Footprint } from "./types";

const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

function pointOf(fp: Footprint, cornerId: string) {
  return fp.corners.find((c) => c.id === cornerId)!.point;
}

function wallLength(fp: Footprint, wallId: string) {
  return fp.walls.find((w) => w.id === wallId)!.lengthFt;
}

describe("editWallLength", () => {
  it("reduces to the same result as buildRectangleFootprint for a plain rectangle", () => {
    const fp = buildRectangleFootprint(30, 20);
    const edited = editWallLength(fp, "AB", 45);
    const expected = buildRectangleFootprint(45, 20);
    expect(pointOf(edited, "A")).toEqual(pointOf(expected, "A"));
    expect(pointOf(edited, "B")).toEqual(pointOf(expected, "B"));
    expect(pointOf(edited, "C")).toEqual(pointOf(expected, "C"));
    expect(pointOf(edited, "D")).toEqual(pointOf(expected, "D"));
    expect(wallLength(edited, "AB")).toBeCloseTo(45, 6);
    expect(wallLength(edited, "BC")).toBeCloseTo(20, 6); // unchanged, not the edited axis
    expect(wallLength(edited, "CD")).toBeCloseTo(45, 6); // opposite wall changes too
    expect(wallLength(edited, "DA")).toBeCloseTo(20, 6); // untouched
  });

  it("leaves corner A (the wall's own start) and D (2 walls away) fixed", () => {
    const fp = buildRectangleFootprint(30, 20);
    const edited = editWallLength(fp, "AB", 45);
    expect(pointOf(edited, "A")).toEqual({ x: 0, y: 0 });
    expect(pointOf(edited, "D")).toEqual({ x: 0, y: 20 });
  });

  it("keeps every corner a right angle after editing a wall on a bump-out'd shape", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint: bumped } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    // Edit one of the bump-out's own jog walls (a short perpendicular one).
    const jogWall = bumped.walls.find((w) => w.startCorner === "1" && w.endCorner === "2")!;
    const edited = editWallLength(bumped, jogWall.id, 8);
    for (const wall of edited.walls) {
      const nextWall = edited.walls.find((w) => w.startCorner === wall.endCorner)!;
      const angle = cornerTurnAngleRad(wall, nextWall, edited.corners);
      expect(isRightAngleCorner(angle)).toBe(true);
    }
    expect(wallLength(edited, jogWall.id)).toBeCloseTo(8, 6);
  });

  it("only moves the wall's own end corner and the next wall's end corner, nothing else", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint: bumped } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    // corners: A(0), pa(1), paOut(2), pbOut(3), pb(4), B(5), C(6), D(7)
    const before = bumped.corners.map((c) => ({ id: c.id, point: { ...c.point } }));
    const wall = bumped.walls.find((w) => w.startCorner === "0" && w.endCorner === "1")!; // A->pa
    const edited = editWallLength(bumped, wall.id, 12);
    const nextWall = bumped.walls.find((w) => w.startCorner === "1")!;
    const movedIds = new Set([wall.endCorner, nextWall.endCorner]);
    for (const c of before) {
      const after = pointOf(edited, c.id);
      if (movedIds.has(c.id)) continue;
      expect(after).toEqual(c.point);
    }
  });

  it("is a no-op when the wall id doesn't exist", () => {
    const fp = buildRectangleFootprint(30, 20);
    const result = editWallLength(fp, "nonexistent", 45);
    expect(result).toBe(fp);
  });

  it("clamps a degenerate/too-small requested length to a small positive floor", () => {
    const fp = buildRectangleFootprint(30, 20);
    const edited = editWallLength(fp, "AB", -5);
    expect(wallLength(edited, "AB")).toBeGreaterThan(0);
  });
});
