import { describe, expect, it } from "vitest";
import {
  buildMultiplexFootprint,
  panelSlotBoxes3D,
  retile,
  ridgeBearingWallFor,
  tileInteriorWalls,
} from "@building-integrity/geometry";
import { SCALE_PX_PER_FT, computeInteriorSlotRects } from "./canvasGeometry";

/* ──────────────────────────────────────────────────────────────────────────
   B34 stride 5 — THE INTERIOR WALLS ARE DRAWN

   ⚠ Since stride 2 the Multiplex's centre and purlin walls have been tiled,
   counted, weighed, priced, install-numbered and given shop fabrication
   sheets — and drawn NOWHERE. The Review Log has been saying so out loud,
   because the Summary, the packet and the crew export all include a wall that
   no drawing shows.

   ⚠ The one thing both renderers have to get right, and the one a picture
   cannot check: **the thickness STRADDLES the stored line.** An outline
   wall's thickness hangs inward off the footprint polygon; an interior wall's
   is split either side of its own centreline. Get that wrong and the wall is
   half a thickness out of place — which `ridgeBearingWallFor` would then stop
   recognising, quietly costing the roof its bearing.
   ────────────────────────────────────────────────────────────────────────── */

const THICKNESS_IN = 15.5;
const STANDARD_IN = 48;
const WIDTH_FT = 36;
const DEPTH_FT = 36;

const multiplex = () =>
  buildMultiplexFootprint({ widthFt: WIDTH_FT, depthFt: DEPTH_FT, wallThicknessIn: THICKNESS_IN, roofBearingWalls: true });

const interiorSlots = (fp: ReturnType<typeof multiplex>) => tileInteriorWalls(fp, STANDARD_IN, "A");

describe("⚠ the 2D plan draws every interior wall", () => {
  const fp = multiplex();
  const slots = interiorSlots(fp);
  const wall = fp.interiorWalls!.find((w) => w.id === "CTR")!;
  const rects = computeInteriorSlotRects(wall, slots[wall.id]!, { x: 0, y: 0 }, (THICKNESS_IN / 12) * SCALE_PX_PER_FT);

  it("one rectangle per panel, and they sum to the wall's own length", () => {
    expect(rects).toHaveLength(slots[wall.id]!.length);
    const sumIn = rects.reduce((s, r) => s + (r.width / SCALE_PX_PER_FT) * 12, 0);
    /* 401in = 36ft less the two exterior walls' thicknesses — stride 2's own
       figure, re-measured here from the drawing rather than from the tiler. */
    expect(sumIn).toBeCloseTo(401, 6);
  });

  it("⚠ the band STRADDLES the centreline, which is what makes the two studios equal", () => {
    /* The anchor sits half a thickness off the stored line, so the band's
       middle is the line. Hanging it off one side would put the wall half a
       thickness out and make one studio 15½in bigger than the other. */
    const halfPx = ((THICKNESS_IN / 12) * SCALE_PX_PER_FT) / 2;
    for (const r of rects) {
      /* This wall runs along +y, so the band is offset in x alone. */
      expect(Math.abs(r.x - (wall.start.x * SCALE_PX_PER_FT + halfPx))).toBeLessThan(1e-9);
    }
  });

  it("⚠ and the OLD behaviour is what happens with no interior walls — nothing is drawn", () => {
    /* Every building that is not a Multiplex has to be untouched by this. */
    const plain = { ...fp, interiorWalls: undefined };
    expect(plain.interiorWalls).toBeUndefined();
    expect(computeInteriorSlotRects(wall, [], { x: 0, y: 0 }, 1)).toEqual([]);
  });

  it("runs the full clear span between the two exterior walls' inner faces", () => {
    const firstY = Math.min(...rects.map((r) => r.y));
    const lastEnd = Math.max(...rects.map((r) => r.y + r.width));
    expect(firstY / SCALE_PX_PER_FT).toBeCloseTo(THICKNESS_IN / 12, 6);
    expect(lastEnd / SCALE_PX_PER_FT).toBeCloseTo(DEPTH_FT - THICKNESS_IN / 12, 6);
  });
});

describe("⚠ the 3D view draws them in the SAME place the plan does", () => {
  const fp = multiplex();
  const slots = {
    ...retile(fp, "A", new Set(["A", "B", "C", "D"]), STANDARD_IN, THICKNESS_IN, THICKNESS_IN),
    ...interiorSlots(fp),
  };
  const boxes = panelSlotBoxes3D(fp, slots, THICKNESS_IN, 10, new Set(["A", "B", "C", "D"]));

  it("every interior wall gets its boxes", () => {
    for (const wall of fp.interiorWalls!) {
      expect({ id: wall.id, n: boxes.filter((b) => b.wallId === wall.id).length }).toEqual({
        id: wall.id,
        n: slots[wall.id]!.length,
      });
    }
  });

  it("⚠ the centre wall's boxes straddle the midline, so the roof keeps its bearing", () => {
    /* The failure this guards: a box hung off one side sits half a thickness
       from the line, and `ridgeBearingWallFor` tests the wall against the
       building's midline. The MODEL would still be right and only the picture
       wrong — which is the harder kind to notice, so it is pinned here. */
    const wall = fp.interiorWalls!.find((w) => w.id === "CTR")!;
    const halfFt = THICKNESS_IN / 12 / 2;
    for (const b of boxes.filter((x) => x.wallId === "CTR")) {
      expect(Math.abs(b.anchorX - (wall.start.x + halfFt))).toBeLessThan(1e-9);
    }
    /* And the wall it is drawn for is still the one carrying the ridge. */
    expect(ridgeBearingWallFor(fp)).toEqual({ wallId: "CTR", axis: "y" });
  });

  it("⚠ the 2D and 3D placements AGREE, panel for panel", () => {
    /* Two renderers is how a plan and a model come to disagree about where a
       wall is. One assertion rather than two pictures. */
    const pxPerFt = SCALE_PX_PER_FT;
    for (const wall of fp.interiorWalls!) {
      const rects = computeInteriorSlotRects(wall, slots[wall.id]!, { x: 0, y: 0 }, (THICKNESS_IN / 12) * pxPerFt);
      const mine = boxes.filter((b) => b.wallId === wall.id);
      expect(mine).toHaveLength(rects.length);
      for (let i = 0; i < rects.length; i++) {
        /* ⚠ A tolerance, not equality: the 2D path multiplies into pixels and
           divides back out, so the two agree to about the 15th decimal rather
           than bit for bit. A millionth of a foot is 1/83000 of an inch. */
        expect(rects[i]!.x / pxPerFt, `${wall.id} panel ${i} x`).toBeCloseTo(mine[i]!.anchorX, 9);
        expect(rects[i]!.y / pxPerFt, `${wall.id} panel ${i} z`).toBeCloseTo(mine[i]!.anchorZ, 9);
      }
    }
  });

  it("the outline's own boxes are untouched by any of this", () => {
    const withoutInterior = panelSlotBoxes3D(
      { ...fp, interiorWalls: undefined },
      slots,
      THICKNESS_IN,
      10,
      new Set(["A", "B", "C", "D"]),
    );
    const outlineIds = new Set(fp.walls.map((w) => w.id));
    expect(boxes.filter((b) => outlineIds.has(b.wallId))).toEqual(withoutInterior);
  });
});
