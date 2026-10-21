import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { insertBumpOut } from "./bumpOut";
import { isMiteredShape } from "./retile";
import {
  cornerRakeDeg,
  miteredCornerIds,
  wallEndIsMitered,
  wallTouchesMiteredCorner,
} from "./miteredCorners";
import type { Footprint } from "./types";

const allCorners = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));
const bump = (fp: Footprint, wallId: string) =>
  insertBumpOut(fp, wallId, 8, 16, 6, allCorners(fp)).footprint;

/** Every shape the app can draw today. */
function everyDrawableShape(): { name: string; fp: Footprint }[] {
  const rect = buildRectangleFootprint(40, 24);
  return [
    { name: "rectangle 40x24", fp: rect },
    { name: "rectangle 30x30", fp: buildRectangleFootprint(30, 30) },
    { name: "octagon 40x24", fp: buildOctagonFootprint(40, 24) },
    { name: "octagon 30x30", fp: buildOctagonFootprint(30, 30) },
    { name: "rectangle + bump-out", fp: bump(rect, "AB") },
    { name: "rectangle + two bump-outs", fp: bump(bump(rect, "AB"), "CD") },
  ];
}

describe("⚠ no behaviour changes today, and that is the point", () => {
  it("per-corner agrees with the shape-wide flag on EVERY shape the app can draw", () => {
    /* The whole reason this can land on its own: a rectangle and a bump-out
       are uniformly square, an octagon is uniformly mitered, so asking per
       corner gives the same answer as asking per building. The difference only
       appears for shapes the draw-wall tool will make possible.

       ⚠ Swept rather than spot-checked, because "they agree" is the ONLY
       thing protecting the call sites during the conversion. */
    for (const { name, fp } of everyDrawableShape()) {
      const shapeWide = isMiteredShape(fp);
      for (const wall of fp.walls) {
        for (const end of ["start", "end"] as const) {
          expect({ name, wall: wall.id, end, mitered: wallEndIsMitered(fp, wall, end) }).toEqual({
            name,
            wall: wall.id,
            end,
            mitered: shapeWide,
          });
        }
      }
    }
  });

  it("so does the 'touching' question", () => {
    for (const { name, fp } of everyDrawableShape()) {
      const shapeWide = isMiteredShape(fp);
      for (const wall of fp.walls) {
        expect({ name, wall: wall.id, touches: wallTouchesMiteredCorner(fp, wall) }).toEqual({
          name,
          wall: wall.id,
          touches: shapeWide,
        });
      }
    }
  });

  it("an octagon has eight mitered corners and a rectangle none", () => {
    expect(miteredCornerIds(buildOctagonFootprint(30, 30)).size).toBe(8);
    expect(miteredCornerIds(buildRectangleFootprint(30, 20)).size).toBe(0);
    expect(miteredCornerIds(bump(buildRectangleFootprint(40, 24), "AB")).size).toBe(0);
  });
});

describe("⚠ the mixed wall — the case the whole change exists for", () => {
  /** A rectangle with one corner cut off: a five-sided shape with two mitered
   * corners and three square ones. The draw-wall tool will produce exactly
   * this, and NOTHING the app can draw today does. */
  function rectangleWithOneCornerCut(): Footprint {
    const corners = [
      { id: "A", point: { x: 0, y: 0 } },
      { id: "B", point: { x: 30, y: 0 } },
      { id: "C", point: { x: 30, y: 20 } },
      { id: "D", point: { x: 10, y: 20 } },
      { id: "E", point: { x: 0, y: 10 } },
    ];
    const ids = corners.map((c) => c.id);
    const walls = ids.map((id, i) => {
      const next = ids[(i + 1) % ids.length]!;
      const a = corners[i]!.point;
      const b = corners.find((c) => c.id === next)!.point;
      return {
        id: `${id}${next}`,
        startCorner: id,
        endCorner: next,
        lengthFt: Math.hypot(b.x - a.x, b.y - a.y),
      };
    });
    return { corners, walls };
  }

  it("the shape-wide flag calls the WHOLE building mitered — three square corners included", () => {
    /* This is the bug, stated as a test. `isMiteredShape` is true, so every
       one of these five walls would get the octagon conventions, including the
       three corners that are plain 90-degree turns. */
    const fp = rectangleWithOneCornerCut();
    expect(isMiteredShape(fp)).toBe(true);
  });

  it("per corner, exactly two are mitered and the rest are square", () => {
    const fp = rectangleWithOneCornerCut();
    expect([...miteredCornerIds(fp)].sort()).toEqual(["D", "E"]);
  });

  it("a wall can have one mitered end and one square end", () => {
    const fp = rectangleWithOneCornerCut();
    const cd = fp.walls.find((w) => w.id === "CD")!;
    expect(wallEndIsMitered(fp, cd, "start")).toBe(false); // corner C is square
    expect(wallEndIsMitered(fp, cd, "end")).toBe(true); // corner D is cut
    expect(wallTouchesMiteredCorner(fp, cd)).toBe(true);
  });

  it("and a wall can touch no mitered corner at all on the same building", () => {
    const fp = rectangleWithOneCornerCut();
    const ab = fp.walls.find((w) => w.id === "AB")!;
    expect(wallTouchesMiteredCorner(fp, ab)).toBe(false);
  });
});

describe("the rake angle, which generalises a number he already approved", () => {
  it("⚠ an octagon's mitered end is 22.5° off square — his own cut note", () => {
    /* Tommy approved "22 1/2 degrees off square" for the octagon's mitered
       panels on 2026-10-13. An octagon turns 45° at each clipped corner and
       the two walls split it, so 22.5 was never an octagon constant — it is
       half the turn, evaluated at the only angle the app could draw. */
    const fp = buildOctagonFootprint(30, 30);
    for (const wall of fp.walls) {
      for (const end of ["start", "end"] as const) {
        expect(cornerRakeDeg(fp, wall, end)).toBeCloseTo(22.5, 6);
      }
    }
  });

  it("a square corner rakes nothing — one wall runs through", () => {
    const fp = buildRectangleFootprint(30, 20);
    for (const wall of fp.walls) {
      expect(cornerRakeDeg(fp, wall, "end")).toBe(0);
    }
  });

  it("any other angle gets its own number from the same rule", () => {
    const fp: Footprint = {
      corners: [
        { id: "A", point: { x: 0, y: 0 } },
        { id: "B", point: { x: 30, y: 0 } },
        { id: "C", point: { x: 30, y: 20 } },
        { id: "D", point: { x: 0, y: 20 } },
      ],
      walls: [
        { id: "AB", startCorner: "A", endCorner: "B", lengthFt: 30 },
        // A 30° turn rather than 90°, so each end face rakes 15°.
        { id: "BC", startCorner: "B", endCorner: "C", lengthFt: 20 },
        { id: "CD", startCorner: "C", endCorner: "D", lengthFt: 30 },
        { id: "DA", startCorner: "D", endCorner: "A", lengthFt: 20 },
      ],
    };
    // Move C so BC leaves B at 30° off AB's direction.
    const rad = (30 * Math.PI) / 180;
    fp.corners[2]!.point = { x: 30 + 20 * Math.cos(rad), y: 20 * Math.sin(rad) };
    const bc = fp.walls.find((w) => w.id === "BC")!;
    expect(cornerRakeDeg(fp, bc, "start")).toBeCloseTo(15, 6);
  });
});
