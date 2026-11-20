import {
  clipDeckPanelsToFootprint,
  deckPanelPlacements,
  clipRoofBandPanels,
  deckRunSplitPointsIn,
  footprintSpanAndRun,
  planDeckRunWidths,
  roofBandCutPlanAreaSqFt,
  roofBandCutToMitre,
  roofBearingBands,
  roofNeedsRidgeBeam,
  simpleRoofPlanes,
  type CompassDirection,
  type DeckPanelCut,
  type Footprint,
  type RoofForm,
} from "@building-integrity/geometry";
import {
  buildFloorRoofPanelMembers,
  buildRoofPanelCapMembers,
  columnBearingGirtPositionsIn,
  FLOOR_ROOF_PANEL_WIDTH_IN,
  floorRoofPanelCutLengthIn,
  floorRoofPanelMinimumWidthIn,
  floorRoofPanelOutlineSection,
  planFloorRoofPanelRun,
  ridgeBeamLayout,
  roofPanelCapOutlineSection,
  roofTopAboveRooflineIn,
  type FloorRoofPanelMitre,
  type FloorRoofPanelOptions,
  type FloorRoofPanelRole,
  type FloorRoofPanelRunPlan,
  type PanelMember,
} from "@building-integrity/panel-catalog";

const IN_PER_FT = 12;

/** Where a panel sits in the world, in the frame `Building3DView` draws in. */
export interface DeckPanelWorldPlacement {
  anchorX: number;
  anchorZ: number;
  anchorYFt: number;
  rotationRad: number;
  /** How far the panel is tipped off flat: 0 for a floor, the pitch for a roof. */
  tiltRad: number;
}

/**
 * One row of panels: a building's floor, or one plane of its roof.
 *
 * A roof has as many runs as it has planes, which is why the run — not the
 * building — is what carries the sheathing module and the panel names.
 */
export interface DeckPanelTakeoffRun {
  index: number;
  kind: "floor" | "roof";
  /** Which roof plane this run lies on; undefined on a floor. */
  planeIndex: number | undefined;
  /**
   * ⚠ **Which BAND UP THE SLOPE this run is, 0 at the eave — B34 stride 3c.**
   *
   * A plane crossed by an interior wall becomes two or more runs of panels
   * rather than one, each landing on that wall from its own side. `0` on every
   * roof without a bearing line, which is every roof this app built before
   * 2026-11-17, and `undefined` on a floor. See `roofBearingLines.ts`.
   */
  slopeBandIndex: number | undefined;
  /** The compass direction that plane looks. Undefined on a floor. */
  facing: CompassDirection | undefined;
  /** How far the row of panels repeats. A roof plane's is its eave, less the
   * gable-wall inset at each end. */
  runIn: number;
  /** What one panel reaches: a floor's span, or a roof's real SLOPED length. */
  spanIn: number;
  /** Names, roles, the 8ft sheathing module, and the too-narrow warning. */
  plan: FloorRoofPanelRunPlan;
}

export interface DeckPanelTakeoffInstance {
  /** Stable id, and the same one the 3D view uses for its React keys. */
  id: string;
  /** `F1`/`R1`, his own naming, with the plane's facing added when a roof has
   * more than one run — otherwise both planes would start again at R1. */
  name: string;
  kind: "floor" | "roof";
  role: FloorRoofPanelRole;
  runIndex: number;
  /** Which roof plane this panel is on; undefined on a floor. */
  planeIndex: number | undefined;
  /** Which band up the slope, 0 at the eave; undefined on a floor. See
   *  `DeckPanelTakeoffRun.slopeBandIndex`. */
  slopeBandIndex: number | undefined;
  /** The compass direction a roof plane looks, for the shop sheet's location
   * line — the same label the user reads elsewhere. Undefined on a floor. */
  facing: CompassDirection | undefined;
  /** How far along the run (floor) or along the eave (roof) this panel starts. */
  atIn: number;
  widthIn: number;
  /** The panel's own span: a floor's span, or a roof's real SLOPED length. */
  spanIn: number;
  /** The group of identical panels this one belongs to. */
  groupKey: string;
  world: DeckPanelWorldPlacement;
}

