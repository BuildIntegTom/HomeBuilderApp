import { divideOnEighthGrid, FLOOR_ROOF_MIN_PANEL_WIDTH_IN } from "./floorRoofPanelMembers";

/**
 * The widest panel anybody will build.
 *
 * > *"The tentitive maximum is 4' x 18'. No reason to build such a behemoth
 * > panel that big in both directions though."* — Tommy, 2026-10-23
 *
 * ⚠ Tentative, and his own caveat is the important half: 4ft x 18ft is the
 * corner of the envelope, not a size to aim at. Measured, a 48in x 18ft floor
 * panel comes to about 943lb — wood and straw only, before any plaster.
 */
export const MAX_PANEL_WIDTH_IN = 48;
export const MAX_PANEL_LENGTH_IN = 18 * 12;

/** One tapered panel on a ring-roof facet. */
export interface TaperedRingPanel {
  index: number;
  /** Width at the inner (short) edge of the facet. */
  innerWidthIn: number;
  /** Width at the outer (long) edge. */
  outerWidthIn: number;
  /** Offset from the facet's start along the inner edge. */
  innerAtIn: number;
  /** Offset from the facet's start along the outer edge. */
  outerAtIn: number;
  /** How far each side edge leans off the span direction. The two end panels
   * carry the hip rake; the ones between share the facet's splay evenly. */
  startRakeDeg: number;
  endRakeDeg: number;
}

export interface RingFacetDivision {
  panels: TaperedRingPanel[];
  /** Null when the facet divides; otherwise why it cannot, in words. */
  refusal: string | null;
  /** True when every panel came out the same width to within 1/8in — the
   * case that buys one jig and one press setup for the whole ring. */
  effectivelyIdentical: boolean;
}

export interface RingFacetDivisionOptions {
  innerEdgeIn: number;
  outerEdgeIn: number;
  spanIn: number;
  maxWidthIn?: number;
  minWidthIn?: number;
}

/**
 * Divide one facet of a ring roof into tapered panels that each reach from
 * the inner wall to the outer wall.
 *
 * **Scheme B**, chosen by Tommy 2026-10-23 over bespoke hip panels on a
 * rectangular field: *"Identical tapered panels sounds awesome."*
 *
 * The rule that forces it is his: *"They need their joists to all bear on the
 * panel below it."* On a ring that reduces to a single sentence — every panel
 * must reach from the inner wall to the outer wall — because a panel's joists
 * live on its two side edges, and an edge that stops short of a wall leaves
 * its joist hanging. A sharp triangular hip fails exactly there. Divide the
 * facet into panels that all span the full width and the problem disappears
 * along with the hips.
 *
 * ⚠ **The panels are near-identical, not identical.** Dividing evenly almost
 * never lands on the 1/8in grid: a 40ft octagon with a 10ft ring splits its
 * 99 1/4in inner edge five ways into 19.85in, which is not a fraction anybody
 * cuts. Both edges are divided on the grid instead, so panels differ by at
 * most 1/8in — one jig and one press block still cover the facet, and the run
 * still sums exactly.
 */
export function divideRingFacet(options: RingFacetDivisionOptions): RingFacetDivision {
  const maxWidthIn = options.maxWidthIn ?? MAX_PANEL_WIDTH_IN;
  const minWidthIn = options.minWidthIn ?? FLOOR_ROOF_MIN_PANEL_WIDTH_IN;
  const { innerEdgeIn, outerEdgeIn, spanIn } = options;

  const empty = { panels: [], effectivelyIdentical: false };
  if (!(innerEdgeIn > 0) || !(outerEdgeIn > 0) || !(spanIn > 0)) {
    return { ...empty, refusal: "This facet has no edges or no span to divide." };
  }
  if (outerEdgeIn < innerEdgeIn) {
    return { ...empty, refusal: "The outer edge of a ring facet cannot be shorter than its inner edge." };
  }

  /* The outer edge sets the floor on the count (no panel wider than the
     maximum) and the inner edge sets the ceiling (none narrower than the
     minimum). A ring that taper enough squeezes the two together. */
  const fewest = Math.ceil(outerEdgeIn / maxWidthIn - 1e-9);
  const most = Math.floor(innerEdgeIn / minWidthIn + 1e-9);
  if (fewest > most) {
    return {
      ...empty,
      refusal:
        `This facet tapers too hard to divide: its ${outerEdgeIn.toFixed(2)}in outer edge needs at least ` +
        `${fewest} panels to stay under ${maxWidthIn}in, but its ${innerEdgeIn.toFixed(2)}in inner edge allows ` +
        `at most ${most} before they drop under ${minWidthIn}in. A narrower ring, or a different maximum, is ` +
        "what gives.",
    };
  }

  /* The fewest panels that fit — widest panels, least fabrication, and the
     closest this ever gets to the 4ft module the rest of the building uses. */
  const count = fewest;
  const innerWidths = divideOnEighthGrid(innerEdgeIn, count);
  const outerWidths = divideOnEighthGrid(outerEdgeIn, count);

  const panels: TaperedRingPanel[] = [];
  let innerAtIn = 0;
  let outerAtIn = 0;
  for (let index = 0; index < count; index++) {
    const innerWidthIn = innerWidths[index]!;
    const outerWidthIn = outerWidths[index]!;
    panels.push({
      index,
      innerWidthIn,
      outerWidthIn,
      innerAtIn,
      outerAtIn,
      startRakeDeg: (Math.atan2(outerAtIn - innerAtIn, spanIn) * 180) / Math.PI,
      endRakeDeg: (Math.atan2(outerAtIn + outerWidthIn - (innerAtIn + innerWidthIn), spanIn) * 180) / Math.PI,
    });
    innerAtIn += innerWidthIn;
    outerAtIn += outerWidthIn;
  }

  const widest = Math.max(...panels.map((p) => p.outerWidthIn));
  const narrowest = Math.min(...panels.map((p) => p.outerWidthIn));
  const innerSpread = Math.max(...innerWidths) - Math.min(...innerWidths);

  return {
    panels,
    refusal: null,
    effectivelyIdentical: widest - narrowest <= 0.125 + 1e-9 && innerSpread <= 0.125 + 1e-9,
  };
}
