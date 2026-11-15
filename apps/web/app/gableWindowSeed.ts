import {
  computeGableTiledRow,
  seedGableWindows,
  type Footprint,
  type GableWallJointSpan,
  type GableWindowReservation,
  type PanelSlot,
  type RoofBearingAnchorMode,
} from "@building-integrity/geometry";
import { wallGeometryFor as wallGeometryForPure } from "@building-integrity/geometry";

/**
 * ⚠ **ONE GABLE WINDOW PER 12FT OF WALL, SEEDED WITH THE BUILDING.**
 *
 * > *"My understanding of how second story panels populate based on the first
 * > rows width, it would be fun to randomly generate one window for every 12
 * > ft of wall length in the second story/Gable section."* — Tommy,
 * > 2026-11-14
 *
 * ⚠ **A MODULE, not twenty lines inside `applyRoofDefaultsForFootprint`, and
 * that is a measured decision rather than tidiness.** Written inline, this
 * pushed `page.tsx`'s `preserve-manual-memoization` count from **62 to 72** —
 * the React Compiler gave up on the component and ten memos that had nothing
 * to do with gable windows stopped being optimized. Bisected 2026-11-14 by
 * linting `page.tsx` alone (which, usefully, finishes in about a minute,
 * unlike the whole-app run `AGENTS.md` warns about). Lifting it out put the
 * count back to 62 exactly.
 *
 * Everything it needs is an argument, so it is a pure function over the FRESH
 * slots — `handleDraw` has not committed them to state when this runs, and on
 * the very first draw there is no previous building to read at all.
 */
/**
 * ⚠ **POSITIONAL, not an options object, and that is measured too.** An
 * options object built at the call site is an allocation inside a component
 * function, and the React Compiler could not preserve memoization across it:
 * with the object literal this read **72**, with positional arguments
 * **62** — the same ten memos, the same bisect, one allocation apart.
 *
 * @param footprint the building
 * @param gableEndWallIds which of its walls carry a gable row
 * @param slotsByWallId the FRESH slots, before they reach state
 * @param existingByWallId walls that already have an answer are left alone
 * @param riseFt the roof's own rise above the eave
 * @param profilePositionsInByWallId where each gable wall's point sits; absent means centred
 * @param columnReservationWidthIn set only on a peaked roof, which reserves a ridge column tile
 */
export function seedGableWindowsForFootprint(
  footprint: Footprint,
  gableEndWallIds: readonly string[],
  slotsByWallId: Record<string, PanelSlot[]>,
  existingByWallId: Record<string, GableWindowReservation[]>,
  thicknessIn: number,
  gableEaveHeightIn: number,
  riseFt: number,
  profilePositionsInByWallId: Record<string, number[]>,
  standardWidthIn: number,
  insetIn: number,
  heelHeightIn: number,
  anchorMode: RoofBearingAnchorMode,
  columnReservationWidthIn: number | undefined,
  /**
   * ⚠ What a tile must RISE to hold a seeded window: the window's own height
   * plus enough panel left above it to be a panel. Passed in rather than
   * derived, because both numbers are the app's (`standardWindowHeightDefaultIn`
   * and `GABLE_PANEL_MIN_HEIGHT_IN`) and geometry owns neither.
   */
  minTileRiseForWindowIn: number,
  randomFn?: () => number,
): Record<string, GableWindowReservation[]> {
  const seeded: Record<string, GableWindowReservation[]> = {};
  const cornerIds = new Set(footprint.corners.map((c) => c.id));
  const anyCornerId = footprint.corners[0]?.id;
  if (anyCornerId === undefined) return seeded;

  for (const wallId of gableEndWallIds) {
    /* ⚠ Only a wall with no answer yet. This runs again on a re-derive after
       a resize, and re-rolling the dice there would move a window the user
       had already placed, resized or deleted. */
    if (existingByWallId[wallId] !== undefined) continue;
    const wall = footprint.walls.find((w) => w.id === wallId);
    if (!wall) continue;
    const wallLengthIn = wall.lengthFt * 12;

    const geometry = wallGeometryForPure(footprint, wallId, cornerIds, anyCornerId, thicknessIn, {});
    let atIn = geometry?.runStartOffsetIn ?? 0;
    const spans: GableWallJointSpan[] = (slotsByWallId[wallId] ?? []).map((slot) => {
      const span: GableWallJointSpan = {
        xStartIn: atIn,
        xEndIn: atIn + slot.widthIn,
        isSafetyGap: slot.type === "safety-gap",
        isColumn: slot.type === "column",
      };
      atIn += slot.widthIn;
      return span;
    });

    /* ⚠ The row is really tiled to get the ordinal space, rather than guessed
       from the wall's slot count. They are nearly 1:1 under joint alignment
       but not exactly — `tileAtJoints` merges a tile under its minimum and
       subdivides a bay over the target — and an ordinal past the end is a
       window that silently never appears. */
    const positionIn = profilePositionsInByWallId[wallId]?.[0] ?? wallLengthIn / 2;
    const tiles = computeGableTiledRow(
      wallLengthIn,
      gableEaveHeightIn,
      [{ xIn: positionIn, heightIn: gableEaveHeightIn + riseFt * 12 }],
      standardWidthIn,
      insetIn,
      true,
      heelHeightIn,
      anchorMode,
      [],
      columnReservationWidthIn,
      0,
      wallLengthIn,
      spans,
    );
    /* The ordinal space `beforeTileCount` counts in: real tiles only, each
       with its own RISE above the eave — see `seedGableWindows`, which refuses
       a tile too short to hold a window under its own roofline. */
    const risesIn = tiles
      .filter((t) => !t.isSafetyGap)
      .map((t) => Math.max(t.leftHeightIn, t.rightHeightIn) - gableEaveHeightIn);
    const windows = seedGableWindows(risesIn, wallLengthIn, standardWidthIn, minTileRiseForWindowIn, randomFn);
    if (windows.length > 0) seeded[wallId] = windows;
  }
  return seeded;
}
