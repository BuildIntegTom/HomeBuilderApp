import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { insertBumpOut } from "./bumpOut";
import { collapseNearZeroWalls, dragWall, dragWallWithCollapse } from "./dragWall";
import { cornerTurnAngleRad, isRightAngleCorner } from "./cornerAngle";
import type { Footprint } from "./types";

const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

function pointOf(fp: Footprint, cornerId: string) {
  return fp.corners.find((c) => c.id === cornerId)!.point;
}

function wallLength(fp: Footprint, wallId: string) {
  return fp.walls.find((w) => w.id === wallId)!.lengthFt;
}

describe("dragWall", () => {
  it("translates the dragged wall, lets its 2 neighbors absorb the change, and leaves the opposite wall untouched", () => {
    const fp = buildRectangleFootprint(30, 20);
    const before = { A: { ...pointOf(fp, "A") }, B: { ...pointOf(fp, "B") } };
    const dragged = dragWall(fp, "AB", 5);

    // AB's own length is unchanged (a translation, not a stretch).
    expect(wallLength(dragged, "AB")).toBeCloseTo(30, 6);
    // A and B both moved by the same perpendicular delta.
    const deltaA = { x: pointOf(dragged, "A").x - before.A.x, y: pointOf(dragged, "A").y - before.A.y };
    const deltaB = { x: pointOf(dragged, "B").x - before.B.x, y: pointOf(dragged, "B").y - before.B.y };
    expect(deltaA).toEqual(deltaB);
    expect(Math.hypot(deltaA.x, deltaA.y)).toBeCloseTo(5, 6);

    // The 2 neighbors (DA, BC) changed length; the opposite wall (CD) and
    // its corners are completely untouched — the key difference from
    // editWallLength, which would also change CD.
    expect(wallLength(dragged, "DA")).toBeCloseTo(15, 6);
    expect(wallLength(dragged, "BC")).toBeCloseTo(15, 6);
    expect(wallLength(dragged, "CD")).toBeCloseTo(30, 6);
    expect(pointOf(dragged, "C")).toEqual(pointOf(fp, "C"));
    expect(pointOf(dragged, "D")).toEqual(pointOf(fp, "D"));
  });

  it("keeps every corner a right angle and moves only the dragged wall's own 2 corners on a bump-out'd shape", () => {
    const fp = buildRectangleFootprint(30, 20);
    const { footprint: bumped } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    // corners: A(0), pa(1), paOut(2), pbOut(3), pb(4), B(5), C(6), D(7)
    const jogWall = bumped.walls.find((w) => w.startCorner === "1" && w.endCorner === "2")!;
    const before = bumped.corners.map((c) => ({ id: c.id, point: { ...c.point } }));

    const dragged = dragWall(bumped, jogWall.id, 3);

    for (const wall of dragged.walls) {
      const nextWall = dragged.walls.find((w) => w.startCorner === wall.endCorner)!;
      const angle = cornerTurnAngleRad(wall, nextWall, dragged.corners);
      expect(isRightAngleCorner(angle)).toBe(true);
    }

    const movedIds = new Set([jogWall.startCorner, jogWall.endCorner]);
    for (const c of before) {
      if (movedIds.has(c.id)) continue;
      expect(pointOf(dragged, c.id)).toEqual(c.point);
    }
  });

  it("clamps the offset so neither neighbor's length drops below the floor — each neighbor is independently the binding constraint from its own direction", () => {
    // A plain rectangle's 2 neighbors of any wall are always equal length
    // to each other (both are literally the same opposite-side value), so
    // they can never independently bind — use a bump-out'd shape instead,
    // where the jog wall's 2 neighbors (the 10ft remainder vs. the 5ft far
    // wall) genuinely differ.
    const fp = buildRectangleFootprint(30, 20);
    const { footprint: bumped } = insertBumpOut(fp, "AB", 10, 15, 5, allPrimary(fp));
    const jogWall = bumped.walls.find((w) => w.startCorner === "1" && w.endCorner === "2")!; // pa->paOut
    const prevWall = bumped.walls.find((w) => w.endCorner === "1")!; // A->pa, 10ft
    const nextWall = bumped.walls.find((w) => w.startCorner === "2")!; // paOut->pbOut, 5ft
    expect(prevWall.lengthFt).toBeCloseTo(10, 6);
    expect(nextWall.lengthFt).toBeCloseTo(5, 6);

    // Dragging one way shrinks the shorter (5ft) neighbor to the floor
    // first, while the longer one grows freely.
    const draggedOneWay = dragWall(bumped, jogWall.id, 1000);
    expect(wallLength(draggedOneWay, nextWall.id)).toBeCloseTo(1, 6);
    expect(wallLength(draggedOneWay, prevWall.id)).toBeGreaterThan(prevWall.lengthFt);

    // Dragging the other way shrinks the longer (10ft) neighbor to the
    // floor instead, while the shorter one grows freely.
    const draggedOtherWay = dragWall(bumped, jogWall.id, -1000);
    expect(wallLength(draggedOtherWay, prevWall.id)).toBeCloseTo(1, 6);
    expect(wallLength(draggedOtherWay, nextWall.id)).toBeGreaterThan(nextWall.lengthFt);
  });

  it("is a no-op when the wall id doesn't exist", () => {
    const fp = buildRectangleFootprint(30, 20);
    const result = dragWall(fp, "nonexistent", 5);
    expect(result).toBe(fp);
  });

  it("a zero offset leaves every corner geometrically identical", () => {
    const fp = buildRectangleFootprint(30, 20);
    const dragged = dragWall(fp, "AB", 0);
    for (const c of fp.corners) {
      expect(pointOf(dragged, c.id)).toEqual(c.point);
    }
  });
});

