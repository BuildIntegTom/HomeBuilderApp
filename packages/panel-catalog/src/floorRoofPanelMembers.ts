import type { PanelComponentSchema, PanelMember, SectionSpacePoint2D } from "./componentSchema";
import { LUMBER_SPECIES_GRADE, PLATE_2X4_THICKNESS_IN, PLATE_2X4_WIDTH_IN, SKIN_PLY_SPEC, SKIN_THICKNESS_IN } from "./panelMemberHelpers";

/**
 * FLOOR AND ROOF PANELS — Tommy's spec, given in interview on 2026-10-22.
 *
 * > *"Although I do want trusses modeled, I am talking about straw stuffed roof
 * > panels… Floors and roof panels are actually quite similar, just inclined or
 * > not. Imagine a standard panel, except instead of 2x4 studs, they are
 * > 2x6s."*
 *
 * Every number here is HIS, first-hand, the same standing
 * `fabricationMinPanelWidthIn` has — not researched, not industry-typical.
 * The full write-up with his quotations is in
 * `Claude outputs/floor-roof-panel-spec-2026-10-22.md`.
 *
 * ## The frame
 *
 * Built in the panel's own fabrication frame, which is the wall panel's frame
 * turned on its side — *"just like a standard panel except on its side"*:
 *
 *   X = across the panel's WIDTH   (19 3/16in, the 5-to-the-8ft module)
 *   Y = through the panel's DEPTH  (15.5in, same as a wall)
 *   Z = along the panel's LENGTH   (the span — a wall panel's height)
 *
 * Installed, Z lies flat for a floor and runs up the slope for a roof. Keeping
 * the fabrication frame means the compressor table, the shop drawing and the
 * cut list all describe the panel the way it is actually built, and only the
 * install drawing has to rotate it.
 *
 * ## ⚠ A joist is a PAIR, and the seams double it
 *
 * > *"Top and bottom pair makes one joist… So when the roof or floor panels
 * > are installed, the overall structure is a bunch of double double 2x6s (two
 * > joists together make a double and there's two 2x6s per joist)."*
 *
 * So one panel carries TWO joists — one at each edge — and each joist is two
 * 2x6s, top and bottom: **four 2x6s per panel**. Butt two panels together and
 * the shared seam has four, which is the "double double". This is the single
 * easiest number here to get wrong by a factor of two, and it is what the
 * material list is built on.
 */

/** 2x6 actual dimensions. */
export const JOIST_2X6_THICKNESS_IN = 1.5;
export const JOIST_2X6_WIDTH_IN = 5.5;

/**
 * The field panel: **19 1/4in**, his decision of 2026-10-22.
 *
 * ⚠ **The module exists because of the black diamonds on the plywood.**
 *
 * > *"the goal I had in mind was making 3/4" tounge and groove plywood super
 * > easy to install using the black diamonds on the plywood. Best to sheath
 * > the floor on site to really tie all the panels together."*
 *
 * Sheathing is marked at 19.2in — five to the 8ft — so a seam under a diamond
 * is a seam the crew can nail without measuring. 19.2in is not a fraction
 * anyone cuts, so the question was which side to round to, and both answers
 * cost something. Measured:
 *
 * | width | worst drift from a diamond | closes 8ft | on the 1/8in grid |
 * |-------|---------------------------|------------|-------------------|
 * | 19 3/16 | 1/16in | 1/16in short | no |
 * | **19 1/4** | 1/4in | 1/4in over | **yes** |
 *
 * He chose 19 1/4: *"I'd rather cut small like 19 1/4 and 5 panels later it's
 * a little bigger to absorb that 1/4"."*
 *
 * ⚠ **A quarter inch of drift does not matter here, and that is why the
 * cheaper cut wins.** Every seam between panels is a DOUBLE JOIST — two 2x6s
 * side by side, 3in of nailing surface — so a diamond 1/4in off its seam is
 * still well inside the target. The diamond is a guide, not a tolerance. And
 * 19 1/4 is on the 1/8in grid the whole app works in, which 19 3/16 is not.
 */
export const FLOOR_ROOF_PANEL_WIDTH_IN = 24;

/**
 * ⚠ There is no longer a closer panel, and this is kept at 0 to say so.
 *
 * It existed because four 19 1/4in field panels came to 77in and a fifth had
 * to be 19in to land the run back on 96. At 24in the module divides 8ft
 * exactly — four panels, no drift, nothing to reset — so the closer has
 * nothing left to do.
 */
export const FLOOR_ROOF_RUN_CLOSER_WIDTH_IN = 0;

/**
 * The first and last panel in a run: **as wide as the wall is thick**.
 *
 * > *"The edge panels for floors and roofs still have to be 15.5" because
 * > thata the wall thickness."* — Tommy, 2026-10-23
 *
 * ⚠ This replaces 13.25in (15.5 less a 2.25in structural girt). That
 * subtraction assumed a girt running along the edge panel's length, under a
 * wall parallel to the panels — and he settled that there is no such girt:
 * *"The walls that sit overtop one span of a panel do not need more than the
 * one structural girt at the end."* With the girt gone the reason to narrow
 * the panel went with it, and the edge panel simply carries the wall's full
 * thickness itself.
 *
 * It is a DEFAULT, not a constant of the universe: a building with a
 * different wall depth wants its own number, which is why
 * `planFloorRoofPanelWidthsIn` takes it as an argument.
 */
export const FLOOR_ROOF_EDGE_PANEL_WIDTH_IN = 15.5;

/** Structural girt: 3/4in CDX with a 2x4 at each edge — 2.25in overall. */
export const STRUCTURAL_GIRT_PLY_THICKNESS_IN = 0.75;
export const STRUCTURAL_GIRT_TOTAL_THICKNESS_IN = STRUCTURAL_GIRT_PLY_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
export const STRUCTURAL_GIRT_PLY_SPEC = "3/4in_5ply_CDX";

/** Anti-twist girt: 5/8in OSB web. */
export const ANTI_TWIST_WEB_THICKNESS_IN = 0.625;
export const ANTI_TWIST_WEB_PLY_SPEC = "5/8in_OSB";

/** *"starting every 3' from the structural girt"* — floors only. */
export const BLOCKING_SPACING_IN = 36;
/** *"there are also anti twist osb girts every 5'"* — both. */
export const ANTI_TWIST_SPACING_IN = 60;

export interface FloorRoofPanelOptions {
  kind: "floor" | "roof";
  widthIn: number;
  depthIn: number;
  /** The span, along Z. */
  lengthIn: number;
  /**
   * Which ends carry a structural girt.
   *
   * > *"only on exterior ends where panel walls are above."*
   *
   * So this is NOT automatic at both ends — a floor panel gets one only where
   * a wall actually lands on it, and a roof panel never gets one at all
   * (*"the roof panels do not need a structural girt, their weight should be
   * on both the inner and outer wyth of the wall panel"*).
   */
  structuralGirtEnds?: ("start" | "end")[];
  /**
   * ⚠ Extra structural girts at arbitrary positions along the span, for
   * where a COLUMN lands on this panel.
   *
   * > *"When a column panel is resting on a floor box, that floor box also
   * > needs a couple extra structural pieces such as more structural girts,
   * > one under each side of the panel resting above it."* — Tommy,
   * > 2026-10-23
   *
   * Each number is the distance along the span to a girt's near face. The
   * caller works out where a column's two sides fall — see
   * `columnBearingGirtPositionsIn` — because only the caller knows where the
   * columns are.
   */
  extraStructuralGirtsAtIn?: number[];
  /**
   * ⚠ The roof's pitch, which PLUMB-CUTS THE PANEL'S TALL END.
   *
   * > *"The tall end of a roof panel should be plumb cut with a vertical
   * > structural top plate, and the bottom of it should meet flush with the
   * > entire wall depth and the rest should go plumb cut vertically. This
   * > makes for easy membrane application when it looks like a monopoly
   * > house — meets the interior wall and exterior wall continues up and
   * > cover."* — Tommy, 2026-10-29
   *
   * Omitted (or 0) the panel is cut square at both ends, which is what a
   * FLOOR wants and what a roof panel got before this existed. A floor
   * ignores it outright.
   */
  pitchIn12?: number;
  /**
   * ⚠ How much LEVEL BEARING the tall end needs — the wall depth.
   *
   * > *"I want the 3.5in edge in the pic be equal to the wall depth, 15.5in"*
   * > — Tommy, 2026-10-29, of the horizontal bottom plate on his older
   * > SketchUp panel.
   *
   * The panel's underside runs at the roof's pitch and a wall's top plate is
   * level, so the two cannot meet across 15 1/2in without something giving.
   * This asks for the WEDGE: a triangular bearing boot under the tall end,
   * level on the bottom, plumb on the outside, closed above by the panel's
   * own sloped underside. Nothing is cut.
   *
   * ⚠ **The alternative was to NOTCH the seat up into the panel, and it
   * was rejected on the numbers.** At 4:12 a 15 1/2in level seat is 4.90in
   * measured perpendicular — 31.6% of the panel's depth, past the NDS d/4
   * end-notch limit, and it leaves 0.60in of the bottom 2x6 chord. The wedge
   * costs only height: the plumb face grows from `depth/cos` to
   * `depth/cos + seat x tan`, 16 3/8in to 21 1/2in at 4:12. *"Let's go with
   * wedge. Make the roof taller."*
   *
   * 0 or omitted builds no wedge, which is what a tall end with no wall or
   * beam under it wants.
   */
  bearingSeatDepthIn?: number;
}

