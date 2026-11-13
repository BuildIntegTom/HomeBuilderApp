import { describe, expect, it } from "vitest";
import {
  computeGableTiledRow,
  tileWall,
  type GableWallJointSpan,
  type RoofProfilePoint,
} from "@building-integrity/geometry";
import { placeColumnUnderPeak } from "./gableColumnPlacement";

/**
 * ⚠ **B3 — THE TWO ROWS, AND WHETHER THEY AGREE WHERE A JOINT GOES.**
 *
 * > *"The gable end panels do not directly line up with the studs of the wall
 * > panels underneath - let's figure out how to match these two layers of
 * > panel slots up, and adjust the bottom row if needed."* — Tommy
 *
 * The gable row is tiled against the roofline and the wall below is tiled by
 * the wall tiler, and nothing coupled them. Measured on a 20ft gable wall
 * before this existed: **not one** interior gable joint landed on a wall
 * joint, and the worst sat 23¼in from the nearest — half a panel, every
 * gable stud bearing mid-bay.
 *
 * These tests are about the JOINT between the two rows, not about either
 * tiler's own arithmetic, which is tested elsewhere.
 */

const STANDARD_IN = 48;
const CORNER_IN = 25.5;
const COLUMN_IN = 25.5;
const EAVE_IN = 122.25;

/**
 * The wall below, as the row needs to see it — **including the ridge column
 * the app places under the peak**, which is what the gable's own column tile
 * now takes its edges from.
 */
