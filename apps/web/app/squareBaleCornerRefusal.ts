import { cornerBandMiddleIn, wallGeometryFor } from "@building-integrity/geometry";
import type { CornerId, Footprint, WallRunStop } from "@building-integrity/geometry";
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
 * refusal can see it; what covers that path is `cornerMayWiden: false` in the
 * geometry, which leaves a **band** wall tiled as it was before absorb existed
 * — nominal 39in corners and a **visible** sub-minimum middle that the Review
 * Log's below-minimum entry reports. A visible gap beats a substituted value.
 *
 * ### ⚠ What `cornerMayWiden: false` does NOT cover — the MERGED bale corner
 *
 * This module used to say the geometry flag stops the geometry inventing a part
 * on *any* other path. **That was an overstatement and is corrected here
 * (2026-09-26).** The flag gates the **absorb** branch only. It does not gate
 * `resolveCorners`' older **merge** branch, which fires when a wall is too
 * short for two nominal corners at all — and that branch emits one `corner`
 * slot of the wall's **whole length**, at any corner width, regardless of the
 * flag. Measured on this branch: `tileWall(72, 39, 39, "end", true, true, true,
 * false)` → a single `corner 72in`, and `tileWall(77.875, ...)` → `corner
 * 77.875in`, **29 7/8in over the confirmed 48in `panelWidthInRange.maxIn`.**
 *
 * So under Square Bale **every two-corner wall shorter than 78in still gets a
 * single merged "bale corner" as wide as the wall.** It is neither refused
 * (`cornerBandMiddleIn` deliberately returns null for the merge case, so
 * `findSquareBaleBandWalls` never sees it) nor reported (the app has no
 * over-maximum panel reporter).
 *
 * **Reached by drawing a small octagon, measured rather than argued:** under
 * Square Bale (39in corner, 14in thickness) every wall of every octagon from
 * about **9.7ft to 15.7ft across** is one merged slot as wide as the wall —
 * 9.75ft → 48 1/2in, 10ft → 49 3/4in, 12ft → 59 3/4in, 15.5ft → 77 1/8in; at
 * 15.75ft the side reaches 78in and the walls tile normally again. (On a
 * mitered shape the slot comes out typed `safety-oct-corner` rather than
 * `corner`, which changes nothing about its width.) A short bump-out return
 * does **not** reach this case: it owns a corner at one end only, so it tiles
 * `braced 21in | corner 39in` — a sub-minimum panel the Review Log does report.
 *
 * This is **pre-existing on `main`** and far older than absorb: the instruction
 * for the absorb work was that the merged corner keep behaving as it does
 * today, so it is deliberately untouched here. Whether *"No — refuse instead"*
 * extends to the merged bale corner is **Tommy's answer and he has been
 * asked**; nothing here assumes it either way. Recorded in the spec under the
 * 51in-75in band section and in `## Open Items`.
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
 * The per-wall facts, read **at the thickness Square Bale is about to be
 * applied at** — not at whatever thickness the project is on right now.
 *
 * ### ⚠ This is the whole reason the function exists, and getting it wrong was
 * a live defect (fixed 2026-09-26)
 *
 * The refusal used to be built from page.tsx's own per-render `wallGeometryFor`,
 * which closes over the **current** `thicknessIn` — 15.5in by default. But the
 * Square Bale button then calls `setThicknessIn(squareBalePanel.thicknessIn)` =
 * **14in**, and a wall's tiling run is thickness-dependent: `cornerOwnership`
 * adds `extraLengthIn = thicknessIn` to any end that owns a **reflex** corner.
 * So the refusal was decided against a run length the wall would not have once
 * Square Bale was applied — validating on one basis and applying on another,
 * the same class of defect as the validate/apply basis split that was a
 * must-fix on Smearforn Stage 3 (see `wallRunStopBasisIn` in page.tsx, whose
 * note says the same thing about the same mistake).
 *
 * **Measured, both directions.** Sweeping a 6ft bump-out's span start in 1/8in
 * steps along the 30ft wall of a 30x20 rectangle (`insertBumpOut(buildRectangle
 * Footprint(30, 20), "AB", s, s + 6, 5, primary)`, 1249 positions, 2498
 * two-corner walls, of which **2306 change run length** between 15.5in and
 * 14in):
 *
 * - **12 positions were FALSE REFUSALS.** At a span start of 62 5/8in, wall
 *   `01` runs **78 1/8in at 15.5in** — in the 78in-102in bale band, middle
 *   1/8in, refused by name — but **76 5/8in at 14in**, which is not in the band
 *   at all. The app refused Square Bale, quoting inches the building would not
 *   have had.
 * - **12 positions were the mirror**, out of band at 15.5in and in band at 14in
 *   (span start 86 1/2in: 102in vs 100 1/2in, a 22 1/2in middle). Not a
 *   shop-safety hole — `cornerMayWiden: false` still applies and the
 *   sub-minimum middle still reports — but the refuse posture was silently
 *   incomplete on the one-click path.
 *
 * Taking the thickness as an argument is also what makes this reachable from
 * this module's own tests instead of only from untested page.tsx glue.
 */
export function squareBaleRefusalWallFacts(
  footprint: Footprint,
  primaryCornerIds: Set<string>,
  leastAccessibleCorner: CornerId,
  baleThicknessIn: number,
  runStopsByWallId: Record<string, WallRunStop>,
): RefusalWallFacts[] {
  const facts: RefusalWallFacts[] = [];
  for (const wall of footprint.walls) {
    const geometry = wallGeometryFor(
      footprint,
      wall.id,
      primaryCornerIds,
      leastAccessibleCorner,
      baleThicknessIn,
      runStopsByWallId,
    );
    if (!geometry) continue;
    facts.push({
      wallId: wall.id,
      lengthIn: geometry.lengthIn,
      hasCornerStart: geometry.hasCornerStart,
      hasCornerEnd: geometry.hasCornerEnd,
    });
  }
  return facts;
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
