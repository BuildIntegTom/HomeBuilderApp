import {
  roofBracePanelBandsFromWidths,
  sliceRoofPlaneBracing,
  snapRoofBracingToSeams,
} from "@building-integrity/geometry";
import {
  buildFloorRoofPanelMembers,
  buildRoofBraceMembers,
  JOIST_2X6_THICKNESS_IN,
  PLATE_2X4_THICKNESS_IN,
  roofBracePiecesForPanel,
  roofBraceTopFaceClearZIn,
  ROOF_BRACE_END_CLEARANCE_IN,
  type FloorRoofPanelOptions,
  type PanelMember,
  type RoofBracePiece,
} from "@building-integrity/panel-catalog";

/**
 * ⚠ **THE ONE RECIPE FOR BRACING A ROOF RUN — the join between the figure and
 * the panels it lands in.**
 *
 * The figure and its slicing live in `@building-integrity/geometry`; the panel
 * and its boards live in `@building-integrity/panel-catalog`; neither package
 * depends on the other and neither should. `apps/web` is the first place both
 * are in scope, so it is the only place this function can live — and it was
 * written as a helper inside `roofBraceAssembly.test.ts` first, where every
 * defect of the JOIN was found. It is promoted here rather than copied, so
 * that test and the app brace a run the same way or the test fails.
 *
 * ⚠ **IT IS PER RUN, NOT PER PANEL AND NOT PER BUILDING.** A brace crosses
 * panel seams, so no panel can work out its own boards; and a roof plane split
 * by an interior bearing wall is two runs with two different spans, so the
 * building cannot either. A run is the one thing that has both a length to lay
 * the figure along and a single span to lay it on.
 */
export interface RoofRunBracingInput {
  /** The panels across the run, in order from its near end. */
  panelWidthsIn: readonly number[];
  /** Whether each panel is cut on an angle in plan. Any one of them refuses
   * the whole run — see `ROOF_BRACE_MITRE_REFUSAL`. */
  panelMitred: readonly boolean[];
  /** The run's own SLOPED span, which is what a panel reaches. */
  spanIn: number;
  /** Panel depth, the wall thickness. */
  depthIn: number;
  /**
   * The panel options the run's panels were built from, by width, so the clear
   * band is read off the very members the takeoff will build rather than off a
   * panel assembled here from arguments that might differ.
   */
  optionsForWidthIn: (widthIn: number) => FloorRoofPanelOptions;
}

export interface RoofRunPanelBracing {
  panelIndex: number;
  members: PanelMember[];
  /**
   * What makes two braced panels THE SAME PART.
   *
   * ⚠ **IT IS GEOMETRY, AND IT DELIBERATELY LEAVES OUT THE BAY NUMBER.** Two
   * panels four bays apart can carry boards identical to the thousandth of an
   * inch — a repeating figure on a uniform module does exactly that — and
   * they are one part for a shop to cut. The bay a panel happens to sit in is
   * a locator like its `atIn`, which the group key has never carried either.
   * The consequence, stated rather than hidden: a sheet's "bay 3" comes from
   * the first copy, and the other copies sit in other bays.
   */
  signature: string;
  /** How far the worst board reaches past the braced region, into an end lid. */
  lidBiteIn: number;
  /** The most any one piece lost to the joists it now bears on. */
  trimmedIn: number;
  withinPanelSpan: boolean;
}

export interface RoofRunBracing {
  perPanel: RoofRunPanelBracing[];
  /** In words when this run carries no bracing at all, else null. */
  refusal: string | null;
  /** What the snap bought and spent, for the Review Log. Empty when refused. */
  why: string;
  snapped: boolean;
  bayCount: number;
  minMemberAngleDeg: number;
  maxMemberAngleDeg: number;
  maxDriftIn: number;
  /** Where the braced region sits in a panel's own span. */
  regionFromIn: number;
  regionToIn: number;
}

const noBracing = (refusal: string): RoofRunBracing => ({
  perPanel: [],
  refusal,
  why: "",
  snapped: false,
  bayCount: 0,
  minMemberAngleDeg: 0,
  maxMemberAngleDeg: 0,
  maxDriftIn: 0,
  regionFromIn: 0,
  regionToIn: 0,
});

/**
 * ⚠ **A MITRED RUN IS REFUSED RATHER THAN BRACED WRONG.**
 *
 * The figure is laid on ONE rectangle — a run's length by its span — and every
 * board is placed from it. A mitred panel is pulled back from that rectangle
 * at one or both corners, by a different amount at each of its two edges, so a
 * board the figure puts in the pulled-back triangle is a board hanging in air
 * past the end of the building. Clipping each board to its own panel's cut is
 * real work — the cut is in the X-Z plane, which is the plane the board's own
 * parallelogram already occupies, and `MemberPosition` says in its own doc
 * comment that those extrusions are mutually exclusive — and it is not this
 * stride's work.
 *
 * So an octagon's or a courtyard's roof says it is unbraced and why, which is
 * the same answer `buildFloorRoofPanelMembers` already gives for a mitre it
 * cannot compose with the roof's own end cuts.
 */
export const ROOF_BRACE_MITRE_REFUSAL =
  "⚠ This roof run is NOT braced. Its panels are cut on an angle in plan so the deck stops at the building, and the bracing figure is laid on the run's full rectangle — so a board near a cut corner would be placed outside the building. Clipping each board to its own panel's mitre is unbuilt, so the run is left unbraced rather than drawn with boards hanging past the roof.";

