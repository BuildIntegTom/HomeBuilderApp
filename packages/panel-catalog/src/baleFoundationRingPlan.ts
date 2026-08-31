import { PLATE_2X4_THICKNESS_IN } from "./panelMemberHelpers";

/**
 * WHERE THE BALE FOUNDATION'S TWO PERIMETER RINGS SIT, relative to the wall
 * above them — the single derivation both consumers read (the 3D preview's
 * `baleFoundationRenderData` in Building3DView.tsx and the 2D FloorCanvas
 * feed in page.tsx). These two used to compute the same insets
 * independently and had already drifted; one exported function is what
 * stops that happening again.
 *
 * Tommy, on seeing the first version live: *"there should be a larger
 * multi-piece unit of lumber as the perimeter, under and flush with the
 * inside of the outer perimeter of the walls. i would like that second
 * large unit to be panel-depth inward perimeter and flush the other way.
 * so basically these two large pieces (or LVL's if thats selected) are
 * flush with the exterior and interior of the panel wall"* — so the pair
 * BRACKETS the wall, one ring under each wythe, each flush on the side
 * facing the wall face it belongs to. That placement rule is CONFIRMED:
 * it is his own description of his own detail.
 *
 * The measuring convention, stated once so the arithmetic below is
 * checkable: distances are measured INWARD from the footprint's exterior
 * line (the corner points themselves — see `wallBoxes3D`'s "thickness
 * extends inward from that line, it doesn't straddle it"), so the wall
 * occupies `[0, thicknessIn]`, and an `insetIn` handed to
 * `computeInsetPerimeterRing` positions a ring's OUTBOARD face. A ring is
 * a doubled stack pair (`buildDoubledStackPair`): two stacks laid side by
 * side across the depth axis at `yIn: 0` and `yIn: PLATE_2X4_THICKNESS_IN`,
 * so it occupies `[insetIn, insetIn + ringWidthIn]`.
 *
 * | Ring | Inset | Occupies | Flush with |
 * |---|---|---|---|
 * | a (exterior) | `0` | `[0, ringWidthIn]` | wall's exterior face, on the ring's outboard side |
 * | b (interior) | `thicknessIn - ringWidthIn` | `[thicknessIn - ringWidthIn, thicknessIn]` | wall's interior face, on the ring's inboard side |
 *
 * `ringWidthIn` is DERIVED from the member spec below, never hardcoded, so
 * that a future material change (Tommy's parenthetical *"or LVL's if thats
 * selected"*) moves Ring B automatically and keeps both rings flush. No
 * such material option exists today — `buildFramingStackMembers` hardcodes
 * `PLATE_2X4_THICKNESS_IN`, and the catalog's only LVL width belongs to the
 * suspended floor-joist system, a different floor type. The CLOSER precedent
 * is `boxBeamMembers.ts`'s `BOX_BEAM_LVL_THICKNESS_IN` (2in) and its
 * selectable LVL depth set — that is what whoever builds a ring material
 * selector should look at first. Either way no LVL width is
 * invented here; writing the arithmetic in terms of `ringWidthIn` is the
 * whole cost of supporting it later.
 */
export const BALE_FOUNDATION_RING_BOARD_THICKNESS_IN = PLATE_2X4_THICKNESS_IN;

/** The across-the-depth width of one doubled ring: the 2 stacks of
 * `buildDoubledStackPair`, each one board thick, touching. Asserted against
 * that builder's own member geometry in the test file, so this stays a
 * derivation of the real members rather than a number that merely agrees
 * with them today. */
export const BALE_FOUNDATION_RING_WIDTH_IN = 2 * BALE_FOUNDATION_RING_BOARD_THICKNESS_IN;

export interface BaleFoundationRingPlacement {
  /** "a" = under the exterior wythe, "b" = under the interior wythe.
   * A collapsed plan (see below) has only the single ring "a". */
  name: "a" | "b";
  /** Inward offset of the ring's OUTBOARD face from the exterior line. */
  insetIn: number;
  /** Inward offset of the pair's INNER stack — the second of the two
   * side-by-side sub-lines, which the 2D canvas draws separately. Exactly
   * one board thickness inboard of `insetIn`, matching
   * `buildDoubledStackPair`'s own `yIn: PLATE_2X4_THICKNESS_IN`. */
  innerInsetIn: number;
}

export interface BaleFoundationRingPlan {
  ringWidthIn: number;
  boardThicknessIn: number;
  /** Normally 2 rings bracketing the wall; 1 only in the degenerate case
   * below. Iterate rather than indexing, so the collapse cannot render as
   * a duplicated ring. */
  rings: BaleFoundationRingPlacement[];
  /** Where the single (non-doubled) interior field stacks start. */
  fieldInsetIn: number;
  /** True when the wall is too thin to hold two non-overlapping rings and
   * they have been collapsed into one. Never true for any thickness this
   * app can select. */
  collapsed: boolean;
}

export function baleFoundationRingPlan(wallThicknessIn: number): BaleFoundationRingPlan {
  const ringWidthIn = BALE_FOUNDATION_RING_WIDTH_IN;
  const boardThicknessIn = BALE_FOUNDATION_RING_BOARD_THICKNESS_IN;
  const placement = (name: "a" | "b", insetIn: number): BaleFoundationRingPlacement => ({
    name,
    insetIn,
    innerInsetIn: insetIn + boardThicknessIn,
  });

  // INTERPRETATION, not Tommy's instruction: a wall thinner than two rings
  // has nowhere to put a bracketing pair, and the placement rule above
  // would put Ring B's outboard face inboard of Ring A's inboard face —
  // two solid rings occupying the same lumber. Collapsing to ONE centered
  // doubled ring is a reviewable, obviously-degenerate answer;
  // interpenetrating geometry is not. This cannot be reached from the UI:
  // the thinnest selectable panel is 14in and `panelThicknessInRange`'s
  // floor is 11.75in, against 6in of ring. The `Math.max(0, ...)` is the
  // same interpretation carried one step further — a ring wider than the
  // wall is centered as far in as it can go rather than spawning outside
  // the footprint, which is the one failure mode Tommy has already had to
  // report ("also is spawned wrong").
  if (wallThicknessIn < 2 * ringWidthIn) {
    return {
      ringWidthIn,
      boardThicknessIn,
      rings: [placement("a", Math.max(0, (wallThicknessIn - ringWidthIn) / 2))],
      fieldInsetIn: Math.max(wallThicknessIn, ringWidthIn),
      collapsed: true,
    };
  }

  return {
    ringWidthIn,
    boardThicknessIn,
    rings: [placement("a", 0), placement("b", wallThicknessIn - ringWidthIn)],
    // INTERPRETATION, not Tommy's instruction: he specified where the two
    // rings go, not where the interior field starts. It starts at the
    // wall's own interior face, inboard of Ring B — the zone between the
    // rings is under the wall's load path, not interior floor span. (The
    // previous `thicknessIn + standardWidthIn` additionally left a ~40in
    // unframed band all round the interior, a third symptom of using a
    // panel WIDTH as an inward DEPTH.)
    fieldInsetIn: wallThicknessIn,
    collapsed: false,
  };
}