/**
 * The tall end's plumb cut, or null when there is nothing to cut.
 *
 * ⚠ **The TOP face is the long point, and the underside is the short one.**
 * That is the same cut a rafter gets at a ridge, and it follows from the
 * panel leaning uphill: travelling up the panel gains height, so the top
 * edge reaches a given vertical plane only after running further along the
 * panel than the bottom edge did.
 *
 * ⚠ **`lengthIn` stays the TOP face's span**, so the roof's outer surface
 * still runs exactly eave-to-ridge and two planes of a gable still meet on
 * the ridge with neither a gap nor an overlap. It is the underside that
 * pulls back, which is where the wall or the ridge beam is — and because the
 * cut is plumb, that underside still bears across the whole wall depth and
 * terminates on the wall's exterior face, which is his *"meet flush with the
 * entire wall depth"*.
 *
 * ⚠ **Member Y runs DOWNWARD once the panel is installed** — y=0 is the
 * panel's TOP face and y=depthIn its underside. That is not a choice made
 * here: `Building3DView` tips the panel with `rotation={[PI/2 - tilt, 0, 0]}`,
 * which sends member-Y to world (0, -cos tilt, sin tilt). Getting this
 * backwards would cut the bevel the wrong way and still look plausible.
 */
interface PlumbEndCut {
  tan: number;
  sin: number;
  cos: number;
  /** How much further the top face runs than the underside. */
  bevelIn: number;
  /** The plumb face's real cut height — the panel AND its bearing wedge. */
  plumbHeightIn: number;
  tiltDeg: number;
  /** The level bearing the wedge provides; 0 when there is no wedge. */
  seatIn: number;
  /** How far through the depth the wedge reaches, at the plumb face. */
  wedgeBottomYIn: number;
  /**
   * ⚠ Where the assembly's LEVEL bottom crosses a plane set back by
   * `perpendicularIn`, as a depth.
   *
   * A line at constant depth is parallel to the PANEL, not to the ground, so
   * cutting the plate's bottom at one depth would leave it riding the pitch
   * instead of sitting on the plate. Each plane through the assembly meets
   * the level bottom a little higher up than the one outside it, by
   * `perpendicular x sin`.
   */
  levelBottomYIn: (perpendicularIn: number) => number;
  /** A plumb edge's real cut length, at a given set-back. */
  plumbEdgeHeightIn: (perpendicularIn: number) => number;
  atEnd: "start" | "end";
  /** +1 at the tall end, -1 at the eave: which way "further into the panel"
   * runs along the span. Every set-back and every wedge corner needs it. */
  dir: number;
  /** Where the panel's outer end face sits, at a given depth. */
  outerAtYIn: (yIn: number) => number;
  /** A plane parallel to it, set back by a perpendicular thickness. */
  setBackAtYIn: (yIn: number, perpendicularIn: number) => number;
}

function plumbEndCut(o: FloorRoofPanelOptions, atEnd: "start" | "end" = "end"): PlumbEndCut | null {
  const pitchIn12 = o.pitchIn12;
  if (o.kind !== "roof" || pitchIn12 === undefined || !(pitchIn12 > 0)) return null;
  const tan = pitchIn12 / 12;
  const hyp = Math.hypot(12, pitchIn12);
  const cos = 12 / hyp;
  const sin = pitchIn12 / hyp;
  /**
   * ⚠ **BOTH ENDS ARE PLUMB, AND THEY LEAN OPPOSITE WAYS.**
   *
   * > *"The roof panel bottom edges still are just squared off and not
   * > correct."* — Tommy, 2026-10-30
   *
   * At the TALL end the long point is the TOP: travelling up the panel gains
   * height, so the top edge reaches a given vertical plane only after
   * running further along the panel than the bottom edge did. At the EAVE
   * the same fact runs the other way and the long point is the UNDERSIDE —
   * which is exactly the fascia cut on a rafter tail. A single formula for
   * both would have one of them backwards, and it would still look
   * plausible.
   *
   * The eave's plumb plane is placed so the UNDERSIDE reaches z = 0: the
   * underside is what bears, and letting the top keep z = 0 instead would
   * push the underside to a negative span.
   */
  const dir = atEnd === "end" ? 1 : -1;
  const baseZIn = atEnd === "end" ? o.lengthIn : o.depthIn * tan;
  const outerAtYIn = (yIn: number) => baseZIn - yIn * tan;
  /* ⚠ **THE BEARING SEAT IS THE TALL END'S ALONE**, and trying to mirror it
     is what forced this comment.

     The two voids are not mirror images. At the tall end the underside
     rises AWAY from the wall going outward, so the void over the plate is
     thickest at the exterior face and the plate reaches down over it. At the
     eave the underside rises INWARD, so the void grows away from the plate
     and the thick end is 15 1/2in inside the building — a different shape
     with its vertical face on the other side. His seat spec was the tall
     end's: *"the bottom of it should meet flush with the entire wall depth"*
     (2026-10-29), and the eave already has his earlier L-plate cap, whose
     seat is *"cut off square"* by exactly the pitch.

     So the eave gets the PLUMB CUT he asked for on 2026-10-30 — *"the roof
     panel bottom edges still are just squared off and not correct"* — and
     its plate stops at the panel's underside rather than hanging below it. */
  const seatIn = atEnd === "end" ? Math.max(0, o.bearingSeatDepthIn ?? 0) : 0;
  return {
    tan,
    sin,
    cos,
    bevelIn: o.depthIn * tan,
    /* ⚠ Panel PLUS wedge. Cutting this to the panel alone would leave the
       wedge's outer face bare, which is the one face the exterior wall laps
       over. */
    plumbHeightIn: o.depthIn / cos + seatIn * tan,
    tiltDeg: (Math.atan2(pitchIn12, 12) * 180) / Math.PI,
    seatIn,
    /* ⚠ Stepping DOWN the plumb face by a vertical `seat x tan` moves
       `seat x sin` through the panel's depth, not `seat x tan`: the plumb
       face leans against the depth axis, so a vertical drop is not a depth
       of the same size. */
    wedgeBottomYIn: o.depthIn + seatIn * sin,
    /* No wedge means no level bottom to find: the plate simply stops flush
       with the panel's underside, parallel to it, as it always did. */
    /* ⚠ The per-plane step MIRRORS with the end. Each plane further into
       the panel meets the level bottom at a different depth, and which way
       depends on which way "into the panel" leans — away from the plumb
       face at the tall end, toward it at the eave. Holding it at one sign
       left the eave plate's bottom 1/2in out of level, which is a plate
       bearing on a line instead of a face. */
    levelBottomYIn: (perpendicularIn: number) =>
      seatIn > 0 ? o.depthIn + seatIn * sin - dir * perpendicularIn * sin : o.depthIn,
    plumbEdgeHeightIn: (perpendicularIn: number) =>
      (seatIn > 0 ? o.depthIn + seatIn * sin - dir * perpendicularIn * sin : o.depthIn) / cos,
    outerAtYIn,
    /* ⚠ A thickness measured PERPENDICULAR to a plumb face is longer than
       that along the span, by 1/cos — the same reason the plate itself is
       taller than the panel is deep. Subtracting the raw thickness would
       leave the parts not quite meeting. */
    atEnd,
    dir,
    setBackAtYIn: (yIn: number, perpendicularIn: number) => outerAtYIn(yIn) - dir * (perpendicularIn / cos),
  };
}

