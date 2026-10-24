import type { Footprint } from "./types";
import { footprintSpanAndRun } from "./joistLayout";

/**
 * Where one floor or roof panel sits in the building, ready to hand to the
 * 3D view.
 *
 * ⚠ **A panel's members are built AS FABRICATED — lying in the compressor
 * table** — so its own Z is the span, the same axis a wall panel uses for its
 * height. Installing a floor means tipping it flat. `tipped` says so, and the
 * 3D view does that rotation; nothing here bakes it into the members, because
 * the shop drawing has to keep showing the panel the way it is actually
 * built.
 */
export interface DeckPanelPlacement {
  index: number;
  /** Plan position of the panel's origin corner, in feet. */
  anchorX: number;
  anchorZ: number;
  /** Yaw about the vertical, applied before the panel is tipped flat.
   *
   * ⚠ Same sign convention as the bale foundation's render data, which the
   * 3D view applies as `rotation={[0, -rotationRad, 0]}`. Getting this
   * backwards puts the deck at right angles to its own building, which is
   * obvious on screen and invisible in a unit test — so it is written down
   * here rather than left to be rediscovered. */
  rotationRad: number;
  widthIn: number;
  /** How far the panel reaches, wall to wall. */
  spanIn: number;
  /** Distance from the run's start to this panel's near edge, in inches. */
  atIn: number;
}

export interface DeckPlacementResult {
  placements: DeckPanelPlacement[];
  /** The span every panel on this deck has to cover, in inches. */
  spanIn: number;
  /** The total the panel widths have to add up to, in inches. */
  runIn: number;
  refusal: string | null;
}

/**
 * Lay a run of floor or roof panels across a footprint.
 *
 * The span/run split is `footprintSpanAndRun`, the same one the joist layout
 * uses, so a building's joists and its floor panels can never be drawn at
 * right angles to each other. Panels repeat along the LONGER bounding
 * dimension and each one spans the shorter.
 *
 * ⚠ The run is the footprint's OUTER dimension, because the walls bear on
 * the deck rather than sitting beside it.
 */
export function deckPanelPlacements(footprint: Footprint, panelWidthsIn: readonly number[]): DeckPlacementResult {
  const { axis, spanFt, runFt, minX, maxX, minY, maxY } = footprintSpanAndRun(footprint);
  const spanIn = spanFt * 12;
  const runIn = runFt * 12;

  if (panelWidthsIn.length === 0) {
    return { placements: [], spanIn, runIn, refusal: "No panels to place on this deck." };
  }
  const total = panelWidthsIn.reduce((a, b) => a + b, 0);
  if (Math.abs(total - runIn) > 1e-6) {
    return {
      placements: [],
      spanIn,
      runIn,
      refusal:
        `These panels add up to ${total.toFixed(2)}in but the run is ${runIn.toFixed(2)}in. ` +
        "Placing them anyway would draw a deck that does not reach its own walls.",
    };
  }

  /* Two cases, and the difference is only which way the run points.
     `footprintSpanAndRun` gives axis "y" when a member spans the depth, so
     the run repeats along X; "x" is the other way round.

     In the panel's own frame X is its width (along the run) and Z is its
     span, so the yaw has to put local X on the run. For axis "y" that is
     already true and the yaw is zero. */
  const placements: DeckPanelPlacement[] = [];
  let atIn = 0;
  for (const [index, widthIn] of panelWidthsIn.entries()) {
    const alongFt = atIn / 12;
    placements.push(
      axis === "y"
        ? { index, anchorX: minX + alongFt, anchorZ: minY, rotationRad: 0, widthIn, spanIn, atIn }
        : /* Run along +Y, span along -X: this yaw puts the panel's width on
             +Y and its span on -X, so the anchor is the far X edge. */
          { index, anchorX: maxX, anchorZ: minY + alongFt, rotationRad: Math.PI / 2, widthIn, spanIn, atIn },
    );
    atIn += widthIn;
  }

  return { placements, spanIn, runIn, refusal: null };
}
