import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { insertBumpOut } from "./bumpOut";
import { computeFootprintAreaSqFt } from "./footprintArea";
import {
  centreFootprintOn,
  footprintBoundingBox,
  footprintCentre,
  isOffsetRefusal,
  offsetFootprintInward,
  offsetRefusalMessage,
  translateFootprint,
} from "./offsetFootprint";
import type { Footprint } from "./types";

const allCorners = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));
const inset = (fp: Footprint, ft: number) => {
  const out = offsetFootprintInward(fp, ft);
  if (isOffsetRefusal(out)) throw new Error(`refused: ${out.reason}`);
  return out;
};
/** Within an eighth of an inch, in feet. */
const EIGHTH_FT = 1 / 8 / 12;
const near = (a: number, b: number) => Math.abs(a - b) < EIGHTH_FT;

describe("⚠ insetting is not scaling, and that is the whole point", () => {
  it("every wall moves inward by exactly the inset, not by a proportion", () => {
    /* A courtyard is specified by the GAP between the loops. Scaling would
       change that gap on every side of an elongated building; offsetting keeps
       it constant all the way round, which is what the number means. */
    const fp = buildRectangleFootprint(40, 20);
    const inner = inset(fp, 5);
    const outer = footprintBoundingBox(fp);
    const box = footprintBoundingBox(inner);
    expect(near(box.minX - outer.minX, 5)).toBe(true);
    expect(near(outer.maxX - box.maxX, 5)).toBe(true);
    expect(near(box.minY - outer.minY, 5)).toBe(true);
    expect(near(outer.maxY - box.maxY, 5)).toBe(true);
  });

  it("⚠ a SCALED rectangle would not do this, which is why the test above matters", () => {
    // Scaling 40x20 to the same inner area would move the long walls further
    // than the short ones. Stated so the distinction is not just prose.
    const fp = buildRectangleFootprint(40, 20);
    const inner = inset(fp, 5);
    const box = footprintBoundingBox(inner);
    expect(near(box.maxX - box.minX, 30)).toBe(true); // 40 - 2*5
    expect(near(box.maxY - box.minY, 10)).toBe(true); // 20 - 2*5
    // A uniform scale that took 20 to 10 would have taken 40 to 20, not 30.
    expect(near(box.maxX - box.minX, 20)).toBe(false);
  });

  it("an octagon insets to an octagon, with all eight walls still there", () => {
    const fp = buildOctagonFootprint(40, 40);
    const inner = inset(fp, 6);
    expect(inner.walls).toHaveLength(8);
    expect(inner.corners).toHaveLength(8);
    expect(computeFootprintAreaSqFt(inner)).toBeLessThan(computeFootprintAreaSqFt(fp));
  });

  it("⚠ works on a SQUARE and a rectangle too — his own requirement", () => {
    /* Tommy, 2026-10-21: "This should also be compatible with concentric
       Square/ rectangle buildings." Nothing in here knows how many sides a
       shape has. */
    for (const fp of [buildRectangleFootprint(30, 30), buildRectangleFootprint(50, 18)]) {
      const inner = inset(fp, 4);
      expect(inner.walls).toHaveLength(fp.walls.length);
      expect(computeFootprintAreaSqFt(inner)).toBeGreaterThan(0);
    }
  });

  it("keeps the ids, so a caller shrinking a shape keeps its panels keyed", () => {
    const fp = buildRectangleFootprint(40, 20);
    const inner = inset(fp, 3);
    expect(inner.walls.map((w) => w.id)).toEqual(fp.walls.map((w) => w.id));
    expect(inner.corners.map((c) => c.id)).toEqual(fp.corners.map((c) => c.id));
  });

  it("the inset ring is still closed, and its wall lengths match its corners", () => {
    const fp = buildOctagonFootprint(40, 30);
    const inner = inset(fp, 5);
    const byId = new Map(inner.corners.map((c) => [c.id, c.point]));
    for (const wall of inner.walls) {
      expect(inner.walls.find((w) => w.startCorner === wall.endCorner)).toBeDefined();
      const a = byId.get(wall.startCorner)!;
      const b = byId.get(wall.endCorner)!;
      expect(near(Math.hypot(b.x - a.x, b.y - a.y), wall.lengthFt)).toBe(true);
    }
  });
});