export interface DeckPanelTakeoffGroup {
  /** Stable per unique panel, for React keys and sheet ids. */
  key: string;
  kind: "floor" | "roof";
  role: FloorRoofPanelRole;
  widthIn: number;
  spanIn: number;
  /**
   * ⚠ **What the SHOP cuts to — the panel's LONG POINT.**
   *
   * Equal to `spanIn` on every square panel, which is every panel on a box
   * building. On a mitred one `spanIn` is the ENVELOPE and this is the longest
   * edge inside it: on the 16ft Octagon's leading deck panel, 135.75in against
   * a 192in envelope. Carried as its own field rather than recomputed at the
   * sheet, so the number on the drawing and the number in the model cannot
   * drift apart.
   */
  cutLengthIn: number;
  /** The run the first copy belongs to, for the sheet's "panel N of M across
   * a 40ft run" line and its sheathing note. */
  runIndex: number;
  /** Exactly what built `members` — so a consumer can rebuild or re-read it
   * without reconstructing the options and risking a different panel. */
  options: FloorRoofPanelOptions;
  members: PanelMember[];
  /**
   * The eave cap, kept as its own field rather than folded into `members`.
   *
   * ⚠ **It is DRAWN now.** It was held out of the 3D view while every one of
   * its pieces sat at `{x:0, y:0, z:0}` — web, seat and stiffeners stacked at
   * the panel's end rather than placed as a true L — because drawing them
   * would have put several members in one place. That is also what Tommy was
   * seeing: *"there is a several inch gap under where the roof panels bear."*
   * The part that fills it existed only on paper.
   *
   * It is placed in its real void now (see `buildRoofPanelCapMembers`), so
   * both the sheet and the view carry it. The field stays separate because a
   * consumer still has reason to tell the panel from the cap it lands on —
   * they are two fabricated parts, not one.
   */
  capMembers: PanelMember[];
  /** The panel's silhouette in (depth, span), for the box/membrane views. */
  sectionIn: { yIn: number; zIn: number }[];
  /**
   * ⚠ The EAVE CAP's own silhouette, which those views also need.
   *
   * > *"the box and membrane views still have the roof panels' bottoms
   * > raised up"* — Tommy, 2026-11-01. The panel really is raised: it is
   * cut back to a level seat so it can bear on a level plate, and the cap
   * fills what is underneath. The framed view has drawn it since the cap
   * was placed properly; a silhouette of the panel alone had nothing to
   * draw. Empty on a floor, and on a roof with no bearing seat.
   */
  capSectionIn: { yIn: number; zIn: number }[];
  instances: DeckPanelTakeoffInstance[];
}

export interface DeckPanelTakeoff {
  runs: DeckPanelTakeoffRun[];
  instances: DeckPanelTakeoffInstance[];
  groups: DeckPanelTakeoffGroup[];
  /** In words, not an empty list, when a deck cannot be panelised. */
  floorRefusal: string | null;
  roofRefusal: string | null;
  /** Real covered area per kind — what a $/sqft rate applies to. A roof's is
   * its SLOPED area, which is the material actually bought and hung. */
  coverageSqFt: { floor: number; roof: number };
}

export interface DeckPanelTakeoffInput {
  footprint: Footprint | null;
  /** The wall/panel depth, which is also a deck panel's depth AND how wide
   * the two edge panels of every run are. */
  depthIn: number;
  /**
   * ⚠ **The deck FIELD module — half the project's standard wall width**
   * (Tommy, 2026-11-19, snapping that dial to 48/39/36/32/24). Omitted, 24in:
   * the answer at the 48in default, so every existing caller is unchanged.
   *
   * It is what makes his 2026-10-23 rule hold at every setting rather than
   * only at 48 — *"2' wide panels everywhere else with 4' wall panels with a
   * center nailer"* — so a deck seam lands under either a wall panel's edge
   * or its centre nailer whatever the dial says.
   */
  fieldPanelWidthIn?: number;
  roofForm: RoofForm;
  /** Withheld on a shape with no resolved pitch — then there is no roof plane
   * to lay anything on, and no roof panels, rather than guessed ones. */
  roofPitchIn12: number | undefined;
  roofEaveHeightFt: number | undefined;
  roofTallSideNorth?: boolean;
  /** How far the roof stops short of each gable wall, which is the gable
   * panel's own depth when the gable ends run full height and 0 otherwise. */
  roofGableEndInsetIn: number;
  /**
   * ⚠ **Cut the roof to the building, or keep the simple overhang — his
   * choice, 2026-11-18.**
   *
   * > *"can we have the roof be basically cut to fit the raised octagon gable
   * > perimeter?"* ... *"i do like the simple overhang as an option."*
   *
   * On, every roof panel is cut by a PLUMB plane following the footprint, the
   * way the floor deck has been since 2026-11-16. Off, the roof is laid across
   * the building's bounding box and overhangs the chamfers, which is what it
   * did before this existed. ⚠ On a RECTANGLE the two are the same roof, so
   * the toggle does nothing there and every box building is untouched either
   * way.
   */
  roofCutToFootprint?: boolean;
}

const EMPTY: DeckPanelTakeoff = {
  runs: [],
  instances: [],
  groups: [],
  floorRefusal: null,
  roofRefusal: null,
  coverageSqFt: { floor: 0, roof: 0 },
};