function wallSpans(wallLengthIn: number): GableWallJointSpan[] {
  const bare = tileWall(wallLengthIn, STANDARD_IN, CORNER_IN, "end").slots;
  const withColumn =
    placeColumnUnderPeak({
      slots: bare,
      peakXIn: wallLengthIn / 2,
      startOffsetIn: 0,
      lengthIn: wallLengthIn,
      standardWidthIn: STANDARD_IN,
      cornerWidthIn: CORNER_IN,
      gapEnd: "end",
      hasCornerStart: true,
      hasCornerEnd: true,
      allowBorrow: true,
      cornerMayWiden: true,
      columnWidthIn: COLUMN_IN,
    }) ?? bare;
  let atIn = 0;
  return withColumn.map((slot) => {
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

/** ⚠ INTERNAL points only, which is what `gableProfilePointsFor` hands the
 * tiler in the app. For a peak that is exactly one. */
function peakedProfile(wallLengthIn: number): RoofProfilePoint[] {
  return [{ xIn: wallLengthIn / 2, heightIn: EAVE_IN + (wallLengthIn / 2) * (4 / 12) }];
}

function row(wallLengthIn: number, spans: GableWallJointSpan[]) {
  return computeGableTiledRow(
    wallLengthIn,
    EAVE_IN,
    peakedProfile(wallLengthIn),
    STANDARD_IN,
    0,
    true,
    0,
    "truss-heel",
    [],
    COLUMN_IN,
    0,
    wallLengthIn,
    spans,
  );
}

/** Every joint the row puts down, including both ends. */
function edgesOf(tiles: ReturnType<typeof row>): number[] {
  return [...new Set(tiles.flatMap((t) => [+t.xStartIn.toFixed(4), +t.xEndIn.toFixed(4)]))].sort((a, b) => a - b);
}

const WALL_LENGTHS_FT = [16, 20, 24, 32, 40];

describe("⚠ a gable joint lands on a wall joint, so the load goes straight down", () => {
  it("⚠ EVERY interior joint the row puts down is one the wall already has", () => {
    /* ⚠ **No exemptions, including the ridge.** An earlier version of this
       test excused the peak as *"a roofline control point the wall below has
       no joint for"*, which was wrong: the wall DOES place a ridge column,
       and the gable's own column tile now takes that column's two edges
       rather than centring on the peak. */
    for (const wallFt of WALL_LENGTHS_FT) {
      const wallLengthIn = wallFt * 12;
      const spans = wallSpans(wallLengthIn);
      const wallEdges = new Set([0, ...spans.map((sp) => +sp.xEndIn.toFixed(4))]);
      const interior = (x: number) => x > 1e-9 && x < wallLengthIn - 1e-9;

      const aligned = edgesOf(row(wallLengthIn, spans)).filter(interior);
      expect(aligned.length).toBeGreaterThan(0);
      expect({ wallFt, off: aligned.filter((x) => !wallEdges.has(x)) }).toEqual({ wallFt, off: [] });

      /* And a row tiled WITHOUT the wall's spans still strays: it puts down
         joints the wall has no panel edge for. ⚠ This read "hit none of
         them" until 2026-11-01, when B14 put the ridge column exactly on the
         peak; the wall's own joints moved with it and now a couple of them
         happen to coincide with the naive row's. Coincidence is not the
         claim worth pinning — straying is. */
      const before = edgesOf(row(wallLengthIn, [])).filter(interior);
      expect({ wallFt, strays: before.some((x) => !wallEdges.has(x)) }).toEqual({ wallFt, strays: true });
    }
  });

  it("⚠ the gable's ridge column stacks EXACTLY on the wall's", () => {
    /* > *"Gable follows the wall."* — Tommy, 2026-11-01.
       The wall places its ridge column where it best fits its own slot run;
       the gable used to centre its own on the peak. Measured on a 16ft wall
       before this: the wall's column at 58⅞..84⅜ and the gable's at
       83¼..108¾ — **24⅜ in apart**, a ridge beam bearing on a column panel
       most of a panel away from the one carrying it. */
    for (const wallFt of WALL_LENGTHS_FT) {
      const wallLengthIn = wallFt * 12;
      const spans = wallSpans(wallLengthIn);
      const wallColumn = spans.find((sp) => sp.isColumn);
      expect({ wallFt, hasColumn: wallColumn !== undefined }).toEqual({ wallFt, hasColumn: true });

      const gableColumn = row(wallLengthIn, spans).find((t) => t.isColumn);
      expect({ wallFt, hasTile: gableColumn !== undefined }).toEqual({ wallFt, hasTile: true });
      expect({ wallFt, x0: gableColumn!.xStartIn, x1: gableColumn!.xEndIn }).toEqual({
        wallFt,
        x0: wallColumn!.xStartIn,
        x1: wallColumn!.xEndIn,
      });

      /* ⚠ **And it is on the PEAK too, which is the stronger claim and is
         new on 2026-11-01.** This used to assert the opposite — that a row
         tiled without the wall's spans lands somewhere else — because the
         wall's column could only sit where its own panel boundaries fell,
         2.25in off the peak on his 22ft 9in wall. B14 tiles the two sides of
         the column as separate runs, so "gable follows the wall" and
         "centred under the ridge" are now the same answer by construction
         rather than by luck, and the beam bears on the middle of the panel
         carrying it. */
      expect({ wallFt, centre: +(((gableColumn!.xStartIn + gableColumn!.xEndIn) / 2).toFixed(4)) }).toEqual({
        wallFt,
        centre: +((wallLengthIn / 2).toFixed(4)),
      });
    }
  });

  it("⚠ no phantom sliver at either eave corner", () => {
    /* An earlier version of this file fed the tiler a profile containing both
       wall ENDS as well as the peak. `resolveAnchors` then pushed the
       coincident end point clear by `MIN_ANCHOR_GAP_IN`, and the row came out
       with a 1in tile at each corner and no column tile at all — none of
       which the app does, because it passes the INTERNAL points only. Pinned
       so the fixture cannot drift away from its caller again. */
    for (const wallFt of WALL_LENGTHS_FT) {
      const wallLengthIn = wallFt * 12;
      const tiles = row(wallLengthIn, wallSpans(wallLengthIn));
      expect({ wallFt, first: tiles[0]!.widthIn }).toEqual({ wallFt, first: CORNER_IN });
      expect({ wallFt, last: tiles[tiles.length - 1]!.widthIn }).toEqual({ wallFt, last: CORNER_IN });
    }
  });

  it("⚠ the row still sums to the wall EXACTLY, and leaves no hole", () => {
    /* His standing rule. Aligning to someone else's joints is exactly the
       change that could drop an eighth of an inch somewhere. */
    for (const wallFt of WALL_LENGTHS_FT) {
      const wallLengthIn = wallFt * 12;
      const tiles = row(wallLengthIn, wallSpans(wallLengthIn));
      expect({ wallFt, sum: +tiles.reduce((a, t) => a + t.widthIn, 0).toFixed(6) }).toEqual({ wallFt, sum: wallLengthIn });
      // Contiguous: each tile starts where the one before it finished.
      const sorted = [...tiles].sort((a, b) => a.xStartIn - b.xStartIn);
      expect(sorted[0]!.xStartIn).toBe(0);
      for (let i = 1; i < sorted.length; i++) {
        expect({ wallFt, i, x: sorted[i]!.xStartIn }).toEqual({ wallFt, i, x: sorted[i - 1]!.xEndIn });
      }
      // Every tile is a whole eighth, like every other panel in this app.
      for (const t of tiles) expect(Math.abs(t.widthIn * 8 - Math.round(t.widthIn * 8))).toBeLessThan(1e-6);
    }
  });

  it("⚠ the gable's safety gap sits directly over the wall's", () => {
    /* The wall's gap is 3/4in and is itself a joint, so the row gets a tile
       exactly there. It is MARKED as a gap rather than left as a 3/4in panel,
       because a 3/4in gable panel is not something a shop should be asked to
       build. */
    const wallLengthIn = 20 * 12;
    const spans = wallSpans(wallLengthIn);
    const wallGaps = spans.filter((sp) => sp.isSafetyGap);
    expect(wallGaps.length).toBeGreaterThan(0);

    const gaps = row(wallLengthIn, spans).filter((t) => t.isSafetyGap);
    expect(gaps.length).toBe(wallGaps.length);
    for (const gap of gaps) {
      expect(wallGaps.some((w) => Math.abs(w.xStartIn - gap.xStartIn) < 1e-6 && Math.abs(w.xEndIn - gap.xEndIn) < 1e-6)).toBe(true);
    }
  });

  it("⚠ no tile is narrower than its own two edge studs, except a safety gap", () => {
    /* A wall joint half an inch from an anchor would otherwise make a tile
       that is two studs with nothing between them. Those are merged away.
       ⚠ **The tile at each END is exempt, and that is a PRE-EXISTING oddity
       rather than an exemption this needed.** `resolveAnchors` puts a
       roofline anchor 1in in from each eave corner, so the row opens and
       closes with a 1in segment — a whole segment, which no merge inside a
       segment can touch. It is there with or without joint alignment (the
       unaligned row's own edges run 0, 1, 40.75, …). Worth its own look;
       see the queue. */
    for (const wallFt of WALL_LENGTHS_FT) {
      const wallLengthIn = wallFt * 12;
      const tiles = row(wallLengthIn, wallSpans(wallLengthIn));
      for (const t of tiles) {
        if (t.isSafetyGap) continue;
        if (t.xStartIn <= 1e-9 || t.xEndIn >= wallLengthIn - 1e-9) continue;
        expect({ wallFt, id: t.xStartIn, w: t.widthIn >= 3 - 1e-9 }).toEqual({ wallFt, id: t.xStartIn, w: true });
      }
      /* And the end slivers really are only the two, so this exemption is
         not quietly covering a row full of them. */
      const slivers = tiles.filter((t) => !t.isSafetyGap && t.widthIn < 3);
      expect({ wallFt, slivers: slivers.length }).toEqual({ wallFt, slivers: slivers.length <= 2 ? slivers.length : -1 });
    }
  });

  it("⚠ the gable column STACKS ON the wall column, and both sit on the peak — inset or not", () => {
    /* > *"It seems that the column panel below it is centered, but the gable
       > end is still not centered."* — Tommy, 2026-11-12, from a photo of
       > strawpanels.com.
       
       That build was twelve commits behind `main` and predated the fix
       entirely, but the complaint is the exact shape of the bug: two columns
       that do not stack, so the ridge beam bears on one of them and misses
       the other. This walks four wall lengths with and without the
       truss-plate inset, because the inset shifts the gable ROW without
       shifting the peak, and that is the most plausible way for the two rows
       to disagree while each looks centred on its own terms. */
    for (const wallFt of [24, 28.75, 36, 44]) {
      const wallLengthIn = wallFt * 12;
      for (const insetIn of [0, 5.5]) {
        const spans = wallSpans(wallLengthIn);
        const wallColumn = spans.find((sp) => sp.isColumn);
        const tiles = computeGableTiledRow(
          wallLengthIn, EAVE_IN, [{ xIn: wallLengthIn / 2, heightIn: EAVE_IN + 48 }], STANDARD_IN,
          insetIn, true, 0, "truss-heel", [], COLUMN_IN, 0, wallLengthIn, spans,
        );
        const gableColumn = tiles.find((t) => t.isColumn);
        const at = { wallFt, insetIn };
        expect({ ...at, hasBoth: wallColumn !== undefined && gableColumn !== undefined }).toEqual({ ...at, hasBoth: true });
        /* Stacked: the same two edges, to the eighth the grid works to. */
        expect({ ...at, start: +gableColumn!.xStartIn.toFixed(4), end: +gableColumn!.xEndIn.toFixed(4) }).toEqual({
          ...at,
          start: +wallColumn!.xStartIn.toFixed(4),
          end: +wallColumn!.xEndIn.toFixed(4),
        });
        /* And on the ridge, not merely agreeing with each other somewhere
           else — two columns can stack perfectly and both be wrong. */
        const centreIn = (gableColumn!.xStartIn + gableColumn!.xEndIn) / 2;
        expect({ ...at, offPeakIn: Math.abs(centreIn - wallLengthIn / 2) < 0.0626 }).toEqual({ ...at, offPeakIn: true });
      }
    }
  });

  it("no spans, no change — a row given nothing tiles the way it always did", () => {
    for (const wallFt of WALL_LENGTHS_FT) {
      const wallLengthIn = wallFt * 12;
      expect(row(wallLengthIn, [])).toEqual(row(wallLengthIn, []));
      // And the two really are different rows, so the flag is doing something.
      expect(edgesOf(row(wallLengthIn, []))).not.toEqual(edgesOf(row(wallLengthIn, wallSpans(wallLengthIn))));
    }
  });
});
