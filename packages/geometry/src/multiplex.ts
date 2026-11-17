import { quantizeFootprint } from "./eighths";
import { buildRectangleFootprint } from "./footprint";
import type { Footprint, InteriorWall } from "./types";

/**
 * ⚠ **THE MULTIPLEX — a square with a load-bearing straw wall down the middle.
 * B34, 2026-11-17.**
 *
 * > *"A 36x36' square with a straw wall running down the center and acting as
 * > the ridge beam. All the loads of everything transfer down the center row
 * > of diving wall panels. This dividing straw wall would make for two
 * > rectngle studio apartments in this large building."* — Tommy, 2026-11-16
 *
 * **His answers, 2026-11-16**, both of the two that move the geometry:
 *
 * | asked | answered |
 * | --- | --- |
 * | Is 36 ft the OUTSIDE dimension? | **Yes.** The centre wall eats into it. |
 * | Which way does the centre wall run? | **N–S**, so the ridge does too. |
 *
 * ⚠ **"So the ridge does too" became TRUE on 2026-11-17 and was not before.**
 * `roofRidgeAxis` ties a square to X, so the ridge ran east–west, square
 * across this wall at 90 degrees, and the wall he described as *"acting as the
 * ridge beam"* carried nothing. Stride 3 makes a wall under the ridge win over
 * that rule — see `ridgeBearingWallFor`, which is also what takes the ridge
 * BEAM away, because a wall under the ridge already catches the panel ends.
 *
 * ## ⚠ What 36 ft OUTSIDE actually costs the rooms
 *
 * A 36 ft building gives two studios of **16'-0¾"** clear, not 18 ft: three
 * wall thicknesses cross its width, two exterior and the centre.
 * ⚠ **This paragraph said 17'-4¼" until 2026-11-17** — see
 * `multiplexStudioWidthFt`, which had forgotten the exterior walls. That is
 * the number that belongs on the tile and in a brochure, and getting it wrong
 * by a whole wall is why the question was worth asking before any of this was
 * drawn.
 *
 * ## ⚠ Why the centre wall is NOT in `walls`
 *
 * Every wall in `walls` is an edge of a closed loop, and 154 reads across the
 * codebase lean on that. A dividing wall ends in **T-junctions** and is an
 * edge of nothing. See `Footprint.interiorWalls`, which has the full split
 * between the outline geometry that must ignore it and the per-wall work that
 * must include it.
 *
 * ## ⚠ The ends BUTT, square — his call
 *
 * Asked how the two ends meet the north and south walls, he chose **butts,
 * square** over corner panels or a safety gap at each end. So the exterior
 * walls take **no new cut and do not re-tile** — which is the whole value of
 * that answer, since corner panels at the junction would have re-tiled every
 * panel in both of those walls, and a safety gap would have put a framed void
 * exactly where the ridge load lands.
 *
 * Its two corners therefore sit **on the inside faces** of the north and south
 * walls, not on the outline, and its length is the clear span between them.
 */

/** ⚠ Distinct from the outline's `AB`/`BC`/... so nothing can mistake it for
 *  a wall of the ring. It has no corner ids at all — an `InteriorWall` carries
 *  its own two points, for the reason that type's own note gives. */
export const MULTIPLEX_CENTRE_WALL_ID = "CTR";

export interface MultiplexFootprintOptions {
  /** Outside dimension, his 36 ft. */
  widthFt: number;
  depthFt: number;
  /** The wall thickness the whole building is built at, in inches. The centre
   *  wall is the same panel system as the rest — *"a straw wall"*. */
  wallThicknessIn: number;
  /**
   * ⚠ **One more interior wall PER SIDE, under each roof purlin — B34 stride
   * 3c, his answer of 2026-11-17.**
   *
   * A roof panel reaches 17.1ft of ground at 4:12 and only **15.0ft at 8:12**,
   * and each side of his 36ft building is 18ft. Asked how to carry an
   * intermediate bearing line, he chose **a wall under each purlin** over
   * posts to the floor, over raking struts back to the centre wall, and over a
   * knee wall off a loft deck.
   *
   * ⚠ **It changes what the building IS, and he said so when he chose it:**
   * each studio becomes two rooms. See `multiplexRoomWidthFt`.
   *
   * ⚠ **And it adds no purlin BEAM**, which falls out of stride 3's rule
   * rather than being a second decision — see `roofBearingLines.ts`.
   */
  roofBearingWalls?: boolean;
}

/** The ids of the two purlin walls, west and east of the centre. Distinct from
 *  `MULTIPLEX_CENTRE_WALL_ID` because they do a different job: the centre wall
 *  carries the RIDGE (both planes end on it), these each split ONE plane. */
export const MULTIPLEX_BEARING_WALL_IDS = ["BRG-W", "BRG-E"] as const;

/**
 * The building, with its centre wall. ⚠ **The outline is an ordinary
 * rectangle** — `buildRectangleFootprint`, unchanged — so everything that asks
 * what shape this building is gets the same answer it would for any 36×36.
 */
