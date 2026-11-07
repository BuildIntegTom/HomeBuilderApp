import {
  addCourtyard,
  buildOctagonFootprint,
  buildRectangleFootprint,
  footprintLoops,
  isOffsetRefusal,
  type Footprint,
} from "@building-integrity/geometry";

/**
 * **U3 — THE STARTER TEMPLATES.**
 *
 * > *"6 prefabs include - Tiny House (16x24' shed roof with tall north wall),
 * > the Tank (24x48 gable roof), octagon (16' or 32' diameters sub options),
 * > Cindy (see buildinteg.com/cindy for floor plan), square courtyard octagon
 * > courtyard, or draw your own, log in OR (if logged in) open from cloud."*
 * > — Tommy, 2026-11-05
 *
 * ⚠ **A template is a RECIPE, not a frozen project file.** Every tile here
 * carries a footprint and nothing else: no girt style, no brace pattern, no
 * roof pitch, no panel width. Those come from the app's own live defaults at
 * the moment the tile is picked, which is the only way a template cannot go
 * stale — a saved `ProjectState` captured today would pin today's defaults
 * into a building a stranger opens next year and quietly show them an app
 * that no longer exists.
 *
 * ⚠ **And the ROOF is not in here either, which is the surprising part.**
 * `decideRoofForm` already picks shed or peak from how far one run of panels
 * reaches at 4:12 — his own rule — so:
 *
 * - the **Tiny House** is 24ft x 16ft, its short walls are the 16ft pair, a
 *   16ft span is inside one panel run, and it gets a **shed** — tall side
 *   north, because `simpleRoofPlanes` already defaults a shed's tall side
 *   north "so the roof faces south";
 * - the **Tank** is 48ft x 24ft, its short walls are 24ft, which is past the
 *   ~17ft a run reaches, so it gets a **peak**.
 *
 * Both of the roofs he named therefore fall out of the dimensions he named.
 * Nothing here sets a roof form, and nothing here may start to: a template
 * that forced one could disagree with the rule the rest of the app builds
 * roofs by, and then two of his own decisions would be fighting inside one
 * building.
 */

export type StarterTemplateId =
  | "tiny-house"
  | "the-tank"
  | "octagon"
  | "the-cindy"
  | "square-courtyard"
  | "octagon-courtyard";

/** What `page.tsx` has to do to put this building on screen. */
export interface StarterPlan {
  shape: "rectangle" | "octagon";
  widthFt: number;
  depthFt: number;
  /**
   * Present only on the two courtyard tiles: the BUILDING's width all the way
   * round, not the courtyard's. That is `CourtyardPanel`'s own convention and
   * its reason holds here too — "a 40ft courtyard inside an octagon is 40ft
   * across which way?"
   */
  courtyardBuildingWidthFt?: number;
  /** Set only where the template states a thickness of his. */
  thicknessIn?: number;
}

export interface StarterTemplateOption {
  id: string;
  /** On the tile's own little switch, e.g. `16 ft`. */
  label: string;
  plan: StarterPlan;
}

export interface StarterTemplate {
  id: StarterTemplateId;
  name: string;
  /** One line under the name. */
  blurb: string;
  /** Two or more options means the tile draws a switch. */
  options: StarterTemplateOption[];
}

/**
 * ⚠ **THE CINDY SHIPS AS ITS OVERALL RECTANGLE — his call, 2026-11-06:**
 * *"Use your best judgment from the knowledge that you have for Cindy. We can
 * finesse it later. Let's just get something up there for now."*
 *
 * `55'-3"` x `34'-10"` are measurements rather than a reading of a drawing:
 * both perimeter chains on his MAIN FLOOR TOE UP PLAN close on them exactly
 * (32'-6" + 3'-3" + 19'-6" across the top against 33'-8" + 21'-7" along the
 * bottom; 14'-2" + 3'-3" + 14'-2" + 3'-3" down the right against the 418"
 * the plan itself states).
 *
 * ⚠ **The notch and the step are deliberately absent.** The real plan is not
 * a rectangle — there is a notch in the right-hand wall and a step near the
 * bottom — and from one screenshot at 1/8" = 1'-0" it is clear THAT it steps
 * but not which segments are walls or which way they turn. His standing rule
 * is that a wall length is exact, so **a rectangle at his two overall
 * dimensions is a true simplification; a notch at invented lengths would be a
 * false building.** A wall-run list or a DXF closes it in one pass.
 *
 * **15.5" is his**, the same day — the standard panel depth, so the Cindy
 * needs no special section.
 */
