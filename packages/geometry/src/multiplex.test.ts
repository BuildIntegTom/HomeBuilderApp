import { describe, expect, it } from "vitest";
import {
  MULTIPLEX_CENTRE_WALL_ID,
  buildMultiplexFootprint,
  multiplexStudioWidthFt,
} from "./multiplex";
import { buildRectangleFootprint } from "./footprint";
import { buildOctagonFootprint } from "./octagon";
import { quantizeFootprint } from "./eighths";
import { footprintLoops, isCourtyardFootprint } from "./footprintLoops";
import { collapseNearZeroWalls, dragWall } from "./dragWall";
import { editWallLength } from "./editWallLength";
import { installRingWallOrder } from "./installRingOrder";
import { wallCompassDirection } from "./wallCompassDirection";
import type { Footprint } from "./types";

/* ──────────────────────────────────────────────────────────────────────────
   B34 STRIDE 1 — A WALL CAN BE INTERIOR

   > "a 36x36' square with a straw wall running down the center and acting as
   >  the ridge beam ... two rectngle studio apartments"  — Tommy, 2026-11-16

   ⚠ The two things these tests exist to protect:

   1. **Every existing building is byte-identical.** `interiorWalls` is
      optional and absent, so no saved project means anything new.
   2. **The centre wall survives every transform.** Eight places in this
      codebase rebuild a footprint from `{ corners, walls }`; before B34 that
      was harmless. Now a dropped field is two deleted studio apartments.
   ────────────────────────────────────────────────────────────────────────── */

const THICKNESS_IN = 15.5;
const multiplex = () => buildMultiplexFootprint({ widthFt: 36, depthFt: 36, wallThicknessIn: THICKNESS_IN });

describe("⚠ every existing building is untouched", () => {
  it("a rectangle and an octagon carry no `interiorWalls` key at all", () => {
    /* Absent, not empty: an empty array would change what every saved project
       deep-equals, and `undefined` is what they have always had. */
    for (const fp of [buildRectangleFootprint(30, 20), buildOctagonFootprint(16, 16)]) {
      expect(fp.interiorWalls).toBeUndefined();
      expect(Object.keys(fp).sort()).toEqual(["corners", "walls"]);
    }
  });

  it("⚠ the quantizer returns a footprint with no interior walls byte-identical", () => {
    const rect = buildRectangleFootprint(30, 20);
    expect(quantizeFootprint(rect)).toEqual(rect);
    expect(Object.keys(quantizeFootprint(rect)).sort()).toEqual(["corners", "walls"]);
  });
});

describe("the 36x36 he asked for", () => {
  it("⚠ 36 ft is the OUTSIDE dimension — his answer — so a studio is 17'-4¼\", not 18 ft", () => {
    /* The question was worth asking before anything was drawn: each studio is
       the half-width LESS half the wall, and a brochure that says 18 ft is
       wrong by 7¾in per room. */
    const studioFt = multiplexStudioWidthFt(36, THICKNESS_IN);
    expect(studioFt).toBeCloseTo(36 / 2 - THICKNESS_IN / 24, 9);
    expect(studioFt * 12).toBeCloseTo(17 * 12 + 4.25, 6);
    /* And the OUTLINE really is 36 ft on every side. */
    const fp = multiplex();
    for (const wall of fp.walls) expect(wall.lengthFt).toBeCloseTo(36, 9);
  });

  it("⚠ the centre wall runs N–S — his answer — so the ridge will too", () => {
    const fp = multiplex();
    const centre = fp.interiorWalls![0]!;
    expect(centre.start.x).toBeCloseTo(centre.end.x, 9);
    expect(centre.start.x).toBeCloseTo(18, 9);
    expect(centre.start.y).not.toBeCloseTo(centre.end.y, 3);
  });

  it("⚠ its ends BUTT the inside faces, square — so the N and S walls do not re-tile", () => {
    /* His call over corner panels (which would have re-tiled every panel in
       both of those walls) and over a safety gap at each end (which would
       have put a framed void exactly where the ridge load lands). */
    const fp = multiplex();
    const centre = fp.interiorWalls![0]!;
    expect(centre.start.y).toBeCloseTo(THICKNESS_IN / 12, 9);
    expect(centre.end.y).toBeCloseTo(36 - THICKNESS_IN / 12, 9);
    /* Its length is the CLEAR span, not the building's depth. */
    expect(centre.lengthFt).toBeCloseTo(36 - (2 * THICKNESS_IN) / 12, 6);
    expect(centre.lengthFt).toBeLessThan(36);
  });
});