/** The girt signature, so two panels group together only if a shop would cut
 * them the same. A floor panel carrying a column's pair of girts is a
 * DIFFERENT part from its neighbour, and gets its own sheet. */
function optionsKey(o: FloorRoofPanelOptions, role: FloorRoofPanelRole): string {
  return [
    o.kind,
    role,
    o.widthIn.toFixed(3),
    o.lengthIn.toFixed(3),
    o.depthIn.toFixed(3),
    (o.structuralGirtEnds ?? []).join("+") || "none",
    (o.extraStructuralGirtsAtIn ?? []).map((v) => v.toFixed(2)).join("+") || "none",
    o.pitchIn12 === undefined ? "flat" : o.pitchIn12.toFixed(3),
    o.bearingSeatDepthIn === undefined ? "noseat" : o.bearingSeatDepthIn.toFixed(3),
    /* ⚠ **THE MITRE IS PART OF THE IDENTITY, and leaving it out cut eight
       panels in ten to the wrong shape.** Measured on the 16ft Octagon the
       first time this was wired without it: ten floor panels collapsed into
       three groups, and a group builds ONE member set for every copy — so the
       panels over the far corner were fabricated from the near corner's cut.
       Two panels of the same width and span are only the same panel if the
       building takes the same bite out of both. */
    o.mitreIn
      ? [o.mitreIn.startNearIn, o.mitreIn.startFarIn, o.mitreIn.endNearIn, o.mitreIn.endFarIn]
          .map((v) => v.toFixed(3))
          .join("/")
      : "square",
  ].join("-");
}

/**
 * ⚠ **THE ONE FLOOR AND ROOF PANEL TAKEOFF — the panels the building
 * actually has, for every consumer that draws, counts, weighs or prices
 * them.**
 *
 * It exists because there were two, and they disagreed:
 *
 * - The 3D view laid the roof on its real PLANES — per plane, repeating along
 *   each eave, inset at the gable walls, each panel spanning the real SLOPED
 *   length. Floors got a structural girt at each end, plus the extra pair
 *   under every ridge column.
 * - The Shop Fabrication pages planned ONE flat run off the footprint's own
 *   span, with no planes, no inset, no slope and no girts at all.
 *
 * So the shop sheet for a floor panel was missing real members, and the sheet
 * for a roof panel described a panel of a different width and length from the
 * one on screen. That is the same class of defect as the gable lift the cut
 * list did not carry (see `gableTileRoofTopLiftIn`) — a drawing that does not
 * describe the building — and one function is the only fix that holds.
 *
 * ⚠ It computes BOTH kinds regardless of any toggle. The 3D view hides decks
 * by its own view switches and the documents gate on whether a floor or roof
 * system is enabled; those are different questions, and a takeoff that
 * answered either of them would be wrong for the other.
 *
 * ⚠ Panel WIDTHS, names, roles and the sheathing module come from
 * `planFloorRoofPanelRun`, which is the one planner for a row of deck panels.
 * This function adds what only the building knows: where each panel lands in
 * the world, which girts a column puts in it, and what its members are.
 */
/**
 * Turn one clipped panel into the mitre its members are built from.
 *
 * ⚠ **THE PANEL'S OWN Z RUNS BACKWARDS ON ONE OF THE TWO ORIENTATIONS, and
 * this is the trap of the whole wiring.** `deckPanelPlacements` lays a run
 * two ways: with `axis === "y"` the panel is anchored at `(minX, minY)`
 * unrotated, so its local Z counts up from `minY` — exactly the direction
 * `deckSpanRangeFtAt` measures. With `axis === "x"` the panel is anchored at
 * **maxX** and yawed 90°, so its local Z counts DOWN from `maxX` while the
 * clip still measures up from `minX`. Feeding the clip straight through would
 * mirror the cut: the right AREA, taken off the wrong wall.
 *
 * ⚠ **AND NO OCTAGON CAN CATCH IT — measured, not assumed.** An octagon is
 * symmetric across the span as well as along the run, so swapping a panel's
 * two ends is a no-op on every panel of one. Reversing this flag left the
 * whole octagon suite green. The test that does catch it builds a box with a
 * single chamfered corner by hand; see *"which SIDE of the panel the cut
 * lands on"* in `deckPanelTakeoff.test.ts`. Until the draw-wall tool can make
 * such a shape this flip is defensive rather than load-bearing, which is
 * worth knowing before anyone "simplifies" it away.
 *
 * ⚠ **`lengthIn` stays the panel's full envelope** (`spanIn`), so the mitre
 * is expressed as a pull-back from each end rather than as a new length. See
 * `FloorRoofPanelOptions.mitreIn`.
 *
 * Returns undefined when nothing is cut, so a box building never carries a
 * mitre field at all — which is what keeps its group keys unchanged.
 */