/**
 * ⚠ **THE EAVE END IS A BIRD'S MOUTH WITH A PLUMB FASCIA, and it is NOT
 * the tall end mirrored.**
 *
 * > *"The bottom of roof panels, where they meet the wall, should be
 * > starting from the inside of the wall with the bottom cord, and then the
 * > top edge goes towards the exterior and then plumb cuts down."* — Tommy,
 * > 2026-10-31
 *
 * Three surfaces, and each member meets whichever one its own depth puts it
 * against:
 *
 *  - the **fascia**, a plumb plane at the wall's EXTERIOR face, which the
 *    panel's top chord runs out to;
 *  - the **seat**, level, bearing on the top plate across the whole wall
 *    depth;
 *  - the **inner face**, a plumb plane at the wall's INTERIOR face, where
 *    the bottom chord stops.
 *
 * ⚠ **Why not the tall end mirrored:** at the tall end the underside rises
 * AWAY from the wall going outward, so the void over the plate is thickest
 * at the exterior and gets filled by an added wedge. Here the underside
 * rises INWARD, so the panel's own section would dip below the plate going
 * outward — nothing can be added to fix that, material has to come OUT.
 * The bottom chord ending at the inside of the wall IS that cut, and it is
 * an ordinary rafter seat, taken at the end of the span where the bending
 * moment is nil rather than anywhere it would matter.
 *
 * ⚠ `seatYIn = depthIn - seat x sin` is the depth at which the level seat
 * meets the fascia, and it is what decides which plane a member ends on. A
 * 15 1/2in panel on a 15 1/2in wall at 4:12 splits at 10.60in: the top
 * chord (0 to 5 1/2in) runs to the fascia, the bottom chord (10 to
 * 15 1/2in) stops at the inside face.
 */
interface EaveCut {
  tan: number;
  sin: number;
  cos: number;
  seatIn: number;
  /** The depth at which the level seat meets the fascia. */
  seatYIn: number;
  /** The plumb plane at the wall's EXTERIOR face. */
  fasciaAtYIn: (yIn: number) => number;
  /** The plumb plane at the wall's INTERIOR face. */
  innerAtYIn: (yIn: number) => number;
  /** The fascia's real cut height, standing vertical. */
  fasciaHeightIn: number;
  /** How far through the depth a plane set back from the fascia meets the
   * level seat — the mirror of the tall end's own `levelBottomYIn`. */
  seatBottomYIn: (perpendicularIn: number) => number;
}

function eaveCut(o: FloorRoofPanelOptions): EaveCut | null {
  const pitchIn12 = o.pitchIn12;
  if (o.kind !== "roof" || pitchIn12 === undefined || !(pitchIn12 > 0)) return null;
  const seatIn = Math.max(0, o.bearingSeatDepthIn ?? 0);
  if (!(seatIn > 0)) return null;
  const tan = pitchIn12 / 12;
  const hyp = Math.hypot(12, pitchIn12);
  const cos = 12 / hyp;
  const sin = pitchIn12 / hyp;
  const seatYIn = o.depthIn - seatIn * sin;
  if (!(seatYIn > 0)) return null;
  return {
    tan,
    sin,
    cos,
    seatIn,
    seatYIn,
    fasciaAtYIn: (yIn: number) => -yIn * tan,
    innerAtYIn: (yIn: number) => (seatIn - yIn * sin) / cos,
    fasciaHeightIn: seatYIn / cos,
    seatBottomYIn: (perpendicularIn: number) => seatYIn + perpendicularIn * sin,
  };
}

/**
 * The eave's fascia plate and the level seat it stands on.
 *
 * ⚠ The fascia stops at the SEAT, not at the panel's underside. Running it
 * the full depth would put it below the wall's top plate — the panel's own
 * section does not reach that far out, which is the whole point of the seat.
 */
function buildEaveEnd(o: FloorRoofPanelOptions, eave: EaveCut): PanelMember[] {
  const out: PanelMember[] = [];

  /* The plumb fascia: skin plus its 2x4 faces, the same lid the other end
     gets, cut to the fascia's own height instead of the panel's depth. */
  const slab = (perpendicularStartIn: number, perpendicularEndIn: number): SectionSpacePoint2D[] => {
    const outerBottomYIn = eave.seatBottomYIn(perpendicularStartIn);
    const innerBottomYIn = eave.seatBottomYIn(perpendicularEndIn);
    return [
      { yIn: 0, zIn: eave.fasciaAtYIn(0) + perpendicularEndIn / eave.cos },
      { yIn: 0, zIn: eave.fasciaAtYIn(0) + perpendicularStartIn / eave.cos },
      { yIn: outerBottomYIn, zIn: eave.fasciaAtYIn(outerBottomYIn) + perpendicularStartIn / eave.cos },
      { yIn: innerBottomYIn, zIn: eave.fasciaAtYIn(innerBottomYIn) + perpendicularEndIn / eave.cos },
    ];
  };
  const edgeHeightIn = (perpendicularIn: number) => eave.seatBottomYIn(perpendicularIn) / eave.cos;

  out.push({
    memberId: "lid-start-skin",
    material: "plywood",
    speciesGrade: null,
    plySpec: SKIN_PLY_SPEC,
    nominalSize: null,
    actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: edgeHeightIn(0), lengthIn: o.widthIn },
    orientation: "flat",
    position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0, sectionCornersIn: slab(0, SKIN_THICKNESS_IN) },
    role: "skin",
    qty: 1,
    notes:
      `eave fascia, standing PLUMB — cut ${edgeHeightIn(0).toFixed(3)}in, which is the panel's depth less the seat's ` +
      `own bite, not the ${o.depthIn}in depth`,
  });

  let xIn = 0;
  let index = 0;
  while (xIn < o.widthIn - 1e-9) {
    const widthIn = Math.min(PLATE_2X4_WIDTH_IN, o.widthIn - xIn);
    const ripped = widthIn < PLATE_2X4_WIDTH_IN - 1e-9;
    out.push({
      memberId: `lid-start-face-${index}`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn, lengthIn: edgeHeightIn(SKIN_THICKNESS_IN) },
      orientation: "horizontal",
      position: {
        xIn,
        yIn: 0,
        zIn: 0,
        rotationDeg: 180,
        sectionCornersIn: slab(SKIN_THICKNESS_IN, SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN),
      },
      role: "stud",
      qty: 1,
      notes: ripped ? `ripped to ${widthIn}in wide — the last one on the eave fascia` : "stands plumb against the eave",
    });
    xIn += PLATE_2X4_WIDTH_IN;
    index += 1;
  }

  /* ⚠ The SEAT: the one face in the panel that is level, because it is the
     one that lands on a top plate. It runs the full wall depth, from the
     fascia's foot back to where the bottom chord starts. Its thickness goes
     straight UP into the panel — direction (-cos, +sin) through (depth,
     span) — not along either axis. */
  const upYIn = SKIN_THICKNESS_IN * eave.cos;
  const upZIn = SKIN_THICKNESS_IN * eave.sin;
  /* ⚠ The seat starts at the FASCIA'S INNER FACE, not at the panel's outer
     edge — the same arrangement the tall end's cheeks have. Running it to
     the outer edge put it in the same space as the fascia itself, which the
     overlap check caught: 8 pairs. The fascia's own 2 1/4in of full-width
     solid is the outermost bearing and the seat carries the remaining
     13 1/4in, which is the wall. */
  const lidThicknessIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const footYIn = eave.seatBottomYIn(lidThicknessIn);
  const footZIn = eave.fasciaAtYIn(footYIn) + lidThicknessIn / eave.cos;
  const heelZIn = eave.innerAtYIn(o.depthIn);
  out.push({
    memberId: "eave-seat-skin",
    material: "plywood",
    speciesGrade: null,
    plySpec: STRUCTURAL_GIRT_PLY_SPEC,
    nominalSize: null,
    actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: eave.seatIn - lidThicknessIn, lengthIn: o.widthIn },
    orientation: "flat",
    position: {
      xIn: 0,
      yIn: footYIn,
      zIn: footZIn,
      rotationDeg: 0,
      sectionCornersIn: [
        { yIn: footYIn, zIn: footZIn },
        { yIn: o.depthIn, zIn: heelZIn },
        { yIn: o.depthIn - upYIn, zIn: heelZIn + upZIn },
        { yIn: footYIn - upYIn, zIn: footZIn + upZIn },
      ],
    },
    role: "skin",
    qty: 1,
    notes:
      `the level bearing seat — ${(eave.seatIn - lidThicknessIn).toFixed(3)}in here plus the fascia's own ` +
      `${lidThicknessIn}in makes the ${eave.seatIn}in wall depth under it`,
  });

  return out;
}

/**
 * The bearing wedge under the tall end: level on the bottom, plumb on the
 * outside, closed above by the panel's own sloped underside.
 *
 * ⚠ **A true triangle, and the only part of a roof panel whose bottom is
 * LEVEL rather than parallel to the panel.** Everything else here is square
 * to the panel, because the panel is what it is built against; this one is
 * square to the world, because a top plate is. Its three corners, in the
 * panel's own (depth, span):
 *
 *   tip     (depthIn, zB)  where the level bottom runs out at the underside
 *   corner  (depthIn, zU)  the panel's own bottom-outer corner
 *   foot    (yA,      zA)  the bottom of the plumb face
 *
 * A cheek sits under each joist, so the reaction goes down the same two
 * lines that carried it along the panel, and a level skin closes the bottom
 * into one bearing surface.
 */
