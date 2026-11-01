import type { PanelComponentSchema, PanelMember, PanelSpacePoint2D } from "./componentSchema";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  PLATE_END_CLEARANCE_IN,
  SKIN_PLY_SPEC,
  SKIN_THICKNESS_IN,
  GIRT_WEB_THICKNESS_IN,
  braceLongestEdgeIn,
  buildGirtRows,
  buildNailer,
  plumbEndedSlopedBoardCornersIn,
} from "./panelMemberHelpers";

/**
 * ⚠ **How many girts a gable panel gets, and where — measured off its
 * SHORT edge, not its tall point.**
 *
 * > *"If the shorter height of a stud on a Gable end panel is less than 2',
 * > then no girts are needed. I am seeing a lot of girts/noggings very close
 * > to each other on gable end panels. If the shorter stud length (or really
 * > from bottom of panel to top tip of shorter stud member) is between 2-3',
 * > then one girt should be placed, it's top height flush with the lower
 * > butt corner of that shorter stud. Gable end panels 3'+ should follow the
 * > typical girt rules (one for every 3' or less so that there are no spaces
 * > that are 3' that aren't braced laterally. Whatever the top height of the
 * > pointy tall end of a Gable end panel is is less relevant for this
 * > equation."* — Tommy, 2026-11-01
 *
 * This replaces a flat `GABLE_GIRT_ROW_COUNT = 2` — two rows spread evenly
 * over the short stud whatever its length, which is exactly why he was
 * seeing *"a lot of girts/noggings very close to each other"*: on a tile
 * whose short edge is 10in, two rows land 3in apart.
 *
 * ⚠ **The driver is the SHORT edge and he said so twice** — "the shorter
 * height of a stud", and then "whatever the top height of the pointy tall
 * end ... is less relevant". A gable tile's two edges can differ by feet,
 * and bracing the short side is what the girt is for.
 *
 * ⚠ **The middle band's girt is placed against a real feature, not a
 * fraction**: its TOP (the web's top face, since the web rests on the bars)
 * is flush with the short stud's lower butt corner. Everything above 3ft
 * falls back to the even spread every other panel uses, sized so no unbraced
 * span exceeds 3ft.
 */
export const GABLE_GIRT_NONE_BELOW_IN = 24;
export const GABLE_GIRT_SINGLE_MAX_IN = 36;
/** The standard rule's own ceiling: *"one for every 3' or less so that there
 * are no spaces that are 3' that aren't braced laterally."* */
export const GABLE_GIRT_MAX_UNBRACED_SPAN_IN = 36;

export interface GableGirtPlan {
  rowCount: number;
  /** Non-null only in the 2ft-3ft band, where the one row is placed against
   * the short stud's own top rather than at a fraction of the span. */
  centerZsIn: number[] | null;
}

/**
 * `shortStudSpanIn` is the SHORTER edge's stud span — bottom skin to the top
 * of that stud, which is his *"from bottom of panel to top tip of shorter
 * stud member"* less the bottom skin he measures from.
 */
export function gableGirtPlan(shortStudSpanIn: number): GableGirtPlan {
  /* His measurement starts at the BOTTOM OF THE PANEL, which is the outside
     of the bottom skin, while the stud starts on top of it. */
  const fromPanelBottomIn = SKIN_THICKNESS_IN + shortStudSpanIn;
  if (!(shortStudSpanIn > 0)) return { rowCount: 0, centerZsIn: null };
  if (fromPanelBottomIn < GABLE_GIRT_NONE_BELOW_IN) return { rowCount: 0, centerZsIn: null };
  if (fromPanelBottomIn <= GABLE_GIRT_SINGLE_MAX_IN) {
    /* ⚠ Solved backwards from the TOP, because that is what he specified.
       A row's top face is its web's, and the web rests on the bars — so
       centre = (that top) less half a bar less the web's own thickness. */
    const rowTopZIn = SKIN_THICKNESS_IN + shortStudSpanIn;
    const centerZIn = rowTopZIn - PLATE_2X4_THICKNESS_IN / 2 - GIRT_WEB_THICKNESS_IN;
    /* A row cannot hang below the bottom skin. Below ~2.75in of stud there
       is no room for one at all, and that is already inside the "no girts"
       band — this is a floor, not a second rule. */
    if (centerZIn - PLATE_2X4_THICKNESS_IN / 2 <= SKIN_THICKNESS_IN) return { rowCount: 0, centerZsIn: null };
    return { rowCount: 1, centerZsIn: [centerZIn] };
  }
  /* 3ft and up: the ordinary rule. n rows spread evenly leave n+1 gaps of
     span/(n+1), so the smallest n with every gap at or under 3ft is
     ceil(span / 36) - 1. */
  return { rowCount: Math.max(0, Math.ceil(shortStudSpanIn / GABLE_GIRT_MAX_UNBRACED_SPAN_IN) - 1), centerZsIn: null };
}