function mitreFromCut(cut: DeckPanelCut, spanIn: number, spanRunsBackwards: boolean): FloorRoofPanelMitre | undefined {
  const nearStartIn = spanRunsBackwards ? spanIn - cut.nearEndIn : cut.nearStartIn;
  const nearEndIn = spanRunsBackwards ? spanIn - cut.nearStartIn : cut.nearEndIn;
  const farStartIn = spanRunsBackwards ? spanIn - cut.farEndIn : cut.farStartIn;
  const farEndIn = spanRunsBackwards ? spanIn - cut.farStartIn : cut.farEndIn;
  const mitre: FloorRoofPanelMitre = {
    startNearIn: nearStartIn,
    startFarIn: farStartIn,
    endNearIn: spanIn - nearEndIn,
    endFarIn: spanIn - farEndIn,
  };
  const cutsAnything =
    Math.abs(mitre.startNearIn) > 1e-6 ||
    Math.abs(mitre.startFarIn) > 1e-6 ||
    Math.abs(mitre.endNearIn) > 1e-6 ||
    Math.abs(mitre.endFarIn) > 1e-6;
  return cutsAnything ? mitre : undefined;
}

export function computeDeckPanelTakeoff(input: DeckPanelTakeoffInput): DeckPanelTakeoff {
  const {
    footprint,
    depthIn,
    fieldPanelWidthIn = FLOOR_ROOF_PANEL_WIDTH_IN,
    roofForm,
    roofPitchIn12,
    roofEaveHeightFt,
    roofTallSideNorth,
    roofGableEndInsetIn,
    roofCutToFootprint = false,
  } =
    input;
  if (!footprint) return EMPTY;

  const runs: DeckPanelTakeoffRun[] = [];
  const instances: DeckPanelTakeoffInstance[] = [];
  const byKey = new Map<
    string,
    { options: FloorRoofPanelOptions; role: FloorRoofPanelRole; runIndex: number; instances: DeckPanelTakeoffInstance[] }
  >();
  const push = (instance: DeckPanelTakeoffInstance, options: FloorRoofPanelOptions, role: FloorRoofPanelRole) => {
    instances.push(instance);
    const existing = byKey.get(instance.groupKey);
    if (existing) existing.instances.push(instance);
    else byKey.set(instance.groupKey, { options, role, runIndex: instance.runIndex, instances: [instance] });
  };

  /* ⚠ Where the ridge columns come down, so the floor panels under them carry
     the extra girts he asked for: *"one under each side of the panel resting
     above it."* Read here rather than in the view, because the shop sheet
     needs them at least as much as the picture does — a floor panel built
     without them is a panel built to carry a column it cannot. */
  /* ⚠ **AND ONLY WHEN THERE REALLY IS A RIDGE BEAM — B34 stride 3c.** Stride 3
     stopped building the beam and its columns when a WALL runs under the ridge,
     but this block kept laying extra structural girts in the floor panels
     underneath them: reinforcement for posts that are not built, on every
     Multiplex, in the shop sheets and in the weight. Found by reading this
     function rather than by any test, which is the honest record — the girts
     change no panel COUNT, so nothing on screen moves. `roofNeedsRidgeBeam` is
     the same single gate `ridgeBeamForPlan` reads, which is the point of it
     having become one. */
  const columnGirtAlongIn: number[] = [];
  if (
    roofForm === "peaked" &&
    roofPitchIn12 !== undefined &&
    roofEaveHeightFt !== undefined &&
    roofNeedsRidgeBeam(roofForm, footprint)
  ) {
    const peaked = simpleRoofPlanes(footprint, {
      form: "peaked",
      pitchIn12: roofPitchIn12,
      eaveHeightFt: roofEaveHeightFt,
    });
    const plane = peaked.planes[0];
    if (peaked.refusal === null && plane) {
      const layout = ridgeBeamLayout({ ridgeStartFt: plane.highStart, ridgeEndFt: plane.highEnd });
      /* ⚠ ENDS INCLUDED. The gable walls bear the ridge through a real column
         panel, so the floor under them needs the same pair of girts an
         interior post gets — and those are the two the floor would otherwise
         never see, because `columns` deliberately excludes the ends. */
      for (const column of [...layout.columns, ...layout.endBearings]) {
        columnGirtAlongIn.push(...columnBearingGirtPositionsIn(column.alongIn, column.widthIn, []).girtAtIn);
      }
    }
  }

  // --- Floor ---------------------------------------------------------------
  let floorRefusal: string | null = null;
  let floorCoverageSqFt = 0;
  {
    const { spanFt, runFt, axis } = footprintSpanAndRun(footprint);
    /* ⚠ **WHERE THE RUN HAS TO LAND A JOINT**, so that no panel straddles a
       corner of the building — his cut-to-fit decision of 2026-11-15. Empty
       on a box, which is what keeps every rectangle building planning its
       widths exactly as it did (the 24in module and the redistributed tail),
       byte for byte. */
    const splitAtIn = deckRunSplitPointsIn(footprint);
    const forcedWidthsIn =
      splitAtIn.length > 0
        ? planDeckRunWidths(
            runFt * IN_PER_FT,
            splitAtIn,
            floorRoofPanelMinimumWidthIn(true),
            /* ⚠ His own floor module as the CEILING for a segment — half a
               wall panel, not the whole one. A segment is divided into as few
               equal panels as fit under it, so the widths stay as near the
               module as a corner-bounded stretch allows. */
            fieldPanelWidthIn,
            depthIn,
          )
        : undefined;
    const plan = planFloorRoofPanelRun({
      kind: "floor",
      fieldPanelWidthIn,
      runLengthIn: runFt * IN_PER_FT,
      spanIn: spanFt * IN_PER_FT,
      depthIn,
      forcedWidthsIn,
    });
    floorRefusal = plan.refusal;
    if (plan.refusal === null) {
      const placed = deckPanelPlacements(
        footprint,
        plan.instances.map((i) => i.widthIn),
      );
      /* The cut itself: how far the building reaches across the span at each
         panel's two edges. A box returns every panel full-span and square. */
      const cuts = clipDeckPanelsToFootprint(
        footprint,
        plan.instances.map((i) => i.widthIn),
      );
      floorRefusal = placed.refusal;
      if (placed.refusal === null) {
        const runIndex = runs.length;
        runs.push({
          index: runIndex,
          kind: "floor",
          planeIndex: undefined,
          slopeBandIndex: undefined,
          facing: undefined,
          runIn: placed.runIn,
          spanIn: placed.spanIn,
          plan,
        });
        for (const p of placed.placements) {
          const planned = plan.instances[p.index]!;
          const cut = cuts[p.index];
          const mitreIn = cut ? mitreFromCut(cut, p.spanIn, axis === "x") : undefined;
          const options: FloorRoofPanelOptions = {
            kind: "floor",
            widthIn: p.widthIn,
            depthIn,
            lengthIn: p.spanIn,
            structuralGirtEnds: ["start", "end"],
            /* ⚠ A column sits over the middle of the SPAN, so its girts go at
               mid-span of whichever panels it crosses. Positions along the run
               pick which panels those are. */
            extraStructuralGirtsAtIn: columnGirtAlongIn
              .filter((alongIn) => alongIn >= p.atIn && alongIn < p.atIn + p.widthIn)
              .map(() => p.spanIn / 2),
            ...(mitreIn ? { mitreIn } : {}),
          };
          /* ⚠ **THE AREA IS THE TRAPEZOID'S, NOT THE RECTANGLE'S**, and this
             is the line that stops the deck overclaiming. Measured before it:
             on the 16ft Octagon the deck read 256 sq ft against the building's
             212.1 — 20.7% over, and that number reaches the price. */
          floorCoverageSqFt += cut
            ? ((cut.nearEndIn - cut.nearStartIn + (cut.farEndIn - cut.farStartIn)) / 2 / IN_PER_FT) *
              (p.widthIn / IN_PER_FT)
            : (p.widthIn / IN_PER_FT) * (p.spanIn / IN_PER_FT);
          push(
            {
              id: `floor-${p.index}`,
              name: planned.name,
              kind: "floor",
              role: planned.role,
              runIndex,
              planeIndex: undefined,
              slopeBandIndex: undefined,
              facing: undefined,
              atIn: p.atIn,
              widthIn: p.widthIn,
              spanIn: p.spanIn,
              groupKey: optionsKey(options, planned.role),
              world: {
                /* The floor deck hangs below Z=0, the finished floor the walls
                   stand on — the datum the bale foundation hangs from too. */
                anchorX: p.anchorX,
                anchorZ: p.anchorZ,
                anchorYFt: 0,
                rotationRad: p.rotationRad,
                tiltRad: 0,
              },
            },
            options,
            planned.role,
          );
        }
      }
    }
  }

  // --- Roof ----------------------------------------------------------------
  let roofRefusal: string | null = null;
  let roofCoverageSqFt = 0;
  if (roofPitchIn12 === undefined || roofEaveHeightFt === undefined) {
    /* Not a refusal in the sense of something going wrong: with no resolved
       pitch there is no plane to lay a panel on, and a guessed one cut
       through his gable panels the last time it was tried. */
    roofRefusal = null;
  } else {
    const roof = simpleRoofPlanes(footprint, {
      form: roofForm,
      pitchIn12: roofPitchIn12,
      eaveHeightFt: roofEaveHeightFt,
      tallSideNorth: roofTallSideNorth,
    });
    roofRefusal = roof.refusal;
    if (roof.refusal === null) {
      /* ⚠ **B34 stride 3c: an interior wall part way up a plane splits its
         run of panels in two**, because an 18ft panel reaches only 15.0ft of
         ground at 8:12 and his 36ft Multiplex needs 18ft a side. Empty on
         every building without one, which returns a single band per plane and
         is byte-identical to what this did before. */
      const bands = roofBearingBands(footprint, roof);
      const tiltRad = Math.atan2(roofPitchIn12, 12);
      const multiPlane = roof.planes.length > 1;
      for (const [planeIndex, plane] of roof.planes.entries()) {
        /* ⚠ A PANEL HAS TO RUN TOWARD ITS OWN HIGH EDGE, and on a peak one of
           the two planes runs the opposite way round the building. The view
           yaws by -rotationRad, which sends the panel's span to the low edge's
           direction turned 90 degrees anticlockwise: inward for the near
           plane, straight OUT of the building for the far one. Walking that
           plane's low edge backwards flips the span to match. */
        const lowMidX = (plane.lowStart.x + plane.lowEnd.x) / 2;
        const lowMidY = (plane.lowStart.y + plane.lowEnd.y) / 2;
        const towardHighX = (plane.highStart.x + plane.highEnd.x) / 2 - lowMidX;
        const towardHighY = (plane.highStart.y + plane.highEnd.y) / 2 - lowMidY;
        const forwardDx = plane.lowEnd.x - plane.lowStart.x;
        const forwardDy = plane.lowEnd.y - plane.lowStart.y;
        const spanPointsInward = -forwardDy * towardHighX + forwardDx * towardHighY > 0;
        const originX = spanPointsInward ? plane.lowStart.x : plane.lowEnd.x;
        const originY = spanPointsInward ? plane.lowStart.y : plane.lowEnd.y;
        const edgeDx = spanPointsInward ? forwardDx : -forwardDx;
        const edgeDy = spanPointsInward ? forwardDy : -forwardDy;
        const fullEdgeLengthIn = Math.hypot(edgeDx, edgeDy) * IN_PER_FT;
        /* ⚠ The roof stops at the gable walls' INSIDE faces when the gable
           ends run full height, so it loses the inset at BOTH ends of the
           eave and starts one inset along. Refuse rather than plan a negative
           run: a building narrower than its own two gable walls has no roof
           to tile. */
        const edgeLengthIn = fullEdgeLengthIn - 2 * roofGableEndInsetIn;
        if (!(edgeLengthIn > 0)) {
          roofRefusal =
            `This roof's eave is ${fullEdgeLengthIn.toFixed(1)}in, which its two full-height gable walls ` +
            `(${roofGableEndInsetIn.toFixed(1)}in each) leave no room inside.`;
          continue;
        }
        const rotationRad = Math.atan2(edgeDy, edgeDx);
        /* ⚠ **THE EAVE'S OWN AXIS, which is NOT the floor's run axis.** A
           floor repeats along whichever axis its joists do not span; a roof
           repeats along its eave, which is the ridge's. They agree on most
           buildings and not on all, and taking the floor's is the mistake the
           cut's own `runAxis` parameter exists to make impossible. */
        const eaveUx = edgeDx / (fullEdgeLengthIn / IN_PER_FT);
        const eaveUy = edgeDy / (fullEdgeLengthIn / IN_PER_FT);
        const runAxis: "x" | "y" = Math.abs(eaveUx) >= Math.abs(eaveUy) ? "x" : "y";
        const runComponent = runAxis === "x" ? eaveUx : eaveUy;
        /* ⚠ **Only an AXIS-ALIGNED eave is cut.** `simpleRoofPlanes` builds
           its planes over the bounding box, so every eave it produces is
           axis-aligned today — and a diagonal one would make the clip's run
           coordinate a projection rather than a position, which is a different
           construction. Refused by not cutting rather than by cutting wrongly. */
        const eaveIsAxisAligned = Math.abs(runComponent) > 1 - 1e-6;
        const cutThisPlane = roofCutToFootprint && eaveIsAxisAligned;
        const runSign: 1 | -1 = runComponent >= 0 ? 1 : -1;
        const runOriginFt = (runAxis === "x" ? originX : originY) + runComponent * (roofGableEndInsetIn / IN_PER_FT);
        const eaveAcrossFt = runAxis === "x" ? lowMidY : lowMidX;
        /* Unit vector along the eave — from the FULL edge, because the inset
           is a distance along that same direction and dividing by the already
           shortened length would scale it wrong. */
        const ux = edgeDx / (fullEdgeLengthIn / IN_PER_FT);
        const uy = edgeDy / (fullEdgeLengthIn / IN_PER_FT);
        /* ⚠ **UP THE SLOPE IN PLAN**, which is the direction a band's start
           moves along. Taken from the plane's own two edge midpoints rather
           than by rotating the eave vector, because the sign of that rotation
           is exactly what `spanPointsInward` above had to work out and getting
           it wrong puts the upper band OUTSIDE the building. */
        const upDx = (plane.highStart.x + plane.highEnd.x) / 2 - lowMidX;
        const upDy = (plane.highStart.y + plane.highEnd.y) / 2 - lowMidY;
        const upLen = Math.hypot(upDx, upDy) || 1;
        const upX = upDx / upLen;
        const upY = upDy / upLen;
        /* The slope length one foot of ground buys at this pitch. Taken as a
           RATIO off the plane rather than recomputed from the pitch, so a band
           and its own plane can never disagree about how steep the roof is. */
        const slopePerRunFt = plane.runFt > 0 ? plane.slopeFt / plane.runFt : 1;
        const upSign: 1 | -1 = (runAxis === "x" ? upY : upX) >= 0 ? 1 : -1;
        /* ⚠ **A panel may not straddle a corner of the building**, or its end
           is a kink and the part is five-sided. The floor takes the same
           boundaries from `deckRunSplitPointsIn`; the roof's are computed in its
           OWN row frame, because that function measures from the footprint's
           minimum along its axis while this row starts at the gable inset and
           may run backwards. */
        const cornerSplitsIn = !cutThisPlane
          ? []
          : [
              ...new Set(
                footprint.corners
                  .map((c) => ((runAxis === "x" ? c.point.x : c.point.y) - runOriginFt) * runSign * IN_PER_FT)
                  .filter((alongIn) => alongIn > 1e-6 && alongIn < edgeLengthIn - 1e-6)
                  .map((alongIn) => Math.round(alongIn * 1e6) / 1e6),
              ),
            ].sort((a, b) => a - b);
        const planeBands = bands[planeIndex]?.bandRunsFt ?? [plane.runFt];
        let groundBeforeFt = 0;
        const multiBand = planeBands.length > 1;

        for (const [slopeBandIndex, bandRunFt] of planeBands.entries()) {
          const bandBaseFt = groundBeforeFt;
          groundBeforeFt += bandRunFt;
          const spanIn = bandRunFt * slopePerRunFt * IN_PER_FT;
          const plan = planFloorRoofPanelRun({
            kind: "roof",
            fieldPanelWidthIn,
            runLengthIn: edgeLengthIn,
            spanIn,
            depthIn,
            pitchIn12: roofPitchIn12,
            ...(cutThisPlane && cornerSplitsIn.length > 0
              ? {
                  forcedWidthsIn: planDeckRunWidths(
                    edgeLengthIn,
                    cornerSplitsIn,
                    floorRoofPanelMinimumWidthIn(false),
                    fieldPanelWidthIn,
                    depthIn,
                  ),
                }
              : {}),
          });
          if (plan.refusal !== null) {
            roofRefusal = plan.refusal;
            continue;
          }
          const runIndex = runs.length;
          runs.push({
            index: runIndex,
            kind: "roof",
            planeIndex,
            slopeBandIndex,
            facing: plane.facing,
            runIn: edgeLengthIn,
            spanIn,
            plan,
          });
          /* Where this band's own eave sits: `bandBaseFt` of ground up the
             slope from the plane's, and the matching rise above it. */
          const bandLowHeightFt = plane.lowHeightFt + (bandBaseFt * roofPitchIn12) / 12;
          const bandOriginX = originX + upX * bandBaseFt;
          const bandOriginY = originY + upY * bandBaseFt;
          /* The cut itself: how far the building reaches up this band's slope
             at every panel's two edges, in PLAN. A rectangle returns every
             panel full-span and square, so nothing moves on one. */
          const bandCuts = cutThisPlane
            ? clipRoofBandPanels(footprint, {
                runAxis,
                runOriginFt,
                runSign,
                eaveAcrossFt,
                upSign,
                bandBaseIn: bandBaseFt * IN_PER_FT,
                bandRunIn: bandRunFt * IN_PER_FT,
                panelWidthsIn: plan.instances.map((inst) => inst.widthIn),
              })
            : [];
          for (const [i, planned] of plan.instances.entries()) {
          const bandCut = bandCuts[i];
          /* ⚠ **PLAN inches become SLOPE inches here and nowhere else.** A
             panel is the hypotenuse over the ground it covers, so a chamfer that
             takes 12in of ground takes 12.65in off the panel at 4:12. Handing the
             plan figure straight to the panel builder would cut every mitred roof
             panel short, by more the steeper the roof. */
          const mitreIn = bandCut?.isMitred
            ? roofBandCutToMitre(bandCut, bandRunFt * IN_PER_FT, slopePerRunFt)
            : undefined;
          const options: FloorRoofPanelOptions = {
            kind: "roof",
            widthIn: planned.widthIn,
            depthIn,
            lengthIn: spanIn,
            ...(mitreIn ? { mitreIn } : {}),
            /* A roof panel never carries one: *"their weight should be on
               both the inner and outer wyth of the wall panel."* */
            structuralGirtEnds: [],
            /* ⚠ The pitch is what PLUMB-CUTS the tall end, and the wall depth
               is what gives it a LEVEL bearing via the wedge. */
            pitchIn12: roofPitchIn12,
            bearingSeatDepthIn: depthIn,
          };
          /* ⚠ **THE TRAPEZOID'S AREA, NOT THE RECTANGLE'S**, the line that stops
             the roof overclaiming exactly as the floor's own does. Measured on the
             16ft Octagon, the floor read 256 sq ft against the building's 212.1
             before its cut landed; a roof over a bounding box is the same 20.7%
             over, and that number reaches the price. */
          roofCoverageSqFt += bandCut
            ? roofBandCutPlanAreaSqFt(bandCut, planned.widthIn) * slopePerRunFt
            : (planned.widthIn / IN_PER_FT) * (bandRunFt * slopePerRunFt);
          /* The inset is where the row STARTS, so a panel's distance into the
             building is its distance along the plan plus that inset. */
          const alongFt = (roofGableEndInsetIn + planned.atIn) / IN_PER_FT;
          push(
            {
              id: `roof-${planeIndex}-${slopeBandIndex}-${i}`,
              /* ⚠ The band has to be in the NAME once there is more than one,
                 or both bands start again at R1 on the same plane and a crew
                 has two different panels both called R1 (E). Same argument the
                 facing suffix already answers one level up. */
              name: multiBand
                ? `${planned.name} (${plane.facing} band ${slopeBandIndex + 1})`
                : multiPlane
                  ? `${planned.name} (${plane.facing})`
                  : planned.name,
              kind: "roof",
              role: planned.role,
              runIndex,
              planeIndex,
              slopeBandIndex,
              facing: plane.facing,
              atIn: planned.atIn,
              widthIn: planned.widthIn,
              spanIn,
              groupKey: optionsKey(options, planned.role),
              world: {
                anchorX: bandOriginX + ux * alongFt,
                anchorZ: bandOriginY + uy * alongFt,
                /* ⚠ The anchor is the panel's TOP at its low edge, because
                   member Y runs downward once the panel is tipped, so it has
                   to clear the plane by the panel's PLUMB thickness for the
                   underside to land on it. `roofTopAboveRooflineIn` is that
                   number and the gable's lift reads the SAME function. */
                anchorYFt: bandLowHeightFt + roofTopAboveRooflineIn(depthIn, roofPitchIn12) / IN_PER_FT,
                rotationRad,
                tiltRad,
              },
            },
            options,
            planned.role,
          );
          }
        }
      }
    }
  }

  const groups: DeckPanelTakeoffGroup[] = [...byKey.entries()].map(
    ([key, { options, role, runIndex, instances: groupInstances }]) => ({
      key,
      kind: options.kind,
      role,
      widthIn: options.widthIn,
      spanIn: options.lengthIn,
      cutLengthIn: floorRoofPanelCutLengthIn(options),
      runIndex,
      options,
      /* Built ONCE per unique panel, not once per copy — the whole point of
         grouping, and what keeps a 40-panel roof from building 40 member sets
         on every render. */
      members: buildFloorRoofPanelMembers(options),
      capMembers:
        options.kind === "roof" && options.pitchIn12 !== undefined
          ? buildRoofPanelCapMembers(options, "eave", options.pitchIn12)
          : [],
      capSectionIn:
        options.kind === "roof" && options.pitchIn12 !== undefined
          ? roofPanelCapOutlineSection(options, options.pitchIn12)
          : [],
      sectionIn: floorRoofPanelOutlineSection(options),
      instances: groupInstances,
    }),
  );

  return {
    runs,
    instances,
    groups,
    floorRefusal,
    roofRefusal,
    coverageSqFt: { floor: floorCoverageSqFt, roof: roofCoverageSqFt },
  };
}
