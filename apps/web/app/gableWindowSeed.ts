import {
  computeGableTiledRow,
  seedGableWindows,
  type Footprint,
  type GableWallJointSpan,
  type GableWindowReservation,
  type PanelSlot,
  type RoofBearingAnchorMode,
  type RoofProfilePoint,
} from "@building-integrity/geometry";
import { wallGeometryFor as wallGeometryForPure } from "@building-integrity/geometry";
import { gableProfilePointsForWall } from "./gableProfilePoints";

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
  /**
   * ⚠ **The same `columnTopDropIn` the app's own row is built with**, which
   * for this app is 0 — the column panel runs full height to the peak (Tommy,
   * 2026-11-12: *"The housing of the beam goes all the way to the peak and
   * matches the other panels"*).
   *
   * Passed rather than defaulted because `computeGableTiledRow` defaults it to
   * `GABLE_COLUMN_FLAT_TOP_DROP_IN` (12in), and omitting it here made the
   * seeder's ridge-column tile **12in shorter** than the one the app builds —
   * a second, independent way for this row to disagree with the real one. It
   * is the identical pair of dropped arguments (`wallSlotsIn` and
   * `columnTopDropIn`) that `computeGableTiledRow`'s own clamped-row recursion
   * had, and which was fixed there on 2026-11-14 without this copy being
   * looked at.
   */
  columnTopDropIn: number,
  /**
   * ⚠ **A wall whose roofline cannot be described by a rise and a position.**
   *
   * On a mitered shape every wall takes its roofline from the roof above its
   * own two corners (see `gableProfilePointsFor`), which no combination of
   * `riseFt` and `profilePositionsInByWallId` can express — an octagon's NE
   * facet runs from 64in down to 45 1/4in and touches the eave nowhere.
   *
   * ⚠ **Passed in rather than rebuilt, for the reason this whole module
   * exists**: when this row and the app's row are constructed separately they
   * drift, and the drift shows up as a window on a tile too short to hold it.
   * Measured again the moment octagon walls got real rooflines — the seeder
   * judged a 32ft Octagon's NE tile and the app built the window on a
   * **15.85in** one.
   */
  profilePointsByWallId: Record<string, RoofProfilePoint[]>,
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
    /* ⚠ **Through the SHARED construction, never a local one** — see
       `gableProfilePointsForWall`, which exists because this line used to
       build its own point and omitted `isExplicitPosition`, so the seeder did
       not recognise a shed and tiled a row with one extra tile in it. Every
       `beforeTileCount` it then returned was off by one on every shed. */
    const tiles = computeGableTiledRow(
      wallLengthIn,
      gableEaveHeightIn,
      profilePointsByWallId[wallId] ??
        gableProfilePointsForWall(wallLengthIn, [riseFt], [profilePositionsInByWallId[wallId]?.[0]], gableEaveHeightIn),
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
      columnTopDropIn,
    );
    /* The ordinal space `beforeTileCount` counts in: real tiles only, each
       with its own RISE above the eave — see `seedGableWindows`, which refuses
       a tile too short to hold a window under its own roofline.
     *
     * ⚠ **THE RIDGE COLUMN IS NOT IN THAT SPACE, and leaving it in shifted
     * every ordinal past it.** `seedGableWindows` says so in its own first
     * parameter — *"safety gaps and the ridge column excluded"* — and adds
     * *"the ridge column is excluded by construction, since it is not in the
     * tile ordinal space at all."* That was an assumption about this caller,
     * not something the function could enforce, and this caller filtered only
     * the safety gaps. A column reservation does not displace an ordinal (it
     * shrinks the two segments meeting at the peak instead, see
     * `columnReservationWidthIn`), so counting it made this row offer one more
     * ordinal than the placer has slots for.
     *
     * ⚠ **Measured 2026-11-15 on the Cindy's East gable**, an 11-tile row with
     * its column at index 5. Every ordinal from the column rightward landed
     * one tile late, and the last one landed nowhere:
     *
     * | ordinal | the rise this row judged | the tile the window got |
     * |---------|--------------------------|-------------------------|
     * | 0 – 4   | — | the right one |
     * | 5       | 65.73in (**the column itself**) | x221.8, 65.73in |
     * | 7       | 51.66in | x305.8, **37.60in** |
     * | 10      | 5.19in | **none at all — dropped** |
     *
     * So ordinal 7 passed the 49.5in height guard on a 51.66in tile and the
     * window was built on a 37.60in one: **10.4in of window standing through
     * its own roofline with no panel over it**, which is the same visible
     * fault as the shed bug above reached by a different route. It bit only
     * PEAKED roofs, because only a peaked roof reserves a column — between the
     * two, every gable template was affected.
     *
     * ⚠ It could also seed "onto the column" (ordinal 5 above), which is not a
     * tile a window may occupy at all. Excluding it closes that too. */
    /* ⚠ **THE SHORT EDGE, 2026-11-19 — this read `Math.max` and that was the
       bug Tommy saw.** A gable tile is a trapezoid, and sizing a window off
       its TALL edge leaves the short edge short by the pitch across the tile's
       own width. On a 4:12 shed that is a third of the width: a tile passing
       the guard at 60.9in had only 51.2in at its other end, so the panel above
       the window came out 3.2in there — *"theres an obvious gap"*. The guard
       has to ask about the edge that runs out first. */
    const risesIn = tiles
      .filter((t) => !t.isSafetyGap && !t.isColumn)
      .map((t) => Math.min(t.leftHeightIn, t.rightHeightIn) - gableEaveHeightIn);
    const windows = seedGableWindows(risesIn, wallLengthIn, standardWidthIn, minTileRiseForWindowIn, randomFn);
    if (windows.length > 0) seeded[wallId] = windows;
  }
  return seeded;
}
