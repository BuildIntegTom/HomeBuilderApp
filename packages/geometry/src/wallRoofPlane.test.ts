import { describe, expect, it } from "vitest";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { simpleRoofPlanes, shedTallWallId, type SimpleRoofOptions } from "./simpleRoofPlanes";
import { wallCompassDirection } from "./wallCompassDirection";
import { wallEndMitreFor, wallMitredEndsFor, wallRoofCrossRiseIn } from "./wallRoofPlane";
import type { Footprint } from "./types";

/**
 * ⚠ **A GABLE'S TOP IS A PLANE, AND ITS ENDS ARE MITRED.**
 *
 * > *"The octagon Gable pieces need to be cut like octagon corners. You're
 * > right, it is not flush for the roof at the top, can we make the top of
 * > Gable and dual beveled So that the roof can meet it?"* — Tommy,
 * > 2026-11-16
 *
 * The numbers below were measured on the live roof planes BEFORE any of this
 * was written, which is what makes them a pin rather than a restatement of
 * the code.
 */

const THICK_IN = 15.5;
const PITCH = 4;
const EAVE_FT = 8;
const SHED: SimpleRoofOptions = { form: "shed", pitchIn12: PITCH, eaveHeightFt: EAVE_FT };

function crossRisesByCompass(fp: Footprint, options: SimpleRoofOptions): Record<string, number> {
  const roof = simpleRoofPlanes(fp, options);
  const out: Record<string, number> = {};
  for (const wall of fp.walls) {
    const rise = wallRoofCrossRiseIn(fp, wall, roof, THICK_IN);
    const dir = wallCompassDirection(wall, fp);
    if (rise && dir) out[dir] = Number(rise.startIn.toFixed(3));
  }
  return out;
}

describe("⚠ a box is untouched — every wall's roofline is flat across its depth", () => {
  /* The safety property. A box's gable top is a plain rake today and is
     correct; nothing here may give it a cross bevel. */
  for (const [w, d] of [
    [40, 20],
    [20, 40],
    [24, 24],
  ] as const) {
    it(`${w} x ${d}, shed`, () => {
      const fp = buildRectangleFootprint(w, d);
      const roof = simpleRoofPlanes(fp, SHED);
      for (const wall of fp.walls) {
        const rise = wallRoofCrossRiseIn(fp, wall, roof, THICK_IN)!;
        expect(rise.planar, `${wall.id} should be planar`).toBe(true);
        /* ⚠ The walls that carry a gable row run straight down the fall and
           get exactly zero. The two EAVE walls run across it and so read the
           full pitch — correct, and harmless: a shed's tall wall is closed by
           the cross-tilt row (which is already bevelled this way) and its low
           wall carries no row at all. */
        const alongTheFall = Math.abs(rise.startIn) < 1e-9;
        const fullPitch = Math.abs(Math.abs(rise.startIn) - THICK_IN * (PITCH / 12)) < 1e-9;
        expect(alongTheFall || fullPitch, `${wall.id} read ${rise.startIn}`).toBe(true);
      }
    });
  }

  it("⚠ and a box's corners are never mitred, so no end pulls back", () => {
    const fp = buildRectangleFootprint(40, 20);
    for (const wall of fp.walls) {
      const ends = wallMitredEndsFor(fp, wall, THICK_IN);
      expect(ends.start.pullBackIn).toBe(0);
      expect(ends.end.pullBackIn).toBe(0);
      expect(ends.start.rakeDeg).toBe(0);
      expect(ends.end.rakeDeg).toBe(0);
    }
  });

  it("a peaked box's gable walls are flat across their depth too", () => {
    const fp = buildRectangleFootprint(40, 20);
    const roof = simpleRoofPlanes(fp, { form: "peaked", pitchIn12: PITCH, eaveHeightFt: EAVE_FT });
    for (const wallId of roof.gableWallIds) {
      const wall = fp.walls.find((w) => w.id === wallId)!;
      const rise = wallRoofCrossRiseIn(fp, wall, roof, THICK_IN)!;
      expect(rise.startIn).toBeCloseTo(0, 9);
      expect(rise.endIn).toBeCloseTo(0, 9);
    }
  });
});

