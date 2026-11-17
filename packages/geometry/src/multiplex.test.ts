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
import { tileInteriorWalls } from "./retile";
import { safetyGapWidthForRunIn, tileWall } from "./tiling";
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
  it("⚠ 36 ft is the OUTSIDE dimension — his answer — so a studio is 16'-0\u00be\", not 18 ft", () => {
    /* ⚠ **This test asserted 17'-4¼" until 2026-11-17, and the figure was
       wrong by a whole wall.** The old formula took out the CENTRE wall and
       stopped, so it measured from the building's outside face to that wall's
       near face with the exterior wall still inside the number. THREE wall
       thicknesses cross a Multiplex: two exterior and the centre.

       Nothing shipped was wrong — the function had no production caller, only
       this test — but it is exactly the kind of figure that ends up in a
       brochure, which is why it was exported at all. Found by
       `multiplexRoomWidthFt` returning 8'-0⅜" for a room that measures
       7'-4⅝". */
    const studioFt = multiplexStudioWidthFt(36, THICKNESS_IN);
    expect(studioFt * 12).toBeCloseTo(16 * 12 + 0.75, 6);
    /* Stated the long way round as well, so the three walls are visible in the
       test rather than hidden inside one expression. */
    expect(studioFt * 2 * 12 + 3 * THICKNESS_IN).toBeCloseTo(36 * 12, 6);
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

describe("⚠ the safety gap on an interior wall — his answer, 2026-11-17", () => {
  /* > "Center wall should get a safety gap, not necessarily both ends but a
     >  similar amount to the threshold we have for all other walls."

     ⚠ **This confirms what the code already did, and the previous note about it
     was wrong.** Stride 2 recorded an open building question on the grounds
     that a cornerless 401in run gets TWO gaps where the same run WITH corner
     panels gets ONE. Measured again: both get two. The claim was the defect,
     not the tiling. */

  it("⚠ gets gaps, at the SAME threshold width every other wall uses", () => {
    const slots = tileInteriorWalls(multiplex(), 48, "A")[MULTIPLEX_CENTRE_WALL_ID]!;
    const runIn = slots.reduce((sum, slot) => sum + slot.widthIn, 0);
    const gaps = slots.filter((slot) => slot.type === "safety-gap");
    expect(gaps.length).toBeGreaterThan(0);
    /* Not a literal 0.75: the THRESHOLD is what he asked for, so the width is
       asserted against the rule every wall in the app reads. */
    for (const gap of gaps) expect(gap.widthIn).toBe(safetyGapWidthForRunIn(runIn));
    expect(safetyGapWidthForRunIn(runIn)).toBe(0.75); // ...and on his 401in run that is 3/4in.
  });

  it("⚠ NOT one at each end — his \"not necessarily both ends\"", () => {
    const slots = tileInteriorWalls(multiplex(), 48, "A")[MULTIPLEX_CENTRE_WALL_ID]!;
    /* A gap is never the first or last slot on any wall: it is the
       second-to-last panel of the run, so there is a standard panel outboard
       of it. Both ends carrying one would show up here. */
    expect(slots[0]!.type).not.toBe("safety-gap");
    expect(slots[slots.length - 1]!.type).not.toBe("safety-gap");
  });

  it("⚠ the gap goes to the end FARTHER from the least-accessible corner", () => {
    /* ⚠ **This was the constant `"end"` until 2026-11-17**, which was the right
       answer on his 36x36 by coincidence: A is at (0,0) and the centre wall's
       far end is the high-y one. Moving the marker to D is the only way anyone
       would ever have noticed, so it is tested by moving it.

       ⚠ **Measured on a 26ft building, not his 36ft one, and that is the point
       of the fixture.** A 401in run gets TWO gaps and they land at index 1 AND
       index length-2, so on that wall both answers look identical. A 281in run
       gets exactly one and the end it chose is visible. */
    const short = buildMultiplexFootprint({ widthFt: 36, depthFt: 26, wallThicknessIn: THICKNESS_IN });
    const gapIndices = (leastAccessible: string) => {
      const slots = tileInteriorWalls(short, 48, leastAccessible)[MULTIPLEX_CENTRE_WALL_ID]!;
      return {
        count: slots.length,
        gaps: slots.flatMap((slot, i) => (slot.type === "safety-gap" ? [i] : [])),
      };
    };
    /* One gap, so there is one answer to read. */
    expect(gapIndices("A").gaps).toHaveLength(1);
    /* His "second-to-last panel on each run", counted from the chosen end. */
    const fromA = gapIndices("A");
    expect(fromA.gaps[0]).toBe(fromA.count - 2);
    expect(gapIndices("D").gaps).toEqual([1]);
  });

  it("⚠ gap COUNT and WIDTH are the run's own rule, swept 48in to 600in", () => {
    /* The interior run against an outline run of the SAME length, every half
       inch. Two things are asserted, and the second is the one that keeps this
       honest rather than circular. */
    const divergences: number[] = [];
    for (let runIn = 48; runIn <= 600; runIn += 0.5) {
      const interior = tileWall(runIn, 48, 48, "end", false, false, true, true).slots;
      const outline = tileWall(runIn, 48, 15.5, "end", true, true, true, true).slots;
      const gaps = interior.filter((slot) => slot.type === "safety-gap");
      /* 1. EVERY interior run gets at least one gap, at exactly the threshold
            width. No run is ever left without one. */
      expect(gaps.length, `${runIn}in`).toBeGreaterThan(0);
      for (const gap of gaps) expect(gap.widthIn, `${runIn}in`).toBe(safetyGapWidthForRunIn(runIn));
      if (gaps.length !== outline.filter((slot) => slot.type === "safety-gap").length) divergences.push(runIn);
    }
    /* 2. The count matches the same-length outline run EVERYWHERE except two
          measured bands — and both are the 24ft rule working as written,
          because a further gap lands on a joint the run already has and taking
          15.5in of corner out of each end moves every joint:

          - 48in to 55in: the OUTLINE run is too short to hold two corner
            panels and a legal middle, so `resolveCorners` merges them into one
            slot spanning the whole wall and there is no middle to put a gap
            in. The interior run is all middle and gets one. The interior wall
            is the one behaving normally here.
          - 385in to 400in: the second gap's eligible joints (20ft to 28ft from
            the first) differ by the 31in of corner. 401in, his own centre
            wall, is just past this band and both runs get two.

          Pinned as an exact list so widening either band shows up as a
          failure rather than as a quiet change in shop items. */
    const expectedBands = [
      ...Array.from({ length: 15 }, (_, i) => 48 + i * 0.5), // 48 .. 55
      ...Array.from({ length: 31 }, (_, i) => 385 + i * 0.5), // 385 .. 400
    ];
    expect(divergences).toEqual(expectedBands);
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