export function buildMultiplexFootprint(options: MultiplexFootprintOptions): Footprint {
  const outline = buildRectangleFootprint(options.widthFt, options.depthFt);
  const widthFt = outline.walls[0]?.lengthFt ?? options.widthFt;
  const depthFt = outline.walls[1]?.lengthFt ?? options.depthFt;
  const thicknessFt = options.wallThicknessIn / 12;

  /* ⚠ **The ends butt against the INSIDE faces of the north and south walls**,
     so the centre wall starts one wall thickness in from each and its length
     is the clear span. His "butts, square". */
  const startY = thicknessFt;
  const endY = depthFt - thicknessFt;
  const centreX = widthFt / 2;

  const centreWall: InteriorWall = {
    id: MULTIPLEX_CENTRE_WALL_ID,
    start: { x: centreX, y: startY },
    end: { x: centreX, y: endY },
    lengthFt: Math.max(0, endY - startY),
  };

  /* ⚠ **Where a purlin wall goes: the two rooms it makes are EQUAL.**

     Two defensible defaults disagree here and the difference is small enough
     that the building wins. Splitting the plane's RUN in half is the
     engineering answer — it minimises the worst panel — and gives rooms of
     7'-0¾" and 7'-8½", because the three wall thicknesses do not fall
     symmetrically about the midpoint. Splitting the CLEAR WIDTH in half gives
     two rooms of 7'-4⅝" and bands of 9.32ft and 8.68ft, both still far
     inside what a panel reaches at his 8:12. So: equal rooms.

     ⚠ **Both rooms are small, and that is worth seeing rather than
     discovering.** A 36ft Multiplex with purlin walls is two one-bedrooms of
     about 7'-4" per room, not two studios. The position is one number
     (`roomWidthFt` below) if he wants it moved. */
  const interiorWalls: InteriorWall[] = [centreWall];
  if (options.roofBearingWalls) {
    const roomWidthFt = multiplexRoomWidthFt(widthFt, options.wallThicknessIn);
    const bearingXFt = thicknessFt + roomWidthFt + thicknessFt / 2;
    for (const [index, id] of MULTIPLEX_BEARING_WALL_IDS.entries()) {
      /* West wall measured in from x = 0, east wall mirrored, so the pair is
         symmetric by construction rather than by two sums agreeing. */
      const x = index === 0 ? bearingXFt : widthFt - bearingXFt;
      interiorWalls.push({
        id,
        start: { x, y: startY },
        end: { x, y: endY },
        lengthFt: Math.max(0, endY - startY),
      });
    }
  }

  /* ⚠ **The corner list is the outline's, untouched.** The centre wall's ends
     are NOT corners: `corners` is the RING, and four modules rebuild the walls
     by walking it in order, so two extra entries would produce an outline that
     runs `D -> CTR0 -> CTR1 -> A`. See `InteriorWall`. */
  return quantizeFootprint({ ...outline, interiorWalls });
}

/**
 * ⚠ **The clear width of ONE ROOM once a purlin wall divides a studio**, which
 * is the number that tells you what this building actually is.
 *
 * Each studio's clear width less one more wall thickness, halved. On his 36 ft
 * at 15½in that is **7'-4⅝"** — two of those per studio, four per building.
 * Exported for the same reason `multiplexStudioWidthFt` is: three copies of
 * this arithmetic is three chances to quote a room that does not exist.
 */
export function multiplexRoomWidthFt(widthFt: number, wallThicknessIn: number): number {
  const studioFt = multiplexStudioWidthFt(widthFt, wallThicknessIn);
  return Math.max(0, (studioFt - wallThicknessIn / 12) / 2);
}

/**
 * ⚠ **The clear width of ONE studio** — the number a person stands in, and
 * **NOT** half the building.
 *
 * On his 36 ft at 15½in that is **16'-0¾"**.
 *
 * ⚠ **IT SAID 17'-4¼" UNTIL 2026-11-17, AND THAT WAS WRONG BY A WHOLE WALL.**
 * The old formula was `(width − thickness) / 2`, which takes out the centre
 * wall and stops — so it measured from the building's OUTSIDE FACE to the
 * centre wall's near face, with the exterior wall still inside the figure.
 * **Three** wall thicknesses cross a Multiplex's width, not one: two exterior
 * and the centre. 432in less 3 x 15.5in is 385.5in, so each studio is
 * 192.75in.
 *
 * It reached the spec and a memory as *"17'-4¼\" clear"* and was quoted back
 * in the stride 1 write-up. Nothing SHIPPED was wrong — the function had no
 * production caller, only tests — but it is exactly the sort of figure that
 * ends up in a brochure, which is why it was exported in the first place.
 * Caught by `multiplexRoomWidthFt` returning 8'-0⅜" for a room that measures
 * 7'-4⅝".
 */
export function multiplexStudioWidthFt(widthFt: number, wallThicknessIn: number): number {
  /* Two exterior walls and the centre wall, then halved. */
  return Math.max(0, (widthFt * 12 - 3 * wallThicknessIn) / 2 / 12);
}
