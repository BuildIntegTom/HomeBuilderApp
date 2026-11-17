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
 * Each studio is the half-width **less half the wall's thickness**, so on a
 * 15½in wall a 36 ft building gives two studios of **17'-4¼" clear**, not
 * 18 ft. That is the number that belongs on the tile and in a brochure, and
 * it is why the question was worth asking before any of this was drawn.
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
}

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

  /* ⚠ **The corner list is the outline's, untouched.** The centre wall's ends
     are NOT corners: `corners` is the RING, and four modules rebuild the walls
     by walking it in order, so two extra entries would produce an outline that
     runs `D -> CTR0 -> CTR1 -> A`. See `InteriorWall`. */
  return quantizeFootprint({ ...outline, interiorWalls: [centreWall] });
}

/**
 * ⚠ **The clear width of ONE studio**, which is the number a person cares
 * about and is NOT half the building: `(width − thickness) / 2`.
 *
 * On his 36 ft at 15½in that is **17'-4¼"**. Exported because the Home tile,
 * the Summary and any brochure all want to say it, and three copies of this
 * arithmetic is three chances to say 18 ft by mistake.
 */
export function multiplexStudioWidthFt(widthFt: number, wallThicknessIn: number): number {
  return Math.max(0, (widthFt - wallThicknessIn / 12) / 2);
}