describe("collapseNearZeroWalls / dragWallWithCollapse", () => {
  it("collapses a wall dragged down to dragWall's own floor into a merged corner, reforming a straight run", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const { footprint: bumped, primaryCornerIds: bumpedPrimary } = insertBumpOut(fp, "AB", 10, 15, 5, primary);
    // corners: A(0), pa(1), paOut(2), pbOut(3), pb(4), B(5), C(6), D(7)
    expect(bumpedPrimary).toEqual(new Set(["0", "5", "6", "7"]));
    const jogWall = bumped.walls.find((w) => w.startCorner === "1" && w.endCorner === "2")!; // pa->paOut

    // Per the existing dragWall clamp test, dragging this jog wall by
    // +1000 shrinks its "23" (paOut->pbOut, 5ft) neighbor to dragWall's own
    // 1ft floor — below COLLAPSE_THRESHOLD_FT (1.1ft) — while the other
    // neighbor grows freely, so exactly one wall should collapse.
    const result = dragWallWithCollapse(bumped, jogWall.id, 1000, bumpedPrimary);

    expect(result.footprint.corners.length).toBe(bumped.corners.length - 1);
    expect(result.footprint.walls.length).toBe(result.footprint.corners.length);
    // Every remaining wall is above the collapse threshold — no leftover
    // sliver walls.
    for (const w of result.footprint.walls) {
      expect(w.lengthFt).toBeGreaterThanOrEqual(1);
    }
    // Still a single closed loop: every corner is exactly one wall's start
    // and exactly one wall's end.
    for (const c of result.footprint.corners) {
      expect(result.footprint.walls.filter((w) => w.startCorner === c.id).length).toBe(1);
      expect(result.footprint.walls.filter((w) => w.endCorner === c.id).length).toBe(1);
    }
    // Corner "3" (pbOut) was absorbed; every other original-primary corner
    // (A, B, C, D) survives, remapped to its shifted post-renumbering id.
    expect(result.primaryCornerIds).toEqual(new Set(["0", "4", "5", "6"]));
  });

  it("is a no-op when no wall is near the collapse threshold", () => {
    const fp = buildRectangleFootprint(30, 20);
    const primary = allPrimary(fp);
    const result = dragWallWithCollapse(fp, "AB", 2, primary);
    expect(result.footprint.corners.length).toBe(4);
    expect(result.primaryCornerIds).toEqual(primary);
  });

  it("never collapses below 4 corners, even if a wall is already near-zero", () => {
    const thin: Footprint = {
      corners: [
        { id: "A", point: { x: 0, y: 0 } },
        { id: "B", point: { x: 0.5, y: 0 } },
        { id: "C", point: { x: 0.5, y: 10 } },
        { id: "D", point: { x: 0, y: 10 } },
      ],
      walls: [
        { id: "AB", startCorner: "A", endCorner: "B", lengthFt: 0.5 },
        { id: "BC", startCorner: "B", endCorner: "C", lengthFt: 10 },
        { id: "CD", startCorner: "C", endCorner: "D", lengthFt: 0.5 },
        { id: "DA", startCorner: "D", endCorner: "A", lengthFt: 10 },
      ],
    };
    const primary = new Set(["A", "B", "C", "D"]);
    const result = collapseNearZeroWalls(thin, primary);
    expect(result.footprint.corners.length).toBe(4);
    expect(result.footprint).toBe(thin);
  });
});
