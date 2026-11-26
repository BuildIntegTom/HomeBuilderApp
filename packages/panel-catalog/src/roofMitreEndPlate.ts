import type { PanelMember, PanelSpacePoint2D } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  normalizeQuadWindingIn,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  SKIN_PLY_SPEC,
  SKIN_THICKNESS_IN,
} from "./panelMemberHelpers";
import type { FloorRoofPanelMitre } from "./floorRoofPanelMitreTypes";

/**
 * ⚠ **WHAT CLOSES A MITRED ROOF PANEL'S CUT FACE — his answer, 2026-11-25.**
 *
 * The plan mitre saws a roof panel's end lid off: it is built square and then
 * passed through a plumb plane, so on the 16ft Octagon's corner panel ten of
 * its lid boards go. `roofPlanMitre.ts` was honest about that and left the cut
 * face open, because closing it is a building decision. He made it:
 *
 * > *"An end plate with dual bevel cuts. Basically the same as a standard
 * > panel's top plate, except the 2x4s attached to the end plate span the
 * > shorter length of the lid and hug the insides of the studs (the full 3/4"
 * > plywood is exposed to the exterior with 2 vertical 2x4s butted up to the
 * > joist members)."*
 *
 * ## ⚠ It is a THIRD lid pattern, and the difference is the whole point
 *
 * | | boards | which way they run |
 * |---|---|---|
 * | square end lid | 2x4s edge to edge across the whole width | through the depth |
 * | FLOOR's mitred lid (2026-11-15) | tiled through the depth | **along the cut** |
 * | **this** | **exactly TWO** | through the depth, against the joists |
 *
 * A square lid tiles its face solid — fourteen boards on a 48in panel. The
 * floor's mitred lid turns them to run along the cut. This one does neither:
 * **two boards**, each hugging the inside of a side joist, with the plywood
 * spanning between them unbacked. Reading *"the same as a standard panel's top
 * plate"* as "so tile it solid" would have put ten boards here where he asked
 * for two, which is why the table above is in the file.
 *
 * ## ⚠ DUAL BEVEL, and both angles come from the cut itself
 *
 * The plate lies IN the mitre plane. That plane is raked in plan (the facet
 * angle) and, because a roof panel is tilted while the cut is plumb, raked
 * through the panel's depth as well — see `plumbSpanSlopeOf` in
 * `roofPlanMitre.ts`. Two angles at once on one piece, which is his *"a lot of
 * dual bevel cuts in the shop to get multiple angles to meet"* of 2026-11-18
 * arriving where he said it would. Nothing here computes an angle: the plate's
 * two faces are built as planes and `shopCutNotes` reads the angles off the
 * solid, the same way it does for every other cut member.
 *
 * ## ⚠ THE ASSUMPTION, stated rather than buried
 *
 * **The plate REPLACES what the cut left of the original end assembly**, it
 * does not sit on top of it. At the shallow corner of a mitre the old lid
 * survives almost intact, so keeping both would put two closures in the same
 * place — and *"an end plate"* reads as one part for the end. If that is
 * wrong, the fix is to keep the surviving sliver and start the plate where the
 * saw did.
 */

/** Where a point sits along the PLUMB span. The same `w` `roofPlanMitre.ts`
 *  cuts on, and the reason both files agree about where the plane is. */
const plumbWIn = (yIn: number, zIn: number, slope: number): number => zIn + yIn * slope;

/**
 * ⚠ **How much `w` a plate of perpendicular thickness `t` occupies.**
 *
 * `w` is measured along the panel's span at constant depth, and the plate's
 * own thickness is measured perpendicular to its face — so the two differ by
 * the face's slope, in BOTH of the directions it is raked:
 *
 * ```
 * K = sqrt(1 + cos(pitch)^2 * planSlope^2) / cos(pitch)
 * ```
 *
 * ⚠ Checked against the two cases already in the app rather than taken on
 * trust. With no plan rake it is `1 / cos(pitch)` — a 3/4in plumb plate
 * occupies **0.7906in** of span at 4:12, which is exactly what
 * `buildPlumbEndPlate` already produces. With no pitch it is
 * `sqrt(1 + planSlope^2)`, the plain 1/cos of a raked plan cut, which is what
 * the floor's mitred lid uses. Getting this wrong is the 0.062in mistake the
 * corner panel's side ply made in November: a sheet lying on a rake occupies
 * MORE than its own thickness, and the difference is where the overlaps come
 * from.
 */
