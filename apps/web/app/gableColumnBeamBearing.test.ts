import { describe, expect, it } from "vitest";
import {
  GABLE_COLUMN_FLAT_TOP_DROP_IN,
  computeGableTiledRow,
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
  it("⚠ the column's top IS the beam's underside, to zero", () => {
    for (const wallFt of WALLS_FT) {
      const { peakIn, tile } = columnTile(wallFt * 12, 4);
      expect({ wallFt, hasTile: tile !== undefined }).toEqual({ wallFt, hasTile: true });

      const beamUndersideIn = peakIn - ROOF_CATCHER_BEAM_DEPTH_IN;
      expect({ wallFt, gapIn: +(beamUndersideIn - tile!.leftHeightIn!).toFixed(6) }).toEqual({ wallFt, gapIn: 0 });
      /* Flat, both edges — a beam cannot bear on a slope. */
      expect({ wallFt, left: tile!.leftHeightIn, right: tile!.rightHeightIn }).toEqual({
        wallFt,
        left: beamUndersideIn,
        right: beamUndersideIn,
      });
    }
  });

  it("⚠ holds at any pitch, because neither number depends on the pitch", () => {
    for (const pitchIn12 of [2, 3, 4, 6, 8]) {
      const { peakIn, tile } = columnTile(273, pitchIn12);
      expect({ pitchIn12, gapIn: +(peakIn - ROOF_CATCHER_BEAM_DEPTH_IN - tile!.leftHeightIn!).toFixed(6) }).toEqual({
        pitchIn12,
        gapIn: 0,
      });
    }
  });

  it("⚠ and the old constant really was 0.75in out — nominal against actual", () => {
    /* Pinned so the drift cannot come back quietly: a 2x12 is 11.25in deep,
       not the 12in its name says. If someone ever makes these equal again,
       this test is the place that explains why they are not. */
    expect(GABLE_COLUMN_FLAT_TOP_DROP_IN - ROOF_CATCHER_BEAM_DEPTH_IN).toBeCloseTo(0.75, 9);

    /* His 22ft 9in wall at 4:12, the exact numbers from the report. */
    const { peakIn, tile } = columnTile(273, 4);
    expect(peakIn).toBeCloseTo(167.75, 6);
    expect(tile!.leftHeightIn).toBeCloseTo(156.5, 6);
    // What the nominal 12 would have given, and what floated above it.
    expect(peakIn - GABLE_COLUMN_FLAT_TOP_DROP_IN).toBeCloseTo(155.75, 6);
  });
});