/**
 * Rip angle/length for a Gable End Panel's sloped top plate + top skin
 * (Tommy: "the plywood of the top plate should also be called out what
 * angle and length it should be ripped at") — pure trig off the two edge
 * heights, kept independent of the member-geometry builder so a UI can
 * show this callout without building full member geometry first.
 * `leftHeightIn`/`rightHeightIn` are the panel's own real edge heights at
 * local x=0 and x=widthIn respectively — either can be the taller one
 * (see buildGablePanelMembers's own doc comment on why order matters here
 * now). `angleDeg` is signed (positive = rising left-to-right); callers
 * that only want the physical rip magnitude (e.g. a shop-drawing callout,
 * where the cut is the same either way) should take `Math.abs()` of it.
 */
export function computeGableRipCallout(
  widthIn: number,
  leftHeightIn: number,
  rightHeightIn: number,
): { angleDeg: number; lengthIn: number } {
  const riseIn = rightHeightIn - leftHeightIn;
  return {
    angleDeg: (Math.atan2(riseIn, widthIn) * 180) / Math.PI,
    lengthIn: Math.hypot(widthIn, riseIn),
  };
}

/**
 * The 4 corner studs, left edge pair + right edge pair.
 *
 * ⚠ **The top is a REAL rake cut now, not a plain box.** It used to be
 * *"angle-cut top simplified to a plain box (not a true bevel)"*, which on a
 * 4:12 roof leaves the stud's flat top crossing the sloped skin above it by
 * half an inch over its own 1 1/2in — one corner buried in the skin and the
 * other hanging under a gap. Tommy, 2026-11-01, with a sketch: *"The corners
 * of the gable end panels are not plumb cut... This applies to any gable or
 * inclined panel."*
 *
 * The two SIDES stay plumb (a stud is vertical) and the TOP follows the
 * underside of the top skin across the stud's own thickness, so the stud and
 * the skin meet on a line instead of crossing. `topUndersideAtXIn` is handed
 * in rather than derived here, so the stud, the plates and the skin are all
 * reading one roofline.
 */