export function planRoofRunBracing(input: RoofRunBracingInput): RoofRunBracing {
  const { panelWidthsIn, panelMitred, spanIn, depthIn, optionsForWidthIn } = input;

  if (panelWidthsIn.length === 0) return noBracing("This run has no panels to brace.");
  if (!(spanIn > 0)) return noBracing("This run has no span, so there is no plane to brace.");
  if (!(depthIn > PLATE_2X4_THICKNESS_IN)) {
    return noBracing(
      `⚠ This roof run is NOT braced. A brace lies flat in the panel's outermost ${PLATE_2X4_THICKNESS_IN}in and these panels are only ${depthIn}in deep, so the board would be the whole thickness of the roof.`,
    );
  }
  if (panelMitred.some(Boolean)) return noBracing(ROOF_BRACE_MITRE_REFUSAL);

  /* ⚠ **THE WIDTHS' OWN SUM, NOT THE RUN'S NOMINAL LENGTH.** The slicer
     refuses bands that do not tile the plane exactly, by throwing — and it is
     right to, since a gap means a brace falling into nothing. But the two
     numbers can differ by float dust once a tail has been redistributed, and a
     throw here is a throw inside a render. The widths are what the panels
     really are, so they are what the plane is. */
  const planeWidthIn = panelWidthsIn.reduce((sum, w) => sum + w, 0);
  const bands = roofBracePanelBandsFromWidths([...panelWidthsIn]);

  /* ⚠ **THE CLEAR BAND COMES FIRST AND THE FIGURE IS BUILT ON IT.** Building
     the figure on the panel's full span and trimming afterwards would change
     every angle the snap chose, and the bay count with them. At 4:12 the
     region is about 7in shorter than the span — the plumb end lid eats that
     much of the top face, while the eave takes its cut from below and eats
     none of it — which is plenty to move a bay boundary.

     ⚠ Read once per DISTINCT WIDTH and intersected, not once per panel: the
     band is capped by the pitch and the depth rather than by the width, so a
     run has two or three distinct widths where it may have forty panels, and
     this function runs on every render. */
  let clearFromIn = 0;
  let clearToIn = spanIn;
  for (const widthIn of new Set(panelWidthsIn)) {
    const clear = roofBraceTopFaceClearZIn(
      buildFloorRoofPanelMembers(optionsForWidthIn(widthIn)),
      spanIn,
      JOIST_2X6_THICKNESS_IN,
      widthIn - JOIST_2X6_THICKNESS_IN,
    );
    clearFromIn = Math.max(clearFromIn, clear.fromIn);
    clearToIn = Math.min(clearToIn, clear.toIn);
  }
  const regionFromIn = clearFromIn + ROOF_BRACE_END_CLEARANCE_IN;
  const regionToIn = clearToIn - ROOF_BRACE_END_CLEARANCE_IN;
  const regionIn = regionToIn - regionFromIn;
  if (!(regionIn > 0)) {
    return noBracing(
      `⚠ This roof run is NOT braced. Between the end lids its panels' top faces are clear from ${clearFromIn.toFixed(
        2,
      )}in to ${clearToIn.toFixed(2)}in of a ${spanIn.toFixed(
        2,
      )}in span, and a board needs ${ROOF_BRACE_END_CLEARANCE_IN}in of clearance at each end to stay inside that — which leaves nothing to brace.`,
    );
  }

  const snap = snapRoofBracingToSeams(planeWidthIn, regionIn, bands);
  const sliced = sliceRoofPlaneBracing(snap, bands);

  const perPanel = bands.map((band, panelIndex) => {
    const pieces = roofBracePiecesForPanel(sliced.slices, panelIndex, band.atIn);
    const plan = buildRoofBraceMembers(pieces, {
      panelDepthIn: depthIn,
      panelSpanIn: spanIn,
      regionFromIn,
      regionToIn,
      clearXFromIn: JOIST_2X6_THICKNESS_IN,
      clearXToIn: band.widthIn - JOIST_2X6_THICKNESS_IN,
    });
    return {
      panelIndex,
      members: plan.members,
      signature: braceSignature(pieces),
      lidBiteIn: plan.lidBiteIn,
      trimmedIn: plan.trimmedIn,
      withinPanelSpan: plan.withinPanelSpan,
    };
  });

  return {
    perPanel,
    refusal: null,
    why: snap.why,
    snapped: snap.snapped,
    bayCount: snap.choice.bays,
    minMemberAngleDeg: snap.minMemberAngleDeg,
    maxMemberAngleDeg: snap.maxMemberAngleDeg,
    maxDriftIn: snap.maxDriftIn,
    regionFromIn,
    regionToIn,
  };
}

/**
 * The pieces a panel carries, as a string, for the group key.
 *
 * ⚠ The pieces are the WHOLE input to `buildRoofBraceMembers` bar the run's
 * own numbers, and those reach the key already through the panel's width,
 * span, depth and pitch. So this plus the existing key is complete: two panels
 * with the same key really do carry the same boards.
 */
export function braceSignature(pieces: readonly RoofBracePiece[]): string {
  if (pieces.length === 0) return "nobrace";
  return pieces
    .map((p) =>
      [
        p.figure,
        p.pieceIndex,
        p.pieceCount,
        p.x1In.toFixed(3),
        p.y1In.toFixed(3),
        p.x2In.toFixed(3),
        p.y2In.toFixed(3),
      ].join(":"),
    )
    .sort()
    .join("|");
}
