import { cornerBandMiddleIn, mergedCornerWidthIn, wallGeometryFor } from "@building-integrity/geometry";
import type { CornerId, Footprint, PanelSlot, WallRunStop } from "@building-integrity/geometry";
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
 * ### TWO refused cases, not one — the band AND the merged corner
 *
 * `resolveCorners` has two branches that can produce a bale corner off 39in,
 * and **both are refused** (Tommy, 2026-09-26, asked whether *"No — refuse
 * instead"* extends to the second: **"Yes — refuse both cases too."**):
 *
 * 1. **ABSORB — the 78in-102in band.** Two nominal bale corners leave a middle
 *    under the 24in fabrication minimum, and absorb would widen them to share
 *    the wall. `findSquareBaleBandWalls` / `squareBaleCornerRefusal`.
 * 2. **MERGE — any two-corner wall under 78in.** Too short for two nominal bale
 *    corners at all, so the tiler emits **one** corner slot as wide as the whole
 *    wall. `findSquareBaleMergedCornerWalls` / `squareBaleMergedCornerRefusal`.
 *    Measured: `tileWall(72, 39, 39, "end", true, true, true, false)` → a single
 *    `corner 72in`; at the widest, `corner 77 7/8in`, **29 7/8in over the
 *    confirmed 48in `panelWidthInRange.maxIn`.** Reached by drawing a small
 *    octagon: under Square Bale every wall of every octagon from about **9.7ft
 *    to 15.7ft across** is one merged slot as wide as the wall (9.75ft →
 *    48 1/2in, 10ft → 49 3/4in, 12ft → 59 3/4in, 15.5ft → 77 1/8in; at 15.75ft
 *    the side reaches 78in and the walls tile normally again). On a mitered shape
 *    the slot comes out typed `safety-oct-corner`, which changes nothing about
 *    its width.
 *
 * `squareBalePanelizationRefusalMessage` is the single entry point that covers
 * both, so a caller cannot wire up one and miss the other — which is exactly how
 * case 2 went unrefused until 2026-09-26.
 *
 * ### ⚠ EXACTLY how far this coverage reaches, and where it stops
 *
 * This module used to say `cornerMayWiden: false` stops the geometry inventing a
 * part on *any* other path. **That was an overstatement, it is why case 2 sat
 * unnoticed, and it is corrected here.** The truthful statement of the coverage
 * is:
 *
 * - **The panelization control is fully covered**, both cases, at Square Bale's
 *   own 14in thickness (see `squareBaleRefusalWallFacts`).
 * - **The geometry flag covers one thing only: a band wall is not silently
 *   widened.** It does **not** gate the merge branch, and deliberately still
 *   does not — the merge is Tommy's own rule, the absorb work was instructed to
 *   leave it alone, and the plywood path depends on it. See `mergedCornerWidthIn`
 *   in tiling.ts.
 * - **⚠ A wall drawn or shortened into either case while Square Bale is ALREADY
 *   selected is NOT refused.** That path never touches the panelization control:
 *   `handleDraw`, the wall-length edit, the octagon resize, `insertBumpOut`,
 *   `handleDragWall` and the notch/collapse path each write a new footprint
 *   directly. A band wall there is **reported** (the Review Log's below-minimum
 *   entry fires on its visible sub-minimum middle); a merged bale corner there is
 *   **reported by `findSquareBaleMergedCorners`' own Review Log entry**, added
 *   2026-09-26 for exactly this reason, because without it Case A would have
 *   created a silence on the one path its refusal cannot see. **Neither is
 *   refused, and refusing them is not built** — see the spec's Open Items for
 *   the reason (six gesture handlers, two of them, drag and draw, with no
 *   specified refusal posture) and for what it would take.
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

/** A wall whose Square Bale corners would be MERGED into one slot as wide as
 * the wall — the second of the two cases Tommy refused. */
export interface SquareBaleMergedCornerWall {
  wallId: string;
  /** The wall's own tiling run length, not its drawn length. */
  wallLengthIn: number;
  /** The single merged corner slot the tiler emits — always the wall's whole
   * grid-snapped run, which is the problem: it is not a whole-bale unit at any
   * length, and above the catalog ceiling it is not even a legal panel. */
  mergedWidthIn: number;
}

/**
 * Every wall whose Square Bale corners would be merged into one slot.
 *
 * **Tommy, 2026-09-26, asked whether *"No — refuse instead"* extends from the
 * widened bale corner to the merged one:**
 *
 * > **"Yes — refuse both cases too."**
 *
 * His reasoning is consistency: both produce a bale part that cannot be built,
 * so both refuse rather than merely report.
 *
 * Uses `mergedCornerWidthIn` from the tiler rather than re-deriving
 * `run < 2 x corner`, for the same reason `findSquareBaleBandWalls` uses
 * `cornerBandMiddleIn`: one definition, in one place, or the refusal and the
 * geometry drift apart.
 *
 * ### ⚠ Every merged bale corner is refused, not only the ones over 48in
 *
 * Worth stating because the alternative reading is defensible and the
 * difference is one comparison. The case put to Tommy was *"under Square Bale
 * any two-corner wall shorter than 78in still gets a single merged bale corner
 * of the wall's whole length — up to 30in over the confirmed 48in ceiling"*, and
 * he refused that case. The breach of `panelWidthInRange.maxIn` is the severity
 * of the worst end of it, not the definition: a 44 3/4in merged bale corner (a
 * 9ft octagon's side) is inside the 48in ceiling and **still is not a 39in
 * whole-bale unit**, which is the thing he said cannot be built. Refusing only
 * above 48in would let a small octagon build sixteen invented bale parts and
 * call it legal.
 *
 * If he meant the narrower reading, it is a single added condition here
 * (`mergedWidthIn > maxPanelWidthIn`) and nothing else changes.
 */
export function findSquareBaleMergedCornerWalls(
  walls: RefusalWallFacts[],
  baleCornerWidthIn: number,
): SquareBaleMergedCornerWall[] {
  const found: SquareBaleMergedCornerWall[] = [];
  for (const wall of walls) {
    const mergedWidthIn = mergedCornerWidthIn(wall.lengthIn, baleCornerWidthIn, wall.hasCornerStart, wall.hasCornerEnd);
    if (mergedWidthIn === null) continue;
    found.push({ wallId: wall.wallId, wallLengthIn: wall.lengthIn, mergedWidthIn });
  }
  return found;
}

/**
 * The refusal sentence for the merged case, or null when no wall merges.
 *
 * Same voice and same shape as `squareBaleCornerRefusal`: name the first
 * offending wall, quote its real run, count the rest, and say plainly that
 * nothing was changed. The over-the-ceiling clause appears **only when the
 * merged slot really does breach `maxPanelWidthIn`**, because a refusal that
 * quotes a limit the wall does not breach is a refusal nobody trusts.
 */
export function squareBaleMergedCornerRefusal(
  mergedWalls: SquareBaleMergedCornerWall[],
  baleCornerWidthIn: number,
  maxPanelWidthIn: number,
  formatLength: FormatLengthIn,
): string | null {
  const first = mergedWalls[0];
  if (!first) return null;
  const others = mergedWalls.length - 1;
  const alsoClause =
    others > 0 ? ` ${others} other wall${others === 1 ? "" : "s"} on this building ${others === 1 ? "is" : "are"} the same.` : "";
  const overCeilingClause =
    first.mergedWidthIn > maxPanelWidthIn
      ? ` That is also ${formatLength(first.mergedWidthIn - maxPanelWidthIn)} over the ${formatLength(maxPanelWidthIn)} maximum panel width.`
      : "";
  return (
    `A Square Bale corner panel is a fixed ${formatLength(baleCornerWidthIn)} whole-bale unit and cannot be built any other width — ` +
    `bales do not stretch. Wall ${first.wallId} owns a corner at both ends but its run is only ${formatLength(first.wallLengthIn)}, ` +
    `less than the ${formatLength(2 * baleCornerWidthIn)} two bale corners need side by side, so the two would be merged into ONE corner panel ` +
    `${formatLength(first.mergedWidthIn)} wide — the whole wall, and not a whole-bale unit.${overCeilingClause}${alsoClause} ` +
    `The panelization was NOT changed, and no panel, wall or thickness on the building was altered.`
  );
}

/**
 * **The one refusal the panelization control asks for** — both of Tommy's
 * refused cases, in one message, or null when Square Bale Panels is a legal
 * choice for this building.
 *
 * The merged case is stated first when a building has both, because it is the
 * one that reaches the shop as a single part up to nearly 30in over the catalog
 * ceiling; the band case leaves a visible sub-minimum gap instead. Both quote
 * their own walls, so a building with one of each says so rather than picking a
 * winner.
 *
 * Exported as the single entry point so page.tsx cannot accidentally wire up one
 * case and not the other, which is how the merged case went unrefused in the
 * first place.
 */
export function squareBalePanelizationRefusalMessage(
  bandWalls: SquareBaleBandWall[],
  mergedWalls: SquareBaleMergedCornerWall[],
  baleCornerWidthIn: number,
  minPanelWidthIn: number,
  maxPanelWidthIn: number,
  formatLength: FormatLengthIn,
): string | null {
  const merged = squareBaleMergedCornerRefusal(mergedWalls, baleCornerWidthIn, maxPanelWidthIn, formatLength);
  const band = squareBaleCornerRefusal(bandWalls, baleCornerWidthIn, minPanelWidthIn, formatLength);
  if (merged && band) return `${merged} ${band}`;
  return merged ?? band;
}

/** One wall of a STORED Square Bale design whose corners are already merged —
 * the reporting counterpart of `SquareBaleMergedCornerWall`, read off the slots
 * that exist rather than off geometry that might be recomputed. */
export interface SquareBaleMergedCornerReport {
  wallId: string;
  /** The single merged slot's width, which is the whole wall. */
  mergedWidthIn: number;
}

/**
 * Every wall of a stored design whose Square Bale corners are ALREADY merged
 * into one slot off the nominal bale width.
 *
 * ### Why a report exists as well as a refusal
 *
 * The refusal above covers the panelization control, and Tommy's posture
 * throughout this app is **refuse at the point of edit, never at load**. That
 * leaves one path: a user already in Square Bale who *draws* a small octagon or
 * shortens a wall under 78in. Nothing on that path touches the panelization
 * control, so no refusal sees it, and unlike the band case there was **nothing
 * else reporting it either** — the Review Log walks for panels under the 24in
 * minimum, and a merged bale corner is over the maximum, which this app has no
 * reporter for at all.
 *
 * So refusing at the control without this walk would have made the app *quieter*
 * about the merged bale corner than it was before, on exactly the path the
 * refusal cannot reach — silence that reads as "legal". This is the honest
 * interim: **refused where the user acts on the panelization, reported
 * everywhere else.** It is not a substitute for refusing the drawing gestures;
 * see this module's coverage note above and the spec's Open Items.
 *
 * ### The shape it matches, and why it cannot false-positive
 *
 * `resolveCorners`' merge branch returns the merged slot as the wall's *only*
 * content (`return { slots: [corners.merged] }`), so the signature is: exactly
 * one slot, typed `corner` or `safety-oct-corner` (a mitered shape renames it
 * and changes nothing else).
 *
 * A wall exactly `baleCornerWidthIn` long is excluded, and that is not a
 * tolerance fudge — a merged corner that happens to come out at exactly 39in
 * **is** a whole-bale unit and is buildable, and so is the other single-slot
 * shape of that width (a wall owning one corner with a zero middle). Nothing
 * unbuildable is filtered out by it.
 *
 * Deliberately scoped to Square Bale by its caller: the plywood merged corner
 * between 48in and 51in is a separate, separately-recorded Open Item, and
 * starting to report it here would be an unasked behaviour change.
 */
export function findSquareBaleMergedCorners(
  slotsByWallId: Record<string, PanelSlot[]>,
  baleCornerWidthIn: number,
): SquareBaleMergedCornerReport[] {
  const found: SquareBaleMergedCornerReport[] = [];
  for (const [wallId, slots] of Object.entries(slotsByWallId ?? {})) {
    const list = slots ?? [];
    if (list.length !== 1) continue;
    const only = list[0]!;
    if (only.type !== "corner" && only.type !== "safety-oct-corner") continue;
    if (only.widthIn === baleCornerWidthIn) continue;
    found.push({ wallId, mergedWidthIn: only.widthIn });
  }
  return found;
}

/**
 * The Review Log note for one already-merged Square Bale corner.
 *
 * Says what the part is, what it is not, and — only when true — that it also
 * breaches the catalog ceiling. **No width is invented and no panel is
 * changed:** the entry describes the wall as stored. Its status is the caller's
 * to set (`pending-BI-confirmation`, same as every other fabrication flag).
 */
export function squareBaleMergedCornerNote(
  report: SquareBaleMergedCornerReport,
  baleCornerWidthIn: number,
  maxPanelWidthIn: number,
  formatLength: FormatLengthIn,
): string {
  const overCeilingClause =
    report.mergedWidthIn > maxPanelWidthIn
      ? ` It is also ${formatLength(report.mergedWidthIn - maxPanelWidthIn)} over the ${formatLength(maxPanelWidthIn)} maximum panel width.`
      : "";
  return (
    `This wall is shorter than the ${formatLength(2 * baleCornerWidthIn)} two ${formatLength(baleCornerWidthIn)} bale corners need side by side, ` +
    `so its two corners are merged into ONE corner panel ${formatLength(report.mergedWidthIn)} wide — the whole wall. ` +
    `A Square Bale corner panel is a fixed ${formatLength(baleCornerWidthIn)} whole-bale unit (two 18in bales + two 1.5in studs) and bales do not stretch, ` +
    `so this is not a part the shop can build as drawn.${overCeilingClause} ` +
    `Nothing was rewritten — it opens, draws, prices and prints as stored. ` +
    `Choosing Square Bale Panels on a building like this is refused outright (Tommy: "Yes — refuse both cases too"); ` +
    `drawing into it while Square Bale is already selected is reported here instead, which is why you are reading this.`
  );
}