function spanPerThicknessIn(slope: number, planSlope: number): number {
  const cosPitch = 1 / Math.hypot(1, slope);
  return Math.hypot(1, cosPitch * planSlope) / cosPitch;
}

/** One end's cut plane, as the `w` it sits at across the panel's width. */
interface MitreEndPlane {
  /** `w` of the cut at this x. */
  readonly atXIn: (xIn: number) => number;
  /** How `w` changes per inch of width — the plan rake. */
  readonly planSlope: number;
  /** +1 when the kept material is at greater `w` (the START end), -1 at the
   *  END end. The plate is built on the kept side. */
  readonly inwardSign: 1 | -1;
}

function mitreEndPlane(
  mitre: FloorRoofPanelMitre,
  widthIn: number,
  lengthIn: number,
  atEnd: "start" | "end",
): MitreEndPlane | null {
  const nearIn = atEnd === "start" ? mitre.startNearIn : mitre.endNearIn;
  const farIn = atEnd === "start" ? mitre.startFarIn : mitre.endFarIn;
  /* ⚠ An end with no set-back at EITHER corner is not mitred and keeps the
     assembly it was built with. An end set back at only one corner IS mitred,
     and gets a plate that runs out to nothing — which is what the cut does to
     the lid there too. */
  if (!(Math.abs(nearIn) > 1e-9 || Math.abs(farIn) > 1e-9)) return null;
  if (!(widthIn > 0)) return null;
  const planSlope = (farIn - nearIn) / widthIn;
  if (atEnd === "start") {
    return { atXIn: (xIn) => nearIn + planSlope * xIn, planSlope, inwardSign: 1 };
  }
  return { atXIn: (xIn) => lengthIn - (nearIn + planSlope * xIn), planSlope: -planSlope, inwardSign: -1 };
}

/**
 * ⚠ **A TRAPEZOID PRISM, NOT A SECTION ONE, AND THE REASON IS THE CUT LIST.**
 *
 * The obvious shape for a piece on a roof panel's end is a SECTION prism — a
 * (Y,Z) ring extruded along X, which is what every other end member here is.
 * It does not work for this one. A section prism's extent along X comes from
 * `actualDimsIn`, and for a flat sheet that field is `lengthIn` — which for
 * this plate is the length of the CUT, 29.6in on a 20.375in-wide panel at a
 * 46.5deg rake. One field cannot be both the panel's width and the piece's
 * length: built that way the skin extruded 29.6in across a 20.375in panel,
 * its far ring described a place it did not reach, and it ran through both
 * right-hand joists. (`roofPlanMitre.ts` names this collision too; here it is
 * unavoidable rather than hypothetical.)
 *
 * Extruding along the DEPTH instead frees `lengthIn` entirely — a trapezoid
 * prism's shape is its corners and `trapezoidDepthIn`, and nothing reads its
 * stated dimensions as geometry. So the cut list can carry the real cut
 * length, which is the number a shop needs. Same mechanism the FLOOR's mitred
 * lid already uses, and for the same reason.
 */