const CINDY_WIDTH_FT = 55 + 3 / 12;
const CINDY_DEPTH_FT = 34 + 10 / 12;

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    id: "tiny-house",
    name: "Tiny House",
    blurb: "A shed roof falling south off a tall north wall.",
    /* ⚠ 24 WIDE x 16 DEEP, and the order matters twice. The short walls have
       to be the 16ft pair for the span to reach as a shed, and the building
       has to be wider than it is deep for `simpleRoofPlanes` to run its ridge
       axis east-west — which is the condition under which "tall side north"
       applies at all. Entered the other way round it is a shed falling WEST,
       which is not the building he named. */
    options: [{ id: "default", label: "16 × 24 ft", plan: { shape: "rectangle", widthFt: 24, depthFt: 16 } }],
  },
  {
    id: "the-tank",
    name: "The Tank",
    blurb: "A gable running the long way, with its ridge column under the peak.",
    options: [{ id: "default", label: "24 × 48 ft", plan: { shape: "rectangle", widthFt: 48, depthFt: 24 } }],
  },
  {
    id: "octagon",
    name: "Octagon",
    blurb: "Eight mitered walls, every corner its own safety-oct-corner.",
    /* His own "sub options". Two real buildings on one tile rather than two
       tiles, because what differs is a size and not a shape. */
    options: [
      { id: "16", label: "16 ft across", plan: { shape: "octagon", widthFt: 16, depthFt: 16 } },
      { id: "32", label: "32 ft across", plan: { shape: "octagon", widthFt: 32, depthFt: 32 } },
    ],
  },
  {
    id: "the-cindy",
    name: "The Cindy",
    blurb: "His Panel-Ready Plan — 1650 sq ft, 3 bed / 2 bath. Overall rectangle for now.",
    options: [
      {
        id: "default",
        label: "55'-3\" × 34'-10\"",
        plan: { shape: "rectangle", widthFt: CINDY_WIDTH_FT, depthFt: CINDY_DEPTH_FT, thicknessIn: 15.5 },
      },
    ],
  },
  {
    id: "square-courtyard",
    name: "Square Courtyard",
    blurb: "A square ring around an open court, its inner walls facing in.",
    /* ⚠ 40ft and 12ft are THIS APP'S numbers, not his — he named the tile and
       not its size. 12ft is `CourtyardPanel`'s own default building width, and
       40ft is the smallest square that leaves a court (16ft) worth standing
       in. Both are starting points a user drags; neither claims to be a plan
       of anything, which is why neither is written down as one. */
    options: [
      {
        id: "default",
        label: "40 ft square, 12 ft deep",
        plan: { shape: "rectangle", widthFt: 40, depthFt: 40, courtyardBuildingWidthFt: 12 },
      },
    ],
  },
  {
    id: "octagon-courtyard",
    name: "Octagon Courtyard",
    blurb: "The concentric ring — two eight-sided loops, one roof sloping outward.",
    options: [
      {
        id: "default",
        label: "36 ft across, 10 ft deep",
        plan: { shape: "octagon", widthFt: 36, depthFt: 36, courtyardBuildingWidthFt: 10 },
      },
    ],
  },
];

/**
 * The footprint a plan produces — the SAME two calls `page.tsx` makes when the
 * tile is picked, which is what lets the tile's picture be a drawing of the
 * building rather than an illustration of one.
 *
 * Returns the outer footprint and says `courtyardRefused` if the inset was
 * refused. A refusal is a real answer (an inset that would self-intersect),
 * and a tile that silently drew a solid building while promising a ring would
 * be lying in a picture.
 */
export function footprintForPlan(plan: StarterPlan): { footprint: Footprint; courtyardRefused: boolean } {
  const base =
    plan.shape === "octagon"
      ? buildOctagonFootprint(plan.widthFt, plan.depthFt)
      : buildRectangleFootprint(plan.widthFt, plan.depthFt);
  if (plan.courtyardBuildingWidthFt === undefined) return { footprint: base, courtyardRefused: false };
  const ring = addCourtyard(base, plan.courtyardBuildingWidthFt);
  if (isOffsetRefusal(ring)) return { footprint: base, courtyardRefused: true };
  return { footprint: ring, courtyardRefused: false };
}

/**
 * Every closed loop of a plan's footprint, as points in feet — outer ring
 * first, then the courtyard if there is one.
 *
 * This is what a tile draws. ⚠ **It is not a 3D render, and the gap is worth
 * naming**: his words were *"so cool to see thumbnail models of that enter
 * that building"*, and a model is stride 2. What this is instead is the real
 * plan of the real building the tile makes — the same corners, the same
 * courtyard, the same proportions, from the same functions. A true drawing at
 * the wrong fidelity beats a pretty picture of a different building.
 */
export function planOutlineLoopsFt(plan: StarterPlan): { x: number; y: number }[][] {
  const { footprint } = footprintForPlan(plan);
  const pointOf = (cornerId: string) => footprint.corners.find((c) => c.id === cornerId)?.point;
  return footprintLoops(footprint)
    .map((loop) =>
      loop.walls.map((wall) => pointOf(wall.startCorner)).filter((p): p is { x: number; y: number } => p !== undefined),
    )
    .filter((points) => points.length >= 3);
}