function buildTallEndWedge(o: FloorRoofPanelOptions, plumb: PlumbEndCut): PanelMember[] {
  if (!(plumb.seatIn > 0)) return [];
  const yA = plumb.wedgeBottomYIn;
  /* Where the level bottom runs out at the panel's own underside, which is
     the wedge's inner tip. */
  /* ⚠ MINUS dir, not plus. The tip runs INTO the panel — down-slope from
     the tall end, up-slope from the eave — and `dir` points the other way,
     outward. Getting it backwards put the tall end's cheek 8in past the end
     of the panel it belongs to, which the overlap check caught. */
  const zB = plumb.outerAtYIn(yA) - plumb.dir * plumb.seatIn * plumb.cos;
  const riseIn = plumb.seatIn * plumb.tan;

  /* ⚠ The cheeks stop at the PLATE'S INNER FACE, the same place the joists
     stop. Running them out to the plumb face instead put 14 member pairs in
     the same space as the plate — the overlap check caught it. The plate's
     own 2 1/4in of full-width solid is the outermost bearing; the cheeks
     carry the remaining 13 1/4in under the joist lines. */
  const lidThicknessIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const footYIn = plumb.levelBottomYIn(lidThicknessIn);

  const out: PanelMember[] = [];
  for (const [side, xIn] of [
    ["left", 0],
    ["right", o.widthIn - JOIST_2X6_THICKNESS_IN],
  ] as [string, number][]) {
    out.push({
      memberId: `wedge-${plumb.atEnd}-cheek-${side}`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x6",
      /* The board it is cut FROM: the sloped face against the panel is the
         longest edge and the one the shop lays out along. */
      actualDimsIn: {
        thicknessIn: JOIST_2X6_THICKNESS_IN,
        widthIn: riseIn,
        lengthIn: plumb.seatIn / plumb.cos,
      },
      orientation: "vertical",
      position: {
        xIn,
        yIn: o.depthIn,
        zIn: zB,
        rotationDeg: 0,
        sectionCornersIn: [
          { yIn: o.depthIn, zIn: zB },
          { yIn: o.depthIn, zIn: plumb.setBackAtYIn(o.depthIn, lidThicknessIn) },
          { yIn: footYIn, zIn: plumb.setBackAtYIn(footYIn, lidThicknessIn) },
        ],
      },
      role: "blocking",
      qty: 1,
      notes:
        side === "left"
          ? `${plumb.atEnd === "end" ? "tall-end" : "eave"} bearing wedge — ${plumb.seatIn}in of level bottom, ${riseIn.toFixed(3)}in tall at the plumb face, ` +
            `tapering to nothing. ADDED, not notched: the same seat cut INTO the panel would take ` +
            `${(plumb.seatIn * plumb.sin).toFixed(2)}in of its ${o.depthIn}in depth and all but 0.6in of the bottom chord.`
          : undefined,
    });
  }

  return out;
}

/**
 * ⚠ `actualDimsIn` IS THE PIECE AS THE SHOP CUTS IT — thickness x width x
 * LENGTH — and `orientation` is what maps that onto the panel's box. The first
 * version of this file passed a bounding box instead, and the cut list came
 * back telling the shop to cut 2x4s "1 1/2in" long, because the box's Z extent
 * happened to be the board's thickness. Found by running `computePanelCutList`
 * on a real panel rather than assuming it would work.
 *
 * The mapping, from `memberBoxSizeIn`:
 *   vertical            -> box (t, w, l)   length runs along Z
 *   horizontal          -> box (l, t, w)   length along X
 *   horizontal, rot 90  -> box (t, l, w)   length along Y
 *   horizontal, rot 180 -> box (w, l, t)   length along Y, width along X
 *   flat                -> box (l, w, t)   length along X, width along Y
 */
const lumber = (
  memberId: string,
  role: PanelMember["role"],
  nominalSize: "2x4" | "2x6",
  dims: { thicknessIn: number; widthIn: number; lengthIn: number },
  orientation: PanelMember["orientation"],
  rotationDeg: number,
  position: { xIn: number; yIn: number; zIn: number },
  notes?: string,
): PanelMember => ({
  memberId,
  material: "dimensional_lumber",
  speciesGrade: LUMBER_SPECIES_GRADE,
  plySpec: null,
  nominalSize,
  actualDimsIn: dims,
  orientation,
  position: { ...position, rotationDeg },
  role,
  qty: 1,
  ...(notes ? { notes } : {}),
});

/** A sheet lying in the panel's X-Y plane: length along X, width along Y,
 * thickness along Z. That is exactly `orientation: "flat"`. */
const sheet = (
  memberId: string,
  role: PanelMember["role"],
  plySpec: string,
  dims: { thicknessIn: number; widthIn: number; lengthIn: number },
  position: { xIn: number; yIn: number; zIn: number },
  notes?: string,
): PanelMember => ({
  memberId,
  material: "plywood",
  speciesGrade: null,
  plySpec,
  nominalSize: null,
  actualDimsIn: dims,
  orientation: "flat",
  position: { ...position, rotationDeg: 0 },
  role,
  qty: 1,
  ...(notes ? { notes } : {}),
});

/**
 * The two joists — one at each edge of the panel, each a top-and-bottom pair
 * of 2x6s.
 *
 * ⚠ Four 2x6s per panel. See the module comment: butting two panels together
 * makes the "double double" at the seam, which is where the installed
 * structure gets its depth.
 */
