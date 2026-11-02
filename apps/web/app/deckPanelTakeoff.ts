import {
  deckPanelPlacements,
  footprintSpanAndRun,
  simpleRoofPlanes,
  type CompassDirection,
  type Footprint,
  type RoofForm,
} from "@building-integrity/geometry";
import {
  buildFloorRoofPanelMembers,
  buildRoofPanelCapMembers,
  columnBearingGirtPositionsIn,
  floorRoofPanelOutlineSection,
  planFloorRoofPanelRun,
  ridgeBeamLayout,
  roofPanelCapOutlineSection,
  roofTopAboveRooflineIn,
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
  roofForm: RoofForm;
  /** Withheld on a shape with no resolved pitch — then there is no roof plane
   * to lay anything on, and no roof panels, rather than guessed ones. */
  roofPitchIn12: number | undefined;
  roofEaveHeightFt: number | undefined;
  roofTallSideNorth?: boolean;
  /** How far the roof stops short of each gable wall, which is the gable
   * panel's own depth when the gable ends run full height and 0 otherwise. */
  roofGableEndInsetIn: number;
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
export function computeDeckPanelTakeoff(input: DeckPanelTakeoffInput): DeckPanelTakeoff {
  const { footprint, depthIn, roofForm, roofPitchIn12, roofEaveHeightFt, roofTallSideNorth, roofGableEndInsetIn } =
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
  const columnGirtAlongIn: number[] = [];
  if (roofForm === "peaked" && roofPitchIn12 !== undefined && roofEaveHeightFt !== undefined) {
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
    const { spanFt, runFt } = footprintSpanAndRun(footprint);
    const plan = planFloorRoofPanelRun({
      kind: "floor",
      runLengthIn: runFt * IN_PER_FT,
      spanIn: spanFt * IN_PER_FT,
      depthIn,
    });
    floorRefusal = plan.refusal;
    if (plan.refusal === null) {
      const placed = deckPanelPlacements(
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
          facing: undefined,
          runIn: placed.runIn,
          spanIn: placed.spanIn,
          plan,
        });
        for (const p of placed.placements) {
          const planned = plan.instances[p.index]!;
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
          };
          floorCoverageSqFt += (p.widthIn / IN_PER_FT) * (p.spanIn / IN_PER_FT);
          push(
            {
              id: `floor-${p.index}`,
              name: planned.name,
              kind: "floor",
              role: planned.role,
              runIndex,
              planeIndex: undefined,
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
        const spanIn = plane.slopeFt * IN_PER_FT;
        const plan = planFloorRoofPanelRun({
          kind: "roof",
          runLengthIn: edgeLengthIn,
          spanIn,
          depthIn,
          pitchIn12: roofPitchIn12,
        });
        if (plan.refusal !== null) {
          roofRefusal = plan.refusal;
          continue;
        }
        const runIndex = runs.length;
        runs.push({ index: runIndex, kind: "roof", planeIndex, facing: plane.facing, runIn: edgeLengthIn, spanIn, plan });
        const rotationRad = Math.atan2(edgeDy, edgeDx);
        /* Unit vector along the eave — from the FULL edge, because the inset
           is a distance along that same direction and dividing by the already
           shortened length would scale it wrong. */
        const ux = edgeDx / (fullEdgeLengthIn / IN_PER_FT);
        const uy = edgeDy / (fullEdgeLengthIn / IN_PER_FT);
        for (const [i, planned] of plan.instances.entries()) {
          const options: FloorRoofPanelOptions = {
            kind: "roof",
            widthIn: planned.widthIn,
            depthIn,
            lengthIn: spanIn,
            /* A roof panel never carries one: *"their weight should be on
               both the inner and outer wyth of the wall panel."* */
            structuralGirtEnds: [],
            /* ⚠ The pitch is what PLUMB-CUTS the tall end, and the wall depth
               is what gives it a LEVEL bearing via the wedge. */
            pitchIn12: roofPitchIn12,
            bearingSeatDepthIn: depthIn,
          };
          roofCoverageSqFt += (planned.widthIn / IN_PER_FT) * plane.slopeFt;
          /* The inset is where the row STARTS, so a panel's distance into the
             building is its distance along the plan plus that inset. */
          const alongFt = (roofGableEndInsetIn + planned.atIn) / IN_PER_FT;
          push(
            {
              id: `roof-${planeIndex}-${i}`,
              name: multiPlane ? `${planned.name} (${plane.facing})` : planned.name,
              kind: "roof",
              role: planned.role,
              runIndex,
              planeIndex,
              facing: plane.facing,
              atIn: planned.atIn,
              widthIn: planned.widthIn,
              spanIn,
              groupKey: optionsKey(options, planned.role),
              world: {
                anchorX: originX + ux * alongFt,
                anchorZ: originY + uy * alongFt,
                /* ⚠ The anchor is the panel's TOP at its low edge, because
                   member Y runs downward once the panel is tipped, so it has
                   to clear the plane by the panel's PLUMB thickness for the
                   underside to land on it. `roofTopAboveRooflineIn` is that
                   number and the gable's lift reads the SAME function. */
                anchorYFt: plane.lowHeightFt + roofTopAboveRooflineIn(depthIn, roofPitchIn12) / IN_PER_FT,
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

  const groups: DeckPanelTakeoffGroup[] = [...byKey.entries()].map(
    ([key, { options, role, runIndex, instances: groupInstances }]) => ({
      key,
      kind: options.kind,
      role,
      widthIn: options.widthIn,
      spanIn: options.lengthIn,
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