function layerCornersIn(
  plane: MitreEndPlane,
  o: RoofMitreEndPlateOptions,
  x0In: number,
  x1In: number,
  fromThicknessIn: number,
  toThicknessIn: number,
  slope: number,
  atDepthIn: number,
  /* ⚠ **WHERE THE PIECE'S SIDE FACES GO, and it is not a detail.** See
     `thicknessStepIn` below. A SHEET spanning the whole panel ends at the
     panel's own sides, which are planes of constant x, so its section is a
     parallelogram and that is correct. A 2x4 does not: its sides are square
     to its own faces, or it is not a 2x4. */
  sidesSquareToTheBoard = false,
): [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] {
  const perIn = spanPerThicknessIn(slope, plane.planSlope);
  /* z = w - y * slope, so a constant-`w` face leans through the depth by
     exactly the slope — which is what makes it plumb. */
  const faceZAt = (xIn: number, thicknessIn: number): number =>
    plane.atXIn(xIn) + plane.inwardSign * thicknessIn * perIn - atDepthIn * slope;

  /**
   * ⚠ **HOW A PIECE GETS THICKER, measured 2026-11-25.**
   *
   * Stepping straight down Z at constant X lands on the right plane — the
   * two faces are `perIn` apart in span either way — but it lands on the
   * WRONG CORNER of it, because a constant-X side face is not square to a
   * plate that is raked in plan. Measured on the 16ft Octagon's stud: a
   * perpendicular cross-section of **3.5000 x 2.1213 at 135 degrees**. The
   * area is right (5.25 sq in, one 2x4's worth) and the shape is not — that
   * piece has to be ripped out of a 2x6, and the cut list calls it a 2x4.
   *
   * Stepping along the plate's own NORMAL instead gives a square board. The
   * normal of `z + y*tan - x*planSlope = c` is `(-planSlope, tan, 1)`, whose
   * length is exactly `spanPerThicknessIn` — which is the same constant
   * arriving from the other direction, and a good check that both are right.
   * Projected onto a plane of constant depth it is `(-planSlope, 1 + tan^2)`
   * per `perIn`, and it collapses to the plain Z step when the plan rake is
   * zero, which is why the SQUARE plumb end plate has always been correct.
   */
  const thicknessStepIn = (thicknessIn: number): { xIn: number; zIn: number } => {
    if (!sidesSquareToTheBoard) return { xIn: 0, zIn: plane.inwardSign * thicknessIn * perIn };
    /* ⚠ **`inwardSign` ON BOTH COMPONENTS.** The step is the plane's own
       normal, turned to point into the kept material — and turning a vector
       round turns ALL of it. Leaving the sign off X cost the whole part at
       the TALL end: the step came out parallel to the board's width, the
       quad collapsed to zero area, and the two boards there became
       zero-thickness slivers. Nothing caught it — a degenerate solid
       overlaps nothing, so the audit was silent, and the first test measured
       only the eave end's two boards. What showed it was the shop sheet, in
       the browser, printing `90 degrees off square` and a waste triangle
       **649314165103509 1/2in** long. */
    return {
      xIn: (plane.inwardSign * -plane.planSlope * thicknessIn) / perIn,
      zIn: (plane.inwardSign * thicknessIn * (1 + slope * slope)) / perIn,
    };
  };

  /* ⚠ `x0In`/`x1In` are where the piece sits on its OUTERMOST face, and the
     step is taken from there — so a caller placing a board against a joist
     is placing the face it can see, not an average. */
  const step = thicknessStepIn(toThicknessIn - fromThicknessIn);
  const corner = (xIn: number, stepped: boolean): PanelSpacePoint2D => ({
    xIn: xIn + (stepped ? step.xIn : 0),
    zIn: faceZAt(xIn, fromThicknessIn) + (stepped ? step.zIn : 0),
  });
  return normalizeQuadWindingIn([
    corner(x0In, false),
    corner(x1In, false),
    corner(x1In, true),
    corner(x0In, true),
  ]);
}

export interface RoofMitreEndPlateOptions {
  widthIn: number;
  lengthIn: number;
  depthIn: number;
  pitchIn12?: number;
  /** The side joists' thickness — the 2x4s butt against their inner faces. */
  joistThicknessIn: number;
}

/**
 * The end plate for one mitred end: a plywood skin over the whole cut face and
 * two 2x4s behind it, each against a side joist.
 *
 * Empty when this end is not mitred.
 */