function buildJoists(o: FloorRoofPanelOptions): PanelMember[] {
  const out: PanelMember[] = [];
  /* ⚠ The joists run BETWEEN the two lids, not past them.
   *
   * A standard panel does the same thing — `studSpanIn = heightIn - 2 *
   * SKIN_THICKNESS_IN` — and this panel is *"just like a standard panel
   * except on its side"*. The lid is a skin plus 2x4s laid face to face,
   * 2.25in of it, and those 2x4s run in line with the joists rather than
   * beside them the way a standard panel's plate 2x4s do, so the joists give
   * up the full 2.25 at each end, not just the skin.
   *
   * Measured before this: 16 pairs of members occupying the same space, every
   * one a joist against a lid. On a 25ft span the joists are cut 295.5in, not
   * 300in. */
  const lidThicknessIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const joistLengthIn = o.lengthIn - 2 * lidThicknessIn;
  const plumb = plumbEndCut(o, "end");
  const eave = eaveCut(o);
  const edges: [string, number][] = [
    ["left", 0],
    ["right", o.widthIn - JOIST_2X6_THICKNESS_IN],
  ];
  for (const [side, xIn] of edges) {
    for (const [face, yIn] of [
      ["bottom", 0],
      ["top", o.depthIn - JOIST_2X6_WIDTH_IN],
    ] as [string, number][]) {
      if (!plumb) {
        out.push(
          lumber(
            `joist-${side}-${face}`,
            "stud",
            "2x6",
            { thicknessIn: JOIST_2X6_THICKNESS_IN, widthIn: JOIST_2X6_WIDTH_IN, lengthIn: joistLengthIn },
            "vertical",
            0,
            { xIn, yIn, zIn: lidThicknessIn },
            `${side} joist, ${face} member of the pair`,
          ),
        );
        continue;
      }
      /* ⚠ A PLUMB-CUT JOIST IS NOT A BOARD CUT SQUARE. Its far end is
         beveled through its own 5 1/2in, so the two joists of a pair are
         DIFFERENT LENGTHS — the one nearer the panel's top face is the
         longer, by (its depth offset) x the pitch. A single length for both
         would be right for neither, and at 4:12 across a 15 1/2in panel the
         two ends are 5 3/16in apart. */
      const nearYIn = yIn;
      const farYIn = yIn + JOIST_2X6_WIDTH_IN;
      const nearEndIn = plumb.setBackAtYIn(nearYIn, lidThicknessIn);
      const farEndIn = plumb.setBackAtYIn(farYIn, lidThicknessIn);
      /* ⚠ **THE TWO CHORDS DO NOT END IN THE SAME PLACE AT THE EAVE**, and
         that is his whole point: *"starting from the inside of the wall with
         the bottom cord, and then the top edge goes towards the exterior and
         then plumb cuts down."*

         Which plane a chord meets is decided by its own depth against the
         seat, taken at its midpoint so a chord is never cut on two planes at
         once. The top chord runs out to the fascia at the wall's EXTERIOR
         face; the bottom chord stops plumb at the INTERIOR face, which is
         the seat cut. Without a seat there is nothing to decide and both
         ends sit at the plate, as a floor's do. */
      const eaveBelowSeat = eave !== null && (nearYIn + farYIn) / 2 >= eave.seatYIn;
      const eavePlaneAtYIn = (atYIn: number) =>
        eave === null
          ? lidThicknessIn
          : eaveBelowSeat
            ? eave.innerAtYIn(atYIn)
            : eave.fasciaAtYIn(atYIn) + lidThicknessIn / eave.cos;
      const nearStartIn = eavePlaneAtYIn(nearYIn);
      const farStartIn = eavePlaneAtYIn(farYIn);
      out.push({
        memberId: `joist-${side}-${face}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x6",
        /* The piece AS CUT: its LONG point, which is the number the shop
           measures to before swinging the saw over. */
        actualDimsIn: {
          thicknessIn: JOIST_2X6_THICKNESS_IN,
          widthIn: JOIST_2X6_WIDTH_IN,
          /* The piece AS CUT is its longest edge, whichever depth that falls
             at once both bevels are taken. */
          lengthIn: Math.max(nearEndIn - nearStartIn, farEndIn - farStartIn),
        },
        orientation: "vertical",
        position: {
          xIn,
          yIn,
          zIn: Math.min(nearStartIn, farStartIn),
          rotationDeg: 0,
          sectionCornersIn: [
            { yIn: nearYIn, zIn: nearStartIn },
            { yIn: nearYIn, zIn: nearEndIn },
            { yIn: farYIn, zIn: farEndIn },
            { yIn: farYIn, zIn: farStartIn },
          ],
        },
        role: "stud",
        qty: 1,
        notes:
          `${side} joist, ${face} member of the pair — both ends cut ` +
          `${plumb.tiltDeg.toFixed(2)}deg off square so each stands plumb. At the eave this one ` +
          `${eaveBelowSeat ? "STOPS AT THE WALL'S INSIDE FACE (it is the bottom chord, and the seat is cut from under it)" : "runs out to the fascia at the wall's outside face"}. ` +
          `Long point ${Math.max(nearEndIn - nearStartIn, farEndIn - farStartIn).toFixed(3)}in, short point ` +
          `${Math.min(nearEndIn - nearStartIn, farEndIn - farStartIn).toFixed(3)}in`,
      });
    }
  }
  return out;
}

/**
 * The clear space between the two joists, which is what every girt is cut to.
 *
 * > *"Girts should all be dynamic components kind of thing to the size of the
 * > space in-between the joists."* — Tommy, 2026-10-23
 *
 * ⚠ Before this, every girt was cut to the panel's FULL width and ran
 * straight THROUGH both joists. Measured on a 19 1/4in floor panel: 50
 * overlapping member pairs, every girt against every joist. The joists own the
 * outer 1.5in of each side for the panel's whole length, so a girt starts
 * where they end.
 */
function girtSpanIn(o: FloorRoofPanelOptions): { lengthIn: number; xIn: number } {
  return { lengthIn: o.widthIn - 2 * JOIST_2X6_THICKNESS_IN, xIn: JOIST_2X6_THICKNESS_IN };
}

/**
 * A structural girt: 3/4in CDX across the panel's section, with a 2x4 at each
 * of its left and right edges.
 *
 * > *"the 2x4s are on the left and right side, the cut edges exposed to the
 * > inside and outside of the panel"* — so the 2x4s run through the DEPTH, and
 * > *"The structural girts are vertical"*, which is that same direction once
 * > the panel is installed.
 */
function buildStructuralGirt(o: FloorRoofPanelOptions, zIn: number, label: string): PanelMember[] {
  const span = girtSpanIn(o);
  return [
    sheet(
      `structural-girt-${label}-web`,
      "girt_web",
      STRUCTURAL_GIRT_PLY_SPEC,
      { thicknessIn: STRUCTURAL_GIRT_PLY_THICKNESS_IN, widthIn: o.depthIn, lengthIn: span.lengthIn },
      { xIn: span.xIn, yIn: 0, zIn },
      "structural girt web — carries the wall above, cut to the space between the joists",
    ),
    ...([
      ["left", span.xIn],
      ["right", span.xIn + span.lengthIn - PLATE_2X4_WIDTH_IN],
    ] as [string, number][]).map(([side, xIn]) =>
      lumber(
        `structural-girt-${label}-${side}`,
        "blocking",
        "2x4",
        { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: o.depthIn },
        "horizontal",
        180,
        { xIn, yIn: 0, zIn: zIn + STRUCTURAL_GIRT_PLY_THICKNESS_IN },
        "cut ends exposed at the panel's inside and outside faces",
      ),
    ),
  ];
}

/**
 * An anti-twist girt: 5/8in OSB web with its two 2x4s HORIZONTAL.
 *
 * > *"The structural girts are vertical, all the OSB girts are horizontal
 * > 2x4s."*
 *
 * ⚠ The orientation follows the GIRT TYPE, not the panel type. I had asked
 * whether a roof's differed from a floor's, since an inclined panel has no
 * top and bottom in the same sense; his answer makes it one rule for both,
 * which is simpler than the question assumed.
 */
function buildAntiTwistGirt(o: FloorRoofPanelOptions, zIn: number, index: number): PanelMember[] {
  const span = girtSpanIn(o);
  return [
    sheet(
      `anti-twist-${index}-web`,
      "girt_web",
      ANTI_TWIST_WEB_PLY_SPEC,
      { thicknessIn: ANTI_TWIST_WEB_THICKNESS_IN, widthIn: o.depthIn, lengthIn: span.lengthIn },
      { xIn: span.xIn, yIn: 0, zIn },
      "anti-twist girt web, cut to the space between the joists",
    ),
    ...([
      ["bottom", 0],
      ["top", o.depthIn - PLATE_2X4_WIDTH_IN],
    ] as [string, number][]).map(([face, yIn]) =>
      lumber(
        `anti-twist-${index}-${face}`,
        "blocking",
        "2x4",
        { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: span.lengthIn },
        "flat",
        0,
        { xIn: span.xIn, yIn, zIn: zIn + ANTI_TWIST_WEB_THICKNESS_IN },
        `ties the ${face} chords laterally`,
      ),
    ),
  ];
}

/**
 * 2x4 blocking, cut to fit between the two 2x6s of each joist.
 *
 * > *"small piece of 2x4 cut to fit the height inbetween the 2x6s starting
 * > every 3' from the structural girt."*
 *
 * ⚠ Floors only — *"I guess we dont need blocking between the girts on the
 * roofs."* And a DIFFERENT member from the anti-twist girts, at a different
 * spacing; the first reading of this spec collapsed the two into one.
 */
function buildBlocking(o: FloorRoofPanelOptions, zIn: number, index: number): PanelMember[] {
  const fitIn = o.depthIn - 2 * JOIST_2X6_WIDTH_IN;
  if (fitIn <= 0) return [];
  return ([
    ["left", 0],
    ["right", o.widthIn - JOIST_2X6_THICKNESS_IN],
  ] as [string, number][]).map(([side, xIn]) =>
    lumber(
      `blocking-${index}-${side}`,
      "blocking",
      "2x4",
      { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: fitIn },
      "horizontal",
      90,
      { xIn, yIn: JOIST_2X6_WIDTH_IN, zIn },
      `cut to fit the ${fitIn}in between the 2x6s`,
    ),
  );
}

/**
 * A structural lid: the skin, its two 2x4 plates, and 2x4s laid face to face
 * across the whole lid.
 *
 * > *"Lets also make the interior lid structural. As many 2x4s (vertically
 * > when installed) to the face of the lid to entirely cover it - the last may
 * > need to be ripped."*
 *
 * ⚠ BOTH lids, inside and out — he was asked whether the inner one stayed
 * plain and said to make it structural too. On a 19 3/16in panel that is five
 * full 2x4s and a sixth ripped, which the builder emits at its real ripped
 * width rather than rounding the count.
 */
function buildStructuralLid(o: FloorRoofPanelOptions, atEnd: "start" | "end"): PanelMember[] {
  /* ⚠ The TALL end's lid stands PLUMB, and is the *"vertical structural top
     plate"* of his 2026-10-29 note — the same skin-plus-2x4-faces lid every
     other end gets, just stood vertical instead of square to the panel. It
     is what the membrane runs onto and what the exterior wall laps over. The
     eave end (`start`) is untouched. */
  if (atEnd === "start") {
    const eave = eaveCut(o);
    if (eave) return buildEaveEnd(o, eave);
  }
  const plumb = atEnd === "end" ? plumbEndCut(o, atEnd) : null;
  if (plumb) return buildPlumbEndPlate(o, plumb);

  const zBase = atEnd === "start" ? 0 : o.lengthIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN;
  const out: PanelMember[] = [
    sheet(
      `lid-${atEnd}-skin`,
      "skin",
      SKIN_PLY_SPEC,
      { thicknessIn: SKIN_THICKNESS_IN, widthIn: o.depthIn, lengthIn: o.widthIn },
      { xIn: 0, yIn: 0, zIn: zBase },
      `${atEnd} lid skin`,
    ),
  ];
  // The face of 2x4s, laid across the width, each running through the depth.
  let xIn = 0;
  let index = 0;
  while (xIn < o.widthIn - 1e-9) {
    const widthIn = Math.min(PLATE_2X4_WIDTH_IN, o.widthIn - xIn);
    const ripped = widthIn < PLATE_2X4_WIDTH_IN - 1e-9;
    out.push(
      lumber(
        `lid-${atEnd}-face-${index}`,
        "stud",
        "2x4",
        { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn, lengthIn: o.depthIn },
        "horizontal",
        180,
        { xIn, yIn: 0, zIn: zBase + SKIN_THICKNESS_IN },
        ripped ? `ripped to ${widthIn}in wide — the last one on the lid` : undefined,
      ),
    );
    xIn += PLATE_2X4_WIDTH_IN;
    index += 1;
  }
  return out;
}

/**
 * The tall end's vertical structural top plate: the same lid, stood plumb.
 *
 * ⚠ **Every piece here is cut LONGER than the panel is deep.** A plate
 * standing vertical against a panel leaning at the roof's pitch has to span
 * `depth / cos(pitch)` to cover it — 15 1/2in of panel needs 16 3/8in of
 * plate at 4:12. Cutting these to the panel's depth would leave the underside
 * corner open, which is the exact corner the membrane has to turn.
 */
function buildPlumbEndPlate(o: FloorRoofPanelOptions, plumb: PlumbEndCut): PanelMember[] {
  /* ⚠ Down to the WEDGE's bottom, not the panel's — the plate is the face
     the exterior wall laps over, and the wedge is part of that face — and
     cut LEVEL there, because it lands on a top plate. Each of the slab's two
     plumb edges meets that level bottom at its own depth. */
  const slab = (perpendicularStartIn: number, perpendicularEndIn: number): SectionSpacePoint2D[] => {
    const outerBottomYIn = plumb.levelBottomYIn(perpendicularStartIn);
    const innerBottomYIn = plumb.levelBottomYIn(perpendicularEndIn);
    return [
      { yIn: 0, zIn: plumb.setBackAtYIn(0, perpendicularEndIn) },
      { yIn: 0, zIn: plumb.setBackAtYIn(0, perpendicularStartIn) },
      { yIn: outerBottomYIn, zIn: plumb.setBackAtYIn(outerBottomYIn, perpendicularStartIn) },
      { yIn: innerBottomYIn, zIn: plumb.setBackAtYIn(innerBottomYIn, perpendicularEndIn) },
    ];
  };

  const out: PanelMember[] = [
    {
      memberId: `lid-${plumb.atEnd}-skin`,
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: plumb.plumbEdgeHeightIn(0), lengthIn: o.widthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0, sectionCornersIn: slab(0, SKIN_THICKNESS_IN) },
      role: "skin",
      qty: 1,
      notes: `${plumb.atEnd === "end" ? "tall-end" : "eave"} skin, standing PLUMB — cut ${plumb.plumbEdgeHeightIn(0).toFixed(3)}in, not the panel's ${o.depthIn}in depth`,
    },
  ];

  let xIn = 0;
  let index = 0;
  while (xIn < o.widthIn - 1e-9) {
    const widthIn = Math.min(PLATE_2X4_WIDTH_IN, o.widthIn - xIn);
    const ripped = widthIn < PLATE_2X4_WIDTH_IN - 1e-9;
    out.push({
      memberId: `lid-${plumb.atEnd}-face-${index}`,
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      /* ⚠ Its own edge, not the skin's. A 2x4 face sits 3/4in further in,
         and a level bottom means every plane further in is cut shorter. */
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn, lengthIn: plumb.plumbEdgeHeightIn(SKIN_THICKNESS_IN) },
      orientation: "horizontal",
      position: {
        xIn,
        yIn: 0,
        zIn: 0,
        rotationDeg: 180,
        sectionCornersIn: slab(SKIN_THICKNESS_IN, SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN),
      },
      role: "stud",
      qty: 1,
      notes: ripped
        ? `ripped to ${widthIn}in wide — the last one on the plumb ${plumb.atEnd === "end" ? "tall-end" : "eave"} plate`
        : `stands plumb against the ${plumb.atEnd === "end" ? "tall end" : "eave"}`,
    });
    xIn += PLATE_2X4_WIDTH_IN;
    index += 1;
  }
  return out;
}

/**
 * Every physical member of a floor or roof panel.
 *
 * ⚠ What this does NOT yet include, stated so nobody reads its absence as a
 * claim: the roof panel's EAVE and RIDGE CAPS. Tommy, 2026-10-22: *"the L
 * plate sits flat on the top plate and wraps up plum and has structural small
 * vertical 2x4s"*, and the ridge cap is the same part with a plumb end cut.
 * Those are an L in a vertical plane meeting an inclined panel, which needs
 * the roof's own pitch — a parameter this builder does not take yet. Built
 * next, not forgotten.
 */
export function buildFloorRoofPanelMembers(options: FloorRoofPanelOptions): PanelMember[] {
  const o = options;
  const plumb = plumbEndCut(o, "end");
  const members: PanelMember[] = [...buildJoists(o), ...buildStructuralLid(o, "start"), ...buildStructuralLid(o, "end")];
  if (plumb) members.push(...buildTallEndWedge(o, plumb));

  const girtEnds = o.kind === "roof" ? [] : (o.structuralGirtEnds ?? []);
  for (const end of girtEnds) {
    const zIn = end === "start" ? SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN : o.lengthIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN - STRUCTURAL_GIRT_TOTAL_THICKNESS_IN;
    members.push(...buildStructuralGirt(o, zIn, end));
  }

  /* ⚠ The extra girts under a column, built from exactly the same part as
     the end ones — *"more structural girts"*, his words, not a new member.
     Clamped inside the panel so a column near an end cannot push a girt out
     through the lid. */
  const firstFaceIn = SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;
  const lastFaceIn = o.lengthIn - SKIN_THICKNESS_IN - PLATE_2X4_THICKNESS_IN - STRUCTURAL_GIRT_TOTAL_THICKNESS_IN;
  for (const [i, atIn] of (o.extraStructuralGirtsAtIn ?? []).entries()) {
    const zIn = Math.min(Math.max(atIn, firstFaceIn), lastFaceIn);
    if (lastFaceIn < firstFaceIn) break;
    members.push(...buildStructuralGirt(o, zIn, `column_${i}`));
  }

  /* Both spacings are measured from the structural girt on a floor and from
     the ridge on a roof — "Girts start from the ridge every 5'". The ridge is
     the panel's own start in this frame, so both cases measure from a datum at
     one end and the loop is the same. */
  const datumIn = girtEnds.includes("start") ? SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN + STRUCTURAL_GIRT_TOTAL_THICKNESS_IN : SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN;

  /* ⚠ A PLUMB TALL END MOVES THE LAST USABLE STATION BACK, and not by the
     plate's thickness. A girt runs the panel's full depth, so the first
     thing it would hit is the plate's SHORT corner — at the underside,
     where the plumb cut has already pulled back by the full bevel. Bounding
     the loop at the panel's nominal length instead would drive the last
     girt straight through the new plate on every 4:12 roof. */
  const lastStationIn = plumb
    ? plumb.setBackAtYIn(o.depthIn, SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN)
    : o.lengthIn - PLATE_2X4_THICKNESS_IN;

  let index = 0;
  for (let zIn = datumIn + ANTI_TWIST_SPACING_IN; zIn < lastStationIn; zIn += ANTI_TWIST_SPACING_IN) {
    members.push(...buildAntiTwistGirt(o, zIn, index));
    index += 1;
  }

  if (o.kind === "floor") {
    let blockIndex = 0;
    for (let zIn = datumIn + BLOCKING_SPACING_IN; zIn < lastStationIn; zIn += BLOCKING_SPACING_IN) {
      members.push(...buildBlocking(o, zIn, blockIndex));
      blockIndex += 1;
    }
  }

  return members;
}

/**
 * Lay out one run of floor or roof panels across a building.
 *
 * The first and last panels are the narrow ones that sit under the walls; the
 * rest are field panels, with a closer at every 8ft so the plywood above keeps
 * landing on sheet edges.
 *
 * ⚠ **The 8ft datum is the first FIELD panel, not the building edge**, and
 * that is an interpretation rather than something he said. The edge panel is
 * 13.25in and carries the wall, so counting it into the sheet module would put
 * every seam at a number no diamond is near. Starting the count after it keeps
 * the field — where the diamonds actually help — on the module. Worth one
 * sentence of confirmation before this reaches a cut list.
 *
 * ⚠ **A tail narrower than the minimum is REDISTRIBUTED, not left as a
 * sliver.** Tommy, 2026-10-23: *"Real minimum is 12in for width, though it
 * should Redistribute if not possible"*. Without this a 20ft run closed with a
 * 2.25in panel, which cannot even hold its own two joists. The sliver is
 * pooled backwards into the field panels before it until the pool can be cut
 * into whole panels between the minimum and the module width, and the pool is
 * then divided as evenly as the 1/8in grid allows.
 *
 * ⚠ The redistributed tail no longer lands on the 8ft sheet module — that is
 * unavoidable, and it is why the pool grows backwards from the end rather than
 * spreading the difference over the whole run, which would move every seam.
 *
 * Returns the widths in order, or null when the run cannot be panelised: too
 * short for its two edge panels, or left with a field too small to be a panel
 * and nothing to redistribute it into.
 */
export function planFloorRoofPanelWidthsIn(runLengthIn: number, edgePanelWidthIn = FLOOR_ROOF_EDGE_PANEL_WIDTH_IN): number[] | null {
  const fieldIn = runLengthIn - 2 * edgePanelWidthIn;
  if (fieldIn < 0) return null;
  if (fieldIn === 0) return [edgePanelWidthIn, edgePanelWidthIn];

  /* ⚠ No closer panel any more. Four 24in panels are exactly 8ft, so the
     module never drifts off the sheet and there is nothing to reset. The
     whole field is one width until the run runs out. */
  const widths: number[] = [];
  let placedIn = 0;
  while (placedIn < fieldIn - 1e-9) {
    const widthIn = Math.min(FLOOR_ROOF_PANEL_WIDTH_IN, fieldIn - placedIn);
    widths.push(widthIn);
    placedIn += widthIn;
  }

  const field = redistributeNarrowTail(widths);
  if (field === null) return null;
  return [edgePanelWidthIn, ...field, edgePanelWidthIn];
}

/** His minimum, given 2026-10-23: *"Real minimum is 12in for width"*. Unlike
 * `floorRoofPanelMinimumWidthIn` — which is measured off the members and says
 * what is geometrically possible — this is a decision about what is worth
 * fabricating, and it is the wider of the two. */
export const FLOOR_ROOF_MIN_PANEL_WIDTH_IN = 12;

/**
 * Divide `totalIn` into `count` panels on the 1/8in grid, summing to exactly
 * `totalIn`.
 *
 * ⚠ Equal division almost never lands on an eighth — 40.75 over 3 is
 * 13.5833 — so the extra eighths are handed out one panel at a time and the
 * last panel absorbs any float residue by subtraction. That keeps his standing
 * rule (the parts sum to the whole, exactly) without pretending the division
 * was even.
 */
export function divideOnEighthGrid(totalIn: number, count: number): number[] {
  const eighths = Math.floor((totalIn / count) * 8) / 8;
  const parts = Array.from({ length: count }, () => eighths);
  let placed = eighths * count;
  for (let i = 0; i < count && totalIn - placed > 0.125 - 1e-9; i++) {
    parts[i] = parts[i]! + 0.125;
    placed += 0.125;
  }
  parts[count - 1] = totalIn - parts.slice(0, count - 1).reduce((a, b) => a + b, 0);
  return parts;
}

/**
 * Pool a too-narrow last panel backwards into the field until what is pooled
 * can be cut into whole panels of a legal width, then re-divide it.
 *
 * Returns the field widths, or null when there is nothing left to pool into
 * and the remainder still cannot be a panel.
 */
function redistributeNarrowTail(field: readonly number[]): number[] | null {
  const last = field[field.length - 1];
  if (last === undefined || last >= FLOOR_ROOF_MIN_PANEL_WIDTH_IN - 1e-9) return [...field];

  for (let pooled = 1; pooled <= field.length; pooled++) {
    const keep = field.slice(0, field.length - pooled);
    const totalIn = field.slice(field.length - pooled).reduce((a, b) => a + b, 0);
    /* Try the most panels the module allows first and work down, so the tail
       stays as close to 19 1/4 as it can.

       ⚠ The search has to be allowed to reach a panel WIDER than the module.
       Capping it there instead refused a 20in field outright — two panels
       would be 10in each, under his minimum, and one 20in panel was ruled out
       by a maximum he never set. Measured: it refused every run from 45 7/8
       to 50 3/8 before this. Redistribution bottoms out just under 24in,
       because above that two panels are both over the minimum and win. */
    for (let count = Math.max(1, Math.ceil(totalIn / FLOOR_ROOF_PANEL_WIDTH_IN - 1e-9)); count >= 1; count--) {
      if (totalIn / count < FLOOR_ROOF_MIN_PANEL_WIDTH_IN - 1e-9) continue;
      return [...keep, ...divideOnEighthGrid(totalIn, count)];
    }
  }
  return null;
}

/**
 * How wide to cut the FIRST sheet of plywood so every sheet after it lands on
 * a panel seam.
 *
 * > *"The installers will most likely cut the first piece of plywood to fit,
 * > so however that could work out with being on the grid."* — Tommy,
 * > 2026-10-22, settling where the 8ft module starts.
 *
 * That answer makes the datum question go away. The edge panel is 13.25in and
 * does not belong to the sheet module, so the first sheet is simply trimmed to
 * the last seam it can reach. Measured on a 40ft run: **90 1/4in**, which is
 * on the 1/8in grid, and every full sheet after it lands exactly on a seam —
 * 186.25, 282.25, 378.25, 474.25. The closer does the rest.
 *
 * Returns null when no seam falls within one sheet, which cannot happen on a
 * real building but is not worth asserting away.
 */
export function firstPlywoodSheetWidthIn(panelWidthsIn: readonly number[], sheetLengthIn = 96): number | null {
  let at = 0;
  let best: number | null = null;
  for (const widthIn of panelWidthsIn) {
    at += widthIn;
    if (at <= sheetLengthIn + 1e-9) best = at;
    else break;
  }
  return best;
}

/**
 * How far down the run the plywood keeps landing on a panel seam.
 *
 * ⚠ **Redistribution costs at most one sheet boundary, and this is what
 * reports it.** Pooling a too-narrow tail backwards eats into the last
 * complete 8ft group, so the seam that group would have closed on is gone.
 * Measured across 20–60ft runs: the panels past the last true seam come to at
 * most 105.5in, a sheet and a bit. Before redistribution the tail was a
 * sliver instead, which did not land either — so this is not a cost of
 * redistribution so much as where the run simply stops dividing by 8ft.
 *
 * Returns the distance from the start of the run, or null when not even the
 * first sheet lands on a seam.
 */
export function lastTrueSheetSeamIn(panelWidthsIn: readonly number[], sheetLengthIn = 96): number | null {
  const firstIn = firstPlywoodSheetWidthIn(panelWidthsIn, sheetLengthIn);
  if (firstIn === null) return null;

  const seams = new Set<number>();
  let at = 0;
  for (const widthIn of panelWidthsIn) {
    at += widthIn;
    seams.add(Number(at.toFixed(6)));
  }

  let last = firstIn;
  for (let next = firstIn + sheetLengthIn; seams.has(Number(next.toFixed(6))); next += sheetLengthIn) {
    last = next;
  }
  return last;
}

/* ──────────────────────────────────────────────────────────────────────────
   THE CAPS — the roof panel's two ends.

   > *"We need to put a fancy cap on the exterior/bottom side of the roof
   > panels. Something like a structural girt except perhaps it's odd angle L
   > shaped. That structural cap. The ridge cap is the same thing except to end
   > plumbing cut."*

   and, asked which leg is which:

   > *"on an installed panel roof, the L plate sits flat on the top plate and
   > wraps up plum and has structural small vertical 2x4s."*

   So the L lives in a VERTICAL plane: one leg flat on the wall's top plate,
   the other turning up plumb, stiffened by small vertical 2x4s the way a
   structural lid is. ⚠ The *"odd angle"* is not between the legs — those are
   square to each other. It is where the INCLINED PANEL meets the L, and it is
   the roof's own pitch.
   ────────────────────────────────────────────────────────────────────────── */

/** The flat leg's bearing width. Defaults to the wall depth, since it *"sits
 * flat on the top plate"* and a top plate is the full depth of its wall.
 * ⚠ A reading of his sentence, not a number he gave. */
/**
 * ⚠ **HOW FAR THE ROOF'S TOP SURFACE SITS ABOVE THE PLANE ITS HEIGHTS ARE
 * QUOTED ON — and the ONE place that number may come from.**
 *
 * It is the panel's PLUMB thickness, `depth / cos(pitch)`: 16 3/8in for a
 * 15 1/2in panel at 4:12, not 15 1/2in. A roof panel leans, so the vertical
 * distance through it is longer than it is deep.
 *
 * Two callers need it and they have to agree exactly, which is why this
 * exists rather than each doing its own trigonometry:
 *
 *  - the 3D view's roof ANCHOR, which must clear the plane by this much for
 *    the panel's underside to land on it (the anchor is the panel's TOP,
 *    because member Y runs downward once the panel is tipped);
 *  - the GABLE END's lift, which must rise by this much for its top plate to
 *    finish flush with the roof's top surface.
 *
 * They were computed separately once — one from the depth, one from the
 * plumb thickness — and the roof hung 0.84in below its own plane while the
 * gable rose the full amount. *"Gable end panels should be installed as the
 * top of the roof panels, it looks like they want to go up halfway into the
 * roof panel."* — Tommy, 2026-10-30. Flush is true by construction now:
 * both read this.
 */
export function roofTopAboveRooflineIn(panelDepthIn: number, pitchIn12: number): number {
  return (panelDepthIn * Math.hypot(12, pitchIn12)) / 12;
}

export const ROOF_CAP_SEAT_WIDTH_IN = 15.5;

export interface RoofCapGeometry {
  /** The roof's pitch, rise per 12 of run. */
  pitchIn12: number;
  /** Degrees off square that the panel meets the cap — the "odd angle". */
  panelAngleDeg: number;
  /** The flat leg, bearing on the top plate. */
  seatWidthIn: number;
  /**
   * The plumb leg's height. An inclined panel's end face stands taller than
   * the panel is deep, by exactly `1 / cos(pitch)` — the same reason a rafter
   * is longer than its run.
   */
  plumbHeightIn: number;
  /** How many small 2x4s stiffen the plumb leg, and how wide the last is cut. */
  stiffenerCount: number;
  lastStiffenerWidthIn: number;
}

/**
 * The cap's geometry for a given pitch and panel depth.
 *
 * ⚠ The EAVE and RIDGE caps are the same part — *"The ridge cap is the same
 * thing except to end plumbing cut"* — so this returns one geometry and the
 * caller says which end it is building. What differs is the end cut, not the
 * shape.
 */
export function roofCapGeometry(pitchIn12: number, panelDepthIn: number, panelWidthIn: number, seatWidthIn = ROOF_CAP_SEAT_WIDTH_IN): RoofCapGeometry {
  const panelAngleRad = Math.atan2(pitchIn12, 12);
  const full = Math.floor(panelWidthIn / PLATE_2X4_WIDTH_IN);
  const remainder = panelWidthIn - full * PLATE_2X4_WIDTH_IN;
  return {
    pitchIn12,
    panelAngleDeg: (panelAngleRad * 180) / Math.PI,
    seatWidthIn,
    plumbHeightIn: panelDepthIn / Math.cos(panelAngleRad),
    stiffenerCount: remainder > 1e-9 ? full + 1 : full,
    lastStiffenerWidthIn: remainder > 1e-9 ? remainder : PLATE_2X4_WIDTH_IN,
  };
}

/**
 * The cap's members: the plywood web, its flat seat, and the small 2x4s.
 *
 * Built in the same fabrication frame as the rest of the panel, at the Z end
 * the caller names. The plumb leg runs through Y and the seat extends beyond
 * the panel's end, which is why its members sit outside the panel box — that
 * is the point of a cap.
 */
export function buildRoofPanelCapMembers(
  options: FloorRoofPanelOptions,
  atEnd: "eave" | "ridge",
  pitchIn12: number,
): PanelMember[] {
  const geom = roofCapGeometry(pitchIn12, options.depthIn, options.widthIn);
  const zIn = atEnd === "eave" ? 0 : options.lengthIn;
  const cutNote = atEnd === "ridge" ? "plumb end cut at the ridge" : `seat cut ${geom.panelAngleDeg.toFixed(2)}deg off square`;

  const members: PanelMember[] = [
    sheet(
      `cap-${atEnd}-web`,
      "girt_web",
      STRUCTURAL_GIRT_PLY_SPEC,
      { thicknessIn: STRUCTURAL_GIRT_PLY_THICKNESS_IN, widthIn: geom.plumbHeightIn, lengthIn: options.widthIn },
      { xIn: 0, yIn: 0, zIn },
      `${atEnd} cap plumb leg — ${cutNote}`,
    ),
    /* ⚠ The seat is a SHEET, not a 2x4. He called the whole thing an "L
       plate" — a 2x4 is 3.5in wide and could not bear the 15.5in top plate
       he described it sitting flat on. */
    sheet(
      `cap-${atEnd}-seat`,
      "plate",
      STRUCTURAL_GIRT_PLY_SPEC,
      { thicknessIn: STRUCTURAL_GIRT_PLY_THICKNESS_IN, widthIn: geom.seatWidthIn, lengthIn: options.widthIn },
      { xIn: 0, yIn: 0, zIn },
      "flat leg — bears on the wall's top plate",
    ),
  ];

  let xIn = 0;
  for (let i = 0; i < geom.stiffenerCount; i++) {
    const widthIn = Math.min(PLATE_2X4_WIDTH_IN, options.widthIn - xIn);
    members.push(
      lumber(
        `cap-${atEnd}-stiffener-${i}`,
        "stud",
        "2x4",
        { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn, lengthIn: geom.plumbHeightIn },
        "horizontal",
        180,
        { xIn, yIn: 0, zIn },
        widthIn < PLATE_2X4_WIDTH_IN - 1e-9 ? `ripped to ${widthIn}in wide` : undefined,
      ),
    );
    xIn += PLATE_2X4_WIDTH_IN;
  }
  return members;
}

/**
 * The full component schema for a floor or roof panel — the shape a SketchUp
 * exporter would read `members` from, the same wrapper
 * `buildStandardPanelSchema` produces for a wall.
 *
 * ⚠ **`status: "draft"`, deliberately, and it is not pessimism.** Everything
 * here came from one verbal interview on 2026-10-22 and has not been through a
 * fabrication round. Two readings of mine are still awaiting a sentence from
 * him — the cap seat's bearing width and the direction of the 8ft closer — and
 * both are carried as notes on the schema rather than left in a comment
 * nobody exports. A panel that said "locked" while those were open would be
 * claiming a confidence nobody has.
 *
 * ⚠ **`overallDimensions` is the panel AS FABRICATED**, lying in the
 * compressor table: height is its span, depth is the 15.5in through-thickness,
 * width is the module. A roof panel is installed inclined and a floor flat,
 * but neither is built that way, and the shop drawing has to match the table.
 */
export function buildFloorRoofPanelSchema(options: FloorRoofPanelOptions, pitchIn12?: number): PanelComponentSchema {
  const isRoof = options.kind === "roof";
  /* ⚠ The pitch now reaches the MEMBERS, not just the caps: it is what
     plumb-cuts the tall end. Passing it only to the caps, as this did
     before, left the panel itself square and the cap standing against a
     corner that was not there. */
  const members = [...buildFloorRoofPanelMembers(isRoof && pitchIn12 !== undefined ? { ...options, pitchIn12 } : options)];
  if (isRoof && pitchIn12 !== undefined) {
    /* ⚠ ONLY THE EAVE CAP. *"The ridge cap is the same thing except to end
       plumbing cut"* — and the panel's own tall-end lid now IS that plumb
       cut, built as the *"vertical structural top plate"* of his 2026-10-29
       note. Adding a separate ridge cap on top of it would put two plates in
       one place, which is the overlap rule broken by duplication rather than
       by arithmetic. */
    members.push(...buildRoofPanelCapMembers(options, "eave", pitchIn12));
  }

  const notes: PanelComponentSchema["notes"] = [
    {
      type: "warning",
      text:
        "The cap's flat leg is modelled bearing the full wall depth (15.5in), read from \"the L plate sits flat on the top plate\". " +
        "A reading of his sentence, not a dimension he gave.",
    },
    {
      type: "deviation",
      text:
        `Field panels are ${FLOOR_ROOF_PANEL_WIDTH_IN}in and the edge ones are as wide as the wall is thick. Four field panels ` +
        "make exactly 8ft, so the sheathing above lands on a panel seam every sheet with no closer panel and no drift. " +
        "This replaced a 19 3/16in module whose fifth panel had to be trimmed to 19in to get back onto 96in.",
    },
  ];
  if (isRoof && pitchIn12 === undefined) {
    notes.push({
      type: "deviation",
      text: "No pitch given, so this roof panel carries NO eave or ridge cap. Their geometry depends on the pitch and cannot be guessed.",
    });
  }

  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: isRoof ? "roof_panel" : "floor_panel",
    displayName: isRoof ? "Roof Panel" : "Floor Panel",
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn: options.lengthIn, widthIn: options.widthIn, depthIn: options.depthIn },
    members,
    fasteners: [],
    notes,
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
