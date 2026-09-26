import { cornerBandMiddleIn } from "@building-integrity/geometry";
import type { FormatLengthIn } from "./placementNotice";

/**
 * **Square Bale Panels REFUSES a wall in the corner band; it does not absorb
 * it.** Tommy's decision, asked directly whether a bale corner may be widened
 * the way a plywood-faced corner panel may:
 *
 * > *"No — refuse instead."*
 *
 * ### Why this is a refusal and not a wider panel
 *
 * The corner-absorb rule (see `resolveCorners` in packages/geometry's
 * tiling.ts) fixes a wall owning corners at both ends whose middle is too
 * small to build, by WIDENING the two corner panels to share the wall. That is
 * legal for the plain corner panel because it is a 24in core plus two 3/4in
 * plywood faces and Tommy confirmed it can be built at *"any width in the
 * 24-48in band"*.
 *
 * A Square Bale corner is not that part. It is a `squareBalePanel.widthIn`
 * whole-bale unit — a **confirmed 39in**, two 18in bales plus two 1.5in studs
 * — and **bales do not stretch**. At 39in the band moves from 51in-75in to
 * **78in-102in**, which is where ordinary buildings live: an **8ft wall**
 * (`MIN_DIMENSION_FT`, the shortest side the rectangle tool will draw) would
 * emit two **48in** "corner panels", and a 7ft wall two 42in ones. Neither is
 * a product; each is a bale corner with inches of nothing added to it.
 *
 * ### Where this fires, and where it deliberately does not
 *
 * At the **point of edit** — choosing Square Bale Panels — and never at load,
 * the same posture as Stage 3's wall-run-stop refusal and Stage 2's placement
 * refusals: a stored design must never become unopenable because a rule
 * tightened, and a limit is enforced on the gesture that would breach it.
 *
 * It is NOT the only thing standing between the shop and an invented part, and
 * must not be mistaken for it. A user already in Square Bale who draws or
 * shortens a wall into the band never touches the panelization control, so no
 * refusal can see it; what protects that path is `cornerMayWiden: false` in
 * the geometry, which leaves the wall tiled as it was before absorb existed —
 * nominal 39in corners and a **visible** sub-minimum middle that the Review
 * Log's below-minimum entry reports. A visible gap beats a substituted value.
 *
 * ### The honest part of the message
 *
 * Those band walls have **no legal tiling at all** under Square Bale. The
 * refusal says so, in real inches, and says that nothing was changed — rather
 * than switching the panelization and leaving the user to find the unbuildable
 * panel in the Review Log. Lengths are formatted by an injected
 * `formatLength`, so this module knows nothing about the unit system and its
 * tests can read the sentence exactly.
 */
export interface SquareBaleBandWall {
  wallId: string;
  /** The wall's own tiling run length, not its drawn length. */
  wallLengthIn: number;
  /** What two nominal bale corners leave between them — above zero and under
   * the shop's minimum panel width, which is the whole problem. */
  middleIn: number;
}

/** Exactly the per-wall facts this refusal reads. Narrower than `WallGeometry`
 * on purpose: it keeps the inputs obvious and the tests free of
 * footprint-building. */
export interface RefusalWallFacts {
  wallId: string;
  lengthIn: number;
  hasCornerStart: boolean;
  hasCornerEnd: boolean;
}

/**
 * Every wall that would have no legal tiling under Square Bale's fixed corner.
 *
 * Uses `cornerBandMiddleIn` rather than re-deriving the arithmetic, so this
 * and the tiler cannot drift apart about what "in the band" means. Corner
 * ownership and run length are properties of the footprint, not of a story, so
 * one pass over the walls covers every story of the building.
 */
export function findSquareBaleBandWalls(walls: RefusalWallFacts[], baleCornerWidthIn: number): SquareBaleBandWall[] {
  const found: SquareBaleBandWall[] = [];
  for (const wall of walls) {
    const middleIn = cornerBandMiddleIn(wall.lengthIn, baleCornerWidthIn, wall.hasCornerStart, wall.hasCornerEnd);
    if (middleIn === null) continue;
    found.push({ wallId: wall.wallId, wallLengthIn: wall.lengthIn, middleIn });
  }
  return found;
}

/**
 * The refusal sentence, or null when Square Bale Panels is a legal choice for
 * this building.
 *
 * Names the first offending wall and counts the rest: the count is what tells
 * the user whether this is one awkward return wall or the whole footprint.
 */
export function squareBaleCornerRefusal(
  bandWalls: SquareBaleBandWall[],
  baleCornerWidthIn: number,
  minPanelWidthIn: number,
  formatLength: FormatLengthIn,
): string | null {
  const first = bandWalls[0];
  if (!first) return null;
  const others = bandWalls.length - 1;
  const alsoClause =
    others > 0 ? ` ${others} other wall${others === 1 ? "" : "s"} on this building ${others === 1 ? "is" : "are"} the same.` : "";
  return (
    `A Square Bale corner panel is a fixed ${formatLength(baleCornerWidthIn)} whole-bale unit and cannot be built any other width — ` +
    `bales do not stretch. Wall ${first.wallId} owns a corner at both ends and its run is ${formatLength(first.wallLengthIn)}, ` +
    `so two of them leave ${formatLength(first.middleIn)} in the middle, under the ${formatLength(minPanelWidthIn)} minimum panel the shop can build. ` +
    `That wall has no legal Square Bale tiling at all.${alsoClause} ` +
    `The panelization was NOT changed, and no panel, wall or thickness on the building was altered.`
  );
}