describe("⚠ the 16ft Octagon shed — the dual bevel he asked for", () => {
  const fp = buildOctagonFootprint(16, 16);

  it("⚠ four of the eight facets need a cross bevel, and the two signs differ", () => {
    const byDir = crossRisesByCompass(fp, SHED);
    /* Measured. The diagonal facets run 45deg to the fall, so their cross
       rise is the full pitch times cos(45deg): 15.5 x (4/12) x 0.70711. */
    const diagonalIn = Number((THICK_IN * (PITCH / 12) * Math.SQRT1_2).toFixed(3));
    expect(diagonalIn).toBeCloseTo(3.653, 3);
    expect(byDir).toEqual({
      /* Runs across the fall: the full pitch. N is the shed's tall wall and S
         carries no row, but the geometry answers for every wall. */
      N: -Number((THICK_IN * (PITCH / 12)).toFixed(3)),
      S: Number((THICK_IN * (PITCH / 12)).toFixed(3)),
      /* ⚠ Runs straight down the fall: ZERO. These two are the only facets a
         box building ever exercises, which is why the fault hid. */
      E: 0,
      W: 0,
      /* ⚠ The uphill pair falls inward; the downhill pair rises inward. */
      NE: -diagonalIn,
      NW: -diagonalIn,
      SE: diagonalIn,
      SW: diagonalIn,
    });
  });

  it("⚠ every facet's cross rise is the same at both of its corners — one plane", () => {
    const roof = simpleRoofPlanes(fp, SHED);
    for (const wall of fp.walls) {
      const rise = wallRoofCrossRiseIn(fp, wall, roof, THICK_IN)!;
      expect(rise.planar, `${wall.id}`).toBe(true);
      expect(rise.startIn).toBeCloseTo(rise.endIn, 9);
    }
  });

  it("⚠ the six facets that carry a gable row, and which of them are already right", () => {
    const roof = simpleRoofPlanes(fp, SHED);
    const tallWallId = shedTallWallId(fp, SHED);
    const carrying = fp.walls.filter((w) => w.id !== tallWallId);
    const needBevel = carrying.filter((w) => Math.abs(wallRoofCrossRiseIn(fp, w, roof, THICK_IN)!.startIn) > 1e-9);
    /* S has no roof above it at all, so it builds no row; of the six that do,
       E and W are square across and the other four are not. */
    expect(needBevel.map((w) => wallCompassDirection(w, fp)).sort()).toEqual(["NE", "NW", "S", "SE", "SW"]);
  });

  it("⚠ every corner mitres 22 1/2deg, pulling the interior face back 6.420in", () => {
    for (const wall of fp.walls) {
      const ends = wallMitredEndsFor(fp, wall, THICK_IN);
      for (const [label, mitre] of [
        ["start", ends.start],
        ["end", ends.end],
      ] as const) {
        expect(mitre.rakeDeg, `${wall.id} ${label}`).toBeCloseTo(22.5, 6);
        expect(mitre.pullBackIn).toBeCloseTo(THICK_IN * Math.tan(Math.PI / 8), 9);
        expect(mitre.pullBackIn).toBeCloseTo(6.4203, 4);
        /* An octagon corner is convex, so the EXTERIOR face is the long one. */
        expect(mitre.interiorIsShort, `${wall.id} ${label}`).toBe(true);
      }
    }
  });

  it("the 32ft Octagon reads the same cross rise — it depends on the pitch, not the size", () => {
    expect(crossRisesByCompass(buildOctagonFootprint(32, 32), SHED)).toEqual(crossRisesByCompass(fp, SHED));
  });

  it("a steeper pitch bevels more, in proportion", () => {
    const at8 = crossRisesByCompass(fp, { ...SHED, pitchIn12: 8 });
    /* A ratio rather than a difference: the helper above rounds to
       thousandths, which is coarser than the proportion itself. */
    expect(at8.NE! / crossRisesByCompass(fp, SHED).NE!).toBeCloseTo(2, 3);
  });
});


describe("⚠ the two guards, on shapes no builder will make", () => {
  /* Both branches below are DEFENSIVE rather than load-bearing today, and the
     footprints are hand-built to say so out loud: `buildRectangleFootprint`
     clamps to 8ft and every octagon corner is convex, so nothing the draw
     tools can produce reaches either one. The draw-wall tool will. */

  function handBuilt(points: readonly [number, number][]): Footprint {
    const corners = points.map(([x, y], i) => ({ id: String(i), point: { x, y } }));
    const walls = corners.map((c, i) => {
      const next = corners[(i + 1) % corners.length]!;
      return {
        id: `${c.id}${next.id}`,
        startCorner: c.id,
        endCorner: next.id,
        lengthFt: Math.hypot(next.point.x - c.point.x, next.point.y - c.point.y),
      };
    });
    return { corners, walls };
  }

  it("⚠ planar = false where the RIDGE runs between a wall's two faces", () => {
    /* 40ft x 2.5ft: the ridge of a peak lands 15in in from each long wall,
       INSIDE a 15 1/2in wall's own depth. The top of that wall is a shallow
       hip, not a bevel. ⚠ And the trap it guards is that the two faces read
       the SAME height there (one each side of the ridge, equally far from
       it), so the cross rise comes out near zero and would read as "nothing
       to do" while the middle of the wall stands proud. */
    const fp = handBuilt([
      [0, 0],
      [40, 0],
      [40, 2.5],
      [0, 2.5],
    ]);
    const roof = simpleRoofPlanes(fp, { form: "peaked", pitchIn12: PITCH, eaveHeightFt: EAVE_FT });
    const long = fp.walls.find((w) => w.id === "01")!;
    const rise = wallRoofCrossRiseIn(fp, long, roof, THICK_IN)!;
    expect(rise.planar).toBe(false);
    expect(Math.abs(rise.startIn)).toBeLessThan(THICK_IN * (PITCH / 12));

    /* The same wall through a THINNER wall stays clear of the ridge and is a
       plain plane again — so the flag tracks the geometry, not the shape. */
    expect(wallRoofCrossRiseIn(fp, long, roof, 8)!.planar).toBe(true);
  });

  it("⚠ a REFLEX mitred corner puts the pull-back on the exterior face", () => {
    /* A chevron: a V notched up into the bottom edge, with its point off the
       right angle so the corner is genuinely mitred. */
    const fp = handBuilt([
      [0, 0],
      [40, 0],
      [40, 20],
      [20, 14],
      [0, 20],
    ]);
    const incoming = fp.walls.find((w) => w.id === "23")!;
    const atReflex = wallEndMitreFor(fp, incoming, "end", THICK_IN);
    expect(atReflex.rakeDeg).toBeGreaterThan(1);
    expect(atReflex.rakeDeg).toBeLessThan(45);
    expect(atReflex.interiorIsShort, "a reflex corner is long on the inside").toBe(false);
    expect(atReflex.pullBackIn).toBeCloseTo(THICK_IN * Math.tan((atReflex.rakeDeg * Math.PI) / 180), 9);

    /* And the two convex corners of the same shape answer the other way. */
    expect(wallEndMitreFor(fp, fp.walls.find((w) => w.id === "12")!, "end", THICK_IN).interiorIsShort).toBe(true);
  });
});
