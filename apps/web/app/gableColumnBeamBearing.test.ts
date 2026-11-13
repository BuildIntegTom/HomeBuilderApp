import { describe, expect, it } from "vitest";
import {
  GABLE_COLUMN_FLAT_TOP_DROP_IN,
  computeGableTiledRow,
  gableTileTallestHeightIn,
  tileWall,
  type GableWallJointSpan,
} from "@building-integrity/geometry";
import { COLUMN_TOTAL_WIDTH_IN, ROOF_CATCHER_BEAM_DEPTH_IN } from "@building-integrity/panel-catalog";
import { placeColumnUnderPeak } from "./gableColumnPlacement";

/**
 * ⚠ **B9 — THE BEAM BEARS ON THE COLUMN, and for a long time it did not.**
 *
 * > *"gable end column panels' tops should be flush/meet the bottom of the
 * > gable ridge beams. This means the column panel should be shorter, rather
 * > than having the beam run through the panel as it currently does. The beam
 * > should air on top the panel."* — Tommy
 *
 * Three numbers described one joint and two of them were wrong:
 *
 * | constant | value |
 * | --- | --- |
 * | `ROOF_CATCHER_BEAM_DEPTH_IN` (three 2x12s on edge) | **11.25** |
 * | `GABLE_COLUMN_FLAT_TOP_DROP_IN` (what the row used) | 12 |
 * | the UI's "beam depth offset" control (inert) | 11.25 |
 *
 * Nominal against actual — a 2x12 is 11.25in, not 12. Measured on a
 * 25ft 3in x 22ft 9in building at 4:12: peak 167.75in, beam underside
 * 156.50in, column top 155.75in. **The beam floated 0.75in above the panel
 * carrying it.** The drop is now the beam's own depth, passed by the caller,
 * so there is one number and it belongs to the beam.
 */

const STD = 48;
const CORNER = 25.5;
const EAVE_IN = 122.25;

/** The wall below, with its ridge column, as the row needs to see it. */
function wallSpans(wallLengthIn: number): GableWallJointSpan[] {
  const bare = tileWall(wallLengthIn, STD, CORNER, "end").slots;
  const placed =
    placeColumnUnderPeak({
      slots: bare,
      peakXIn: wallLengthIn / 2,
      startOffsetIn: 0,
      lengthIn: wallLengthIn,
      standardWidthIn: STD,
      cornerWidthIn: CORNER,
      gapEnd: "end",
      hasCornerStart: true,
      hasCornerEnd: true,
      allowBorrow: true,
      cornerMayWiden: true,
      columnWidthIn: COLUMN_TOTAL_WIDTH_IN,
    }) ?? bare;
  let atIn = 0;
  return placed.map((slot) => {
    const span = {
      xStartIn: atIn,
      xEndIn: atIn + slot.widthIn,
      isSafetyGap: slot.type === "safety-gap",
      isColumn: slot.type === "column",
    };
    atIn += slot.widthIn;
    return span;
  });
}

/** The row exactly as `page.tsx` builds it, beam depth and all. */
function columnTile(wallLengthIn: number, pitchIn12: number) {
  const peakIn = EAVE_IN + (wallLengthIn / 2) * (pitchIn12 / 12);
  const tiles = computeGableTiledRow(
    wallLengthIn,
    EAVE_IN,
    [{ xIn: wallLengthIn / 2, heightIn: peakIn }],
    STD,
    0,
    true,
    0,
    "panel-depth",
    [],
    COLUMN_TOTAL_WIDTH_IN,
    0,
    wallLengthIn,
    wallSpans(wallLengthIn),
    ROOF_CATCHER_BEAM_DEPTH_IN,
  );
  return { peakIn, tile: tiles.find((t) => t.isColumn) };
}

const WALLS_FT = [16, 18, 20, 22.75, 24, 25.25, 28, 30];

