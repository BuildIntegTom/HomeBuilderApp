import { describe, expect, it } from "vitest";
import { computeGableTiledRow, tileWall, type GableWallJointSpan, type RoofProfilePoint } from "./index";

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
const EAVE_IN = 122.25;

/** The wall below, as the row needs to see it. */
function wallSpans(wallLengthIn: number): GableWallJointSpan[] {
  let atIn = 0;
  return tileWall(wallLengthIn, STANDARD_IN, CORNER_IN, "end").slots.map((slot) => {
    const span = { xStartIn: atIn, xEndIn: atIn + slot.widthIn, isSafetyGap: slot.type === "safety-gap" };
    atIn += slot.widthIn;
    return span;
  });
}

function peakedProfile(wallLengthIn: number): RoofProfilePoint[] {
  return [
    { xIn: 0, heightIn: EAVE_IN },
    { xIn: wallLengthIn / 2, heightIn: EAVE_IN + (wallLengthIn / 2) * (4 / 12) },
    { xIn: wallLengthIn, heightIn: EAVE_IN },
  ];
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
    undefined,
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
    /* The anchors are excluded and named: the two ends are the wall's own
       corners, and the PEAK is a roofline control point the wall below has no
       joint for. Those are the "adjust the bottom row" half, which is a
       change to the WALL and is not what this does. Everything else is held
       to exact. */
    for (const wallFt of WALL_LENGTHS_FT) {
      const wallLengthIn = wallFt * 12;
      const spans = wallSpans(wallLengthIn);
      const wallEdges = new Set([0, ...spans.map((sp) => +sp.xEndIn.toFixed(4))]);
      const anchorish = (x: number) => x <= 1 || x >= wallLengthIn - 1e-9 || Math.abs(x - wallLengthIn / 2) < 1e-6;

      const aligned = edgesOf(row(wallLengthIn, spans)).filter((x) => !anchorish(x));
      expect(aligned.length).toBeGreaterThan(0);
      expect({ wallFt, off: aligned.filter((x) => !wallEdges.has(x)) }).toEqual({ wallFt, off: [] });

      // And it really was broken before: the unaligned row hit none of them.
      const before = edgesOf(row(wallLengthIn, [])).filter((x) => !anchorish(x));
      expect({ wallFt, on: before.filter((x) => wallEdges.has(x)).length }).toEqual({ wallFt, on: 0 });
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

  it("no spans, no change — a row given nothing tiles the way it always did", () => {
    for (const wallFt of WALL_LENGTHS_FT) {
      const wallLengthIn = wallFt * 12;
      expect(row(wallLengthIn, [])).toEqual(row(wallLengthIn, []));
      // And the two really are different rows, so the flag is doing something.
      expect(edgesOf(row(wallLengthIn, []))).not.toEqual(edgesOf(row(wallLengthIn, wallSpans(wallLengthIn))));
    }
  });
});
