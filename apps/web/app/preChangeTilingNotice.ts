import { toEighths } from "@building-integrity/geometry";

/**
 * The one line that tells a user their project was tiled before the corner
 * ownership flip of 2026-10-01, and that its walls will re-tile as they are
 * edited.
 *
 * ### Why a notice and not a migration
 *
 * The flip changed which wall owns a convex corner (the LONGER one runs
 * through), so almost every wall of almost every stored project now has a
 * different run length than the one its stored panels add up to.
 * `repairStateToEighths`' guard deliberately keeps a wall's stored total when it
 * no longer matches the wall's geometry — the Smearforn principle, "never
 * silently re-tile and discard hand work" — so an old file opens with its old
 * tiling until an edit touches each wall.
 *
 * Tommy cleared the consequence up front (*"Totally fine changing any current
 * drawings/projects"*), and that is **permission to break old work, not a
 * request to rewrite it**. A re-tile migration would be worse than doing
 * nothing, and specifically worse in a way nobody would see: a pinned panel
 * width or a locked-width plan is a set of widths that sums to the OLD run, and
 * a set that sums to the old run cannot sum to the new one — so a migration
 * would silently discard every pinned width and every locked-width plan in every
 * stored file, dressed up as a refresh. Not re-tiling can only surprise
 * pleasantly; re-tiling loses data.
 *
 * So the remedy is to make it VISIBLE instead. No `PROJECT_FILE_VERSION` bump
 * either: a bump buys an old deploy the ability to refuse the file, and there is
 * nothing here for an old deploy to get wrong — the file's own contents are
 * exactly as valid as they were.
 *
 * ### What this measures, and what it does not claim
 *
 * It does **not** read a version, a date or a flag; there is none to read. It
 * compares each wall's stored panel total against the run the CURRENT rules give
 * that wall, using the same tolerance `repairStateToEighths` uses to decide
 * whether to re-size — so a wall is named here only when its stored tiling was
 * genuinely kept rather than repaired on load.
 *
 * Two consequences of measuring rather than flagging, both wanted:
 *
 * - It is **self-clearing**. Editing a wall re-tiles it to the current run, the
 *   mismatch goes, and the wall drops out of the entry with no bookkeeping.
 * - It is **not specific to this one change**. Any stored-vs-current run
 *   mismatch lands here, which is the honest scope: the sentence says the stored
 *   run and the current run disagree and names the corner-ownership change as
 *   the reason this is common right now, rather than asserting the cause.
 *
 * The run length passed in must be the wall's run WITH its run stops applied —
 * the length its slots are supposed to sum to — not the raw wall line and not
 * the unstopped run. A stopped wall's panels sum to its stopped run, so passing
 * the unstopped one would report every stopped wall in the building.
 */

/** One wall's stored panel run against the run the current rules give it. */
export interface StoredWallRun {
  wallId: string;
  story: "ground" | "second";
  /** The wall's stored slot widths summed, in inches. */
  storedTotalIn: number;
  /** `wallGeometryFor(...).lengthIn` for this wall, right now. */
  currentRunIn: number;
  /** How many slots that stored total is spread across. */
  slotCount: number;
}

/**
 * The walls whose stored panel run does not match the run the current rules give
 * them, by the same test `repairStateToEighths` applies on load.
 *
 * The `> slotCount` tolerance is that function's own and is not arbitrary: a
 * residual of at most one eighth per slot is what an eighth-grid repair can
 * absorb by nudging the slots it already has, so a wall inside it was re-sized
 * at load and is NOT carrying a stale run. Anything larger it refused to touch.
 */
export function findWallsKeepingStoredTiling(walls: readonly StoredWallRun[]): StoredWallRun[] {
  return walls.filter(
    (wall) =>
      wall.slotCount > 0 &&
      Math.abs(toEighths(wall.currentRunIn) - toEighths(wall.storedTotalIn)) > wall.slotCount,
  );
}

/** How one wall reads inside the note: `AB (ground, 155in stored vs 124in now)`. */
const describeWall = (wall: StoredWallRun, formatLengthIn: (inches: number) => string): string =>
  `${wall.wallId} (${wall.story}, ${formatLengthIn(wall.storedTotalIn)} stored vs ${formatLengthIn(wall.currentRunIn)} now)`;

/**
 * The Review Log note, or `null` when every wall's stored run is current — which
 * is every project drawn since the change, and every old project once its walls
 * have been edited.
 *
 * ONE entry naming every affected wall, deliberately, rather than one per wall:
 * on a project that predates the change this is normally EVERY wall in the
 * building, and a per-wall entry would bury the rest of the Review Log under a
 * fact that is the same fact each time.
 */
export function preChangeTilingReviewNote(
  walls: readonly StoredWallRun[],
  formatLengthIn: (inches: number) => string,
): string | null {
  const stale = findWallsKeepingStoredTiling(walls);
  if (stale.length === 0) return null;
  const wallList = stale.map((wall) => describeWall(wall, formatLengthIn)).join(", ");
  return (
    `This project's panels were laid out before the corner-ownership change of 2026-10-01, when the LONGER wall at ` +
    `a right-angle corner became the one that runs through and owns the corner panel (and every wall run began ` +
    `reserving a safety gap). ${stale.length === 1 ? "One wall still carries" : `${stale.length} walls still carry`} ` +
    `its stored panel run rather than the run those rules now give it: ${wallList}. ` +
    `Nothing has been rewritten and nothing is lost — the drawing, the cut lists and the prices are exactly what ` +
    `was saved — but each of these walls WILL re-tile to its new run the first time something edits it, and the ` +
    `panels on it will change then. Editing a wall clears it from this entry. ` +
    `⚠ Do not read a mixed project as a defect: a building part-way through being edited legitimately has some ` +
    `walls on the new rule and some on the old, and the two cannot be compared panel for panel.`
  );
}