describe("⚠ the ridge beam bears on the column panel", () => {
  /* ⚠ **2026-11-13 — B9'S CONTENT SURVIVES, BUT "THE COLUMN'S TOP" MOVED.**
     This panel is now five-sided (Tommy: *"this Gable column panel would be
     five-sided"*), so its top is a RIDGE rather than a flat plane: the two
     edges follow the roofline and `apexHeightIn` carries the peak. Before,
     the whole top sat at ridge height, which is why this panel stood
     `(width / 2) x pitch/12` proud of both roof planes — 4.25in at 4:12.

     So the assertions below read the APEX where they used to read
     `leftHeightIn`. The joint being pinned is unchanged and still exact; what
     changed is which point on the panel is the one the beam meets.

     ⚠ **And "a beam cannot bear on a slope" is no longer the right objection
     to a sloped top**, because the beam stopped bearing on this panel's top
     at all. The 2026-11-12 Gable Peak Panel runs it THROUGH the panel inside
     a plywood furring box, bearing on the box floor (see
     `gablePeakSlotIn`) — which is also why `page.tsx` passes a drop of 0
     today and this file's `ROOF_CATCHER_BEAM_DEPTH_IN` drop exercises the
     contract rather than the live configuration. */
  it("⚠ the column's RIDGE is the beam's underside, to zero", () => {
    for (const wallFt of WALLS_FT) {
      const { peakIn, tile } = columnTile(wallFt * 12, 4);
      expect({ wallFt, hasTile: tile !== undefined }).toEqual({ wallFt, hasTile: true });

      const beamUndersideIn = peakIn - ROOF_CATCHER_BEAM_DEPTH_IN;
      expect({ wallFt, gapIn: +(beamUndersideIn - gableTileTallestHeightIn(tile!)).toFixed(6) }).toEqual({
        wallFt,
        gapIn: 0,
      });
      /* Symmetric about the ridge, and both edges BELOW it by the roof's own
         fall across half the panel — which is the whole point of the change.
         A tile still reporting two equal edges at ridge height would be the
         old block back. */
      expect({ wallFt, symmetric: +(tile!.leftHeightIn - tile!.rightHeightIn).toFixed(9) }).toEqual({
        wallFt,
        symmetric: 0,
      });
      const fallIn = (tile!.widthIn / 2) * (4 / 12);
      expect({ wallFt, edgeIn: +tile!.leftHeightIn.toFixed(6) }).toEqual({
        wallFt,
        edgeIn: +(beamUndersideIn - fallIn).toFixed(6),
      });
    }
  });

  it("⚠ holds at any pitch — the ridge never floats, however steep the roof", () => {
    for (const pitchIn12 of [2, 3, 4, 6, 8]) {
      const { peakIn, tile } = columnTile(273, pitchIn12);
      expect({
        pitchIn12,
        gapIn: +(peakIn - ROOF_CATCHER_BEAM_DEPTH_IN - gableTileTallestHeightIn(tile!)).toFixed(6),
      }).toEqual({ pitchIn12, gapIn: 0 });
      /* And the steeper it gets, the further the edges fall away from the
         ridge — the error the old flat top was making, now measured instead
         of made. */
      const fallIn = (tile!.widthIn / 2) * (pitchIn12 / 12);
      expect({ pitchIn12, edgeDropIn: +(gableTileTallestHeightIn(tile!) - tile!.leftHeightIn).toFixed(6) }).toEqual({
        pitchIn12,
        edgeDropIn: +fallIn.toFixed(6),
      });
    }
  });

  it("⚠ and the old constant really was 0.75in out — nominal against actual", () => {
    /* Pinned so the drift cannot come back quietly: a 2x12 is 11.25in deep,
       not the 12in its name says. If someone ever makes these equal again,
       this test is the place that explains why they are not. */
    expect(GABLE_COLUMN_FLAT_TOP_DROP_IN - ROOF_CATCHER_BEAM_DEPTH_IN).toBeCloseTo(0.75, 9);

    /* His 22ft 9in wall at 4:12, the exact numbers from the report — read at
       the ridge now, which is where the panel's top is. */
    const { peakIn, tile } = columnTile(273, 4);
    expect(peakIn).toBeCloseTo(167.75, 6);
    expect(gableTileTallestHeightIn(tile!)).toBeCloseTo(156.5, 6);
    /* And the edges, 4.25in lower — the material the flat top used to put
       above the roof plane on both sides. */
    expect(tile!.leftHeightIn).toBeCloseTo(152.25, 6);
    // What the nominal 12 would have given, and what floated above it.
    expect(peakIn - GABLE_COLUMN_FLAT_TOP_DROP_IN).toBeCloseTo(155.75, 6);
  });
});