describe("⚠ the outline geometry walks straight past it", () => {
  const fp = multiplex();

  it("it is ONE loop — a dividing wall does not make a courtyard", () => {
    /* If the centre wall were in `walls`, the loop walk would break: a
       T-junction means a corner with two walls leaving it, and the walk is a
       map from corner to wall. */
    expect(footprintLoops(fp)).toHaveLength(1);
    expect(isCourtyardFootprint(fp)).toBe(false);
  });

  it("the loop is the plain four-sided outline", () => {
    expect(footprintLoops(fp)[0]!.walls).toHaveLength(4);
    expect(fp.walls.map((w) => wallCompassDirection(w, fp))).toEqual(["N", "E", "S", "W"]);
  });

  it("⚠ B35 numbers it LAST — 'out to in', and a dividing wall is innermost", () => {
    /* ⚠ **This test asserted the opposite for an hour, and the change is the
       point.** When the centre wall first existed there was no answer to
       where it belonged in the install order, so the honest assertion was
       that nothing placed it. Shipping that is what produced the defect: with
       no ring it scored 0 on every positional field and its `C1`-`C11` came
       out INTERLEAVED with the north wall's — 0022, 0035, 0037, 0040 — which
       would have sent a crew back and forth across the building.

       His own clause answers it: a dividing wall is inside every ring. */
    const order = installRingWallOrder(fp, "A");
    expect(order.size).toBe(5);
    const centre = order.get(MULTIPLEX_CENTRE_WALL_ID)!;
    expect(centre).toBeDefined();
    /* Past the one ring the outline has, so every outline panel numbers
       first. */
    for (const wall of fp.walls) {
      expect(order.get(wall.id)!.ringIndex, wall.id).toBeLessThan(centre.ringIndex);
    }
  });
});

describe("⚠ the centre wall survives the transforms that rebuild a footprint", () => {
  /* Eight places rebuild a footprint from `{ corners, walls }`. Each one that
     has a source footprint now spreads it, so carrying is the default and
     dropping takes deliberate effort. A miss here is two deleted apartments
     and a silent one. */
  const centreOf = (fp: Footprint) => fp.interiorWalls?.find((w) => w.id === MULTIPLEX_CENTRE_WALL_ID);

  it("survives a quantize, and is re-measured like any other wall", () => {
    const fp = quantizeFootprint(multiplex());
    expect(centreOf(fp)?.lengthFt).toBeCloseTo(36 - (2 * THICKNESS_IN) / 12, 6);
  });

  it("⚠ is SNAPPED to the eighth and re-measured — not merely carried along", () => {
    /* ⚠ **This test exists because a mutation survived without it.** Deleting
       the quantizer's interior-wall branch changed nothing any other test
       could see: the `...footprint` spread still carried the walls through,
       just unsnapped. "Present" and "quantized" are different claims.

       It matters for his dimensional-tightness rule — every wall length an
       exact eighth is the precondition for a row of panels summing exactly to
       its wall. An off-grid centre wall is a row that cannot close. */
    const offGrid: Footprint = {
      ...buildRectangleFootprint(36, 36),
      interiorWalls: [
        { id: "CTR", start: { x: 18.0001, y: 1.29297 }, end: { x: 18.0001, y: 34.70703 }, lengthFt: 999 },
      ],
    };
    const centre = centreOf(quantizeFootprint(offGrid))!;
    /* On the 1/8in grid: a foot is 96 eighths, so every coordinate times 96
       lands on a whole number. */
    for (const v of [centre.start.x, centre.start.y, centre.end.x, centre.end.y]) {
      expect(Math.abs(v * 96 - Math.round(v * 96)), String(v)).toBeLessThan(1e-9);
    }
    /* And the bogus 999 is replaced by the real distance between the snapped
       points, rather than trusted. */
    expect(centre.lengthFt).toBeCloseTo(centre.end.y - centre.start.y, 9);
    expect(centre.lengthFt).toBeLessThan(36);
  });

  it("survives dragging an outline wall", () => {
    const fp = multiplex();
    expect(centreOf(dragWall(fp, "AB", -4))).toBeDefined();
  });

  it("⚠ survives the collapse pass, which RENUMBERS every corner", () => {
    /* ⚠ **This one has to force a real collapse to mean anything.** The first
       version ran it on a plain Multiplex, which has no short wall, so it
       returned early and the test proved nothing — measured, `corners` came
       back by reference.

       `collapseNearZeroWalls` deletes a corner and renumbers the rest to
       `0,1,2,...`, which is the transform most likely to lose a wall keyed on
       the old ids. An interior wall carries POINTS, so a renumber cannot
       touch it — and this is what proves that rather than assuming it. */
    const fp = multiplex();
    const withSliver: Footprint = {
      ...fp,
      /* Inserted right AFTER B, so the B->SLIVER wall is the near-zero one.
         Appended to the end it would have made two long walls instead and the
         pass would have returned early again. */
      corners: [
        fp.corners[0]!,
        fp.corners[1]!,
        { id: "SLIVER", point: { x: 36, y: 0.001 } },
        fp.corners[2]!,
        fp.corners[3]!,
      ],
    };
    const result = collapseNearZeroWalls(withSliver, new Set(withSliver.corners.map((c) => c.id)));
    /* It really did renumber — otherwise this is the early return again. */
    expect(result.footprint.corners.map((c) => c.id)).toEqual(["0", "1", "2", "3"]);
    expect(centreOf(result.footprint)).toBeDefined();
    expect(centreOf(result.footprint)!.start.x).toBeCloseTo(18, 6);
  });

  it("survives editing an outline wall's length", () => {
    const fp = multiplex();
    expect(centreOf(editWallLength(fp, "AB", 40))).toBeDefined();
  });
});