export function buildRoofMitreEndPlate(
  o: RoofMitreEndPlateOptions,
  atEnd: "start" | "end",
  mitre: FloorRoofPanelMitre,
): PanelMember[] {
  const plane = mitreEndPlane(mitre, o.widthIn, o.lengthIn, atEnd);
  if (!plane) return [];
  const slope = o.pitchIn12 !== undefined && o.pitchIn12 > 0 ? o.pitchIn12 / 12 : 0;

  /* ⚠ **Every piece is cut LONGER than the panel is deep**, the same note
     `buildPlumbEndPlate` already carries: a face standing plumb against a
     panel leaning at the roof's pitch has to span `depth / cos(pitch)` to
     cover it. Cutting to the panel's depth leaves the underside corner open,
     which is the corner the membrane has to turn. */
  const plumbEdgeHeightIn = o.depthIn * Math.hypot(1, slope);
  const endLabel = atEnd === "start" ? "eave" : "tall";

  const layer = (x0In: number, x1In: number, t0: number, t1: number, squareSides = false) => {
    const near = layerCornersIn(plane, o, x0In, x1In, t0, t1, slope, 0, squareSides);
    const far = layerCornersIn(plane, o, x0In, x1In, t0, t1, slope, o.depthIn, squareSides);
    return {
      near,
      far,
      /* ⚠ CENTRE through the depth, not the min corner — `memberPrism` reads
         a trapezoid as `yIn +/- trapezoidDepthIn / 2`. */
      position: {
        xIn: x0In,
        yIn: o.depthIn / 2,
        zIn: Math.min(...near.map((c) => c.zIn), ...far.map((c) => c.zIn)),
        rotationDeg: 0,
        trapezoidDepthIn: o.depthIn,
        trapezoidCornersIn: near,
        trapezoidFarCornersIn: far,
      },
    };
  };

  const out: PanelMember[] = [];

  /* THE SKIN — the full cut face, plywood outboard. His 2026-11-05 rule, and
     here it is also the piece the next facet's panel presses against.

     The cut face's own length across the panel: the plan rake makes it longer
     than the panel is wide, and that is the number a sheet is cut to. Panel x
     and z are orthogonal, so the face edge runs `sqrt(widthIn^2 + rise^2)`
     where the rise is the set-back's own change across the width. */
  const faceLengthIn = o.widthIn * Math.hypot(1, plane.planSlope);
  const skin = layer(0, o.widthIn, 0, SKIN_THICKNESS_IN);
  out.push({
    memberId: `mitre-${atEnd}-plate-skin`,
    material: "plywood",
    speciesGrade: null,
    plySpec: SKIN_PLY_SPEC,
    nominalSize: null,
    actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: plumbEdgeHeightIn, lengthIn: faceLengthIn },
    orientation: "flat",
    position: skin.position,
    role: "skin",
    qty: 1,
    notes: `${endLabel}-end mitre plate skin — the OUTER layer, the full 3/4in plywood face exposed to the exterior; DUAL BEVEL, the plan mitre and the plumb cut on one piece`,
  });

  /* THE TWO 2x4s — one hugging the inside of each side joist, spanning the
     lid's SHORT dimension (the panel's depth). Not tiled across the face: a
     square lid does that and this deliberately does not. */
  /* ⚠ **A 2x4'S 3 1/2in IS MEASURED IN THE PLATE'S OWN PLANE, NOT ACROSS THE
     PANEL — and getting that wrong is not a rounding error.** The plate is
     raked 46.5deg in plan on the 16ft Octagon, so a board given 3 1/2in of
     panel x is **5.085in** wide where it lies: measured on the first version,
     a sheared parallelepiped of **121.31 cubic inches** against the 85.78 a
     2x4 of that length holds — 41% too much wood, on a cut list that said
     "1 1/2in x 3 1/2in". Dividing by the rake's own factor makes the solid a
     true rectangular board again, which is what a shop can cut.

     ⚠ It is `hypot(1, cos(pitch) * planSlope)`, not `hypot(1, planSlope)`:
     the board's width runs HORIZONTALLY in the plumb plate, and the pitch is
     what separates that from the plate's top edge, which rises as the cut
     rakes across a sloping roof. */
  const cosPitch = 1 / Math.hypot(1, slope);
  const boardXSpanIn = PLATE_2X4_WIDTH_IN / Math.hypot(1, cosPitch * plane.planSlope);

  /* ⚠ **THE TWO BOARDS BUTT ON OPPOSITE CORNERS, because they lean the same
     way.** A square board on a plate raked in plan does not present a face to
     the joist — it leans across the panel as it gets thicker, by 1.061in over
     its own 1 1/2in on the 16ft Octagon. So the left board touches its joist
     with its SHALLOW corner and the right board with its DEEP one, and
     placing both the same way drove one of them 1.061in into the joist it was
     supposed to sit against. Measured: 2 pairs in the same volume, both
     against a plate that was otherwise right.

     Each board is therefore placed by its own extreme corner — the one that
     reaches furthest toward its joist — which is also how a shop does it:
     push it over until it stops. */
  /* ⚠ The same `inwardSign` the step itself carries — which way a board
     leans depends on which end of the panel it is closing. */
  const thicknessXStepIn =
    (plane.inwardSign * -plane.planSlope * PLATE_2X4_THICKNESS_IN) /
    spanPerThicknessIn(slope, plane.planSlope);
  const boardStarts: [string, number][] = [
    ["left", o.joistThicknessIn - Math.min(0, thicknessXStepIn)],
    ["right", o.widthIn - o.joistThicknessIn - Math.max(0, thicknessXStepIn) - boardXSpanIn],
  ];
  for (const [side, x0In] of boardStarts) {
    const stud = layer(
      x0In,
      x0In + boardXSpanIn,
      SKIN_THICKNESS_IN,
      SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN,
      true,
    );
    out.push({
      memberId: `mitre-${atEnd}-plate-stud-${side}`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: {
        thicknessIn: PLATE_2X4_THICKNESS_IN,
        widthIn: PLATE_2X4_WIDTH_IN,
        lengthIn: plumbEdgeHeightIn,
      },
      orientation: "flat",
      position: stud.position,
      role: "stud",
      qty: 1,
      notes: `butted against the inside face of the ${side} joist, behind the ${endLabel}-end mitre plate skin — cut ${plumbEdgeHeightIn.toFixed(3)}in, not the panel's ${o.depthIn}in depth; DUAL BEVEL at both ends`,
    });
  }

  return out;
}