function buildGableCornerStuds(
  widthIn: number,
  depthIn: number,
  leftStudSpanIn: number,
  rightStudSpanIn: number,
  topUndersideAtXIn: (xIn: number) => number,
): PanelMember[] {
  const cornerXs: [number, number] = [0, widthIn - PLATE_2X4_THICKNESS_IN]; // [left edge, right edge]
  const cornerYs = [0, depthIn - PLATE_2X4_WIDTH_IN];
  const heights = [leftStudSpanIn, rightStudSpanIn];
  const edgeLabels = ["left", "right"];
  const members: PanelMember[] = [];
  let idx = 0;
  for (const yIn of cornerYs) {
    for (let side = 0; side < 2; side++) {
      idx++;
      /* ⚠ No stud where the panel has no height for one. The ids stay with
         their own corner (idx still advances), so `stud_corner_3` means the
         same corner whether or not its neighbour exists. */
      if (!(heights[side]! > 0)) continue;
      const nearXIn = cornerXs[side]!;
      const farXIn = nearXIn + PLATE_2X4_THICKNESS_IN;
      /* Both top corners, each read off the roofline at its own x — then
         clamped to the bottom plate, because a stud at a triangle's tip can
         have one corner above the bottom skin and the other below it. */
      const nearTopZIn = Math.max(SKIN_THICKNESS_IN, topUndersideAtXIn(nearXIn));
      const farTopZIn = Math.max(SKIN_THICKNESS_IN, topUndersideAtXIn(farXIn));
      const cornersIn: [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D] = [
        { xIn: nearXIn, zIn: SKIN_THICKNESS_IN },
        { xIn: farXIn, zIn: SKIN_THICKNESS_IN },
        { xIn: farXIn, zIn: farTopZIn },
        { xIn: nearXIn, zIn: nearTopZIn },
      ];
      const longPointIn = Math.max(nearTopZIn, farTopZIn) - SKIN_THICKNESS_IN;
      if (!(longPointIn > 0)) continue;
      members.push({
        memberId: `stud_corner_${idx}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        /* ⚠ The LONG POINT, the way every other angle-cut member in this app
           is dimensioned — a shop cuts to the long point and reads the angle
           off the note. */
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: longPointIn },
        orientation: "vertical",
        position: {
          xIn: nearXIn,
          yIn: yIn + PLATE_2X4_WIDTH_IN / 2,
          zIn: SKIN_THICKNESS_IN,
          rotationDeg: 0,
          trapezoidCornersIn: cornersIn,
          /* A stud stands on its 1 1/2in thickness and runs 3 1/2in through
             the panel — see `trapezoidDepthIn`. */
          trapezoidDepthIn: PLATE_2X4_WIDTH_IN,
        },
        role: "stud",
        qty: 1,
        notes: `${edgeLabels[side]} edge — bottom is a square cut flush to the bottom plate; top is cut to the roof rake so it lands flush on the underside of the top skin.`,
      });
    }
  }
  return members;
}

/**
 * Every physical member of a Gable End Panel (Tommy): a Standard Panel
 * core whose top is cut at the roof pitch instead of flat — trapezoidal
 * envelope, not rectangular. The left/right edge heights are supplied
 * directly per instance; no roof/ridge system exists yet to derive them
 * from automatically (see the gable-multistory-roof-strategy memory —
 * that auto-derivation from a roof pitch + bottom-of-truss height is the
 * long-term target).
 *
 * Bottom skin/plates are flat and unchanged from a Standard Panel. The 2
 * edge stud pairs each get their own height with an angle-cut top
 * (simplified to a plain box, not true beveled geometry). The top plate
 * 2x4s and top skin run the full sloped rip length, modeled as tilted
 * ("diagonal") members using the same convention as the Braced Panel's
 * brace.
 *
 * Girt rows and the optional nailer use the SHORTER edge's (more
 * conservative) stud span for vertical spacing/length, whichever end that
 * actually is — a real gable panel's taller-edge side may need additional
 * fill rows, not modeled here. Flag for refinement, same as the Braced
 * Panel's own draft status.
 */
/** A Gable End Panel is a short add-on cap sitting above the wall's own
 * eave line, not a full-height wall panel — Tommy: "gable panels...can be
 * up to 8' tall." `leftHeightIn`/`rightHeightIn` are this panel's own real
 * height at local x=0 and x=widthIn respectively — already relative to the
 * eave line (a caller subtracts the roofline's own base height before
 * calling this), and already relative to true world position (a caller
 * placing this panel at a real wall position must NOT reorder these into
 * "low then high" — a tile whose real roofline descends left-to-right
 * (e.g. one to the right of a single peak) needs `leftHeightIn >
 * rightHeightIn` here, or the built panel ends up mirrored: physically
 * correct in isolation, but facing the wrong way once placed in the real
 * scene). Either can be the taller one — there is no ordering
 * requirement. */
export const GABLE_PANEL_MAX_HEIGHT_IN = 96;

/** ⚠ The floor, and it is a GEOMETRIC one rather than a fabrication
 * judgement: a Gable End Panel's studs span its height less its two 3/4in
 * skins, so under 1 1/2in they are negative. Not a minimum anyone chose —
 * the smallest height at which the panel this builder makes still exists. */
export const GABLE_PANEL_MIN_HEIGHT_IN = 2 * SKIN_THICKNESS_IN;

export function buildGablePanelMembers(
  widthIn: number,
  depthIn: number,
  leftHeightIn: number,
  rightHeightIn: number,
  includeNailer: boolean,
): PanelMember[] {
  const tallerHeightIn = Math.max(leftHeightIn, rightHeightIn);
  /**
   * ⚠ **A PANEL WITH NO HEIGHT AT ALL IS NOT A PANEL** — but a panel with
   * ONE edge at nothing is a TRIANGLE, and that is an ordinary gable part.
   *
   * > *"We can take little gable end panels all the way to the end."*
   *
   * The first version of this guard refused on the SHORTER edge, and it was
   * wrong in a way that took the whole app down: a gable row ending at a
   * shed's low corner, and the triangular cap above a gable window that
   * reaches its own roofline, both hand this builder a legitimate 0in edge.
   * Refusing them threw inside the 3D view's render — *"This page couldn't
   * load whenever I lift my fingers off of the shape draw on mobile"* (Tommy,
   * 2026-10-31). One `Math.max(0, ...)` upstream, and the page was gone.
   *
   * So the refusal is about the PANEL: if even its taller edge cannot carry
   * its own two skins, there is nothing to build. The short edge is handled
   * where it actually bites — the corner studs there are omitted rather than
   * cut to a negative length (which IS what this used to put in the cut list:
   * `stud_corner_1 = -0.50in` at a 1in tile).
   */
  if (tallerHeightIn < GABLE_PANEL_MIN_HEIGHT_IN) {
    throw new Error(
      `Neither edge of this Gable End Panel (${leftHeightIn} and ${rightHeightIn} across ${widthIn}in) reaches the ` +
        `${GABLE_PANEL_MIN_HEIGHT_IN}in it needs for its own two skins, so there is no panel here to build. A sliver ` +
        `this short belongs in the row as a safety-gap filler, not as a fabricated panel.`,
    );
  }
  if (tallerHeightIn > GABLE_PANEL_MAX_HEIGHT_IN) {
    throw new Error(
      `The taller edge height (${tallerHeightIn}) exceeds the ${GABLE_PANEL_MAX_HEIGHT_IN}in (8ft) max a single Gable End Panel can be built at — this should be the panel's own height above the eave line, not an absolute floor height.`,
    );
  }

  const plateLengthIn = widthIn - 2 * PLATE_END_CLEARANCE_IN;
  /* ⚠ Clamped at zero, and `buildGableCornerStuds` then OMITS the pair that
     lands there. At a triangle's tip the two skins and the plates meet with
     no room between them — there is no stud, which is a different statement
     from a stud of length -1.5in. */
  const leftStudSpanIn = Math.max(0, leftHeightIn - 2 * SKIN_THICKNESS_IN);
  const rightStudSpanIn = Math.max(0, rightHeightIn - 2 * SKIN_THICKNESS_IN);
  const shorterStudSpanIn = Math.min(leftStudSpanIn, rightStudSpanIn);
  const { angleDeg: ripAngleDeg, lengthIn: ripLengthIn } = computeGableRipCallout(widthIn, leftHeightIn, rightHeightIn);
  // The top plate 2x4s must run PARALLEL to the top skin (same roof pitch,
  // just a shorter run since they're inset by PLATE_END_CLEARANCE_IN at
  // each end, same as every other plate in this app) — so their own
  // endpoint heights are read off the SAME roofline trend line the skin
  // uses (leftHeightIn -> rightHeightIn over the full widthIn), evaluated
  // at the plate's own inset x positions, not the skin's raw full-width
  // edge heights (Tommy: "the top plate's 2x4's...don't seem to be in
  // parallel with the plywood" — using the raw edge heights at an inset x
  // made the plate's own rise/run steeper than the skin's real pitch).
  const heightAtXIn = (xIn: number) => leftHeightIn + ((rightHeightIn - leftHeightIn) * xIn) / widthIn;
  const platePeakLeftIn = heightAtXIn(PLATE_END_CLEARANCE_IN);
  const platePeakRightIn = heightAtXIn(widthIn - PLATE_END_CLEARANCE_IN);
  const { angleDeg: platePlumbCutAngleDeg, lengthIn: plateRipLengthIn } = computeGableRipCallout(
    plateLengthIn,
    platePeakLeftIn,
    platePeakRightIn,
  );
  // A "plumb cut" at a sloped board's own end (where it butts a vertical
  // corner stud) needs the saw angled by the SAME pitch angle as the rip
  // itself (Tommy: "mitered plumb cut...flush to the studs") — the cut
  // face's own extra length beyond a square cut, measured across the
  // board's thickness, is thicknessIn / cos(angle).
  const plumbCutEdgeLengthIn = (thicknessIn: number) => thicknessIn / Math.cos((ripAngleDeg * Math.PI) / 180);
  /**
   * ⚠ **A PERPENDICULAR THICKNESS IS NOT A VERTICAL ONE**, and the top
   * assembly used to subtract them as if they were.
   *
   * `tiltedMember` takes a CENTRELINE and lays the board's thickness
   * perpendicular to it, so dropping a centreline by half the board's
   * thickness leaves its top face `half x (1/cos - 1)` ABOVE where it was
   * meant to be. Measured at 4:12: the top skin stood 0.020in proud of the
   * edge height it was handed, and the 2x4 plate beneath it ran 0.081in INTO
   * the skin it is supposed to sit under.
   *
   * Small numbers, and exactly the ones that stop a gable's top plate
   * finishing flush with the roof above it — which is what he asked for.
   * Dividing by cos turns a perpendicular offset into the vertical drop that
   * puts the face where it was asked for.
   */
  const verticalForPerpendicularIn = (perpendicularIn: number) => perpendicularIn / Math.cos((ripAngleDeg * Math.PI) / 180);

  /**
   * ⚠ **ONE roofline, read by the skin, the plates and the corner studs
   * alike.**
   *
   * `topAtXIn` is the panel's own top surface — the top face of the top
   * skin, which is the surface the roof above sits on and the one
   * `leftHeightIn`/`rightHeightIn` name. Everything below it is measured
   * down from there in VERTICAL inches, never perpendicular ones: a board
   * sloped at θ and cut plumb stands `thickness / cos θ` tall, and the two
   * were subtracted as if equal twice before (see
   * `verticalForPerpendicularIn` above, and the gable-roof flush junction
   * that took four passes).
   */
  const topAtXIn = (xIn: number) => leftHeightIn + ((rightHeightIn - leftHeightIn) * xIn) / widthIn;
  const skinVerticalThicknessIn = verticalForPerpendicularIn(SKIN_THICKNESS_IN);
  const plateVerticalThicknessIn = verticalForPerpendicularIn(PLATE_2X4_THICKNESS_IN);
  /** The top skin's underside: what the corner studs reach and what the top
   * plates hang beneath. */
  const topUndersideAtXIn = (xIn: number) => topAtXIn(xIn) - skinVerticalThicknessIn;

  /**
   * A sloped top board with PLUMB (vertical) ends, the shape these members'
   * own cut-list notes have been describing all along — see
   * `plumbEndedSlopedBoardCornersIn`. `tiltedMember` drew them as rectangles
   * rotated about their centres, so the ends came out square to the rip and
   * the panel's corners were visibly wrong: *"The corners of the gable end
   * panels are not plumb cut"* (Tommy, 2026-11-01).
   */
  const slopedTopBoard = (
    memberId: string,
    material: PanelMember["material"],
    plySpec: PanelMember["plySpec"],
    nominalSize: PanelMember["nominalSize"],
    perpendicularThicknessIn: number,
    crossWidthIn: number,
    fromXIn: number,
    toXIn: number,
    topAtFromXIn: number,
    centerDepthIn: number,
    role: PanelMember["role"],
    notes: string,
  ): PanelMember => {
    const verticalThicknessIn = verticalForPerpendicularIn(perpendicularThicknessIn);
    const topAtToXIn = topAtFromXIn + ((toXIn - fromXIn) * (rightHeightIn - leftHeightIn)) / widthIn;
    const cornersIn = plumbEndedSlopedBoardCornersIn(fromXIn, topAtFromXIn, toXIn, topAtToXIn, verticalThicknessIn);
    return {
      memberId,
      material,
      speciesGrade: material === "dimensional_lumber" ? LUMBER_SPECIES_GRADE : null,
      plySpec,
      nominalSize,
      actualDimsIn: {
        thicknessIn: perpendicularThicknessIn,
        widthIn: crossWidthIn,
        /* The LONG POINT — the rake-length of the board's own top edge,
           which is what a shop cuts to. */
        lengthIn: braceLongestEdgeIn(cornersIn),
      },
      orientation: "diagonal",
      position: {
        xIn: (fromXIn + toXIn) / 2,
        yIn: centerDepthIn,
        zIn: (topAtFromXIn + topAtToXIn) / 2 - verticalThicknessIn / 2,
        rotationDeg: 0,
        tiltDeg: ripAngleDeg,
        trapezoidCornersIn: cornersIn,
        /* It stands on its thickness and runs `crossWidthIn` through the
           panel's depth — see `trapezoidDepthIn`. */
        trapezoidDepthIn: crossWidthIn,
      },
      role,
      qty: 1,
      notes,
    };
  };

  const members: PanelMember[] = [
    {
      memberId: "bottom_plate_skin",
      material: "plywood",
      speciesGrade: null,
      plySpec: SKIN_PLY_SPEC,
      nominalSize: null,
      actualDimsIn: { thicknessIn: SKIN_THICKNESS_IN, widthIn: depthIn, lengthIn: widthIn },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "skin",
      qty: 1,
    },
    {
      memberId: "bottom_plate_2x4_ext",
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: plateLengthIn },
      orientation: "flat",
      position: { xIn: PLATE_END_CLEARANCE_IN, yIn: 0, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "exterior-wythe edge",
    },
    {
      memberId: "bottom_plate_2x4_int",
      material: "dimensional_lumber",
      speciesGrade: LUMBER_SPECIES_GRADE,
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn: plateLengthIn },
      orientation: "flat",
      position: { xIn: PLATE_END_CLEARANCE_IN, yIn: depthIn - PLATE_2X4_WIDTH_IN, zIn: SKIN_THICKNESS_IN, rotationDeg: 0 },
      role: "plate",
      qty: 1,
      notes: "interior-wythe edge",
    },
    ...buildGableCornerStuds(widthIn, depthIn, leftStudSpanIn, rightStudSpanIn, topUndersideAtXIn),
    slopedTopBoard(
      "top_plate_2x4_ext",
      "dimensional_lumber",
      null,
      "2x4",
      PLATE_2X4_THICKNESS_IN,
      PLATE_2X4_WIDTH_IN,
      PLATE_END_CLEARANCE_IN,
      widthIn - PLATE_END_CLEARANCE_IN,
      topUndersideAtXIn(PLATE_END_CLEARANCE_IN),
      PLATE_2X4_WIDTH_IN / 2,
      "plate",
      `exterior-wythe edge — rip parallel to the top skin, at ${platePlumbCutAngleDeg.toFixed(2)}deg, cut to ${plateRipLengthIn.toFixed(2)}in long (point to butt). Ends are plumb-cut (vertical), flush to each corner stud's face — not square to the rip — extending the board's 1.5in thickness to a ${plumbCutEdgeLengthIn(PLATE_2X4_THICKNESS_IN).toFixed(2)}in cut edge.`,
    ),
    slopedTopBoard(
      "top_plate_2x4_int",
      "dimensional_lumber",
      null,
      "2x4",
      PLATE_2X4_THICKNESS_IN,
      PLATE_2X4_WIDTH_IN,
      PLATE_END_CLEARANCE_IN,
      widthIn - PLATE_END_CLEARANCE_IN,
      topUndersideAtXIn(PLATE_END_CLEARANCE_IN),
      depthIn - PLATE_2X4_WIDTH_IN / 2,
      "plate",
      `interior-wythe edge — rip parallel to the top skin, at ${platePlumbCutAngleDeg.toFixed(2)}deg, cut to ${plateRipLengthIn.toFixed(2)}in long (point to butt). Ends are plumb-cut (vertical), flush to each corner stud's face — not square to the rip — extending the board's 1.5in thickness to a ${plumbCutEdgeLengthIn(PLATE_2X4_THICKNESS_IN).toFixed(2)}in cut edge.`,
    ),
    slopedTopBoard(
      "top_plate_skin",
      "plywood",
      SKIN_PLY_SPEC,
      null,
      SKIN_THICKNESS_IN,
      depthIn,
      0,
      widthIn,
      /* ⚠ The skin's top face IS the panel's stated edge height, exactly —
         no half-thickness correction, because the corners name the face
         rather than a centreline. That is what makes a gable's top plate
         finish flush with the roof above it, which is what he asked for and
         what the centreline reading kept missing by hundredths. */
      leftHeightIn,
      depthIn / 2,
      "skin",
      `Rip at ${ripAngleDeg.toFixed(2)}deg, cut to ${ripLengthIn.toFixed(2)}in long (point to butt). Panel-width edges are plumb-cut (vertical), flush to each corner stud's face — not square to the rip — extending the sheet's 0.75in thickness to a ${plumbCutEdgeLengthIn(SKIN_THICKNESS_IN).toFixed(2)}in cut edge.`,
    ),
    /* ⚠ Girts are spaced across the SHORTER edge's clear span, so a panel
       tapering to nothing has none: they would otherwise stack on the bottom
       skin, or (before the clamp above) sit at a negative height outside the
       panel altogether. A triangle this shallow is skins, plates and its one
       standing stud. */
    ...(() => {
      /* ⚠ By the SHORT edge, per `gableGirtPlan` — it replaced a flat two
         rows, which bunched girts inches apart on a short tile. */
      const plan = gableGirtPlan(shorterStudSpanIn);
      return buildGirtRows(plan.rowCount, widthIn, depthIn, shorterStudSpanIn, plan.centerZsIn ?? undefined);
    })(),
  ];
  if (includeNailer) members.push(buildNailer(widthIn, Math.min(leftHeightIn, rightHeightIn)));
  return members;
}

/**
 * Wraps `buildGablePanelMembers` in the full shared component schema —
 * see `buildStandardPanelSchema`'s doc comment for the same rationale.
 * `overallDimensions.heightIn` is the TALLER edge height (whichever side
 * that is) — the envelope is trapezoidal, not a uniform rectangle.
 */
export function buildGablePanelSchema(
  widthIn: number,
  depthIn: number,
  leftHeightIn: number,
  rightHeightIn: number,
  includeNailer: boolean,
): PanelComponentSchema {
  const { angleDeg: ripAngleDeg, lengthIn: ripLengthIn } = computeGableRipCallout(widthIn, leftHeightIn, rightHeightIn);
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "gable_panel",
    displayName: "Gable End Panel",
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn: Math.max(leftHeightIn, rightHeightIn), widthIn, depthIn },
    members: buildGablePanelMembers(widthIn, depthIn, leftHeightIn, rightHeightIn, includeNailer),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text:
          "Trapezoidal envelope — edge stud angle cuts are simplified to plain boxes, not true beveled geometry. " +
          "Girt rows/nailer use the shorter edge's stud span for vertical spacing, not the full slope. No diagonal " +
          "bracing — standard panel with an inclined top only, for the default construction.",
      },
      {
        type: "warning",
        text: `Top skin rip: ${Math.abs(ripAngleDeg).toFixed(2)}deg, ${ripLengthIn.toFixed(2)}in long. Left/right edge heights are ` +
          "supplied manually — no roof/ridge system exists yet to derive them automatically.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
