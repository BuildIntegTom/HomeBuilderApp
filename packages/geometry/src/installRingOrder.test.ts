import { describe, expect, it } from "vitest";
import { installRingWallOrder } from "./installRingOrder";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { addCourtyard } from "./footprintLoops";
import { isOffsetRefusal } from "./offsetFootprint";
import { wallCompassDirection } from "./wallCompassDirection";
import type { Footprint } from "./types";

/* ──────────────────────────────────────────────────────────────────────────
   B35 — "FROM POINT OF LEAST ACCESSABILITY, CLOCKWISE, FROM OUT TO IN"

   The two outer clauses of his panel-numbering order. ⚠ These are the tests
   that pin the PLA rotation, which cannot be exercised in the browser without
   clicking a canvas corner — and the rotation is the whole point of the
   feature: it is what makes 0001 the panel a crew unloads first.
   ────────────────────────────────────────────────────────────────────────── */

/** The walls in numbering order, as compass labels. */
function walkOrder(footprint: Footprint, pla: string): string[] {
  const order = installRingWallOrder(footprint, pla);
  return footprint.walls
    .filter((w) => order.has(w.id))
    .sort((a, b) => {
      const pa = order.get(a.id)!;
      const pb = order.get(b.id)!;
      return pa.ringIndex - pb.ringIndex || pa.wallIndex - pb.wallIndex;
    })
    .map((w) => wallCompassDirection(w, footprint));
}

describe("⚠ clockwise is already the walk, and screen-up is North", () => {
  const rect = buildRectangleFootprint(30, 20);

  it("a rectangle from corner A runs N, E, S, W", () => {
    /* The thing being checked is that nothing here reverses the ring: a
       rectangle is built A(0,0) -> B(w,0) -> C(w,d) -> D(0,d), which on a
       y-down plan is clockwise as drawn. If this ever reads N, W, S, E then
       the walk has been flipped and every panel number with it. */
    expect(walkOrder(rect, "A")).toEqual(["N", "E", "S", "W"]);
  });

  it("every wall is placed, exactly once, with no gaps in the index", () => {
    const order = installRingWallOrder(rect, "A");
    expect(order.size).toBe(rect.walls.length);
    expect([...order.values()].map((p) => p.wallIndex).sort()).toEqual([0, 1, 2, 3]);
    expect([...order.values()].every((p) => p.ringIndex === 0)).toBe(true);
  });
});

describe("⚠ the point of least accessibility ROTATES the walk", () => {
  const rect = buildRectangleFootprint(30, 20);

  it("starting at B begins on the EAST wall and still runs clockwise", () => {
    /* His own reasoning, from the truck work: "if the PLA is on the top left
       (NW) then that panel on the corner is the top of the first stack." The
       wall that STARTS at the corner is the one that goes first. */
    expect(walkOrder(rect, "B")).toEqual(["E", "S", "W", "N"]);
  });

  it("every corner gives a different start, and the cycle never changes", () => {
    expect(walkOrder(rect, "C")).toEqual(["S", "W", "N", "E"]);
    expect(walkOrder(rect, "D")).toEqual(["W", "N", "E", "S"]);
  });

  it("⚠ an unknown corner leaves the ring in its own order rather than throwing", () => {
    /* A malformed or stale PLA should not blank a crew's numbering. */
    expect(walkOrder(rect, "nope")).toEqual(["N", "E", "S", "W"]);
  });
});

describe("⚠ out to in — the outer ring finishes before an inner one starts", () => {
  const courtyard = addCourtyard(buildRectangleFootprint(40, 40), 10);

  it("a courtyard building has two rings, outer first", () => {
    if (isOffsetRefusal(courtyard)) throw new Error(`courtyard refused: ${courtyard.reason}`);
    const order = installRingWallOrder(courtyard, "A");
    const rings = [...order.values()].map((p) => p.ringIndex);
    expect(new Set(rings)).toEqual(new Set([0, 1]));
    /* Every wall placed, and the outer ring's indices all come before the
       inner ring's in the sort, which is what ring-major means. */
    expect(order.size).toBe(courtyard.walls.length);
  });

  it("⚠ the outer ring is the one with the larger area, NOT the one wound a particular way", () => {
    /* An inner ring winds the OTHER way. Reading the winding to decide which
       is outer is the mistake that made compass directions come out backwards
       on an inner ring in October: "the interior side of the inner courtyard
       wall is the outside." */
    if (isOffsetRefusal(courtyard)) throw new Error("courtyard refused");
    const order = installRingWallOrder(courtyard, "A");
    /* The four walls of the original 40x40 are still in the footprint and are
       the outer ring, so each of them must be ringIndex 0. */
    const outerIds = buildRectangleFootprint(40, 40).walls.map((w) => w.id);
    for (const id of outerIds) {
      expect(order.get(id)?.ringIndex, id).toBe(0);
    }
  });

  it("⚠ an inner ring is NOT rotated — there is no second PLA to rotate it to", () => {
    /* The least-accessible corner is a corner of the BUILDING, which an inner
       courtyard ring does not touch. Its own order is one consistent walk;
       inventing a start for it would be inventing a fact about the site. */
    if (isOffsetRefusal(courtyard)) throw new Error("courtyard refused");
    const atA = installRingWallOrder(courtyard, "A");
    const atC = installRingWallOrder(courtyard, "C");
    const innerIds = courtyard.walls.filter((w) => atA.get(w.id)?.ringIndex === 1).map((w) => w.id);
    expect(innerIds.length).toBeGreaterThan(0);
    for (const id of innerIds) {
      expect(atC.get(id)?.wallIndex, id).toBe(atA.get(id)?.wallIndex);
    }
    /* While the OUTER ring did move, which is what makes that a real check. */
    const outerId = courtyard.walls.find((w) => atA.get(w.id)?.ringIndex === 0)!.id;
    expect(atC.get(outerId)?.wallIndex).not.toBe(atA.get(outerId)?.wallIndex);
  });
});

describe("the octagon he asked about", () => {
  it("⚠ runs all eight facets clockwise from the PLA, with no facet skipped", () => {
    /* An octagon is the shape every one of 2026-11-16's findings came off, and
       its facets are the case where "clockwise" is doing visible work: four
       square walls and four diagonals alternating. */
    const octagon = buildOctagonFootprint(16, 16);
    expect(octagon.walls).toHaveLength(8);
    const order = installRingWallOrder(octagon, "A");
    expect(order.size).toBe(8);
    expect([...order.values()].map((p) => p.wallIndex).sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    /* And the eight facets come out in one clockwise sweep — the alternating
       square-and-diagonal order, not the four squares then the four
       diagonals, which is how the truss plates were coming out before the
       install sequence read their walls. */
    expect(walkOrder(octagon, "A")).toEqual(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  });
});