/** The whole plan for a mitred panel's two ends. */
export interface RoofMitreEndPlatePlan {
  /** ⚠ The mitre the panel's STRUCTURE is cut to — see below. */
  structuralMitre: FloorRoofPanelMitre;
  plates: PanelMember[];
  /** Ends whose original lid the plates replace. */
  replacedEnds: ("start" | "end")[];
}

/** The plate's total thickness: plywood plus one 2x4 lying flat, which is the
 *  same 2 1/4in every other lid in this builder is. */
export const MITRE_END_PLATE_THICKNESS_IN = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;

/**
 * ⚠ **THE STRUCTURE IS CUT 2 1/4in DEEPER THAN THE BUILDING'S OUTLINE, AND
 * THE PLATE FILLS THAT BAND.** Measured the hard way: build the plate ON the
 * cut face and leave the joists cut to the same plane, and the plate is
 * inside all four of them — **47 pairs of members in the same volume** on the
 * 16ft Octagon, which is worse than the open end it was closing.
 *
 * That is not a quirk of this part; it is how a square panel already works. A
 * lid occupies the last 2 1/4in of the panel's span and the joists run
 * `2.25 .. lengthIn - 2.25`. The panel's OUTER surface is the lid's outer
 * face. So on a mitred end the outer surface is the cut plane — the
 * building's own outline, which is the whole point of cutting to it — and
 * everything structural stops 2 1/4in behind it.
 *
 * ⚠ **Measured PERPENDICULAR to the cut**, not along the span: a plate lying
 * on a double rake eats more span than its own thickness (`spanPerThicknessIn`).
 * At 4:12 with a 46.5deg plan rake that is 3.42in of span for 2 1/4in of plate.
 * Using 2.25 here would leave the joists 1.17in long and back inside the
 * plate.
 *
 * ⚠ **An end that is not mitred is not deepened**, because it still has its
 * own lid in its own 2 1/4in.
 */
export function planRoofMitreEndPlates(
  o: RoofMitreEndPlateOptions,
  mitre: FloorRoofPanelMitre,
): RoofMitreEndPlatePlan {
  const slope = o.pitchIn12 !== undefined && o.pitchIn12 > 0 ? o.pitchIn12 / 12 : 0;
  const structuralMitre = { ...mitre };
  const plates: PanelMember[] = [];
  const replacedEnds: ("start" | "end")[] = [];

  for (const atEnd of ["start", "end"] as const) {
    const plane = mitreEndPlane(mitre, o.widthIn, o.lengthIn, atEnd);
    if (!plane) continue;
    replacedEnds.push(atEnd);
    plates.push(...buildRoofMitreEndPlate(o, atEnd, mitre));

    const deepenIn = MITRE_END_PLATE_THICKNESS_IN * spanPerThicknessIn(slope, plane.planSlope);
    if (atEnd === "start") {
      structuralMitre.startNearIn += deepenIn;
      structuralMitre.startFarIn += deepenIn;
    } else {
      structuralMitre.endNearIn += deepenIn;
      structuralMitre.endFarIn += deepenIn;
    }
  }

  return { structuralMitre, plates, replacedEnds };
}