describe("⚠ what an inset refuses, rather than producing a shape nobody drew", () => {
  const refusal = (fp: Footprint, ft: number) => {
    const out = offsetFootprintInward(fp, ft);
    if (!isOffsetRefusal(out)) throw new Error("expected a refusal");
    return out;
  };

  it("an inset at least half the short side leaves nothing", () => {
    const fp = buildRectangleFootprint(40, 20);
    expect(refusal(fp, 10).reason).toBe("collapsed");
    expect(refusal(fp, 25).reason).toBe("collapsed");
  });

  it("⚠ a DOUBLE inversion keeps the winding, and only a per-edge check catches it", () => {
    /* This is the case that caught me. Inset a 40ft x 20ft rectangle by 25ft
       and it turns inside out on BOTH axes: 40 becomes -10, 20 becomes -30,
       and a twice-flipped rectangle winds the SAME way as the original with a
       perfectly positive area of 300. The winding check sees nothing, the area
       check sees nothing, and the boundary does not cross itself.

       What does see it is comparing each new edge's direction against the edge
       it came from: a flipped edge points the other way, and one inversion or
       two, every flipped edge reverses. The three checks I wrote first all
       missed this; the test is what found it. */
    const fp = buildRectangleFootprint(40, 20);
    const bad = offsetFootprintInward(fp, 25);
    expect(isOffsetRefusal(bad)).toBe(true);
    // Swept, because the band where both axes have flipped is a range, not a point.
    for (let ft = 10; ft <= 40; ft += 0.5) {
      expect({ ft, refused: isOffsetRefusal(offsetFootprintInward(fp, ft)) }).toEqual({ ft, refused: true });
    }
  });

  it("⚠ the shape turns INSIDE OUT before it vanishes, and the winding check is what catches that", () => {
    /* Offsetting past the middle does not produce an empty polygon — it
       produces one wound the other way, with a positive area and a perfectly
       plausible-looking outline. Area alone would accept it. */
    const fp = buildRectangleFootprint(40, 20);
    const out = offsetFootprintInward(fp, 11);
    expect(isOffsetRefusal(out)).toBe(true);
  });

  it("zero and negative insets are refused rather than silently doing nothing", () => {
    const fp = buildRectangleFootprint(40, 20);
    expect(refusal(fp, 0).reason).toBe("collapsed");
    expect(refusal(fp, -5).reason).toBe("collapsed");
  });

  it("⚠ a bump-out's notch is eaten before the building is, and that is its own refusal", () => {
    /* A reflex corner makes the offset boundary cross itself while there is
       still plenty of building left. Found by sweeping insets rather than by
       picking one, because which inset first breaks it depends on the notch. */
    const base = buildRectangleFootprint(40, 24);
    const fp = insertBumpOut(base, "AB", 10, 20, 8, allCorners(base)).footprint;
    const reasons = new Set<string>();
    for (let ft = 1; ft <= 11; ft += 0.5) {
      const out = offsetFootprintInward(fp, ft);
      if (isOffsetRefusal(out)) reasons.add(out.reason);
    }
    expect(reasons.has("self-intersects") || reasons.has("collapsed")).toBe(true);
  });

  it("every refusal has a sentence a person can act on", () => {
    const fp = buildRectangleFootprint(40, 20);
    for (const ft of [0, 10, 25]) {
      const message = offsetRefusalMessage(refusal(fp, ft), ft);
      expect(message.length).toBeGreaterThan(20);
      expect(message).toMatch(/[.!]$/);
    }
  });

  it("⚠ no inset on any drawable shape ever returns a shape that is not closed", () => {
    /* The sweep: whatever is typed, the answer is a named refusal or a valid
       closed ring. There is no third outcome for a caller to defend against. */
    const base = buildRectangleFootprint(40, 24);
    for (const fp of [
      buildRectangleFootprint(40, 20),
      buildRectangleFootprint(30, 30),
      buildOctagonFootprint(40, 24),
      buildOctagonFootprint(30, 30),
      insertBumpOut(base, "AB", 10, 20, 8, allCorners(base)).footprint,
    ]) {
      for (let ft = 0.5; ft <= 20; ft += 0.5) {
        const out = offsetFootprintInward(fp, ft);
        if (isOffsetRefusal(out)) continue;
        expect(out.walls.length).toBe(fp.walls.length);
        expect(computeFootprintAreaSqFt(out)).toBeGreaterThan(0);
        for (const wall of out.walls) {
          expect(out.walls.find((w) => w.startCorner === wall.endCorner)).toBeDefined();
        }
      }
    }
  });
});

describe("moving and centring", () => {
  it("translating moves every corner and changes no wall length", () => {
    const fp = buildOctagonFootprint(30, 30);
    const moved = translateFootprint(fp, 12, -5);
    for (const wall of moved.walls) {
      expect(near(wall.lengthFt, fp.walls.find((w) => w.id === wall.id)!.lengthFt)).toBe(true);
    }
    expect(near(footprintCentre(moved).x - footprintCentre(fp).x, 12)).toBe(true);
    expect(near(footprintCentre(moved).y - footprintCentre(fp).y, -5)).toBe(true);
  });

  it("centring puts one shape's middle exactly on a point", () => {
    const fp = buildRectangleFootprint(40, 20);
    const centred = centreFootprintOn(fp, { x: 100, y: 50 });
    const c = footprintCentre(centred);
    expect(near(c.x, 100)).toBe(true);
    expect(near(c.y, 50)).toBe(true);
  });

  it("⚠ an INSET shape is already concentric — centring it is a no-op", () => {
    /* The property that makes a ring work: offsetting moves every edge inward
       by the same amount, so the inner loop shares the outer's centre without
       anyone having to align it. If this ever fails, the Centre button stops
       being a convenience and becomes a requirement. */
    for (const fp of [buildRectangleFootprint(40, 20), buildOctagonFootprint(36, 36), buildRectangleFootprint(30, 30)]) {
      const inner = inset(fp, 5);
      const a = footprintCentre(fp);
      const b = footprintCentre(inner);
      expect({ dx: near(a.x, b.x), dy: near(a.y, b.y) }).toEqual({ dx: true, dy: true });
    }
  });

  it("the bounding box is the box, on a shape whose centroid is elsewhere", () => {
    // A triangle: its area-centroid sits a third of the way up, the box's
    // centre halfway. The Centre button uses the box, deliberately.
    const fp: Footprint = {
      corners: [
        { id: "0", point: { x: 0, y: 0 } },
        { id: "1", point: { x: 30, y: 0 } },
        { id: "2", point: { x: 0, y: 30 } },
      ],
      walls: [
        { id: "01", startCorner: "0", endCorner: "1", lengthFt: 30 },
        { id: "12", startCorner: "1", endCorner: "2", lengthFt: Math.hypot(30, 30) },
        { id: "20", startCorner: "2", endCorner: "0", lengthFt: 30 },
      ],
    };
    expect(footprintCentre(fp)).toEqual({ x: 15, y: 15 });
  });
});
